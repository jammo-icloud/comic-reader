The signature Bindery card: a 2:3 cover with corner-anchored badges, an optional bottom progress strip, and a title/meta footer. Powers the library grid, series covers, comic-chapter thumbnails, and discover results.

```jsx
<CoverThumb
  src={coverUrl}
  title="Frieren"
  meta="2020 · 12 ch."
  href="/series/frieren"
  badgeTR={<Badge intent="new">+3 New</Badge>}
  progress={42}
/>

{/* Read chapter */}
<CoverThumb src={thumb} title="Chapter 14" meta="22 pages" read />

{/* Discover result with per-source top edge */}
<CoverThumb src={cover} title="One Piece" meta="1997" topEdgeColor="#f97316"
  badgeTR={<Badge intent="success" pill>ongoing</Badge>} />
```

Place badges with `badgeTL` / `badgeTR` / `badgeBL` (any node, usually a `<Badge>`). `progress` draws the accent strip; `read` overrides it with a solid green strip. `blurred` covers NSFW art. Lay these out in a `grid` with `gap: var(--gap-grid)`.
