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
  { id: "nav", group: "Structure", label: "Page nav", icon: "⇔", help: "Previous / next page links (slug|Title).", syntax: ":::nav prev=intro|Introduction next=auth|Authentication\n:::", snippet: ":::nav prev=intro|Introduction next=auth|Authentication\n:::\n", aiHint: "Use :::nav only for custom previous/next destinations; normal sequential navigation is provided by the Docs UI." },
  { id: "steps", group: "Structure", label: "Steps", icon: "1", help: "Numbered procedure steps.", syntax: ":::steps\n1. Title\n   Detail\n2. Next\n:::", snippet: ":::steps\n1. Install\n   Run the installer.\n2. Configure\n3. Run\n:::\n", aiHint: "Procedures → :::steps." },
  { id: "tabs", group: "Structure", label: "Tabs", icon: "◫", help: "Tabbed panels. Supports nested documentation components. Prefer === Title; --- Title is also accepted inside :::tabs.", syntax: ":::tabs\n=== JS\n...\n=== Python\n...\n:::", snippet: ":::tabs\n=== JavaScript\n`npm i pkg`\n=== Python\n`pip install pkg`\n:::\n", aiHint: "Same content in multiple variants → :::tabs. Use === panel titles; nested directives are allowed." },
  { id: "style", group: "Structure", label: "Element styling", icon: "✦", help: "Safe presentation presets and layout options for documentation blocks. Unknown values keep the default renderer style. class= creates a custom CSS hook.", syntax: ":::style style=soft align=center width=wide\nContent\n:::", snippet: ":::style style=hero align=center spacing=compact\n## Highlighted section\nContent styled without changing the default renderer.\n:::\n", aiHint: "Use style= or variant= on directives/fences when a block needs a different presentation. For ordinary Markdown, wrap the content in :::style ... :::. Options: align, width, spacing, radius, border, shadow, tone, class." },
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
  { id: "math-plot", group: "Math & Charts", label: "2D Function Plot", icon: "∿", help: "Client-rendered interactive 2D graph for safe mathematical functions. Supports multiple curves, x/y ranges, grid, title, hover coordinates, and zoom controls.", syntax: "```plot\nx = -10..10\ny = -5..15\ntitle = Quadratic\ny = x^2\ny = sin(x)\n```", snippet: "```plot\nx = -10..10\ny = -5..15\ntitle = Quadratic and sine\ny = x^2\ny = sin(x)\n```\n", aiHint: "Use ```plot for a 2D function chart. One expression per y = line; x/y ranges use a..b. Supported functions include sin, cos, tan, sqrt, abs, log, ln, exp, min, max, pow and constants pi/e/tau. Also available as :::plot ... ::: or ```math-plot." },

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

export const AI_WRITER_GUIDE = `You are using a documentation-writing SKILL for PassDeployer's Docs-as-Code system.

THIS IS AN INSTRUCTION LAYER, NOT THE TOPIC
- This text describes how to use the documentation system and how to write output for it.
- Do NOT turn this guide itself into an article unless the user explicitly asks for an article about this guide.
- The user's notes/topic that appear after the final USER CONTENT marker are the subject to write about.
- Use this skill silently to transform those notes into a polished documentation page.

PRIMARY JOB
- Produce a complete documentation article from the user's notes.
- Return the actual article, not an explanation of how to write it.
- Match the user's language unless the user explicitly requests another language.
- Preserve technical facts from the supplied notes; do not invent APIs, commands, URLs, limits, or product behaviour.
- Improve structure, clarity, examples, headings, tables, callouts, and diagrams when useful.

OUTPUT CONTRACT
- Output ONLY Markdown understood by the PassDeployer Docs renderer.
- Do not output React, JSX, HTML applications, YAML front matter, JSON, or a commentary around the Markdown.
- When the user asks for an .md file, output the raw Markdown file content directly. Do NOT wrap the entire file in a \`\`\`markdown fence.
- Do not add a "Subject", "slug", "category", or other import metadata block at the top of an imported Markdown file unless the user explicitly asks for metadata.
- The first non-empty line of an imported .md file becomes the article title. It may be either:
  # Article title
  or:
  Article title
  The importer consumes that first title line, so do not repeat it immediately as body content.
- If the user gives rough notes rather than Markdown, convert them into the final page yourself.
- Close every :::directive block with a line containing only :::.
- Do not invent directive names or syntax.
- All directive property/option names must remain English ASCII identifiers exactly as documented. Never translate property names into the article language. Examples include: author, updated, tags, prev, next, since, use, critical, height, grid, and title.
- Option values may be user-facing content when the syntax allows it, but the property name itself must remain the documented English identifier.

DOCUMENT URL / INFORMATION ARCHITECTURE
- Public documentation lives under /docs.
- An uncategorized article with slug x is normally addressed as:
  /docs/x
- An article with category slug y and article slug x is addressed as:
  /docs/y/x
- For nested categories, include every category slug in order:
  /docs/parent-category/child-category/x
- Category names and category slugs are different things. Use the actual slug supplied by the user/admin when constructing URLs; never silently invent a category slug.
- Category assignment is managed by the Docs admin tree, not by Markdown front matter.
- The Markdown file itself normally needs only its title and body.
- When linking to another documentation page whose category path and slug are known, use the corresponding /docs/... URL.
- Do not add category-path text to a page just to explain its URL unless the user asks for it.

SLUG RULES
- The admin has automatic slug generation.
- By default the slug is derived from the title: lower-case, accents normalized, non-alphanumeric runs collapsed into a single dash, and leading/trailing dashes removed.
- In normal use, do not hard-code a slug into the Markdown file; let the admin generate it from the title.
- If the user explicitly provides a slug, preserve that exact intended slug and use it in links.
- The admin also has an Auto Slug option and a manual slug field.
- A manually edited slug is normalized to lower case, whitespace becomes dashes, invalid characters are removed, and repeated dashes are collapsed.
- The import pipeline does NOT use YAML front matter to set the slug.

IMPORTING A MARKDOWN FILE
- A Markdown file can be imported directly into the Admin Docs editor.
- The first non-empty line becomes the title; if it is an ATX heading, the heading markers are stripped.
- The title line is removed from the body after import so it is not rendered twice.
- If the file has no usable first line, the filename becomes the title.
- Therefore, when preparing an importable .md file, put the intended article title on the first non-empty line.
- Do not put YAML front matter before the title.
- The Admin editor can then choose the category, adjust the slug, order, description, and publish state.

PAGE NAVIGATION AND ORDER
- The Docs UI already provides Previous / Next navigation at the bottom of articles using the article ordering in the Admin tree.
- Do NOT add a :::nav block just to create ordinary sequential navigation.
- Use :::nav only when the user specifically needs custom previous/next destinations that differ from the automatic article order.
- Do not add "Next page", "Previous page", "Read the next article", or equivalent manual navigation text at the end of a normal page.
- Use :::related when a page benefits from explicitly related links.
- Do not duplicate navigation that the UI already provides.

PAGE STRUCTURE
A strong default page structure is:
1. Title
2. Short introduction / scope
3. Optional :::meta
4. Optional :::reading-time
5. Optional :::toc
6. ## / ### sections
7. Examples / procedures / references as needed
8. Optional :::related or :::feedback at the end
Do not mechanically include every optional component. Use only what improves the page.

STANDARD MARKDOWN
- Headings: #, ##, ###, ####, #####, ######
- Inline: **bold**, *italic*, \`code\`, ~~strike~~
- Links: [label](url)
- Images: ![meaningful alt text](url)
- Lists: - item, 1. item, task lists - [ ] / - [x]
- Blockquotes: > text
- Horizontal rule: ---
- GFM tables:
  | A | B |
  | --- | --- |
  | 1 | 2 |
- Definition lists:
  Term
  : definition
- Prefer descriptive links and meaningful alt text.

GITHUB ALERTS
- [!NOTE] neutral context
- [!TIP] useful guidance
- [!IMPORTANT] important constraints
- [!WARNING] caution
- [!CAUTION] destructive/high-risk warning
- Quote form also works:
  > [!WARNING]
  > Be careful
- Use alerts when they clarify risk or importance; do not overuse them.

INLINE EXTENSIONS
- [[kbd:Ctrl+K]]
- [[badge:success Stable]]
- [[badge:warning Beta]]
- [[badge:danger Deprecated]]
- [[copy:value]]
- [[term:OAuth]]
- ::audio[Title](url)
- ::video[Title](url)

STRUCTURE DIRECTIVES
- :::toc
  :::
- :::anchors h2
  :::
- :::breadcrumb Home > API > Auth
  :::
- :::reading-time
  :::
- :::meta author=Team updated=YYYY-MM-DD tags=api,guide
  :::
- :::steps
  1. First
     Details
  2. Second
  :::
- :::tabs
  === JavaScript
  ...
  === Python
  ...
  :::
  Tabs also accept --- Panel title, but prefer === for clarity.
  Nested directives/components are supported inside tab panels.
- Styling / presentation
  - Custom directives support presentation attributes such as style=PRESET or variant=PRESET.
  - Built-in presets: default, subtle, soft, elevated, outline, flat, compact, spacious, accent, muted, hero.
  - Layout options: align=left|center|right|justify, width=narrow|normal|wide|full, spacing=none|compact|normal|loose.
  - Visual options: radius=none|sm|md|lg, border=none|subtle|accent|strong, shadow=none|soft|strong, tone=neutral|primary|success|warning|danger.
  - class= adds a sanitized custom hook prefixed with doc-user-. It never executes CSS or JavaScript.
  - Unknown style values are ignored, so the component falls back to its normal default style.
  - Use :::style to give an explicit presentation scope to ordinary Markdown:
    :::style style=hero width=wide
    ## Section
    Paragraph, list, table, image, or other Markdown.
    :::
  - Fenced code and special fences accept the same presentation attributes after the language, for example: fenced code with js style=compact radius=sm.
  - Do not put arbitrary raw CSS into Markdown; use the documented presets/options or a project CSS rule targeting a doc-user-* hook.
- :::details Title
  Content
  :::
- :::cards
  === Feature A
  Description
  === Feature B
  Description
  :::
- :::compare Free | Pro
  === Free
  ...
  === Pro
  ...
  :::
- :::timeline
  2026-01-01 — Launch
  Notes
  :::

CODE / DIAGRAMS
- Normal code fences:
  \`\`\`js
  code
  \`\`\`
- Supported special fences include:
  terminal, console, shell-session, output, diff, mermaid, math, plot, math-plot.
- \`\`\`math is a preformatted math block; it is not a graph.
- \`\`\`mermaid renders a Mermaid diagram.
- \`\`\`plot and \`\`\`math-plot render a 2D mathematical function graph.
- :::html ... ::: and html-render fences are available for safe presentation HTML; scripts and dangerous HTML are stripped.
- :::code-group
  === index.js
  \`\`\`js
  export default 1
  \`\`\`
  === index.ts
  \`\`\`ts
  export default 1
  \`\`\`
  :::

2D MATHEMATICAL FUNCTION PLOTS
- Use a \`\`\`plot fence for actual 2D function charts.
- Example:
  \`\`\`plot
  x = -10..10
  y = -5..15
  title = Quadratic and sine
  y = x^2
  y = sin(x)
  \`\`\`
- x = a..b controls the x-axis range.
- y = a..b controls the y-axis range.
- height = N controls chart height and is clamped to a safe range.
- grid = false hides the grid; grid defaults to true.
- title = ... adds a chart title.
- Each remaining expression is one curve. Preferred syntax is y = expression.
- A bare expression is also accepted, for example: x^2
- Use explicit multiplication when clarity matters: 2*x, not a prose phrase.
- Supported operators: +, -, *, /, ^, parentheses.
- Supported constants include pi, e, tau.
- Supported functions include sin, cos, tan, asin, acos, atan, sinh, cosh, tanh, sqrt, cbrt, abs, exp, log, ln, log10, floor, ceil, round, sign, min, max, pow, sec, csc, cot.
- Implicit multiplication such as 2x and 2(x+1) is accepted.
- The renderer uses a restricted mathematical parser; do not put JavaScript, arbitrary function calls, or executable code in a plot expression.
- Plots are rendered in both the public Docs page and the Admin editor live preview.
- Hovering a graph shows x/y coordinates; zoom controls are available on the graph.
- Use a plot only when a graph communicates something better than prose or a simple table.
- For simple equations with no graph, use \`\`\`math instead.

API / REFERENCE
- :::api METHOD /path
  Description
  :::
- :::env
  KEY · required · default · description
  :::
- :::props
  name · type · default · description
  :::
- :::tree
  src/
    components/
  :::
- :::matrix
  | Feature | Free | Pro |
  | --- | --- | --- |
  | API | ✓ | ✓ |
  :::

CALLOUT DIRECTIVES
- :::note ... :::
- :::tip ... :::
- :::warning ... :::
- :::danger ... :::
- :::deprecated since=2.0 use=newApi ... :::
- :::security critical ... :::
- :::best-practice ... :::
- :::example ... :::
- :::anti-example ... :::
- :::draft ... :::
- :::changelog 1.2.0 2026-08-01
  - item
  :::

MEDIA
- :::figure
  ![Alt](url)
  Caption
  :::
- :::download /files/spec.pdf API Spec PDF
  :::
- :::embed youtube VIDEO_ID
  :::
- :::embed vimeo VIDEO_ID
  :::
- :::qr https://example.com
  :::
- ::audio[Title](url)
- ::video[Title](url)

CONTENT DIRECTIVES
- :::spoiler Answer
  Content
  :::
- :::related
  [Auth](/docs/auth) — tokens
  [API](/docs/api) — endpoints
  :::
- :::feedback
  :::
- :::author @team
  Bio
  :::
- :::progress 70
  Roadmap complete
  :::
- :::date YYYY-MM-DD
  :::
- :::i18n lang
  :::
- :::draft
  Work in progress
  :::

AUTHORING RULES
- Prefer clear section hierarchy; do not skip from ## to #### without a reason.
- Use short paragraphs and concrete examples.
- Use code fences with the correct language whenever showing code.
- Use tables for structured comparisons, not for ordinary prose.
- Use callouts for important constraints rather than shouting in prose.
- Use steps for procedures with a clear sequence.
- Use tabs when multiple variants solve the same task and the reader chooses one.
- Use code-group when comparing related files.
- Use a 2D plot when the mathematical relationship itself is easier to understand visually.
- Use presentation styles only when they improve hierarchy or readability; do not style every block unnecessarily.
- Keep examples internally consistent with the surrounding explanation.
- Do not mention undocumented features as if they exist.
- Do not add navigation, front matter, or metadata solely because this skill document mentions them.
- Do not output the skill instructions themselves as the article.

FINAL CHECK BEFORE OUTPUT
- Is the first non-empty line the intended title?
- Is the result actual article content rather than an explanation of this skill?
- Is every ::: block closed?
- Are all internal /docs links consistent with category + slug when that information is known?
- Did you avoid unnecessary :::nav because the UI already handles previous/next?
- Did you avoid YAML front matter so the .md importer can read the title correctly?
- If a graph is needed, is it written using the supported plot syntax?
- Is the entire response valid Markdown for direct import?

USER CONTENT / TOPIC TO WRITE ABOUT
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
