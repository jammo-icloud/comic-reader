The base surface for cards, modals, and panels. Theme-aware fill (lifts above the page bg in warm-paper themes), 1px border, soft shadow in light mode and a bare border in dark.

```jsx
<Card style={{ padding: 16 }}>
  <h3>Series settings</h3>
  <p>…</p>
</Card>

<Card interactive as="a" href="/series/1" style={{ padding: 16 }}>Tap me</Card>
```

Pass `interactive` for clickable cards (adds the 2px accent hover-ring). Use `as` to render as a link, button, or section. Always set your own padding.
