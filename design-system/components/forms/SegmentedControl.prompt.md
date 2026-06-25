A segmented control for mutually-exclusive choices on a subtle track — Library type tabs, view toggles, theme light/dark.

```jsx
<SegmentedControl
  options={['Comics', 'Magazines']}
  value={type}
  onChange={setType}
/>

<SegmentedControl
  options={[{value:'light', label:'', icon:<Sun size={14}/>}, {value:'dark', label:'', icon:<Moon size={14}/>}]}
  value={mode}
  onChange={setMode}
/>
```

Options can be plain strings or `{value, label, icon}`. The selected segment lifts onto a raised surface.
