# Explorer Sizes

Every file's and folder's size beside its name in VS Code's Explorer (`851 MB`, the exact count of bytes in its
tooltip), the open folder's total in the Explorer's heading, and zebra rows.

VS Code lets an extension put only a character or two beside a name, so the extension patches VS Code itself
(`extension/patch.js`) when it starts: on a new machine, and again after each VS Code update. VS Code then asks to be
quit and opened again once. The checksums VS Code keeps of its files are updated with it, so it does not report
itself corrupt.

## Install

```
git clone https://github.com/kahlery/explorer-sizes ~/.vscode/explorer-sizes
code --install-extension ~/.vscode/explorer-sizes/explorer-sizes.vsix
```

Open VS Code (or reload it), quit it when it asks, and open it again.

## Change it

Edit `extension/`, then `python3 build.py` packs `explorer-sizes.vsix` and installs it; commit both.

## Undo

`Explorer Sizes: Undo VS Code Patch` from the command palette puts VS Code's own files back (uninstall the extension
too, or it patches them again). By hand: `node extension/patch.js --undo [path to VS Code's resources/app]`.

Sizes under folders VS Code does not watch (`files.watcherExclude`) do not follow changes: `Explorer Sizes: Refresh`.
