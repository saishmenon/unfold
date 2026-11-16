/* The Getting started notes and their pictures. Written into a new notes folder once (see boot in app.js). Loaded before app.js. */
const GUIDE_DIR='Getting started/Welcome/';
/* Written in this order, so the welcome note is the newest and sits first. */
const GUIDE=[
 [
  "unfold.svg",
  "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 720 300\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M214 262q146 26 292 0\" stroke=\"#9A9488\" stroke-opacity=\".45\" stroke-width=\"2\"/><g stroke=\"#9A9488\" stroke-width=\"2.5\"><path d=\"M230 236l86-43V72l-86 43z\" fill=\"#C2613F\" fill-opacity=\".10\"/><path d=\"M316 193l86 43V115l-86-43z\" fill=\"#C2613F\" fill-opacity=\".20\"/><path d=\"M402 236l86-43V72l-86 43z\" fill=\"#C2613F\" fill-opacity=\".10\"/></g><g stroke=\"#C2613F\" stroke-width=\"3\"><path d=\"M334 106l50 25M334 128l50 25M334 150l30 15\"/></g><g stroke=\"#9A9488\" stroke-width=\"2.5\" stroke-opacity=\".7\"><path d=\"M248 142l50-25M248 164l50-25M420 142l50-25M420 164l34-17\"/></g></svg>\n"
 ],
 [
  "shape.svg",
  "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 720 300\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M92 150c18-44 36 44 54 0s36-44 54 0 36 44 54 0\" stroke=\"#9A9488\" stroke-width=\"3\"/><path d=\"M92 196c14-20 28 20 42 0s28-20 42 0\" stroke=\"#9A9488\" stroke-width=\"3\" stroke-opacity=\".6\"/><path d=\"M318 160h72m-16-14l16 14-16 14\" stroke=\"#C2613F\" stroke-width=\"3\"/><g stroke=\"#9A9488\" stroke-width=\"3\"><path d=\"M450 124h178M450 160h178M450 196h112\"/></g><g stroke=\"#6E8B68\" stroke-width=\"3.5\" stroke-dasharray=\"1 8\"><path d=\"M486 136h64M560 172h52\"/></g></svg>\n"
 ],
 [
  "echoes.svg",
  "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 720 300\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"150\" y=\"66\" width=\"196\" height=\"168\" rx=\"16\" stroke=\"#9A9488\" stroke-width=\"2.5\" fill=\"#C2613F\" fill-opacity=\".10\"/><g stroke=\"#9A9488\" stroke-width=\"3\"><path d=\"M178 104h96M178 136h140M178 162h140M178 188h88\"/></g><g stroke=\"#C2613F\" stroke-width=\"3\"><path d=\"M376 116a48 48 0 0 1 0 68\" stroke-opacity=\".9\"/><path d=\"M398 96a76 76 0 0 1 0 108\" stroke-opacity=\".55\"/><path d=\"M420 78a104 104 0 0 1 0 144\" stroke-opacity=\".28\"/></g><g stroke=\"#9A9488\" stroke-width=\"2.5\"><rect x=\"470\" y=\"82\" width=\"124\" height=\"58\" rx=\"12\"/><rect x=\"470\" y=\"160\" width=\"124\" height=\"58\" rx=\"12\"/><path d=\"M490 104h56M490 120h82M490 182h70M490 198h46\" stroke-opacity=\".7\"/></g></svg>\n"
 ],
 [
  "colours.svg",
  "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 720 300\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"220\" cy=\"96\" r=\"19\" fill=\"#C2613F\"/><circle cx=\"276\" cy=\"96\" r=\"19\" fill=\"#B8862B\"/><circle cx=\"332\" cy=\"96\" r=\"19\" fill=\"#6E8B68\"/><circle cx=\"388\" cy=\"96\" r=\"19\" fill=\"#3F8C86\"/><circle cx=\"444\" cy=\"96\" r=\"19\" fill=\"#5B86A3\"/><circle cx=\"500\" cy=\"96\" r=\"19\" fill=\"#9A5F7E\"/><g stroke-width=\"5\"><path d=\"M220 162h150\" stroke=\"#C2613F\"/></g><g stroke=\"#9A9488\" stroke-width=\"3\"><path d=\"M220 194h280M220 220h200\"/></g><path d=\"M436 220h64\" stroke=\"#5B86A3\" stroke-width=\"3\"/></svg>\n"
 ],
 [
  "Markdown at a glance.md",
  "# Markdown at a glance\n\nNotes are plain `.md` files, so they open anywhere. Every mark on this page is one Unfold understands.\n\n## Text\n\n**Bold** for the point, *italic* for a title, ~~struck~~ for what I changed my mind about, ==highlight== for the line to find again, and `code` for anything typed exactly.\n\n## Lists\n\n- A plain bullet\n- Another, with a [link](https://commonmark.org)\n  - Indented one level\n\n1. First step\n2. Second step\n\n- [x] A finished task\n- [ ] A task still to do\n\n### Quotes and dividers\n\n> Plain text outlives every app that opens it.\n\n---\n\n## Code\n\n```\n# Heading\n**bold** and *italic*\n- [ ] a task\n> a quote\n```\n\n## Note links and pictures\n\nLink to another note with double brackets: [[Welcome to Unfold]].\n\nA picture is one line. The file sits beside the note: `![A caption](photo.jpg)`\n\nJust type. The marks hide when you leave a line and come back when you return to it. **Cmd+B** makes bold, **Cmd+E** shows the raw markdown, and `Esc` puts the cursor away."
 ],
 [
  "Make it yours.md",
  "# Make it yours\n\n![Swatches of colour beside lines of text](colours.svg)\n\nReading should feel easy, so every part of the page can change.\n\n## Look\n\nOpen **Aa** at the top of the page.\n\n- **Themes:** Paper, Sepia and Dusk\n- **Typeface, size and spacing:** change them while you read\n- **Easy reading:** a dyslexia-friendly preset, one click\n\n## Colour\n\nIn **Settings**, under **Appearance**, give headings, links and quotes their own colour. Every colour is checked so it stays readable.\n\n### What it looks like\n\nA [web link](https://commonmark.org), a note link to [[Welcome to Unfold]], some `inline code`, a ==highlight==, **bold** and *italic*.\n\n> A quote sits beside a quiet bar.\n\n## Small touches\n\n- Headings get a little air above them, so each one stays with its paragraph\n- Marks hide when you leave a line and return when you come back\n- The style bar has one **List** button for bullets, numbers and checklists\n\nBack to the start: [[Welcome to Unfold]]\n"
 ],
 [
  "Notes that come back.md",
  "# Notes that come back\n\n![An old note echoing beside a new one](echoes.svg)\n\nThe best note is the one you find again at the right moment.\n\n## Echoes\n\nAs you write, the side panel shows older notes that sound like the paragraph you are on.\n\n- **Click** an echo to peek without leaving your note\n- **Cmd-click** to open it\n- **Cmd+[** brings you straight back\n\n## Find anything\n\nPress **Cmd+K** and type. Search reads every note. Filters such as `is:pinned` and `has:task` narrow it down.\n\n## Connect ideas\n\nType two square brackets to link notes, like [[Make it yours]]. Click a link to follow it.\n\n## Keep it tidy\n\n- **Pin** a note to hold it at the top\n- **Drag** a note onto a folder to move it\n- Folders are real folders on your disk\n\nNext: [[Make it yours]]\n"
 ],
 [
  "Write first, shape later.md",
  "# Write first, shape later\n\n![A rough line becoming a clean one](shape.svg)\n\nGood writing takes two passes. Unfold keeps them apart, so nothing nags you while you think.\n\n## 1. Draft\n\nJust write. Nothing is underlined. If you pause, a quiet question appears below your writing. Keep typing to ignore it, or press **Tab** to keep it.\n\n## 2. Shape\n\nWhen the idea is down, press **Cmd+;**. Weak spots get a dotted underline. Hover one to see *why*, then choose **Fix** or **Ignore**.\n\nTry it on this line:\n\n> We are kind of thinking that maybe the onboarding could be made simpler. There are very many steps and it is really quite long.\n\n## A second pair of eyes\n\nRight-click a paragraph and choose **Refine this paragraph**. A small AI model rewrites it, and nothing changes until you accept.\n\n- It runs on this Mac, so your notes stay private\n- It is free and optional\n- Set it up in **Settings**, under **Writing help**\n\nNext: [[Notes that come back]]\n"
 ],
 [
  "Welcome to Unfold.md",
  "# Welcome to Unfold\n\n![A sheet of paper, unfolding](unfold.svg)\n\nMost notes are written once and never read again. They go in, and they stay in.\n\n**Unfold began with that problem.** It is a quiet place to write, where ==old notes find their way back== to you while you work.\n\n> Your notes are plain files in a folder you own. No account, no cloud.\n\n## The short tour\n\n1. [[Write first, shape later]]: get the idea down, then polish it\n2. [[Notes that come back]]: echoes, search and links\n3. [[Make it yours]]: themes, colours and easy reading\n4. [[Markdown at a glance]]: every mark Unfold understands\n\n## Try these now\n\n- [x] Open Unfold\n- [ ] Click anywhere on this page and type\n- [ ] Press **Cmd+K** and search for *shape*\n- [ ] Press **Cmd+E** to see this note as plain markdown\n\n---\n\nMarkdown is an open format, so these notes open in any app. [CommonMark](https://commonmark.org) explains it in a page.\n"
 ]
];
const GUIDE_PIN=['Welcome to Unfold.md','Write first, shape later.md','Notes that come back.md','Make it yours.md'];
