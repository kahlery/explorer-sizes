// Patches VS Code itself so Explorer Sizes can show a whole size ("851 MB") beside a name in the Explorer. Used by
// the extension on each start (an update puts VS Code's original files back), and by hand:
//
//   node patch.js [--undo] [path to VS Code's resources/app]
//
// 1. The extension host turns away a decoration badge longer than a character or two: that check is taken out.
// 2. A folder with changed files under it (git) shows only a dot in place of its badge: such a folder keeps its own
//    badge (its size) instead, coloured as git colours it.
// 3. The Explorer's heading has the open folder's total size beside it.
// 4. Zebra rows in the Explorer.
// 5. product.json's checksums of the files changed are brought up to date, so VS Code does not call itself corrupt.
// The original of each file is kept beside it as <name>.orig (--undo puts them back).
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const MARK = "/*explorer-sizes*/";
const ID = "[\\w$]+";

const BADGE_CHECK = new RegExp(`${ID}\\.badge\\.length>${ID}(\\)throw new Error\\("The 'badge'-property must be undefined or a short character"\\))`, "g");
const BUBBLE = new RegExp(
  `if\\((${ID})\\)\\{const (${ID})=this\\.(${ID})\\.findSuperstr\\((${ID})\\);if\\(\\2\\)for\\(const (${ID}) of \\2\\)` +
    `for\\(const (${ID}) of \\5\\[1\\]\\.values\\(\\)\\)\\6&&!\\(\\6 instanceof (${ID})\\)&&\\6\\.bubble&&\\((${ID})\\.push\\(\\6\\),(${ID})=!0\\)\\}`,
  "g",
);
const NAME = new RegExp(`get name\\(\\)\\{return this\\.(${ID})\\.getWorkspaceLabel\\(this\\.(${ID})\\.getWorkspace\\(\\)\\)\\}`, "g");
const DECORATIONS = new RegExp(`this\\.B\\(this\\.(${ID})\\.registerDecorationsProvider\\(this\\.${ID}\\)\\)`, "g");
const DESCRIPTION = new RegExp(`(${ID})\\(e\\)\\{this\\.${ID}\\(e\\),this\\.${ID}\\(this\\.${ID},e\\),this\\.${ID}=e,this\\.${ID}\\.fire\\(\\)\\}`, "g");
// Stripes on the rows' container, which scrolls with them (each row is 22 px; a list's rows are reused, so a row
// cannot tell odd from even itself).
const ZEBRA = `${MARK}.explorer-folders-view .monaco-list-rows{background-image:repeating-linear-gradient(to bottom,` +
  `transparent 0 22px,color-mix(in srgb,var(--vscode-foreground) 5%,transparent) 22px 44px)}`;

// An edit: the text it gives in place of `s` and how many places it found (anything but 1 is VS Code changed).
function regex(pattern, replace) {
  return (s) => {
    const found = s.match(pattern)?.length ?? 0;
    return [found === 1 ? s.replace(pattern, replace) : s, found];
  };
}

function rootSize(s) {
  const names = [...s.matchAll(NAME)], decorations = [...s.matchAll(DECORATIONS)], descriptions = [...s.matchAll(DESCRIPTION)];
  if (names.length !== 1 || decorations.length !== 1 || descriptions.length !== 1) return [s, 0];
  const [, label, workspace] = names[0], deco = decorations[0][1], describe = descriptions[0][1];
  const show = `const __es=()=>{const f=this.${workspace}.getWorkspace().folders;if(f.length!==1)return;` +
    `const t=this.${deco}.getDecoration(f[0].uri,!1)?.tooltip||"",m=/([\\d.,]+ [KMGT]?B) \\(/.exec(t);` +
    `this.${describe}(m?m[1]:void 0)};`;
  const getter = `get name(){${MARK}this.__es||(this.__es=1,setTimeout(()=>{${show}this.B(this.${deco}.onDidChangeDecorations(` +
    `e=>{const f=this.${workspace}.getWorkspace().folders;f.length===1&&e.affectsResource(f[0].uri)&&__es()}));` +
    `__es()},0));return this.${label}.getWorkspaceLabel(this.${workspace}.getWorkspace())}`;
  return [s.replace(NAME, () => getter), 1];
}

// Each file's changes, each with the mark that shows it is already made.
const badge = regex(BADGE_CHECK, (_, rest) => "!1" + MARK + rest);
const PATCHES = {
  "vs/workbench/api/node/extensionHostProcess.js": [["!1" + MARK, badge]],
  "vs/workbench/api/worker/extensionHostWorkerMain.js": [["!1" + MARK, badge]],
  "vs/workbench/workbench.desktop.main.css": [[MARK + ".explorer-folders-view", (s) => [s + "\n" + ZEBRA + "\n", 1]]],
  "vs/workbench/workbench.desktop.main.js": [
    [`if(t){${MARK}`, regex(BUBBLE, (m, on, found, tree, uri, entry, d, pend, list, children) =>
      `if(${on}){${MARK}const __own=${list}.some(x=>x.letter);const ${found}=this.${tree}.findSuperstr(${uri});` +
      `if(${found})for(const ${entry} of ${found})for(const ${d} of ${entry}[1].values())${d}&&!(${d} instanceof ${pend})` +
      `&&${d}.bubble&&(__own?${list}.push({...${d},letter:void 0}):(${list}.push(${d}),${children}=!0))}`)],
    ["get name(){" + MARK, rootSize],
  ],
};
const HOST = "vs/workbench/api/node/extensionHostProcess.js";

function checksum(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("base64").replace(/=+$/, "");
}

function keepOriginal(file) {
  if (!fs.existsSync(file + ".orig")) fs.copyFileSync(file, file + ".orig");
}

function updateChecksums(app) {
  const productPath = path.join(app, "product.json");
  let text = fs.readFileSync(productPath, "utf8");
  const before = text;
  for (const [rel, old] of Object.entries(JSON.parse(text).checksums || {})) {
    const file = path.join(app, "out", rel);
    if (!fs.existsSync(file)) continue;
    const now = checksum(file);
    if (now !== old) text = text.replace(`"${old}"`, `"${now}"`);
  }
  if (text !== before) {
    keepOriginal(productPath);
    fs.writeFileSync(productPath, text);
  }
}

// Whether VS Code at `app` has the badge check taken out (the extension host started from it then allows long badges).
function hostPatched(app) {
  try {
    return fs.readFileSync(path.join(app, "out", HOST), "utf8").includes("!1" + MARK);
  } catch {
    return false;
  }
}

// Makes whatever changes are missing: { patched: files changed now, failed: [file, why] }.
function apply(app) {
  const patched = [], failed = [];
  for (const [rel, edits] of Object.entries(PATCHES)) {
    const file = path.join(app, "out", rel);
    if (!fs.existsSync(file)) continue;
    let s = fs.readFileSync(file, "utf8"), made = 0;
    for (const [mark, edit] of edits) {
      if (s.includes(mark)) continue;
      const [next, found] = edit(s);
      if (found !== 1) {
        failed.push([rel, `found ${found} places (VS Code changed this code)`]);
        continue;
      }
      s = next;
      made++;
    }
    if (made) {
      try {
        keepOriginal(file);
        fs.writeFileSync(file, s);
        patched.push(rel);
      } catch (error) {
        failed.push([rel, error.message]);
      }
    }
  }
  if (patched.length) updateChecksums(app);
  return { patched, failed };
}

function undo(app) {
  const restored = [];
  for (const rel of Object.keys(PATCHES).map((r) => path.join("out", r)).concat("product.json")) {
    const file = path.join(app, rel);
    if (fs.existsSync(file + ".orig")) {
      fs.renameSync(file + ".orig", file);
      restored.push(rel);
    }
  }
  return restored;
}

function defaultApp() {
  if (process.platform === "darwin") return "/Applications/Visual Studio Code.app/Contents/Resources/app";
  if (process.platform === "win32") return path.join(process.env.LOCALAPPDATA || "", "Programs", "Microsoft VS Code", "resources", "app");
  return "/usr/share/code/resources/app";
}

module.exports = { apply, undo, hostPatched };

if (require.main === module) {
  const args = process.argv.slice(2);
  const app = args.find((a) => !a.startsWith("--")) || defaultApp();
  if (args.includes("--undo")) {
    for (const rel of undo(app)) console.log("restored", rel);
  } else {
    const { patched, failed } = apply(app);
    for (const rel of patched) console.log("patched", rel);
    for (const [rel, why] of failed) console.log(`could not patch ${rel}: ${why}`);
    if (!patched.length && !failed.length) console.log("already patched");
    else if (patched.length) console.log("done: quit VS Code and open it again");
    process.exitCode = failed.length ? 1 : 0;
  }
}
