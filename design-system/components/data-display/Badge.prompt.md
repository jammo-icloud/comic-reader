Small badges and status pills. `Badge` is the generic chip (semantic intents); `StatusPill` maps a series' publication status to the canonical color (ongoing→green, completed→accent, hiatus→amber, cancelled→red).

```jsx
<Badge intent="new">+3 New</Badge>
<Badge intent="success" pill>Saved</Badge>
<Badge intent="danger" pill>NSFW</Badge>
<StatusPill status="ongoing" />
<StatusPill status="completed" />
```

Intents: `neutral`, `accent`, `accent-soft`, `success`, `warning`, `danger`, `new`. Use `StatusPill` for series status so the mapping stays consistent.
