import child_process from "child_process";
import fs from "fs-extra";
import { Logger } from "./utils";

// This script is created to help translating pokemon names
//
// Usage: npm run translate <lang: language>
// Possible languages can be found in the texts/languages.json
//
// Use npm run translate <lang: language> stat to see translation progress.
//
// It can be possibly extended to fetch content from https://github.com/smogon/pokemon-showdown/tree/master/data/text

async function main() {
  const targetName = process.argv[2];
  if (!allLangs.includes(targetName)) {
    return Logger.critical(
      `Target language name ${targetName} does not exists in the list:\n${allLangs.join(
        "\n"
      )}`
    );
  }

  const file = `texts/${targetName}.lang`;

  if (process.argv[3] === "stat") {
    const enStrings: Record<string, string> = {};

    await forEachLangFileEntry(
      "texts/en_US.lang",
      (langKey, value) => (enStrings[langKey] = value)
    );

    let translated = 0;
    const { strings } = await forEachLangFileEntry(file, (langKey, value) => {
      if (value !== enStrings[langKey]) translated++;
    });

    Logger.info(
      `Stat: ${((translated / strings) * 100).toFixed(2)}% translated.`
    );
    return;
  }

  if (child_process.execSync(`git diff --name-only ${file}`).toString()) {
    return Logger.critical(
      `File ${file} has been changed by user. Commit it to the git using 'git commit -a "Updated ${file}"' and then run this script again.`
    );
  }

  async function getFromCobblemon(lang: string) {
    const source = `https://gitlab.com/cable-mc/cobblemon/-/raw/main/common/src/main/resources/assets/cobblemon/lang/${lang.toLowerCase()}.json?ref_type=heads&inline=false`;
    Logger.info(`Fetching ${lang} language file...`);

    return await (await fetch(source)).json();
  }

  const en = await getFromCobblemon("en_US");
  const target = await getFromCobblemon(targetName);

  Logger.info(
    `Fetched successfully. Total keys of en: ${
      Object.keys(en).length
    }. Total keys of ${targetName}: ${Object.keys(target).length}`
  );

  const enValues = Object.fromEntries(
    Object.entries(en).map(([key, value]) => [value, key])
  );

  let stringsFromCobblemon = 0;
  let stringsFromCobblemonInTarget = 0;
  let translated = 0;

  const { lines, strings, unparsed } = await forEachLangFileEntry(
    file,
    (langKey, value, comment, lines, i) => {
      if (!(value in enValues)) return;

      stringsFromCobblemon++;
      const key = enValues[value];
      if (!(key in target)) return;

      stringsFromCobblemonInTarget++;
      if (target[key] === en[key]) return;

      translated++;
      lines[i] = `${langKey}=${target[key]}${comment || ""}`;
    }
  );

  if (unparsed.length) {
    Logger.warn(
      `Unable to parse ${unparsed.length} lines. Please check that they match the pattern key=value.`
    );
    Logger.warn(`Lines that failed to parse:\n${unparsed.join("\n")}`);
  }

  Logger.info(
    `Strings from cobblemon total: ${stringsFromCobblemon}, strings from cobblemon in target language: ${stringsFromCobblemonInTarget}`
  );
  Logger.info(" ");
  Logger.info(
    `Total of ${translated}/${strings} strings were translated successfully. That is ${(
      100 *
      (translated / strings)
    ).toFixed(2)}% of total strings.`
  );

  fs.writeFile(file, lines.join("\n"));
}

const allLangs = [
  "en_US",
  "en_GB",
  "de_DE",
  "es_ES",
  "es_MX",
  "fr_FR",
  "fr_CA",
  "it_IT",
  "ja_JP",
  "ko_KR",
  "pt_BR",
  "pt_PT",
  "ru_RU",
  "zh_CN",
  "zh_TW",
  "nl_NL",
  "bg_BG",
  "cs_CZ",
  "da_DK",
  "el_GR",
  "fi_FI",
  "hu_HU",
  "id_ID",
  "nb_NO",
  "pl_PL",
  "sk_SK",
  "sv_SE",
  "tr_TR",
  "uk_UA",
];

main();

async function forEachLangFileEntry(
  file: string,
  callback: (
    langKey: string,
    value: string,
    comment: undefined | string,
    lines: string[],
    i: number
  ) => void
) {
  if (!fs.existsSync(file)) fs.copySync("texts/en_US.lang", file);
  const lines = (await fs.readFile(file, "utf-8")).split("\n");

  Logger.info(`${file} has total of ${lines.length} lines.`);

  let unparsed: number[] = [];
  let strings = 0;
  for (const [i, line] of lines.entries()) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;

    const parsed = /([^=]+)=([^\r]+)(.+)?/.exec(line);
    if (!parsed) {
      unparsed.push(i);
      continue;
    }

    const [, langkey, value, comment] = parsed;
    strings++;
    callback(langkey, value, comment, lines, i);
  }

  return { unparsed, strings, lines };
}
