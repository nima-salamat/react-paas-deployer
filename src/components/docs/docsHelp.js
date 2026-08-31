/**
 * Complete catalog of everything the docs markdown renderer supports.
 * Used by admin Markdown helper + AI writer guide.
 */

export const DOCS_HELP_ITEMS = [
  // —— Standard Markdown ——
  { id: "heading", group: "Standard Markdown", label: "Heading", icon: "H", help: "H1–H6. Auto anchor id for #links.", syntax: "# H1\n## H2\n### H3", snippet: "## Section title\n\nBody text.\n", aiHint: "Use ## / ###; do not skip levels." },
  { id: "emphasis", group: "Standard Markdown", label: "Bold / italic / code", icon: "B", help: "Inline emphasis and code.", syntax: "**bold** *italic* `code`", snippet: "Use **bold**, *italic*, and `inline code`.\n", aiHint: "Prefer **bold** for UI labels." },
  { id: "link", group: "Standard Markdown", label: "Link", icon: "🔗", help: "External or internal links. File-like URLs get a file chip.", syntax: "[label](https://example.com)\n[Section](#section-title)", snippet: "See [docs home](/docs) and [this heading](#section-title).\n", aiHint: "Use descriptive link text." },
  { id: "image", group: "Standard Markdown", label: "Image", icon: "🖼", help: "Standard markdown image.", syntax: "![alt text](https://example.com/a.png)", snippet: "![Architecture diagram](https://example.com/diagram.png)\n", aiHint: "Always set meaningful alt text." },
  { id: "list", group: "Standard Markdown", label: "Lists", icon: "•", help: "Ordered, unordered, and task lists.", syntax: "- item\n1. one\n- [ ] todo\n- [x] done", snippet: "- Feature A\n- Feature B\n\n1. Install\n2. Configure\n\n- [x] Done\n- [ ] Todo\n", aiHint: "Use task lists for checklists." },
  { id: "blockquote", group: "Standard Markdown", label: "Blockquote", icon: "❝", help: "Quoted text (lines starting with >).", syntax: "> Quoted line\n> Second line", snippet: "> This is a quote.\n", aiHint: "Quotes only — for alerts use [!IMPORTANT] or :::note." },
  { id: "hr", group: "Standard Markdown", label: "Horizontal rule", icon: "—", help: "Section divider.", syntax: "---", snippet: "Above\n\n---\n\nBelow\n", aiHint: "Separate major sections with ---." },
  { id: "table-gfm", group: "Standard Markdown", label: "Table (GFM)", icon: "▦", help: "GitHub-flavored tables with optional alignment.", syntax: "| A | B |\n| --- | --- |\n| 1 | 2 |", snippet: "| Column | Value |\n| --- | --- |\n| Item | 42 |\n", aiHint: "Prefer tables for structured comparisons." },
  { id: "definition", group: "Standard Markdown", label: "Definition list", icon: "≡", help: "Term on one line; next line starts with colon + space.", syntax: "Term\n: definition", snippet: "OAuth\n: Open protocol for authorization\n\nJWT\n: JSON Web Token\n", aiHint: "Glossary pairs as Term then : definition." },
  { id: "code-fence", group: "Standard Markdown", label: "Code fence", icon: "</>", help: "Fenced code with language tag, line count, and Copy.", syntax: "```js\ncode\n```", snippet: "```js\nconsole.log('hello')\n```\n", aiHint: "Always set a language tag." },

  // —— GitHub Alerts ——
  { id: "gh-note", group: "GitHub Alerts", label: "[!NOTE]", icon: "i", help: "GitHub-style note. Body continues until a blank line. Also works as > [!NOTE].", syntax: "[!NOTE] Message", snippet: "[!NOTE] Useful context for the reader.\n", aiHint: "Neutral info → [!NOTE]." },
  { id: "gh-tip", group: "GitHub Alerts", label: "[!TIP]", icon: "✓", help: "Helpful tip alert.", syntax: "[!TIP] Tip text", snippet: "[!TIP] Cache tokens for 5 minutes.\n", aiHint: "Tips → [!TIP]." },
  { id: "gh-important", group: "GitHub Alerts", label: "[!IMPORTANT]", icon: "!", help: "Important platform/policy note.", syntax: "[!IMPORTANT] Message\nMore lines…", snippet: "[!IMPORTANT] CPU, RAM, and privileged settings are controlled server-side.\nThey cannot be overridden in Deploy.config.\n", aiHint: "Hard limits → [!IMPORTANT]." },
  { id: "gh-warning", group: "GitHub Alerts", label: "[!WARNING]", icon: "⚠", help: "Warning alert. Quote form: > [!WARNING]", syntax: "> [!WARNING]\n> Be careful", snippet: "> [!WARNING]\n> Changing this can break running services.\n", aiHint: "Risky actions → [!WARNING]." },
  { id: "gh-caution", group: "GitHub Alerts", label: "[!CAUTION]", icon: "✕", help: "Strong caution / danger.", syntax: "[!CAUTION] Destructive", snippet: "[!CAUTION] This permanently deletes data.\n", aiHint: "Destructive → [!CAUTION]." },

  // —— Structure directives ——
  { id: "toc", group: "Structure", label: "TOC", icon: "☰", help: "Auto table of contents from h2/h3.", syntax: ":::toc\n:::", snippet: ":::toc\n:::\n", aiHint: "Place :::toc after the intro." },
  { id: "anchors", group: "Structure", label: "Anchors menu", icon: "↕", help: "Jump menu for headings.", syntax: ":::anchors h2\n:::", snippet: ":::anchors h2\n:::\n", aiHint: "Long pages → :::anchors." },
  { id: "breadcrumb", group: "Structure", label: "Breadcrumb", icon: "›", help: "Hierarchical path.", syntax: ":::breadcrumb Home > API > Auth\n:::", snippet: ":::breadcrumb Home > API > Auth\n:::\n", aiHint: "Deep pages → breadcrumb at top." },
  { id: "reading-time", group: "Structure", label: "Reading time", icon: "⏱", help: "Estimated reading time from word count.", syntax: ":::reading-time\n:::", snippet: ":::reading-time\n:::\n", aiHint: "Under the title." },
  { id: "meta", group: "Structure", label: "Meta bar", icon: "i", help: "Author, updated date, tags.", syntax: ":::meta author=Team updated=2026-08-31 tags=api,guide\n:::", snippet: ":::meta author=Team updated=2026-08-31 tags=api,guide\n:::\n", aiHint: "Add meta when useful." },
  { id: "nav", group: "Structure", label: "Page nav", icon: "⇔", help: "Previous / next page links (slug|Title).", syntax: ":::nav prev=intro|Introduction next=auth|Authentication\n:::", snippet: ":::nav prev=intro|Introduction next=auth|Authentication\n:::\n", aiHint: "End sequential guides with nav." },
  { id: "steps", group: "Structure", label: "Steps", icon: "1", help: "Numbered procedure steps.", syntax: ":::steps\n1. Title\n   Detail\n2. Next\n:::", snippet: ":::steps\n1. Install\n   Run the installer.\n2. Configure\n3. Run\n:::\n", aiHint: "Procedures → :::steps." },
  { id: "tabs", group: "Structure", label: "Tabs", icon: "◫", help: "Tabbed panels. Each panel starts with === Title", syntax: ":::tabs\n=== JS\n...\n=== Python\n...\n:::", snippet: ":::tabs\n=== JavaScript\n`npm i pkg`\n=== Python\n`pip install pkg`\n:::\n", aiHint: "Same idea in multiple languages → :::tabs." },
  { id: "details", group: "Structure", label: "Accordion", icon: "▾", help: "Collapsible details/summary.", syntax: ":::details Title\nContent\n:::", snippet: ":::details FAQ\nAnswer here.\n:::\n", aiHint: "Optional deep-dives → :::details." },
  { id: "cards", group: "Structure", label: "Cards", icon: "▦", help: "Feature card grid. Panels with === Title", syntax: ":::cards\n=== Title\nBody\n:::", snippet: ":::cards\n=== Feature A\nDescription\n=== Feature B\nDescription\n:::\n", aiHint: "Feature summaries → :::cards." },
  { id: "compare", group: "Structure", label: "Compare", icon: "▥", help: "Side-by-side columns.", syntax: ":::compare A | B\n=== A\n...\n=== B\n...\n:::", snippet: ":::compare Free | Pro\n=== Free\n- Basic\n=== Pro\n- Advanced\n:::\n", aiHint: "Plans → :::compare." },
  { id: "timeline", group: "Structure", label: "Timeline", icon: "∴", help: "Dated events / roadmap.", syntax: ":::timeline\n2026-01-01 — Launch\nNotes\n:::", snippet: ":::timeline\n2026-01-01 — Launch\nInitial release\n2026-06-01 — v2\nMajor update\n:::\n", aiHint: "Roadmaps → :::timeline." },

  // —— Inline ——
  { id: "kbd", group: "Inline", label: "Kbd", icon: "⌨", help: "Keyboard key chip.", syntax: "[[kbd:Ctrl+K]]", snippet: "Press [[kbd:Ctrl+K]] to open the helper.\n", aiHint: "Shortcuts as [[kbd:…]]." },
  { id: "badge", group: "Inline", label: "Badge", icon: "●", help: "Status badge. Tones: success, warning, danger, info, neutral", syntax: "[[badge:success New]]", snippet: "Status: [[badge:success Stable]] [[badge:warning Beta]]\n", aiHint: "Status pills via [[badge:tone Label]]." },
  { id: "copy", group: "Inline", label: "Copy value", icon: "⧉", help: "One-click copy chip for tokens/IDs.", syntax: "[[copy:value_here]]", snippet: "API key: [[copy:sk_live_xxx]]\n", aiHint: "Secrets/IDs → [[copy:…]]." },
  { id: "term", group: "Inline", label: "Term", icon: "?", help: "Glossary term styling.", syntax: "[[term:OAuth]]", snippet: "We use [[term:OAuth]] for login.\n", aiHint: "Mark glossary terms with [[term:Name]]." },

  // —— Code special fences ——
  { id: "terminal", group: "Code", label: "Terminal", icon: "$", help: "Shell session with prompt styling.", syntax: "```terminal\n$ cmd\n```", snippet: "```terminal\n$ npm install\n+ pkg@1.0.0\n```\n", aiHint: "CLI → ```terminal." },
  { id: "output", group: "Code", label: "Output", icon: "◀", help: "Command or API response output.", syntax: "```output\n...\n```", snippet: "```output\n{ \"ok\": true }\n```\n", aiHint: "Responses → ```output." },
  { id: "diff", group: "Code", label: "Diff", icon: "±", help: "Line-by-line diff.", syntax: "```diff\n- old\n+ new\n```", snippet: "```diff\n- oldValue\n+ newValue\n```\n", aiHint: "Breaking changes → ```diff." },
  { id: "code-group", group: "Code", label: "Code group", icon: "{ }", help: "Multiple related files as tabs.", syntax: ":::code-group\n=== file.js\n```js\n...\n```\n:::", snippet: ":::code-group\n=== index.js\n```js\nexport default 1\n```\n=== index.ts\n```ts\nexport default 1\n```\n:::\n", aiHint: "Related files → :::code-group." },
  { id: "html-render", group: "Code", label: "Live HTML", icon: "<>", help: "Renders safe HTML (scripts stripped). Aliases: live-html, raw-html, html!", syntax: "```html-render\n<div>…</div>\n```", snippet: "```html-render\n<div style=\"padding:12px;border:1px solid #334155;border-radius:4px\">Hello</div>\n```\n", aiHint: "Presentation HTML only — no scripts." },
  { id: "html-block", group: "Code", label: ":::html block", icon: "<>", help: "Same as live HTML using a directive block.", syntax: ":::html\n<div>…</div>\n:::", snippet: ":::html\n<div style=\"padding:8px\">Inline HTML block</div>\n:::\n", aiHint: "Alternate to ```html-render." },
  { id: "mermaid", group: "Code", label: "Mermaid", icon: "⬡", help: "Diagrams via Mermaid (loaded in preview).", syntax: "```mermaid\nflowchart LR\n  A-->B\n```", snippet: "```mermaid\nflowchart LR\n  Client --> API --> DB\n```\n", aiHint: "Architecture → mermaid fence." },
  { id: "math", group: "Code", label: "Math", icon: "∑", help: "Math fence (rendered as preformatted math block).", syntax: "```math\nE = mc^2\n```", snippet: "```math\nE = mc^2\n```\n", aiHint: "Formulas → ```math." },

  // —— API / reference ——
  { id: "api", group: "API", label: "API endpoint", icon: "API", help: "Method + path badge.", syntax: ":::api GET /v1/users\nDescription\n:::", snippet: ":::api GET /v1/users\nReturns a paginated list of users.\n:::\n", aiHint: "Each endpoint :::api METHOD /path." },
  { id: "env", group: "API", label: "Env table", icon: "ENV", help: "Environment variables. Rows: KEY · required · default · description", syntax: ":::env\nKEY · yes · — · desc\n:::", snippet: ":::env\nAPI_KEY · yes · — · Secret key\nDEBUG · no · false · Verbose logs\n:::\n", aiHint: "Config → :::env." },
  { id: "props", group: "API", label: "Props table", icon: "P", help: "Component/API params. Rows: name · type · default · description", syntax: ":::props\nid · string · — · id\n:::", snippet: ":::props\nid · string · — · Unique id\nsize · number · 16 · Icon size\n:::\n", aiHint: "Params → :::props." },
  { id: "tree", group: "API", label: "File tree", icon: "🌳", help: "Indented folder tree.", syntax: ":::tree\nsrc/\n  App.jsx\n:::", snippet: ":::tree\nsrc/\n  components/\n    App.jsx\n  index.js\n:::\n", aiHint: "Project layout → :::tree." },
  { id: "matrix", group: "API", label: "Matrix", icon: "⊞", help: "Feature matrix table (✓ / ✗).", syntax: ":::matrix\n| F | A |\n| --- | --- |\n| X | ✓ |\n:::", snippet: ":::matrix\n| Feature | Free | Pro |\n| --- | --- | --- |\n| API | ✓ | ✓ |\n| SSO | ✗ | ✓ |\n:::\n", aiHint: "Feature grids → :::matrix." },

  // —— Callout directives ——
  { id: "note", group: "Callouts", label: ":::note", icon: "!", help: "Neutral note block (close with :::).", syntax: ":::note\n...\n:::", snippet: ":::note\nUseful information.\n:::\n", aiHint: "Neutral → :::note or [!NOTE]." },
  { id: "tip", group: "Callouts", label: ":::tip", icon: "✓", help: "Tip callout.", syntax: ":::tip\n...\n:::", snippet: ":::tip\nHelpful tip.\n:::\n", aiHint: "Tips → :::tip." },
  { id: "warning", group: "Callouts", label: ":::warning", icon: "⚠", help: "Warning callout.", syntax: ":::warning\n...\n:::", snippet: ":::warning\nBe careful.\n:::\n", aiHint: "Cautions → :::warning." },
  { id: "danger", group: "Callouts", label: ":::danger", icon: "✕", help: "Danger / destructive.", syntax: ":::danger\n...\n:::", snippet: ":::danger\nDestructive action.\n:::\n", aiHint: "Destructive → :::danger." },
  { id: "deprecated", group: "Callouts", label: "Deprecated", icon: "⛔", help: "Deprecated with since= and use=.", syntax: ":::deprecated since=2.0 use=newApi\n...\n:::", snippet: ":::deprecated since=2.0 use=newApi\nOld endpoint removed in v3.\n:::\n", aiHint: "Deprecated APIs → :::deprecated." },
  { id: "security", group: "Callouts", label: "Security", icon: "🔒", help: "Security callout (optional critical).", syntax: ":::security critical\n...\n:::", snippet: ":::security critical\nRotate keys after exposure.\n:::\n", aiHint: "Security → :::security." },
  { id: "best", group: "Callouts", label: "Best practice", icon: "★", help: "Recommended approach.", syntax: ":::best-practice\n...\n:::", snippet: ":::best-practice\nPrefer idempotent writes.\n:::\n", aiHint: "Recommendations → :::best-practice." },
  { id: "example", group: "Callouts", label: "Example", icon: "✓", help: "Correct usage example.", syntax: ":::example\n...\n:::", snippet: ":::example\nCorrect usage.\n:::\n", aiHint: "Good patterns → :::example." },
  { id: "anti", group: "Callouts", label: "Anti-example", icon: "✗", help: "What not to do.", syntax: ":::anti-example\n...\n:::", snippet: ":::anti-example\nAvoid this pattern.\n:::\n", aiHint: "Bad patterns → :::anti-example." },
  { id: "draft", group: "Callouts", label: "Draft", icon: "✎", help: "WIP / draft banner.", syntax: ":::draft\n...\n:::", snippet: ":::draft\nWork in progress.\n:::\n", aiHint: "Unfinished pages → :::draft." },
  { id: "changelog", group: "Callouts", label: "Changelog", icon: "📦", help: "Version + date entry.", syntax: ":::changelog 1.2.0 2026-08-01\n- item\n:::", snippet: ":::changelog 1.2.0 2026-08-01\n- Added tabs support\n:::\n", aiHint: "Releases → :::changelog." },

  // —— Media ——
  { id: "figure", group: "Media", label: "Figure", icon: "▣", help: "Image plus caption.", syntax: ":::figure\n![alt](url)\nCaption\n:::", snippet: ":::figure\n![Diagram](https://example.com/d.png)\nSystem overview\n:::\n", aiHint: "Screenshots → :::figure." },
  { id: "download", group: "Media", label: "Download", icon: "⬇", help: "Download button for a file URL.", syntax: ":::download /path/file.pdf Label\n:::", snippet: ":::download /files/spec.pdf API Spec PDF\n:::\n", aiHint: "File downloads → :::download." },
  { id: "embed", group: "Media", label: "Embed YT/Vimeo", icon: "▶", help: "YouTube or Vimeo embed.", syntax: ":::embed youtube VIDEO_ID\n:::", snippet: ":::embed youtube dQw4w9WgXcQ\n:::\n", aiHint: "Only youtube/vimeo." },
  { id: "qr", group: "Media", label: "QR code", icon: "▦", help: "QR image generated from URL.", syntax: ":::qr https://example.com\n:::", snippet: ":::qr https://example.com/app\n:::\n", aiHint: "Deep links → :::qr." },
  { id: "audio", group: "Media", label: "Audio", icon: "♪", help: "Inline audio player.", syntax: "::audio[Title](https://example.com/a.mp3)", snippet: "::audio[Podcast intro](https://example.com/intro.mp3)\n", aiHint: "Audio → ::audio[title](url)." },
  { id: "video", group: "Media", label: "Video", icon: "▶", help: "Inline video player.", syntax: "::video[Title](https://example.com/v.mp4)", snippet: "::video[Demo](https://example.com/demo.mp4)\n", aiHint: "Video → ::video[title](url)." },

  // —— Content widgets ——
  { id: "spoiler", group: "Content", label: "Spoiler", icon: "▒", help: "Hidden until clicked.", syntax: ":::spoiler Title\n...\n:::", snippet: ":::spoiler Answer\n42\n:::\n", aiHint: "Hide answers → :::spoiler." },
  { id: "related", group: "Content", label: "Related", icon: "→", help: "Related links block.", syntax: ":::related\n[Title](/docs/x) — desc\n:::", snippet: ":::related\n[Auth](/docs/auth) — tokens\n[API](/docs/api) — endpoints\n:::\n", aiHint: "End with :::related." },
  { id: "feedback", group: "Content", label: "Feedback", icon: "?", help: "Was this helpful? widget.", syntax: ":::feedback\n:::", snippet: ":::feedback\n:::\n", aiHint: "Optional at end of page." },
  { id: "author", group: "Content", label: "Author", icon: "☺", help: "Author card.", syntax: ":::author @name\nBio\n:::", snippet: ":::author @team\nPlatform engineering\n:::\n", aiHint: "Credit writers → :::author." },
  { id: "progress", group: "Content", label: "Progress", icon: "%", help: "Percent progress bar.", syntax: ":::progress 70\nLabel\n:::", snippet: ":::progress 70\nRoadmap complete\n:::\n", aiHint: "Completion → :::progress N." },
  { id: "date", group: "Content", label: "Date", icon: "📅", help: "Highlighted date.", syntax: ":::date 2026-12-01\n:::", snippet: ":::date 2026-12-01\n:::\n", aiHint: "Deadlines → :::date YYYY-MM-DD." },
  { id: "i18n", group: "Content", label: "i18n note", icon: "文", help: "Other-language edition note.", syntax: ":::i18n fa\n:::", snippet: ":::i18n Persian\n:::\n", aiHint: "Other locales → :::i18n." },
];

export const AI_WRITER_GUIDE = `You are writing developer documentation for a Docs-as-Code system.

OUTPUT RULES
- Output ONLY Markdown this renderer understands (no React components).
- Prefer: title, meta, reading-time, short intro, TOC, then ## sections.
- Use the blocks below when they improve clarity. Do not invent new block names.
- Match the user's language (Persian or English).
- Close every ::: block with a line containing only :::
- For tabs/cards/compare/code-group, start each panel with: === Panel title

STANDARD MARKDOWN
- # ## ### headings, **bold** *italic* \`code\`, [label](url), ![alt](url)
- Lists: - item, 1. item, - [ ] todo, - [x] done
- Tables (GFM), > blockquote, --- horizontal rule
- Definition list: Term on one line, next line ": definition"

GITHUB ALERTS (also render as callouts)
- [!NOTE] [!TIP] [!IMPORTANT] [!WARNING] [!CAUTION]
- Or blockquote form:
  > [!WARNING]
  > message

INLINE EXTENSIONS
- [[kbd:Ctrl+K]] [[badge:success Label]] [[copy:value]] [[term:OAuth]]
- ::audio[Title](url)  ::video[Title](url)

STRUCTURE
- :::toc  :::anchors h2  :::breadcrumb A > B  :::reading-time
- :::meta author=X updated=YYYY-MM-DD tags=a,b
- :::nav prev=slug|Title next=slug|Title
- :::steps (1. 2. 3.)  :::tabs  :::details Title  :::cards  :::compare L | R  :::timeline

CODE
- \`\`\`js \`\`\`terminal \`\`\`output \`\`\`diff \`\`\`mermaid \`\`\`math \`\`\`html-render
- :::html ... :::   :::code-group with === filename panels

API / REFERENCE
- :::api METHOD /path
- :::env   KEY · required · default · description
- :::props name · type · default · description
- :::tree  :::matrix (✓/✗ table)

CALLOUTS
- :::note :::tip :::warning :::danger
- :::deprecated since=x use=y  :::security critical
- :::best-practice :::example :::anti-example :::draft
- :::changelog 1.0.0 2026-01-01

MEDIA / WIDGETS
- :::figure  :::download /url Label  :::embed youtube ID  :::qr URL
- :::spoiler Title  :::related  :::feedback  :::author @name
- :::progress 70  :::date YYYY-MM-DD  :::i18n lang

USER CONTENT (rewrite into polished docs using the options above):
`;

export function buildItemCopyText(item) {
  return [
    "# " + item.label,
    "",
    item.help,
    "",
    "## Syntax",
    "```",
    item.syntax,
    "```",
    "",
    "## Snippet",
    "```",
    (item.snippet || item.syntax).trimEnd(),
    "```",
    "",
    "## Hint for AI",
    item.aiHint || "",
  ].join("\n");
}

export function buildAiPromptWithUserText(userText) {
  const body = (userText && String(userText).trim()) || "(paste your rough notes here)";
  return AI_WRITER_GUIDE + "\n" + body + "\n";
}
