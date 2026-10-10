# FoldNote 📝

**FoldNote** lets you fold custom blocks of code, attach a descriptive note to each one, and highlight important passages, all **without modifying your source files**.

Hide a 50-line utility block, collapse boilerplate, or mark a section with a reminder like `TODO: Refactor after API migration`. Select lines A to B, fold them, and a label stays visible in your editor. Then manage everything from a dedicated sidebar.

Think of it as reading a codebase the way you read a textbook: collapse what you've understood, leave a note on what matters, and shade the lines you want to come back to.

> **Status:** in development. This README describes the planned feature set.

> **Terminology:** a *folder* is our nickname for a labeled, folded section of code. It is not a file-system folder.

---

## ✨ Features

### Folders
- **Fold any selection:** select lines 2 to 5 (or 20 to 100) and collapse them into one clean line.
- **Custom notes:** every folder carries a text label, shown next to the collapsed line (for example `📝 Helper logic for auth tokens`).
- **Non-invasive:** FoldNote never inserts `#region` tags or comments into your files.
- **Nested folders:** fold a folder that sits inside a larger one. Folders form a clean tree.
- **Overlap protection:** a new folder that *partially* overlaps an existing one is rejected with a notification.

### Sidebar manager
- **Everything in one place:** all folders and highlights, grouped by file, with their line ranges.
- **Tree view:** nested folders appear as children of the folder that contains them.
- **Click to jump** to any entry in the editor.
- **Quick actions:** unfold or delete from the list.

### Clickable indicator
- A small 📝 indicator (a CodeLens) appears at each folder. Click it to open the sidebar on that folder.

### Highlighter
- **Highlight any range**, including part of a line, like shading a paragraph in a book.
- **Colors with meaning:** for example yellow for "important", green for "understood", red for "revisit".
- **Optional notes** on each highlight.
- **Free overlap:** highlights never hide code, so they may overlap freely.

### Persistence
- **Survives restarts:** folders, highlights, and notes come back when you reopen your files.
- **Follows your edits:** when lines are added or removed above an annotation, its range shifts to stay attached to the right code.

---

## 🧱 How It Works

Folders and highlights are two kinds of one underlying thing, an **annotation**. Each annotation has a unique ID, a file, a range, a note, and a type.

| Property | Folder | Highlight |
| :--- | :--- | :--- |
| Range | Whole lines | Lines or character range |
| Hides code | Yes | No |
| Note | Required | Optional |
| Style | Note label | Color |
| Can overlap others | Only by nesting | Freely |

---

## 📏 Overlap & Conflict Rules

Because folders hide code, they must nest cleanly.

| Situation | Behavior |
| :--- | :--- |
| New folder fully **inside** an existing one | Allowed (nested) |
| New folder fully **contains** an existing one | Allowed (becomes the parent) |
| **Partial overlap** with an existing folder | **Rejected** with a notification naming the conflicting folder and its lines |
| **Identical range** to an existing folder | Rejected with a notification |
| **Adjacent** ranges (no shared lines) | Allowed |

After a rejection, your selection is left intact so you can adjust it and try again.

**Edits can create conflicts later.** If an edit breaks a folder (for example, pasting across its boundary or deleting all of its lines), the folder is marked **conflicted** and shown with a warning in the sidebar. It stays that way until you unfold it, which deletes it.

---

## 🚀 Quick Start

1. **Select code** you want to fold or highlight.
2. Open the **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`).
3. Run **`FoldNote: Fold Selection with Note`** or **`FoldNote: Highlight Selection`**.
4. Enter a note if prompted.
5. Open the **FoldNote sidebar**, or click the 📝 indicator, to browse, jump to, unfold, or delete your annotations.

---

## ⌨️ Commands

| Command | Default Keybinding | Description |
| :--- | :--- | :--- |
| `FoldNote: Fold Selection with Note` | `Ctrl+Alt+F` / `Cmd+Alt+F` | Collapse the selected lines and prompt for a note |
| `FoldNote: Unfold / Clear Note` | `Ctrl+Alt+U` / `Cmd+Alt+U` | Unfold the folder under the cursor and remove its note |
| `FoldNote: Highlight Selection` | — | Highlight the selection with a chosen color |
| `FoldNote: Remove Highlight` | — | Remove the highlight under the cursor |
| `FoldNote: Toggle All Notes` | — | Show or hide all note labels in the active file |
| `FoldNote: Refresh Ranges` | — | Re-validate ranges, useful after changes made outside the editor |
| `FoldNote: Clear All Data` | — | Remove all stored annotations for the workspace |

---

## ⚙️ Settings

- `foldNote.badgePrefix`: icon or text shown before a note (default `"📝 "`).
- `foldNote.badgeBackgroundColor` / `foldNote.badgeForegroundColor`: note label colors.
- `foldNote.highlightColors`: the named highlight colors and their meanings.
- `foldNote.preserveOnSave`: keep annotations saved between sessions (default `true`).

---

## 💾 Where Your Data Lives

FoldNote saves its data in the editor's own extension storage, not in your project. Nothing is added to your repository, and notes stay private to your machine. Files are identified by their path relative to the workspace folder, so moving the project directory does not orphan your notes. Use `FoldNote: Clear All Data` to remove everything.

---

## 📋 Requirements

- VS Code, Trae, Cursor, VSCodium, or any VS Code-compatible editor on version `^1.80.0`.

---

## 🛠️ Known Limitations

- Changes made outside the editor (for example `git checkout` or another editor) cannot be tracked live. FoldNote checks ranges when a file is opened, and `FoldNote: Refresh Ranges` re-checks them on demand.
- The editor controls the placeholder shown on a collapsed line, so FoldNote draws its note next to it as a separate label.
- The 📝 indicator is a CodeLens and disappears if CodeLens is turned off in your editor settings. The inline label still works.

---

## 📄 License

[MIT](LICENSE) © [Der-Feb](https://github.com/Der-Feb)