# FoldNote: Build Plan

## How the coding agent should work

1. Work **one chapter at a time**, in order.
2. **Before starting a chapter, ask Derick every question listed under its "Ask first" heading.** Propose the suggested default so he can answer quickly. Do not guess.
3. Each chapter must leave the extension in a **working, runnable state**.
4. When a chapter's checklist is done, **commit the code** using the commit message given at the end of the chapter, then stop and confirm before starting the next one.
5. Keep this file updated: tick `[x]` as items finish, and record Derick's answers under each chapter.

Legend: `[ ]` not started, `[x]` done, ❓ = open question to ask Derick

---

## Decisions already made (do not re-ask)

- Folders and highlights are two kinds of one **annotation** model; each annotation has a unique ID (UUID).
- Files are identified by **workspace-relative path**; annotations are grouped under their file.
- Data is stored in the **extension's own storage** (not in the project), as JSON with a `schemaVersion`. No custom file format.
- Load once at startup into memory (lookups by path and by ID); save **debounced**, and flush on shutdown.
- Folders must **nest cleanly**. A new folder that partially overlaps an existing one is **rejected with a notification** naming the conflicting folder and its lines. Highlights may overlap freely.
- Edits that break a folder mark it **conflicted** (kept, flagged with a warning). Unfolding a conflicted folder deletes it. Normal folders are *not* deleted by unfolding.
- Folding uses VS Code's **folding range provider** plus the built-in fold/unfold commands. The note label is drawn with a **decoration**. A **CodeLens** is the clickable indicator that opens the sidebar on that folder.
- Sidebar: tree view, files at the top, nested folders as children (nesting derived from ranges at runtime, no stored parent ID), unfold and delete actions.
- Target: VS Code and compatible forks on `^1.80.0`.

---

## Chapter 0: Project Setup

- [x] Scaffold the extension in TypeScript
- [x] Set engine to `^1.80.0`
- [x] Folder structure: `commands/`, `model/`, `storage/`, `views/`, `providers/`, `utils/`
- [x] Linting, formatting, and a basic test runner
- [x] Add `.gitignore`, `LICENSE` (MIT), and the README
- [x] Confirm the extension activates and a hello-world command runs

**Answers**
1. npm + esbuild
2. Publisher: `der-feb`, display name: `FoldNote`
3. Mocha via `@vscode/test-electron`

**Commit:** `chore: scaffold FoldNote extension`

---

## Chapter 1: Prototype Spike (riskiest piece first)

Goal: prove the core mechanism works before building on it. Use **hardcoded** data.

- [ ] Register a folding range provider returning one hardcoded range
- [ ] Fire the provider's change event and confirm VS Code re-asks for ranges
- [ ] Run the built-in fold command on that range's start line
- [ ] Draw a note label at the end of the folded line using a decoration
- [ ] Add a CodeLens above the line that runs a test command when clicked
- [ ] Test in at least **TypeScript, Python, and Markdown**: does the custom range coexist with each language's own folding?
- [ ] Observe how to detect fold/unfold changes (visible-range changes) and write down what works
- [ ] Write findings in a short `docs/spike-notes.md`

**❓ Ask first**
1. Which editors do you want tested besides VS Code (Cursor, Trae, VSCodium)? *Suggested: VS Code now, one fork in Chapter 9.*

**❓ Ask after (decision gate)**
1. If the provider clashes with a language's built-in folding, how should we handle it? Share the spike results and propose options before continuing.

**Commit:** `feat: prototype folding provider, label decoration, and CodeLens`

---

## Chapter 2: Data Model & Store

- [ ] Define types: annotation (id, file, range, kind, note, color, anchor, status, timestamps)
- [ ] Define the stored shape: `schemaVersion` plus `files → path → annotations`
- [ ] Workspace-relative path helper (handle multi-root workspaces)
- [ ] In-memory store with lookups by path and by ID: add, update, remove, list
- [ ] Load once on startup (without blocking activation)
- [ ] Debounced save, plus flush on deactivate
- [ ] Migration scaffold for future `schemaVersion` changes
- [ ] Overlap checker (nested, partial, identical, adjacent) as pure functions
- [ ] Unit tests for the overlap checker (every case) and the store

**❓ Ask first**
1. Where exactly should the data be stored: the editor's per-workspace state, or a JSON file in the extension's storage folder? *Suggested: per-workspace state, since it needs no file handling.*
2. Multi-root workspaces: store the path relative to its own root and include the root's name? *Suggested: yes.*
3. Untitled/unsaved documents: should they be blocked from getting folders? *Suggested: block with a clear message.*
4. Should the same project opened at a different location keep its notes? *Suggested: yes, via relative paths; confirm that matches how you work.*

**Commit:** `feat: annotation data model, store, and overlap checker`

---

## Chapter 3: Create Folders

- [ ] Command `Fold Selection with Note`
- [ ] Normalize the selection to whole lines (trim a selection that ends at column 0)
- [ ] Reject single-line selections with a message
- [ ] Run the overlap checker; on rejection show a warning naming the conflicting folder and its lines
- [ ] Keep the user's selection intact after a rejection
- [ ] Prompt for a note via an input box (cancel aborts with no changes)
- [ ] Create the record, add it to the store, register the range with the provider, and fold it
- [ ] Draw the note label with a decoration
- [ ] Support nested folders
- [ ] Command `Unfold / Clear Note` for the folder under the cursor
- [ ] Settings: `badgePrefix`, `badgeBackgroundColor`, `badgeForegroundColor`
- [ ] Command `Toggle All Notes`
- [ ] Register default keybindings from the README

**❓ Ask first**
1. Empty note: allow it, or require text? *Suggested: require text.*
2. Multiple selections: use the first one, or reject? *Suggested: reject with a message.*
3. Identical range to an existing folder: confirm we reject. *Suggested: reject.*
4. Should "Reveal" appear as a button on the rejection notification? *Suggested: yes.*

**Commit:** `feat: create, label, and unfold folders`

---

## Chapter 4: Range Tracking & Conflicts

- [ ] Listen to document changes, only for files that have annotations
- [ ] Shift ranges for changes entirely above; ignore changes below
- [ ] Grow or shrink ranges for edits inside a folder
- [ ] Detect edits straddling a boundary, folders collapsing to zero lines, and new overlaps
- [ ] Mark those folders **conflicted** (keep the record, exclude it from the folding provider)
- [ ] On file open: validate ranges against file length and a short anchor hash of the first lines; flag drifted ones
- [ ] Command `Refresh Ranges`
- [ ] Unit tests: insert above, delete above, edit inside, paste across a boundary, delete everything

**❓ Ask first**
1. A conflicted range can't stay physically folded without breaking nesting. Confirm: show the code **expanded** with a warning, and remove it via the sidebar or CodeLens click. *Suggested: yes.* (The gutter chevron won't exist for it.)
2. Use the anchor hash to flag possible drift when files change outside the editor? *Suggested: yes, flag only, never auto-move.*
3. Should an anchor mismatch be shown as "conflicted" or as a softer "may have moved" state? *Suggested: softer state.*

**Commit:** `feat: track edits and flag conflicted folders`

---

## Chapter 5: Sidebar Manager

- [ ] Activity Bar view container and tree view
- [ ] Top level: files; beneath: annotations; nesting derived from ranges
- [ ] Each entry shows note and range (e.g. `Auth helpers · L20-70`)
- [ ] Click an entry to jump to it and reveal it
- [ ] Inline actions: unfold, delete
- [ ] Conflicted entries show a warning icon; unfolding or deleting removes them
- [ ] Orphaned files (path no longer exists) shown flagged
- [ ] Distinct icon so folders aren't confused with file-system folders
- [ ] Refresh the tree whenever the store changes

**❓ Ask first**
1. In the sidebar, "we can fold folded codes": do you mean **collapsible nesting in the tree** (expand/collapse parent folders), or something else? *Suggested: collapsible tree nodes.*
2. What does "unfold" do in the sidebar for a normal folder: expand the code and **keep** the record, or remove it too? *Suggested: expand and keep; delete is a separate action.*
3. Should the view be empty-state friendly (a welcome message when there are no folders)? *Suggested: yes.*

**Commit:** `feat: sidebar tree view for managing annotations`

---

## Chapter 6: CodeLens Indicator

- [ ] CodeLens provider showing `📝 note · L20-70` above each folder's start line
- [ ] Click runs a command that opens the sidebar and **reveals that folder by ID**
- [ ] Conflicted folders show `⚠ conflict · click to remove`
- [ ] Refresh the CodeLens whenever ranges change
- [ ] Setting to turn the CodeLens off (the inline label remains)

**❓ Ask first**
1. Show the CodeLens only while a block is folded, or always? *Suggested: always, since it's the entry point to the sidebar.*
2. Should highlights get a CodeLens too? *Suggested: no, folders only.*

**Commit:** `feat: CodeLens indicator that opens the sidebar`

---

## Chapter 7: Persistence Polish & Lifecycle

- [ ] Re-apply folds, labels, and CodeLens when files open or become visible (lazily, not all at startup)
- [ ] Handle file rename/move (update the path key) and delete (flag as orphaned)
- [ ] Command `Clear All Data` (with confirmation)
- [ ] Setting `preserveOnSave`
- [ ] Debounced save verified, including save on shutdown
- [ ] Performance check with many annotations and large files

**❓ Ask first**
1. After reloading VS Code, should folders reopen **collapsed** (store a collapsed flag, infer state from visible-range changes) or **expanded**? *Suggested: collapsed, if the spike (Chapter 1) shows state can be detected reliably.*
2. When a file is deleted outside VS Code, auto-remove its annotations or keep them flagged until the user deletes them? *Suggested: keep and flag.*
3. Confirm the extension's data isn't guaranteed to be removed on uninstall, so `Clear All Data` is the cleanup path. *Suggested: document this in the README.*

**Commit:** `feat: persistence lifecycle, file events, and clear-all command`

---

## Chapter 8: Highlighter

- [ ] Command `Highlight Selection` (choose a color, optional note)
- [ ] Support whole-line and partial-line (character) ranges
- [ ] Allow overlapping highlights and define how colors layer
- [ ] Setting `highlightColors` (names and meanings)
- [ ] Command `Remove Highlight`
- [ ] Store highlights in the same store and track them through edits
- [ ] Show highlights in the sidebar with their color
- [ ] Hover shows a highlight's note

**❓ Ask first**
1. Which default colors and meanings? *Suggested: yellow = important, green = understood, red = revisit, blue = question.*
2. When highlights overlap, which one shows on top: newest or first created? *Suggested: newest on top.*
3. What happens to a highlight when an edit deletes the text it covers? *Suggested: remove it silently if its range becomes empty, or flag it like a conflicted folder?*
4. Should highlighting inside a folded folder be allowed (the highlight is hidden while folded)? *Suggested: allow.*

**Commit:** `feat: highlighter with colors, notes, and sidebar support`

---

## Chapter 9: Polish & Release

- [ ] Final keybindings registered in `package.json`
- [ ] Clear error and warning messages everywhere
- [ ] Light and dark theme check, keyboard accessibility
- [ ] Test multi-root workspaces and remote setups (SSH, WSL, containers)
- [ ] Test in VS Code plus at least one fork (Cursor, VSCodium, or Trae)
- [ ] README updated with screenshots or GIFs; CHANGELOG added
- [ ] Extension icon and marketplace metadata
- [ ] Package with `vsce`, install the `.vsix`, and test it
- [ ] Publish

**❓ Ask first**
1. Publish to the VS Code Marketplace, Open VSX (used by VSCodium and several forks), or both? *Suggested: both.*
2. Do you want a version number scheme (start at 0.1.0)? *Suggested: yes.*
3. Keep the name "FoldNote" now that it covers highlights too? *Suggested: keep.*

**Commit:** `chore: release 0.1.0`

---

## Later Ideas (not planned yet)

- [ ] Extend/shrink options when a fold partially overlaps, instead of rejecting
- [ ] Export annotations to Markdown (a study-notes summary)
- [ ] Search and filter in the sidebar
- [ ] Optional sharing of annotations with teammates (would need a project file)
- [ ] **Manual CodeLens placement** — a command that lets you add a CodeLens to any line you choose (prompt for line number, prompt for label/action). Follow-up questions to flesh out before implementing: what should clicking it do (open sidebar, run a command, show a note popup)? should it be tied to an annotation or free-floating? should it persist across sessions?