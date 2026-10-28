// Patches VS Code itself so Explorer Sizes can show a whole size ("851 MB") beside a name in the Explorer. Used by
// the extension on each start (an update puts VS Code's original files back), and by hand:
//
//   node patch.js [--undo] [path to VS Code's resources/app]
//
// 1. The extension host turns away a decoration badge longer than a character or two: that check is taken out.
// 2. A folder with changed files under it (git) shows only a dot in place of its badge: such a folder keeps its own
//    badge (its size) instead, coloured as git colours it.
// 3. The open folder's total size beside its name at the top: in the title bar's command center, and in the
//    Explorer's heading when that is shown (read from the extension's status bar item, which is hidden then).
// 4. product.json's checksums of the files changed are brought up to date, so VS Code does not call itself corrupt.
// The original of each file is kept beside it as <name>.orig (--undo puts them back).
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// The patch's own version: a file patched by an earlier one is patched again from its original.
const MARK = "/*explorer-sizes:8*/";
const ANY_MARK = "/*explorer-sizes";
const ID = "[\\w$]+";

const BADGE_CHECK = new RegExp(`${ID}\\.badge\\.length>${ID}(\\)throw new Error\\("The 'badge'-property must be undefined or a short character"\\))`, "g");
const BUBBLE = new RegExp(
  `if\\((${ID})\\)\\{const (${ID})=this\\.(${ID})\\.findSuperstr\\((${ID})\\);if\\(\\2\\)for\\(const (${ID}) of \\2\\)` +
    `for\\(const (${ID}) of \\5\\[1\\]\\.values\\(\\)\\)\\6&&!\\(\\6 instanceof (${ID})\\)&&\\6\\.bubble&&\\((${ID})\\.push\\(\\6\\),(${ID})=!0\\)\\}`,
  "g",
);
// The extension's status bar item, read for the heading's total (see TOTAL), is hidden once VS Code is patched; the
// total is styled as a pane heading's own description is.
const HIDE_TOTAL = `${MARK}.statusbar-item[id$="explorerSizes.total"]{display:none!important}` +
  `.explorer-sizes-total{flex-shrink:0;font-weight:400;margin-left:6px;opacity:.6;text-transform:none;white-space:nowrap}` +
  `.pane-header .explorer-sizes-total{margin-left:10px}` +
  `[data-explorer-sizes-total]::after{content:attr(data-explorer-sizes-total);font-weight:400;margin-left:6px;opacity:.6}`;

// An edit: the text it gives in place of `s` and how many places it found (anything but 1 is VS Code changed).
function regex(pattern, replace) {
  return (s) => {
    const found = s.match(pattern)?.length ?? 0;
    return [found === 1 ? s.replace(pattern, replace) : s, found];
  };
}

// The total, put beside the open folder's name at the top: after the window's title ("exfilon 1.3 GB") or the title
// bar's command center when that is on, and in the Explorer's own heading when that is shown (VS Code hides it,
// merged into the side bar's title, when the Explorer is the only view open there). VS Code rewrites the title's
// text as it changes, so there the total is an attribute its CSS shows after the text (see HIDE_TOTAL). Read from the extension's own status bar item (its element's id ends in
// "explorerSizes.total", its text "exfilon 1.3 GB", which works without the patch), and written into a span of its own
// after each name. It runs only when the title bar, the status bar or the side bar change (watched for that, once
// they are there, and at most once a frame), never while VS Code sits idle. It leans on the page, not on VS Code's
// code, so it is the same in every version. A failure is logged, tagged.
const TOTAL = `;${MARK}(()=>{const put=(n,v)=>{let e=n.parentElement.querySelector(":scope>.explorer-sizes-total");` +
  `if(!e){if(!v)return;e=document.createElement("span");e.className="explorer-sizes-total";n.after(e)}` +
  `e.textContent!==v&&(e.textContent=v)};` +
  `const t=()=>{try{const i=document.querySelector('.statusbar-item[id$="explorerSizes.total"]'),` +
  `m=/([\\d.,]+ [KMGT]?B)\\s*$/.exec(i?.textContent||""),v=m?m[1]:"";` +
  `for(const n of document.querySelectorAll(".part.titlebar .window-title:not(:has(.command-center)),.command-center .search-label"))` +
  `v?n.dataset.explorerSizesTotal!==v&&(n.dataset.explorerSizesTotal=v):delete n.dataset.explorerSizesTotal;` +
  `for(const h of document.querySelectorAll(".pane-header:not(.hidden)")){const n=h.querySelector("h3.title");` +
  `n&&h.parentElement?.querySelector(".explorer-folders-view")&&put(n,v)}}` +
  `catch(x){console.error("[explorer-sizes]",x)}};` +
  `let q=0;const run=()=>{q||(q=1,requestAnimationFrame(()=>{q=0;t()}))};` +
  `const watch=()=>{const p=document.querySelectorAll(".part.titlebar,.part.statusbar,.part.sidebar");` +
  `if(p.length<3)return setTimeout(watch,500);const o=new MutationObserver(run);` +
  `for(const e of p)o.observe(e,{childList:!0,subtree:!0,characterData:!0,attributes:!0,attributeFilter:["class"]});t()};` +
  `watch()})();`;

// Each file's changes, each with the mark that shows it is already made.
const badge = regex(BADGE_CHECK, (_, rest) => "!1" + MARK + rest);
const PATCHES = {
  "vs/workbench/api/node/extensionHostProcess.js": [["!1" + MARK, badge]],
  "vs/workbench/api/worker/extensionHostWorkerMain.js": [["!1" + MARK, badge]],
  "vs/workbench/workbench.desktop.main.css": [[MARK + ".statusbar-item", (s) => [s + "\n" + HIDE_TOTAL + "\n", 1]]],
  "vs/workbench/workbench.desktop.main.js": [
    [`if(t){${MARK}`, regex(BUBBLE, (m, on, found, tree, uri, entry, d, pend, list, children) =>
      `if(${on}){${MARK}const __own=${list}.some(x=>x.letter);const ${found}=this.${tree}.findSuperstr(${uri});` +
      `if(${found})for(const ${entry} of ${found})for(const ${d} of ${entry}[1].values())${d}&&!(${d} instanceof ${pend})` +
      `&&${d}.bubble&&(__own?${list}.push({...${d},letter:void 0}):(${list}.push(${d}),${children}=!0))}`)],
    [";" + MARK + "(()=>", (s) => [s + "\n" + TOTAL + "\n", 1]],
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
    return fs.readFileSync(path.join(app, "out", HOST), "utf8").includes("!1" + ANY_MARK);
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
    if (s.includes(ANY_MARK) && !edits.every(([mark]) => s.includes(mark)) && fs.existsSync(file + ".orig")) {
      s = fs.readFileSync(file + ".orig", "utf8");
      made = 1;
    }
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
