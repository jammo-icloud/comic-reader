A button for any tappable action — primary CTAs, secondary actions, ghost toolbar actions, destructive deletes, and the comic-panel login submit.

```jsx
<Button variant="primary" size="md">Add to Library</Button>
<Button variant="secondary" iconLeft={<Download size={16} />}>Save offline</Button>
<Button variant="ghost" size="sm">Cancel</Button>
<Button variant="destructive">Delete series</Button>
<Button variant="comic">Sign In →</Button>
```

Variants: `primary` (accent fill, the default), `secondary` (subtle surface + border), `ghost` (transparent, hover bg), `destructive` (danger fill), `comic` (square hard-offset shadow, used only on the login spread). Sizes: `sm` (28px pill), `md` (40px, default), `lg` (44px mobile CTA). Pass `iconLeft` / `iconRight` for icon-text buttons.
