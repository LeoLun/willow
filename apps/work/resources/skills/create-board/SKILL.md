---
name: create-board
description: Create or update an interactive project overview board at .agents/panel/index.html. Use whenever the user asks to create a board, dashboard, project overview, visual project status, architecture summary, progress display, or content for Willow's board panel.
---

# 创建看板

为当前项目创建清晰、可交互的概览看板，并让 Willow 在右侧看板面板中直接加载它。

## Workflow

1. Inspect the project structure, documentation, configuration, and current task context before deciding what the board should show.
2. Resolve the requested visual style and load exactly one matching style reference as described below.
3. Choose a small set of useful project-specific sections, such as status, milestones, architecture, modules, commands, risks, or key metrics. Do not invent facts that cannot be derived from the project.
4. Create the entry file at `.agents/panel/index.html` relative to the workspace root.
5. Place every supporting JavaScript, stylesheet, image, font, or data file under `.agents/panel/`. Use relative URLs from `index.html`; never reference files outside that directory.
6. Keep the board self-contained and offline. Do not load code, fonts, analytics, images, APIs, or other resources from the network.
7. Ensure `index.html` works when opened directly with the `file://` protocol, without Willow or a development server.
8. Verify that the entry file exists and that every referenced local resource resolves inside `.agents/panel/`.

## Style references

Match style names case-insensitively. Read only the selected reference; do not load the other style
files. Treat the reference as visual direction, then adapt its system to the project's content and
the narrow board panel instead of reproducing a source website literally.

- **Airbnb** — warm, approachable marketplace styling with generous whitespace and rounded cards.
  Read [references/airbnb.md](references/airbnb.md).
- **Cursor** — restrained developer-tool styling with an editorial cream canvas and code-forward
  details. Read [references/cursor.md](references/cursor.md).
- **Claude** — warm, humanist editorial styling with cream, coral, serif display type, and dark
  product surfaces. Read [references/claude.md](references/claude.md).
- **Apple** — minimal, product-first gallery styling with precise typography and quiet chrome. Read
  [references/apple.md](references/apple.md).

If the user does not name a style, select the closest fit from the summaries above based on the
project, state the choice briefly, and load only that reference. Use locally available system-font
fallbacks when a reference names a proprietary font; the offline constraint takes precedence.

## Design and interaction

- Make the layout responsive down to a narrow sidebar width of about 350px.
- Use semantic HTML, visible focus states, accessible labels, and keyboard-operable controls.
- Support light and dark color schemes with `prefers-color-scheme` unless the project provides a stronger visual direction.
- Prefer concise summaries and visual hierarchy over dense prose. Avoid generic placeholder cards.
- JavaScript may provide filtering, tabs, collapsible sections, or local interactions. Keep core information readable if a nonessential interaction fails.
- Store only non-sensitive presentation preferences in browser storage. Never embed credentials, environment secrets, or private user data.

## Updating an existing board

Preserve useful existing structure and styling unless the user asks for a redesign. Refresh project-derived facts, remove stale information, and re-run the same path and offline-resource checks before finishing.
