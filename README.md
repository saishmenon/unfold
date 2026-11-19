# Unfold

**A calm, minimalist markdown notes app for macOS.**

Unfold is for people who want writing to feel easy again. Your notes are plain `.md` files in a folder you choose. No account, no cloud, no subscription.

> **Alpha (v0.1.0-alpha.1).** Unfold is early and still changing. Expect rough edges, keep a backup of important notes, and please tell me what breaks.

## Why Unfold

- **Echoes.** As you write, the side panel brings back older notes that sound like the paragraph you're on. Notes stop being write-only.
- **Help getting started.** Gentle writing prompts appear below your text to get you past the blank page. Press Tab to keep one.
- **Easy reading.** Reading settings inspired by Apple Books: dyslexia-friendly typefaces (Atkinson Hyperlegible, Lexend), spacing, line width, bolder text and an Easy reading preset.
- **Private by design.** Writing help runs on your Mac through a local model (Ollama). Nothing leaves your computer.
- **Your files, your folder.** Plain markdown you can open in any other app.

## Features

- One free-flowing page with a formatted view and a markdown view (⌘E), kept in sync and both editable
- Headings, bold, italic, strikethrough, highlight, code, quotes, links, `[[note links]]`, images, nested lists and checklists
- Folders panel with sections, pinned folders and notes, and an All notes view
- Search (⌘K) with filters like `is:pinned`, `has:task`, `in:folder`, plus a command menu (⌘P)
- Draft and Shape writing modes, and quick AI actions on selected text (Improve, Fix, Shorter, More)
- Themes: Paper, Sepia and Dusk, with customisable markdown colours
- Export to Markdown, web page or plain text

## Install

1. Download the latest `.dmg` from [Releases](../../releases).
2. Open it and drag **Unfold** into **Applications**.
3. Open Unfold. macOS will say it **can't verify the developer**. Click **Done**.
4. Go to **System Settings → Privacy & Security**, scroll down, and click **Open Anyway** next to Unfold.
5. Click **Open Anyway** once more and enter your Mac password if asked.

You only do this once. Unfold isn't signed with a paid Apple developer certificate yet, so macOS asks you to confirm it.

<details>
<summary>Prefer Terminal? One command does the same thing</summary>

After step 2, run:

```sh
xattr -dr com.apple.quarantine /Applications/Unfold.app
```

This removes the "downloaded from the internet" mark from Unfold only. Then open it normally.
</details>

Requires a Mac with Apple silicon (M1 or later).

### Optional: writing help

1. Install [Ollama](https://ollama.com) and pull a model, for example `ollama pull qwen3`.
2. In Unfold, open **Settings (⌘,) → Writing help** and choose the model.

## Build from source

You need [Rust](https://rustup.rs), [Node.js](https://nodejs.org) and Xcode command-line tools.

```sh
git clone https://github.com/saishmenon/unfold.git
cd unfold
npm install
npx tauri dev     # run while developing
npx tauri build   # build Unfold.app and a .dmg
```

The interface is hand-written HTML, CSS and JavaScript in `ui/`, with no framework and no build step. The native shell is [Tauri v2](https://tauri.app) in `src-tauri/`.

```
ui/            interface (index.html, app.js and feature scripts, fonts)
src-tauri/     Rust shell: file access, local AI bridge, app config
sample-notes/  example notes
tests/         UI tests (Python Playwright against a simulated disk)
```

## Feedback

Unfold is a small project and I'd love to know if it's useful to you.

- **Found a bug or have an idea?** [Open an issue](../../issues).
- **Using it?** A star helps me know people care.

## License

[MIT](LICENSE). Bundled fonts (Inter, Atkinson Hyperlegible, Lexend, Commit Mono) are under the SIL Open Font License.
