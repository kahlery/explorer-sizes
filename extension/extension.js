// Shows each file's and folder's size beside its name in the Explorer, the exact count of bytes in its tooltip.
// VS Code allows a decoration's badge only a character or two: patch.js lifts that limit in VS Code itself.
const vscode = require("vscode");
const fs = require("fs/promises");
const path = require("path");
const patch = require("./patch");

const sizes = new Map(); // path -> bytes, a folder's being everything under it
const pending = new Map(); // path -> the walk working it out
const changed = new vscode.EventEmitter();

// At most this many lstats and readdirs at once, so a big tree does not run out of file handles.
let running = 0;
const waiting = [];
async function limited(job) {
  if (running >= 32) await new Promise((go) => waiting.push(go));
  running++;
  try {
    return await job();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

function sizeOf(p) {
  if (sizes.has(p)) return Promise.resolve(sizes.get(p));
  if (pending.has(p)) return pending.get(p);
  const walk = (async () => {
    const stat = await limited(() => fs.lstat(p)).catch(() => null);
    if (!stat) return undefined;
    let total = stat.size;
    if (stat.isDirectory()) {
      const names = await limited(() => fs.readdir(p)).catch(() => []);
      const parts = await Promise.all(names.map((name) => sizeOf(path.join(p, name))));
      total = parts.reduce((sum, bytes) => sum + (bytes || 0), 0);
    }
    if (pending.get(p) === walk) {
      sizes.set(p, total);
      pending.delete(p);
    }
    return total;
  })();
  pending.set(p, walk);
  return walk;
}

function human(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes, i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  const shown = i === 0 || value >= 100 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, "");
  return `${shown} ${units[i]}`;
}

function inWorkspace(p) {
  return (vscode.workspace.workspaceFolders || []).some((folder) => {
    const rel = path.relative(folder.uri.fsPath, p);
    return !rel.startsWith("..") && !path.isAbsolute(rel);
  });
}

// A change somewhere: forget it, whatever was under it, and the folders above it, and redraw those.
let queued = new Set(), timer;
function forget(uri) {
  const p = uri.fsPath;
  for (const key of sizes.keys()) if (key === p || key.startsWith(p + path.sep)) sizes.delete(key);
  pending.delete(p);
  for (let up = p; inWorkspace(up); up = path.dirname(up)) {
    sizes.delete(up);
    pending.delete(up);
    queued.add(up);
    if (path.dirname(up) === up) break;
  }
  clearTimeout(timer);
  timer = setTimeout(() => {
    changed.fire([...queued].map((q) => vscode.Uri.file(q)));
    queued = new Set();
  }, 800);
}

// VS Code patched as patch.js has it, now if it is not (new, or just updated): true when this window's extension
// host already allows long badges.
function patchVSCode() {
  const app = vscode.env.appRoot;
  const ready = patch.hostPatched(app);
  const { patched, failed } = patch.apply(app);
  if (failed.length) {
    vscode.window.showWarningMessage(`Explorer Sizes could not patch VS Code: ${failed.map(([rel, why]) => `${rel}: ${why}`).join("; ")}`);
  } else if (patched.length) {
    vscode.window.showInformationMessage("Explorer Sizes patched VS Code: quit and open it again to see the sizes.", "Quit VS Code")
      .then((choice) => choice && vscode.commands.executeCommand("workbench.action.quit"));
  }
  return ready;
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("explorerSizes.undoPatch", () => {
      const restored = patch.undo(vscode.env.appRoot);
      vscode.window.showInformationMessage(restored.length
        ? "VS Code's own files are back: uninstall Explorer Sizes (or it patches them again), then quit and open VS Code again."
        : "VS Code was not patched.");
    }),
  );
  // Without the patch VS Code turns the sizes away (and logs an error for each), so none are given until it is in.
  if (!patchVSCode()) return;
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider({
      onDidChangeFileDecorations: changed.event,
      async provideFileDecoration(uri) {
        if (uri.scheme !== "file" || !inWorkspace(uri.fsPath)) return undefined;
        const bytes = await sizeOf(uri.fsPath);
        if (bytes === undefined) return undefined;
        return new vscode.FileDecoration(human(bytes), `${human(bytes)} (${bytes.toLocaleString("en-US")} bytes)`);
      },
    }),
  );
  const watcher = vscode.workspace.createFileSystemWatcher("**/*");
  watcher.onDidCreate(forget);
  watcher.onDidChange(forget);
  watcher.onDidDelete(forget);
  context.subscriptions.push(
    watcher,
    changed,
    vscode.commands.registerCommand("explorerSizes.refresh", () => {
      sizes.clear();
      pending.clear();
      changed.fire(undefined);
    }),
  );
}

module.exports = { activate, deactivate() {} };
