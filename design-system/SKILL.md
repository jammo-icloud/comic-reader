---
name: bindery-design
description: Use this skill to generate well-branded interfaces and assets for Bindery — a self-hosted manga & comic reader — whether for production code or throwaway prototypes, mocks, and slides. Contains the theme engine (12 themes), color/type/spacing/shape tokens, the system font stack, brand assets (logo, cover/login art), reusable React components, and a full UI kit for prototyping.
user-invocable: true
---

# Bindery design skill

Read `readme.md` in this skill first — it carries the product context, content
voice, visual foundations, and iconography rules. Then explore the other files:

- `styles.css` + `tokens/` — link `styles.css` for the full token system and the
  12-theme engine. Activate a theme with `data-theme="<id>"` on `<html>` (add
  `class="dark"` for the 6 dark themes).
- `tokens/components.css` — the `.by-*` component classes (Button, Badge, Avatar,
  Card, CoverThumb, segmented control, etc.) usable directly in plain HTML.
- `components/` — React primitives. `<Name>.prompt.md` in each directory shows the
  API and a usage example.
- `ui_kits/bindery-web/` — a full click-through recreation of the product to copy
  screens and patterns from.
- `templates/comic-library/` — a ready-to-copy library-screen starting point.
- `assets/` — logo, iOS icon, login fantasy art, placeholder covers.

If creating **visual artifacts** (slides, mocks, throwaway prototypes), copy the
assets you need out of `assets/` and produce static HTML that links `styles.css`
(or inlines the tokens). Use Lucide for all icons. If working on **production
code**, copy assets and apply the rules here to design fluently in the brand.

If invoked without specifics, ask what the user wants to build, ask a few focused
questions (surface, theme, dark/light, audience), then act as an expert Bindery
designer who outputs either HTML artifacts or production code as the need dictates.

Brand rules that matter most: theme-first color (never hard-code), system sans +
mono only, sentence case (uppercase only for kickers + the comic wordmark), Lucide
icons with 2px stroke and no emoji in chrome, 2:3 covers as the loudest element,
2px accent ring for selection, `100dvh` over `100vh`, and quiet, precise,
second-person copy.
