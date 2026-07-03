// Собирает markdown-файлы скиллов из skills/ в один JS-модуль api/_lib/skills.js,
// чтобы serverless-функции Vercel получали контент скиллов без чтения с диска.
import { readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsDir = join(root, "skills");

function readSkill(name) {
  const dir = join(skillsDir, name);
  const parts = [readFileSync(join(dir, "SKILL.md"), "utf8")];
  const refsDir = join(dir, "references");
  try {
    if (statSync(refsDir).isDirectory()) {
      for (const f of readdirSync(refsDir).sort()) {
        parts.push(
          `\n\n---\n# Reference: ${f}\n\n` + readFileSync(join(refsDir, f), "utf8")
        );
      }
    }
  } catch {
    // нет references — только SKILL.md
  }
  return parts.join("");
}

const names = readdirSync(skillsDir).filter((n) =>
  statSync(join(skillsDir, n)).isDirectory()
);

let out = "// Сгенерировано scripts/embed-skills.mjs — не редактировать вручную.\n";
out += "export const SKILLS = {\n";
for (const name of names.sort()) {
  const key = name.replace(/-/g, "_");
  out += `  ${key}: ${JSON.stringify(readSkill(name))},\n`;
}
out += "};\n";

writeFileSync(join(root, "api", "_lib", "skills.js"), out);
console.log(`Embedded ${names.length} skills: ${names.join(", ")}`);
