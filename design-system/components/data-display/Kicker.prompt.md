The recurring eyebrow / section label — uppercase, tracked, tiny, tertiary. Used above shelves and sections ("Continue reading", "Recommended").

```jsx
<Kicker>Continue reading</Kicker>
<Kicker count={6}>Continue reading</Kicker>
```

Pass `count` to append a muted " · N". Defaults to an `<h2>`; override with `as` for non-heading uses.
