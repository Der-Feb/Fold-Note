# FoldNote 📝

**FoldNote** allows you to fold custom blocks of code and assign them floating, descriptive annotations—all **without modifying your source code files**.

Whether you want to hide a 50-line utility block, collapse boilerplate code, or mark a section with a reminder like `// TODO: Refactor after API migration`, FoldNote lets you collapse ranges from line $A$ to $B$ and overlay a custom label in your editor.

---

## ✨ Features

- **Fold Any Selection:** Select lines 2 to 5 (or 20 to 100) and fold them into a single clean line.
- **Custom Notes & Labels:** Attach custom text summaries (e.g., `📝 Helper logic for auth tokens`) to folded blocks.
- **Non-Invasive:** Does **not** insert `#region` tags or comments into your underlying source files.
- **Persistent Metadata:** Stores fold ranges and notes per workspace so your layout stays intact when you reopen files.
- **Clean Visual Styling:** Highlights folded notes with subtle editor badges so you never lose track of hidden code.

---

## 🚀 Quick Start

1. **Select Code:** Highlight the block of code you want to collapse.
2. **Open Command Palette:** Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS).
3. **Run Command:** Type `FoldNote: Fold Selection with Note`.
4. **Type Note:** Enter your label/annotation in the prompt and press `Enter`.

To unfold or clear a note, place your cursor on the folded line and run `FoldNote: Unfold / Clear Note`.

---

## ⌨️ Keyboard Shortcuts

| Command | Default Keybinding | Description |
| :--- | :--- | :--- |
| `FoldNote: Fold Selection with Note` | `Ctrl+Alt+F` / `Cmd+Alt+F` | Collapses selected range and prompts for a custom note |
| `FoldNote: Unfold / Clear Note` | `Ctrl+Alt+U` / `Cmd+Alt+U` | Unfolds the block under cursor and removes its custom note |
| `FoldNote: Toggle All Notes` | — | Temporarily hides or shows all custom fold badges in active file |

---

## ⚙️ Extension Settings

This extension contributes the following settings:

* `foldNote.badgePrefix`: The icon or text prefix used before your note (default: `"📝 "`).
* `foldNote.badgeBackgroundColor`: Background color for the inline folded note annotation.
* `foldNote.badgeForegroundColor`: Text color for the inline folded note annotation.
* `foldNote.preserveOnSave`: Keep custom fold ranges saved in workspace storage (`true` by default).

---

## 📋 Requirements

* VS Code, Trae, Cursor, VSCodium, or any VS Code-compatible editor on version `^1.80.0`.

---

## 🛠️ Known Issues / Limitations

* Manual fold ranges rely on line indexing; major edits above a folded block may shift line positions. Running `FoldNote: Refresh Ranges` re-aligns active blocks.

---

## 📄 License

[MIT](LICENSE) © [Der-Feb](https://github.com/Der-Feb)