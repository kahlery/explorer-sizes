# Explorer Sizes

A VS Code extension: every file's and folder's size at the right of its row in the Explorer (the exact count of bytes
in its tooltip), the open folder's total in the Explorer's heading, and zebra rows.

![Explorer Sizes](images/explorer-dark.png)

VS Code lets an extension put only a character or two beside a name, so the extension patches VS Code itself
(`extension/patch.js`) when it starts: on a new machine, and again after each VS Code update. VS Code then asks to be
quit and opened again once. The checksums VS Code keeps of its files are updated with it, so it does not report
itself corrupt. The Marketplace page, `extension/README.md`, says all of this to users.

## Install from the repo

```
git clone https://github.com/kahlery/explorer-sizes ~/.vscode/explorer-sizes
code --install-extension ~/.vscode/explorer-sizes/explorer-sizes.vsix
```

Open VS Code (or reload it), quit it when it asks, and open it again.

## Build

Edit `extension/`, then

```
python3 build.py
```

packs everything under `extension/` (images included) into `explorer-sizes.vsix` and installs it. Commit both.

## Publish

```
cd extension
npx @vscode/vsce publish
```

`vsce` packs `extension/` itself, as publisher `kahlery`. The Marketplace page's screenshots are linked relatively
(`images/…`, a copy of the top-level `images/` kept in `extension/images/`); `vsce` turns them into links into this
(public) repository, where the top-level `images/` answers them.

## Undo

`Explorer Sizes: Undo VS Code Patch` from the command palette puts VS Code's own files back (uninstall the extension
too, or it patches them again). By hand: `node extension/patch.js --undo [path to VS Code's resources/app]`.
