import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const head = git("rev-parse", "HEAD");
const branch = git("branch", "--show-current");
let main = "nicht lokal bekannt", distance = "unbekannt";
try {
  main = git("rev-parse", "origin/main");
  distance = git("rev-list", "--left-right", "--count", "HEAD...origin/main").replace(/\s+/, " vor / ") + " hinter origin/main";
} catch { /* Eine Kopie ohne Remote behauptet keinen Merge-Stand. */ }
const changed = git("status", "--porcelain", "--untracked-files=normal").split("\n").filter(Boolean).length;
const stand = JSON.parse(readFileSync(resolve(root, ".claude/stand.json"), "utf8"));
const decisions = pathToFileURL(resolve(root, "docs/PAWN-ENTSCHEIDUNGEN.md")).href;
const source = pathToFileURL(resolve(root, ".claude/stand.json")).href;
const marker = "<!-- pawn-projektstand: automatisch -->";
const text = `${marker}
# PAWN — aktueller Arbeitsstand

Erzeugt: ${new Date().toISOString()}. Lokale Git-Referenzen; kein automatischer Fetch.
Live-Auslieferung und Datenbank werden hier nicht geprueft.

- Arbeitskopie: ${root.replaceAll("\\", "/")}
- Branch: ${branch || "(direkter Commit)"}
- Commit: ${head}
- Zuletzt lokal bekannter Hauptzweig: ${main}
- Abstand: ${distance}
- Dateien mit lokalen Aenderungen: ${changed}
- Uebergabe zuletzt gepflegt: ${stand.aktualisiert || "nicht angegeben"}

[Produktentscheidungen](<${decisions}>) · [Technische Uebergabe](<${source}>)

## Naechster Einstieg

Im Repository \`npm run stand\` ausfuehren. Nach einem Fetch erneut erzeugen.
Eine gemergte PR beweist weder einen Backend-Deploy noch eine ausgefuehrte Migration.
Dieser Schnappschuss wird ersetzt; eigene Notizen bitte in PAWN.md fuehren.
`;
const at = process.argv.indexOf("--vault");
if (at >= 0) {
  if (!process.argv[at + 1]) throw new Error("--vault braucht einen vorhandenen Obsidian-Ordner.");
  const vault = resolve(process.argv[at + 1]);
  if (!existsSync(resolve(vault, ".obsidian"))) throw new Error("Kein bestaetigter Obsidian-Vault.");
  const dir = resolve(vault, "04-projekte/pawn");
  mkdirSync(dir, { recursive: true });
  const target = resolve(dir, "PAWN — Stand (automatisch).md");
  if (existsSync(target) && !readFileSync(target, "utf8").startsWith(marker)) throw new Error("Vorhandene fremde Notiz wird nicht ueberschrieben.");
  writeFileSync(target, text);
  console.log(target);
} else {
  console.log(text);
}
