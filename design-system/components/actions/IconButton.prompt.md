A 36×36 icon button for toolbars, chip rows, and dense controls. Carries a pressed/toggled `active` state and an always-required `title` (doubles as the aria-label).

```jsx
<IconButton title="Search" onClick={open}><Search size={18} /></IconButton>
<IconButton title="Sort" label="Sort" onClick={sort}><ArrowDownAZ size={18} /></IconButton>
<IconButton title="Grid view" active onClick={setGrid}><LayoutGrid size={18} /></IconButton>
<IconButton title="Add" variant="primary"><Plus size={18} /></IconButton>
<IconButton title="Delete" variant="destructive"><Trash2 size={18} /></IconButton>
```

Variants: `default` (subtle, hover bg), `primary` (accent fill), `destructive` (danger). Pass `label` to show text at wider breakpoints. Always pass `title` — icon-only buttons need an accessible name.
