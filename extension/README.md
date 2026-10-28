# Explorer Sizes

Every file's and folder's size beside its name in the Explorer (`851 MB`; the exact count of bytes in its tooltip),
the open folder's total in the Explorer's heading, and zebra rows to keep the eye on a line.

## It patches VS Code

VS Code lets an extension put only a character or two beside a name. So this extension changes VS Code's own files
when it starts (and again after each VS Code update, which puts them back): it takes that limit out, lets a folder
with changed files under it keep its size instead of git's dot, puts the total in the heading and draws the stripes.
The checksums VS Code keeps of its files are updated with it, so VS Code does not report itself corrupt. VS Code asks
to be quit and opened again once after each patch.

VS Code must be installed where it can write to its own files (the usual user install does; a system-wide install
under Program Files does not, and the extension says so).

## Commands

- **Explorer Sizes: Refresh**: works every size out again (sizes under folders VS Code does not watch, see
  `files.watcherExclude`, do not follow changes by themselves).
- **Explorer Sizes: Undo VS Code Patch**: puts VS Code's own files back. Uninstall the extension too, or it patches
  them again on the next start.
