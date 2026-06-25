/* @ds-bundle: {"format":3,"namespace":"BinderyDesignSystem_cd2bc2","components":[{"name":"Button","sourcePath":"components/actions/Button.jsx"},{"name":"IconButton","sourcePath":"components/actions/IconButton.jsx"},{"name":"Avatar","sourcePath":"components/data-display/Avatar.jsx"},{"name":"Badge","sourcePath":"components/data-display/Badge.jsx"},{"name":"StatusPill","sourcePath":"components/data-display/Badge.jsx"},{"name":"Kicker","sourcePath":"components/data-display/Kicker.jsx"},{"name":"ProgressBar","sourcePath":"components/data-display/ProgressBar.jsx"},{"name":"Tag","sourcePath":"components/data-display/Tag.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"SegmentedControl","sourcePath":"components/forms/SegmentedControl.jsx"},{"name":"CoverThumb","sourcePath":"components/library/CoverThumb.jsx"},{"name":"Card","sourcePath":"components/surfaces/Card.jsx"}],"sourceHashes":{"components/actions/Button.jsx":"c1d72130ccf0","components/actions/IconButton.jsx":"cf03c3d402c3","components/data-display/Avatar.jsx":"00568f28a942","components/data-display/Badge.jsx":"f87be0ef64d6","components/data-display/Kicker.jsx":"ce411ec9feeb","components/data-display/ProgressBar.jsx":"9e43ae66bd17","components/data-display/Tag.jsx":"e8533bc39356","components/forms/Input.jsx":"60ec2cc0d180","components/forms/SegmentedControl.jsx":"927d291e818f","components/library/CoverThumb.jsx":"0adb5aa5f02b","components/surfaces/Card.jsx":"a9f15b4d1b86","ui_kits/bindery-web/Admin.jsx":"a7ab3b558bf3","ui_kits/bindery-web/Discover.jsx":"68760ef718a9","ui_kits/bindery-web/Library.jsx":"48979f08fc44","ui_kits/bindery-web/Login.jsx":"3a529ffa31ea","ui_kits/bindery-web/Reader.jsx":"a8c7a93c6862","ui_kits/bindery-web/Series.jsx":"d2d86d6d3d4b","ui_kits/bindery-web/chrome.jsx":"aeb61266e030","ui_kits/bindery-web/lib.jsx":"a2cc18166f1b"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.BinderyDesignSystem_cd2bc2 = window.BinderyDesignSystem_cd2bc2 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/actions/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Bindery's primary button. Four intents (primary / secondary / ghost /
 * destructive) plus a `comic` variant for the login spread, and three sizes
 * mapped to the touch-target tokens.
 */
function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  iconLeft = null,
  iconRight = null,
  className = '',
  ...rest
}) {
  const cls = ['by-btn', `by-btn--${variant}`, variant === 'comic' ? '' : `by-btn--${size}`, className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    className: cls,
    disabled: disabled
  }, rest), iconLeft, children, iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/Button.jsx", error: String((e && e.message) || e) }); }

// components/actions/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Square 36×36 icon button for sticky toolbars and chip rows. Optional text
 * label appears alongside the icon. `active` reflects a pressed/toggled state.
 */
function IconButton({
  children,
  onClick,
  active = false,
  disabled = false,
  title,
  label,
  variant = 'default',
  className = '',
  ...rest
}) {
  const cls = ['by-icon-btn', variant !== 'default' ? `by-icon-btn--${variant}` : '', label ? 'by-icon-btn--label' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: cls,
    onClick: onClick,
    disabled: disabled,
    title: title,
    "aria-label": title,
    "aria-pressed": active
  }, rest), children, label && /*#__PURE__*/React.createElement("span", {
    className: "by-icon-btn__label"
  }, label));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Avatar.jsx
try { (() => {
/**
 * Initial-circle avatar — the identity glyph for a logged-in user. Picks up the
 * active theme's accent. `onDark` variant is for use over dark cover heroes.
 */
function Avatar({
  username,
  size = 'md',
  variant = 'default',
  className = ''
}) {
  const initial = username && username.length > 0 ? username[0].toUpperCase() : '?';
  const cls = ['by-avatar', `by-avatar--${size}`, variant === 'onDark' ? 'by-avatar--on-dark' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    className: cls
  }, initial);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Small status / meta badge. Intent maps to a semantic color; `new` is the
 * accent-filled uppercase chip used on series covers with fresh chapters.
 */
function Badge({
  children,
  intent = 'neutral',
  pill = false,
  className = '',
  ...rest
}) {
  const isNew = intent === 'new';
  const cls = ['by-badge', `by-badge--${intent}`, pill && !isNew ? 'by-badge--pill' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls
  }, rest), children);
}

/**
 * Status pill mapped to a series' publication status, per the design system:
 *   ongoing → success · completed → accent-soft · hiatus → warning · cancelled → danger
 */
function StatusPill({
  status,
  className = ''
}) {
  const map = {
    ongoing: 'success',
    completed: 'accent-soft',
    hiatus: 'warning',
    cancelled: 'danger'
  };
  const intent = map[status] || 'neutral';
  return /*#__PURE__*/React.createElement(Badge, {
    intent: intent,
    className: className
  }, status);
}
Object.assign(__ds_scope, { Badge, StatusPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Badge.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Kicker.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Uppercase, tracked eyebrow label — section headers, kicker text. */
function Kicker({
  children,
  count,
  as = 'h2',
  className = '',
  ...rest
}) {
  const Tag = as;
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: `by-kicker ${className}`
  }, rest), children, count != null && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 6,
      color: 'var(--text-muted)',
      fontWeight: 500,
      textTransform: 'none',
      letterSpacing: 'normal'
    }
  }, "\xB7 ", count));
}
Object.assign(__ds_scope, { Kicker });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Kicker.jsx", error: String((e && e.message) || e) }); }

// components/data-display/ProgressBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Thin themed progress bar — accent fill on a track. Clamps 0–100. */
function ProgressBar({
  value,
  className = '',
  ...rest
}) {
  const pct = Math.min(100, Math.max(0, value));
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `by-progress ${className}`,
    role: "progressbar",
    "aria-valuenow": Math.round(pct),
    "aria-valuemin": 0,
    "aria-valuemax": 100
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "by-progress__fill",
    style: {
      width: `${pct}%`
    }
  }));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** A tag / genre chip — subtle filled pill of tertiary text. */
function Tag({
  children,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `by-tag ${className}`
  }, rest), children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Tag.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Text input. Default is the standard rounded field; `comic` is the
 * hard-bordered monospace field used on the login spread.
 */
function Input({
  variant = 'default',
  className = '',
  ...rest
}) {
  const cls = ['by-input', variant === 'comic' ? 'by-input--comic' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("input", _extends({
    className: cls
  }, rest));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/SegmentedControl.jsx
try { (() => {
/**
 * Segmented control — a row of mutually-exclusive options on a subtle track.
 * Used for the Library type tabs (Comics / Magazines) and the theme toggle.
 */
function SegmentedControl({
  options,
  value,
  onChange,
  className = ''
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `by-segmented ${className}`,
    role: "group"
  }, options.map(opt => {
    const val = typeof opt === 'string' ? opt : opt.value;
    const label = typeof opt === 'string' ? opt : opt.label;
    const icon = typeof opt === 'string' ? null : opt.icon;
    const selected = val === value;
    return /*#__PURE__*/React.createElement("button", {
      key: val,
      type: "button",
      className: "by-segment",
      "aria-pressed": selected,
      onClick: () => onChange && onChange(val)
    }, icon, label);
  }));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/library/CoverThumb.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * The signature Bindery cover card — a 2:3 cover with corner-anchored badges,
 * an optional bottom progress strip, and a title/meta footer. Powers the
 * library grid, series covers, and comic-chapter thumbnails.
 *
 * Badges are placed by corner: badgeTL / badgeTR / badgeBL accept any node
 * (commonly a <Badge>). `progress` (0–100) draws the accent strip along the
 * bottom of the art; `read` draws a solid success strip instead.
 */
function CoverThumb({
  src,
  alt = '',
  title,
  meta,
  href,
  onClick,
  blurred = false,
  progress = null,
  read = false,
  badgeTL = null,
  badgeTR = null,
  badgeBL = null,
  topEdgeColor = null,
  className = ''
}) {
  const Tag = href ? 'a' : onClick ? 'button' : 'div';
  const extra = href ? {
    href
  } : onClick ? {
    type: 'button',
    onClick
  } : {};
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: `by-cover ${className}`
  }, extra), topEdgeColor && /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      background: topEdgeColor,
      zIndex: 2
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "by-cover__art"
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: alt,
    loading: "lazy",
    style: blurred ? {
      filter: 'blur(16px)'
    } : undefined
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: '100%'
    }
  }), badgeTL && /*#__PURE__*/React.createElement("div", {
    className: "by-cover__badge by-cover__badge--tl"
  }, badgeTL), badgeTR && /*#__PURE__*/React.createElement("div", {
    className: "by-cover__badge by-cover__badge--tr"
  }, badgeTR), badgeBL && /*#__PURE__*/React.createElement("div", {
    className: "by-cover__badge by-cover__badge--bl"
  }, badgeBL), read ? /*#__PURE__*/React.createElement("div", {
    className: "by-cover__strip",
    style: {
      background: 'var(--color-success)'
    }
  }) : progress != null && progress > 0 ? /*#__PURE__*/React.createElement("div", {
    className: "by-cover__strip"
  }, /*#__PURE__*/React.createElement("div", {
    className: "by-cover__strip-fill",
    style: {
      width: `${Math.min(100, progress)}%`
    }
  })) : null), (title || meta) && /*#__PURE__*/React.createElement("div", {
    className: "by-cover__body"
  }, title && /*#__PURE__*/React.createElement("h3", {
    className: "by-cover__title"
  }, title), meta && /*#__PURE__*/React.createElement("div", {
    className: "by-cover__meta"
  }, meta)));
}
Object.assign(__ds_scope, { CoverThumb });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/library/CoverThumb.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * The canonical surface — theme-aware card / modal background, 1px border,
 * subtle shadow in light mode (none in dark). `interactive` adds the
 * accent hover-ring used on clickable cards.
 */
function Card({
  children,
  interactive = false,
  as = 'div',
  className = '',
  ...rest
}) {
  const Tag = as;
  const cls = ['by-card', interactive ? 'by-card--interactive' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: cls
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Card.jsx", error: String((e && e.message) || e) }); }

// ui_kits/bindery-web/Admin.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Bindery UI kit — Admin (4 tabs: Library, Tasks, Subscriptions, Users).
   UX fix vs. the original: the bulk maintenance actions (Run maintenance,
   Cleanup, Rescan, Re-enrich, Sync all) were buried inside the personal
   profile/avatar menu. They live in a dedicated header "Tools" menu here. */

const {
  Button,
  IconButton,
  Badge,
  Avatar,
  ProgressBar,
  Kicker,
  Card
} = window.DS;
const A = window.ADMIN_STATS;
function Admin({
  onBack,
  onOpenMenu
}) {
  const [tab, setTab] = React.useState('library');
  const [search, setSearch] = React.useState('');
  const [showSearch, setShowSearch] = React.useState(false);
  const [attention, setAttention] = React.useState(false);
  const [selectMode, setSelectMode] = React.useState(false);
  const [selected, setSelected] = React.useState(new Set());
  const [confirm, setConfirm] = React.useState(null);
  const catalog = window.SERIES;
  const filtered = catalog.filter(s => (!search || s.name.toLowerCase().includes(search.toLowerCase())) && (!attention || !s.en));
  const toggleSel = id => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);else if (next.size < 2) next.add(id);
    return next;
  });
  const tabs = ['library', 'tasks', 'subscriptions', 'users'];
  const tabLabel = {
    library: 'Library',
    tasks: 'Tasks',
    subscriptions: 'Subscriptions',
    users: 'Users'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100dvh',
      background: 'var(--bg-page)',
      paddingBottom: selectMode ? 80 : 0
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 30,
      background: 'var(--chrome-bg)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-default)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1152,
      margin: '0 auto',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    title: "Back to library",
    onClick: onBack
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "arrow-left",
    size: 20
  })), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 20,
      fontWeight: 700,
      color: 'var(--text-body)'
    }
  }, "Admin"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-muted)'
    }
  }, "v", A.version), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(ToolsMenu, {
    onConfirm: setConfirm
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onOpenMenu,
    title: "Profile",
    "aria-label": "Profile menu",
    style: {
      padding: 4,
      borderRadius: '50%',
      background: 'none',
      border: 'none',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    username: "Jammo",
    size: "md"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1152,
      margin: '0 auto',
      padding: '0 8px',
      display: 'flex',
      overflowX: 'auto'
    },
    className: "no-scrollbar"
  }, tabs.map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    onClick: () => setTab(t),
    style: {
      padding: '12px 16px',
      fontSize: 14,
      fontWeight: 500,
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      background: 'none',
      border: 'none',
      borderBottom: '2px solid ' + (tab === t ? 'var(--color-accent)' : 'transparent'),
      color: tab === t ? 'var(--color-accent)' : 'var(--text-tertiary)'
    }
  }, tabLabel[t])))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1152,
      margin: '0 auto',
      padding: '16px'
    }
  }, /*#__PURE__*/React.createElement(StatRow, {
    tab: tab,
    subs: window.SUBSCRIPTIONS,
    users: window.USERS,
    catalog: catalog
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      margin: '18px 0 12px'
    }
  }, tab === 'library' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--text-heading)'
    }
  }, "Library ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)',
      fontWeight: 400
    }
  }, "(", filtered.length, ")")), showSearch && /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    value: search,
    onChange: e => setSearch(e.target.value),
    placeholder: "Search series\u2026",
    className: "by-input",
    style: {
      flex: 1,
      height: 36,
      maxWidth: 280
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(IconButton, {
    title: showSearch ? 'Close search' : 'Search',
    active: showSearch,
    onClick: () => {
      setShowSearch(s => !s);
      if (showSearch) setSearch('');
    }
  }, /*#__PURE__*/React.createElement(Ic, {
    name: showSearch ? 'x' : 'search',
    size: 16
  })), /*#__PURE__*/React.createElement(IconButton, {
    title: "Show only series needing attention",
    label: "Attention",
    active: attention,
    onClick: () => setAttention(a => !a)
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "circle-alert",
    size: 16
  })), /*#__PURE__*/React.createElement(IconButton, {
    title: "Select for merge",
    label: selectMode ? selected.size ? selected.size + '/2' : 'Select' : 'Select',
    active: selectMode,
    onClick: () => {
      setSelectMode(m => !m);
      setSelected(new Set());
    }
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "git-merge",
    size: 16
  }))), tab === 'tasks' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--text-heading)'
    }
  }, "Download tasks"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(IconButton, {
    title: "Refresh",
    onClick: () => {}
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "refresh-cw",
    size: 16
  })), /*#__PURE__*/React.createElement(IconButton, {
    title: "Clear completed",
    label: "Clear",
    variant: "destructive",
    onClick: () => setConfirm({
      title: 'Clear completed tasks?',
      msg: 'Removes finished and errored downloads from the list. In-progress tasks are unaffected.',
      label: 'Clear'
    })
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "trash-2",
    size: 16
  }))), tab === 'subscriptions' && /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--text-heading)'
    }
  }, "Subscriptions ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)',
      fontWeight: 400
    }
  }, "(", window.SUBSCRIPTIONS.length, ")")), tab === 'users' && /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--text-heading)'
    }
  }, "Registered users")), tab === 'library' && /*#__PURE__*/React.createElement(LibraryTab, {
    rows: filtered,
    total: catalog.length,
    selectMode: selectMode,
    selected: selected,
    onToggle: toggleSel,
    onDelete: s => setConfirm({
      title: `Delete "${s.name}"?`,
      msg: `Permanently removes ${s.ch} chapters and the series metadata.`,
      label: 'Delete',
      danger: true
    })
  }), tab === 'tasks' && /*#__PURE__*/React.createElement(TasksTab, {
    tasks: window.TASKS
  }), tab === 'subscriptions' && /*#__PURE__*/React.createElement(SubsTab, {
    subs: window.SUBSCRIPTIONS,
    onUnsub: s => setConfirm({
      title: `Unsubscribe "${s.name}"?`,
      msg: 'New chapters will no longer be auto-downloaded. Existing chapters stay in your library.',
      label: 'Unsubscribe'
    })
  }), tab === 'users' && /*#__PURE__*/React.createElement(UsersTab, {
    users: window.USERS
  })), tab === 'library' && selectMode && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 30,
      background: 'var(--chrome-bg)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderTop: '1px solid var(--border-default)',
      boxShadow: 'var(--shadow-2xl)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1152,
      margin: '0 auto',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--text-body)'
    }
  }, selected.size === 0 ? 'Select 2 series to merge' : selected.size === 1 ? '1 selected — pick one more' : '2 selected'), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    iconLeft: /*#__PURE__*/React.createElement(Ic, {
      name: "git-merge",
      size: 15
    }),
    disabled: selected.size !== 2,
    onClick: () => setConfirm({
      title: 'Merge series?',
      msg: 'Combines the two selected series, keeping one as the canonical record. Chapters and progress are merged.',
      label: 'Merge'
    })
  }, "Merge"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    onClick: () => {
      setSelectMode(false);
      setSelected(new Set());
    }
  }, "Cancel"))), confirm && /*#__PURE__*/React.createElement(ConfirmDialog, _extends({}, confirm, {
    onClose: () => setConfirm(null)
  })));
}

/* ---- Header Tools menu (the UX fix: bulk ops out of the profile menu) ---- */
function ToolsMenu({
  onConfirm
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(null); // key currently running
  const [done, setDone] = React.useState({}); // keys recently completed
  const run = key => {
    setBusy(key);
    setTimeout(() => {
      setBusy(null);
      setDone(d => ({
        ...d,
        [key]: true
      }));
      setTimeout(() => setDone(d => ({
        ...d,
        [key]: false
      })), 2000);
    }, 1500);
  };
  const items = [{
    key: 'maintenance',
    icon: 'wrench',
    label: 'Run maintenance',
    hint: 'Page counts, thumbnails, orphans'
  }, {
    key: 'cleanup',
    icon: 'sparkles',
    label: 'Cleanup',
    hint: 'Remove orphaned files & data'
  }, {
    key: 'rescan',
    icon: 'refresh-cw',
    label: 'Rescan library',
    hint: 'Re-detect all files on disk'
  }, {
    key: 'sync',
    icon: 'rss',
    label: 'Sync all subscriptions',
    hint: 'Poll every source for new chapters'
  }, {
    key: 'enrich',
    icon: 'database',
    label: 'Re-enrich all',
    hint: 'Refetch metadata from MyAnimeList',
    danger: true
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    iconLeft: /*#__PURE__*/React.createElement(Ic, {
      name: "wrench",
      size: 15
    }),
    iconRight: /*#__PURE__*/React.createElement(Ic, {
      name: "chevron-down",
      size: 14
    }),
    onClick: () => setOpen(o => !o)
  }, "Tools"), open && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: () => setOpen(false),
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 49
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 0,
      top: 44,
      width: 280,
      background: 'var(--surface-raised)',
      border: '1px solid var(--border-default)',
      borderRadius: 12,
      boxShadow: 'var(--shadow-2xl)',
      zIndex: 50,
      overflow: 'hidden',
      padding: '4px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "bindery-kicker",
    style: {
      padding: '8px 14px 4px'
    }
  }, "Library tools"), items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.key,
    onClick: () => run(it.key),
    disabled: busy === it.key,
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '9px 14px',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      textAlign: 'left'
    },
    onMouseEnter: e => e.currentTarget.style.background = it.danger ? 'rgb(var(--danger)/0.1)' : 'var(--bg-subtle)',
    onMouseLeave: e => e.currentTarget.style.background = 'none'
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: done[it.key] ? 'var(--color-success)' : it.danger ? 'var(--color-danger)' : 'var(--text-tertiary)',
      display: 'inline-flex'
    }
  }, busy === it.key ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      animation: 'by-spin 0.9s linear infinite'
    }
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "loader",
    size: 16
  })) : done[it.key] ? /*#__PURE__*/React.createElement(Ic, {
    name: "check",
    size: 16
  }) : /*#__PURE__*/React.createElement(Ic, {
    name: it.icon,
    size: 16
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 14,
      color: it.danger ? 'var(--color-danger)' : 'var(--text-body)'
    }
  }, busy === it.key ? 'Running…' : done[it.key] ? 'Done' : it.label), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 11,
      color: 'var(--text-muted)'
    }
  }, it.hint)))))));
}

/* ---- Stat cards ---- */
function StatRow({
  tab,
  subs,
  users,
  catalog
}) {
  const sets = {
    library: [{
      icon: 'database',
      label: 'Series',
      value: A.seriesCount,
      hint: A.chapterCount + ' chapters'
    }, {
      icon: 'hard-drive',
      label: 'Storage',
      value: window.formatBytes(A.librarySize),
      hint: 'Data: ' + window.formatBytes(A.dataSize)
    }, {
      icon: 'tag',
      label: 'Tagged',
      value: '100%',
      hint: '0 untagged'
    }, {
      icon: 'link',
      label: 'MAL linked',
      value: '83%',
      hint: '2 unlinked'
    }],
    tasks: [{
      icon: 'loader',
      label: 'Active',
      value: window.TASKS.filter(t => t.status === 'downloading').length,
      accent: 'accent'
    }, {
      icon: 'zap',
      label: 'Queued',
      value: window.TASKS.filter(t => t.status === 'queued').length,
      accent: 'warning'
    }, {
      icon: 'check',
      label: 'Complete',
      value: window.TASKS.filter(t => t.status === 'complete').length
    }, {
      icon: 'circle-alert',
      label: 'Errors',
      value: window.TASKS.filter(t => t.status === 'error').length,
      accent: 'danger'
    }],
    subscriptions: [{
      icon: 'bell',
      label: 'Subscriptions',
      value: subs.length
    }, {
      icon: 'database',
      label: 'New chapters',
      value: subs.reduce((n, s) => n + s.newChapterCount, 0),
      accent: 'accent'
    }, {
      icon: 'refresh-cw',
      label: 'Sources',
      value: new Set(subs.map(s => s.source)).size
    }, {
      icon: 'zap',
      label: 'Last sync',
      value: '2h ago'
    }],
    users: [{
      icon: 'users',
      label: 'Users',
      value: users.length
    }, {
      icon: 'check',
      label: 'Total reads',
      value: users.reduce((n, u) => n + u.read, 0)
    }, {
      icon: 'book-open',
      label: 'Tracking',
      value: users.reduce((n, u) => n + u.tracked, 0),
      hint: 'Chapters in progress'
    }, {
      icon: 'zap',
      label: 'Active readers',
      value: users.filter(u => u.tracked > 0).length
    }]
  };
  const accentColor = {
    accent: 'var(--color-accent)',
    warning: 'var(--color-warning)',
    danger: 'var(--color-danger)'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 12
    },
    className: "stat-grid"
  }, sets[tab].map((c, i) => /*#__PURE__*/React.createElement(Card, {
    key: i,
    style: {
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      color: 'var(--text-tertiary)',
      fontSize: 12,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement(Ic, {
    name: c.icon,
    size: 12
  }), " ", /*#__PURE__*/React.createElement("span", null, c.label)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 24,
      fontWeight: 700,
      color: c.accent && c.value ? accentColor[c.accent] : 'var(--text-body)'
    },
    className: "bindery-nums"
  }, c.value), c.hint && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--text-muted)'
    }
  }, c.hint))));
}

/* ---- Library tab (catalog rows) ---- */
function LibraryTab({
  rows,
  total,
  selectMode,
  selected,
  onToggle,
  onDelete
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "admin-cols",
    style: {
      display: 'grid',
      gridTemplateColumns: (selectMode ? '28px ' : '') + 'minmax(0,1fr) 64px minmax(120px,200px) 56px 96px',
      gap: 12,
      padding: '0 14px 8px',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'var(--text-muted)',
      fontWeight: 500
    }
  }, selectMode && /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null, "Name"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right'
    }
  }, "Ch."), /*#__PURE__*/React.createElement("span", null, "Tags"), /*#__PURE__*/React.createElement("span", null, "MAL"), /*#__PURE__*/React.createElement("span", null)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, rows.map(s => {
    const sel = selected.has(s.id);
    const linked = !!s.en;
    return /*#__PURE__*/React.createElement("div", {
      key: s.id,
      className: "admin-cols by-card",
      style: {
        display: 'grid',
        gridTemplateColumns: (selectMode ? '28px ' : '') + 'minmax(0,1fr) 64px minmax(120px,200px) 56px 96px',
        gap: 12,
        alignItems: 'center',
        padding: '8px 14px',
        background: 'var(--surface-card)',
        boxShadow: sel ? 'inset 0 0 0 2px var(--color-accent)' : undefined
      }
    }, selectMode && /*#__PURE__*/React.createElement("button", {
      onClick: () => onToggle(s.id),
      "aria-label": "Select",
      style: {
        width: 20,
        height: 20,
        borderRadius: 5,
        border: '2px solid ' + (sel ? 'var(--color-accent)' : 'var(--border-default)'),
        background: sel ? 'var(--color-accent)' : 'transparent',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: '#fff'
      }
    }, sel && /*#__PURE__*/React.createElement(Ic, {
      name: "check",
      size: 13
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: s.cover,
      alt: "",
      style: {
        width: 32,
        height: 44,
        borderRadius: 4,
        objectFit: 'cover',
        flexShrink: 0,
        background: 'var(--bg-subtle)'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 500,
        color: 'var(--text-body)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, s.name), s.en && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--text-muted)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, s.en))), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right',
        fontSize: 13,
        color: 'var(--text-secondary)'
      },
      className: "bindery-nums admin-hide"
    }, s.ch), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 4,
        flexWrap: 'wrap',
        overflow: 'hidden',
        maxHeight: 22
      },
      className: "admin-hide"
    }, s.tags.slice(0, 2).map(t => /*#__PURE__*/React.createElement("span", {
      key: t,
      className: "by-tag"
    }, t))), /*#__PURE__*/React.createElement("span", {
      className: "admin-hide",
      title: linked ? 'Linked to MyAnimeList' : 'No MAL link',
      style: {
        color: linked ? 'var(--color-success)' : 'var(--text-muted)'
      }
    }, /*#__PURE__*/React.createElement(Ic, {
      name: linked ? 'link' : 'unlink',
      size: 15
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 2,
        justifyContent: 'flex-end'
      }
    }, /*#__PURE__*/React.createElement(IconButton, {
      title: "Edit metadata",
      onClick: () => {}
    }, /*#__PURE__*/React.createElement(Ic, {
      name: "pencil",
      size: 15
    })), /*#__PURE__*/React.createElement(IconButton, {
      title: "Delete series",
      variant: "destructive",
      onClick: () => onDelete(s)
    }, /*#__PURE__*/React.createElement(Ic, {
      name: "trash-2",
      size: 15
    }))));
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      padding: '12px 14px 0',
      fontSize: 11,
      color: 'var(--text-muted)'
    }
  }, rows.length, " of ", total));
}

/* ---- Tasks tab ---- */
function TasksTab({
  tasks
}) {
  const tone = {
    downloading: 'var(--color-accent)',
    queued: 'var(--color-warning)',
    complete: 'var(--color-success)',
    error: 'var(--color-danger)'
  };
  const icon = {
    downloading: 'loader',
    queued: 'zap',
    complete: 'check',
    error: 'circle-alert'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, tasks.map(t => /*#__PURE__*/React.createElement(Card, {
    key: t.id,
    style: {
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: tone[t.status],
      display: 'inline-flex',
      flexShrink: 0
    }
  }, t.status === 'downloading' ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      animation: 'by-spin 0.9s linear infinite'
    }
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "loader",
    size: 16
  })) : /*#__PURE__*/React.createElement(Ic, {
    name: icon[t.status],
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--text-body)'
    }
  }, t.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--text-tertiary)'
    },
    className: "bindery-nums"
  }, t.status === 'complete' ? `${t.total} chapters` : t.status === 'error' ? t.error : t.status === 'queued' ? 'Queued' : `Ch. ${t.chapter} — ${t.cur}/${t.total}`), (t.status === 'downloading' || t.status === 'queued') && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      maxWidth: 360
    }
  }, /*#__PURE__*/React.createElement(ProgressBar, {
    value: t.total > 0 ? t.cur / t.total * 100 : 0
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 2,
      flexShrink: 0
    }
  }, (t.status === 'downloading' || t.status === 'queued') && /*#__PURE__*/React.createElement(IconButton, {
    title: "Cancel",
    onClick: () => {}
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "square",
    size: 14
  })), t.status === 'error' && /*#__PURE__*/React.createElement(IconButton, {
    title: "Retry",
    onClick: () => {}
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "rotate-ccw",
    size: 14
  })), /*#__PURE__*/React.createElement(IconButton, {
    title: "Delete",
    variant: "destructive",
    onClick: () => {}
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "trash-2",
    size: 14
  })))))));
}

/* ---- Subscriptions tab ---- */
function SubsTab({
  subs,
  onUnsub
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, subs.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.id,
    className: "by-card admin-cols",
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) minmax(120px,180px) 72px minmax(110px,150px) auto',
      gap: 12,
      alignItems: 'center',
      padding: '10px 14px',
      background: 'var(--surface-card)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--text-body)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, s.name), s.en && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--text-muted)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, s.en)), /*#__PURE__*/React.createElement("div", {
    className: "admin-hide",
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-secondary)'
    }
  }, s.source), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-muted)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, s.mangaId)), /*#__PURE__*/React.createElement("div", {
    className: "admin-hide",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 13,
      color: 'var(--text-secondary)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "bindery-nums"
  }, s.chapterCount), s.newChapterCount > 0 && /*#__PURE__*/React.createElement(Badge, {
    intent: "accent-soft",
    pill: true
  }, "+", s.newChapterCount)), /*#__PURE__*/React.createElement("span", {
    className: "admin-hide",
    style: {
      fontSize: 12,
      color: 'var(--text-tertiary)'
    }
  }, s.lastSync || 'Never'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 2,
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    title: "Sync now",
    onClick: () => {}
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "refresh-cw",
    size: 15
  })), /*#__PURE__*/React.createElement(IconButton, {
    title: "Unsubscribe",
    variant: "destructive",
    onClick: () => onUnsub(s)
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "x",
    size: 15
  }))))));
}

/* ---- Users tab ---- */
function UsersTab({
  users
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 12
    },
    className: "stat-grid"
  }, users.map(u => /*#__PURE__*/React.createElement(Card, {
    key: u.username,
    style: {
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    username: u.username,
    size: "lg"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--text-body)',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, u.username, u.admin && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      padding: '2px 6px',
      borderRadius: 4,
      background: 'rgb(var(--accent)/0.15)',
      color: 'var(--color-accent)',
      fontWeight: 600
    }
  }, "Admin")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--text-muted)',
      marginTop: 2
    },
    className: "bindery-nums"
  }, u.collection, " series \xB7 ", u.read, " read \xB7 ", u.tracked, " tracked"))))));
}

/* ---- Confirm dialog (replaces window.confirm, portaled-feel modal) ---- */
function ConfirmDialog({
  title,
  msg,
  label,
  danger,
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgb(0 0 0 / 0.5)',
      backdropFilter: 'blur(4px)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    style: {
      position: 'relative',
      width: '100%',
      maxWidth: 420,
      background: 'var(--surface-card)',
      borderRadius: 12,
      border: '1px solid var(--border-default)',
      boxShadow: 'var(--shadow-2xl)',
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '0 0 8px',
      fontSize: 17,
      fontWeight: 600,
      color: 'var(--text-body)'
    }
  }, title), msg && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 18px',
      fontSize: 13,
      lineHeight: 1.5,
      color: 'var(--text-secondary)'
    }
  }, msg), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    onClick: onClose
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    variant: danger ? 'destructive' : 'primary',
    onClick: onClose
  }, label))));
}
Object.assign(window, {
  Admin
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/bindery-web/Admin.jsx", error: String((e && e.message) || e) }); }

// ui_kits/bindery-web/Discover.jsx
try { (() => {
/* Bindery UI kit — Discover (multi-source search). */

const {
  CoverThumb,
  Badge,
  IconButton,
  Input
} = window.DS;
const SOURCES = [{
  id: 'mangadex',
  name: 'MangaDex',
  color: '#ff6740'
}, {
  id: 'mangafox',
  name: 'MangaFox',
  color: '#3b82f6'
}, {
  id: 'rawkuma',
  name: 'Rawkuma',
  color: '#e63525'
}, {
  id: 'readcomics',
  name: 'ReadComicsOnline',
  color: '#16a34a'
}, {
  id: 'archive',
  name: 'Archive.org',
  color: '#8b5cf6'
}];
const RESULTS = [{
  t: 'Berserk',
  y: 1989,
  src: 0,
  status: 'ongoing',
  cover: window.ART.bg2,
  tags: ['dark fantasy', 'seinen'],
  inLib: false
}, {
  t: 'Oyasumi Punpun',
  y: 2007,
  src: 0,
  status: 'completed',
  cover: window.ART.forest,
  tags: ['drama'],
  inLib: true,
  inColl: false
}, {
  t: 'Akira',
  y: 1982,
  src: 1,
  status: 'completed',
  cover: window.ART.discover,
  tags: ['sci-fi'],
  inLib: false
}, {
  t: 'Monster',
  y: 1994,
  src: 0,
  status: 'completed',
  cover: window.ART.manga,
  tags: ['thriller', 'mystery'],
  inLib: false
}, {
  t: 'Kaiju No. 8',
  y: 2020,
  src: 2,
  status: 'ongoing',
  cover: window.ART.bg3,
  tags: ['action'],
  inLib: false
}, {
  t: 'Slam Dunk',
  y: 1990,
  src: 3,
  status: 'completed',
  cover: window.ART.bg2,
  tags: ['sports'],
  inLib: true,
  inColl: true
}, {
  t: 'Nausica\u00e4',
  y: 1982,
  src: 4,
  status: 'completed',
  cover: window.ART.forest,
  tags: ['fantasy', 'adventure'],
  inLib: false
}, {
  t: 'Made in Abyss',
  y: 2012,
  src: 0,
  status: 'ongoing',
  cover: window.ART.manga,
  tags: ['adventure', 'horror'],
  inLib: false
}, {
  t: 'Real',
  y: 1999,
  src: 1,
  status: 'hiatus',
  cover: window.ART.discover,
  tags: ['sports', 'drama'],
  inLib: false
}, {
  t: 'Gantz',
  y: 2000,
  src: 2,
  status: 'completed',
  cover: window.ART.bg3,
  tags: ['sci-fi', 'action'],
  inLib: false
}];
// Use the real cover art across discover results too.
RESULTS.forEach((r, i) => {
  r.cover = window.COVERS[i % window.COVERS.length];
});
function Discover() {
  const [q, setQ] = React.useState('');
  const [active, setActive] = React.useState('all');
  const results = RESULTS.filter(r => !q || r.t.toLowerCase().includes(q.toLowerCase()));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100dvh',
      background: 'var(--bg-page)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1280,
      margin: '0 auto',
      padding: '20px 16px 0'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: '0 0 4px',
      fontSize: 24,
      fontWeight: 700,
      color: 'var(--text-body)'
    }
  }, "Discover"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 16px',
      fontSize: 14,
      color: 'var(--text-tertiary)'
    }
  }, "Search across ", SOURCES.length, " sources, plus your household\u2019s Recommended feed."), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      maxWidth: 520,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 12,
      top: '50%',
      transform: 'translateY(-50%)',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "search",
    size: 18
  })), /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search MangaDex, MangaFox & more\u2026",
    className: "by-input",
    style: {
      paddingLeft: 40,
      height: 44,
      fontSize: 15
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    label: /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5
      }
    }, /*#__PURE__*/React.createElement(Ic, {
      name: "heart",
      size: 13
    }), " Recommended"),
    active: active === 'all',
    onClick: () => setActive('all')
  }), /*#__PURE__*/React.createElement(Pill, {
    label: /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5
      }
    }, /*#__PURE__*/React.createElement(Ic, {
      name: "library",
      size: 13
    }), " Library"),
    active: active === 'lib',
    onClick: () => setActive('lib')
  }), SOURCES.map((s, i) => /*#__PURE__*/React.createElement(Pill, {
    key: s.id,
    dot: s.color,
    label: s.name,
    active: active === s.id,
    onClick: () => setActive(s.id)
  })))), /*#__PURE__*/React.createElement("main", {
    style: {
      maxWidth: 1280,
      margin: '0 auto',
      padding: '0 16px 48px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 1fr)',
      gap: 16
    },
    className: "lib-grid"
  }, results.map((r, i) => {
    const src = SOURCES[r.src];
    return /*#__PURE__*/React.createElement(CoverThumb, {
      key: i,
      src: r.cover,
      title: r.t,
      topEdgeColor: src.color,
      meta: /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          marginTop: 4
        }
      }, r.tags.slice(0, 2).map(t => /*#__PURE__*/React.createElement("span", {
        key: t,
        style: {
          fontSize: 10,
          padding: '1px 6px',
          borderRadius: 4,
          background: 'var(--bg-subtle)',
          color: 'var(--text-tertiary)'
        }
      }, t))),
      badgeTR: /*#__PURE__*/React.createElement(Badge, {
        intent: statusIntent(r.status),
        pill: true
      }, r.status),
      badgeTL: r.inLib ? /*#__PURE__*/React.createElement(Badge, {
        intent: r.inColl ? 'success' : 'accent',
        pill: true
      }, r.inColl ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Ic, {
        name: "check",
        size: 9
      }), " In Collection") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Ic, {
        name: "library",
        size: 9
      }), " In Library")) : null
    });
  }))));
}
function statusIntent(s) {
  return s === 'ongoing' ? 'success' : s === 'completed' ? 'accent' : s === 'hiatus' ? 'warning' : 'danger';
}
function Pill({
  label,
  active,
  dot,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      minHeight: 32,
      padding: '0 12px',
      borderRadius: 9999,
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 500,
      border: active ? '1px solid var(--color-accent)' : '1px solid var(--border-default)',
      background: active ? 'rgb(var(--accent)/0.15)' : 'var(--surface-card)',
      color: active ? 'var(--color-accent)' : 'var(--text-secondary)'
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: dot
    }
  }), label);
}
Object.assign(window, {
  Discover
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/bindery-web/Discover.jsx", error: String((e && e.message) || e) }); }

// ui_kits/bindery-web/Library.jsx
try { (() => {
/* Bindery UI kit — Library page. */

const {
  CoverThumb,
  Badge,
  SegmentedControl,
  IconButton,
  Kicker,
  ProgressBar
} = window.DS;
function ContinueShelf({
  onOpen
}) {
  return /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement(Kicker, {
    count: window.CONTINUE.length
  }, "Continue reading"), /*#__PURE__*/React.createElement("div", {
    className: "no-scrollbar",
    style: {
      overflowX: 'auto',
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      paddingBottom: 4
    }
  }, window.CONTINUE.map((it, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    onClick: () => onOpen(it.s, it.ch),
    style: {
      flex: '0 0 auto',
      width: 220,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 8,
      borderRadius: 12,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-default)',
      cursor: 'pointer',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 40,
      height: 56,
      borderRadius: 6,
      overflow: 'hidden',
      background: 'var(--bg-subtle)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: it.s.cover,
    alt: "",
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--text-body)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, it.s.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--text-tertiary)',
      marginBottom: 5
    }
  }, "Chapter ", it.ch), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(ProgressBar, {
    value: it.page / it.pages * 100
  }), /*#__PURE__*/React.createElement("span", {
    className: "bindery-nums",
    style: {
      fontSize: 10,
      color: 'var(--text-muted)'
    }
  }, "p.", it.page))))))));
}
function Library({
  onOpenSeries,
  onOpenChapter
}) {
  const [type, setType] = React.useState('Comics');
  const [search, setSearch] = React.useState('');
  const [showSearch, setShowSearch] = React.useState(false);
  const list = window.SERIES.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100dvh',
      background: 'var(--bg-page)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'sticky',
      top: 48,
      zIndex: 20,
      background: 'var(--chrome-bg)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-default)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1280,
      margin: '0 auto',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(SegmentedControl, {
    options: ['Comics', 'Magazines'],
    value: type,
    onChange: setType
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--text-tertiary)'
    },
    className: "bindery-nums"
  }, list.length, " series"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), showSearch && /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    value: search,
    onChange: e => setSearch(e.target.value),
    placeholder: "Search\u2026",
    className: "by-input",
    style: {
      width: 200,
      height: 36
    }
  }), /*#__PURE__*/React.createElement(IconButton, {
    title: "Search",
    active: showSearch,
    onClick: () => setShowSearch(s => !s)
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "search"
  })), /*#__PURE__*/React.createElement(IconButton, {
    title: "Tags",
    onClick: () => {}
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "tag"
  })), /*#__PURE__*/React.createElement(IconButton, {
    title: "Sort",
    label: "Name",
    onClick: () => {}
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "arrow-down-a-z"
  })))), /*#__PURE__*/React.createElement("main", {
    style: {
      maxWidth: 1280,
      margin: '0 auto',
      padding: '20px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 24
    }
  }, !search && /*#__PURE__*/React.createElement(ContinueShelf, {
    onOpen: onOpenChapter
  }), /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 1fr)',
      gap: 16
    },
    className: "lib-grid"
  }, list.map(s => {
    const nsfw = (s.tags || []).some(t => ['nsfw', 'adult', 'hentai', 'ecchi'].includes(t));
    const meta = /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--text-tertiary)'
      }
    }, s.ch, " ch."), /*#__PURE__*/React.createElement("span", {
      className: "bindery-nums"
    }, s.read, "/", s.ch), s.score > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        color: 'var(--color-warning)'
      }
    }, s.score.toFixed(1)));
    return /*#__PURE__*/React.createElement(CoverThumb, {
      key: s.id,
      src: s.cover,
      title: s.name,
      onClick: () => onOpenSeries(s),
      blurred: nsfw,
      meta: meta,
      badgeTL: s.saved ? /*#__PURE__*/React.createElement(Badge, {
        intent: "success",
        pill: true
      }, /*#__PURE__*/React.createElement(Ic, {
        name: "download",
        size: 9
      }), " Saved") : null,
      badgeTR: nsfw ? /*#__PURE__*/React.createElement(Badge, {
        intent: "danger",
        pill: true
      }, "NSFW") : s.neww ? /*#__PURE__*/React.createElement(Badge, {
        intent: "new"
      }, "+", s.neww, " New") : null,
      badgeBL: s.pinned ? /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'rgb(var(--accent)/0.9)',
          color: '#fff'
        }
      }, /*#__PURE__*/React.createElement(Ic, {
        name: "pin",
        size: 11
      })) : null,
      progress: s.read > 0 && s.read < s.ch ? Math.round(s.read / s.ch * 100) : null
    });
  })))));
}
Object.assign(window, {
  Library
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/bindery-web/Library.jsx", error: String((e && e.message) || e) }); }

// ui_kits/bindery-web/Login.jsx
try { (() => {
/* Bindery UI kit — Login (comic-panel spread). */

const {
  Button,
  Input
} = window.DS;
function Login({
  onSignIn
}) {
  const [u, setU] = React.useState('');
  const [p, setP] = React.useState('');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100dvh',
      width: '100%',
      background: '#0a0a0a',
      display: 'flex',
      flexDirection: 'column',
      padding: 20,
      overflow: 'hidden',
      backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.045 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1024,
      margin: '0 auto',
      width: '100%',
      display: 'flex',
      alignItems: 'baseline',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 44,
      fontWeight: 900,
      letterSpacing: '-0.02em',
      color: '#fff',
      lineHeight: 1,
      textShadow: '2px 2px 0 #000, 3px 3px 0 #000, 5px 5px 0 rgb(var(--accent))'
    }
  }, "BINDERY"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.2em',
      color: '#71717a'
    }
  }, "// your library")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      maxWidth: 1024,
      margin: '12px auto 0',
      width: '100%',
      display: 'grid',
      gap: 14,
      gridTemplateColumns: '1.6fr 1fr 1fr',
      gridTemplateRows: '1fr 1fr',
      gridTemplateAreas: '"hero hero login" "p2 p3 p3"'
    }
  }, /*#__PURE__*/React.createElement(Panel, {
    src: window.ART.forest,
    rot: -1.2,
    area: "hero"
  }), /*#__PURE__*/React.createElement(Panel, {
    src: window.ART.bg2,
    rot: 1.5,
    area: "p2"
  }), /*#__PURE__*/React.createElement(Panel, {
    src: window.ART.bg3,
    rot: -0.6,
    area: "p3"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      gridArea: 'login',
      alignSelf: 'start',
      position: 'relative',
      zIndex: 30,
      background: '#fff',
      border: '6px solid #000',
      overflow: 'hidden',
      boxShadow: '0 18px 44px rgb(0 0 0 / 0.7)',
      outline: '3px solid rgb(var(--accent)/0.5)',
      transform: 'perspective(1800px) rotateY(-4deg) rotate(0.6deg) scale(1.02)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.10) 1px, transparent 1px)',
      backgroundSize: '6px 6px',
      opacity: 0.5
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      background: '#000',
      color: '#fff',
      padding: '14px 20px',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      opacity: 0.25,
      backgroundImage: 'radial-gradient(circle, white 1.2px, transparent 1.2px)',
      backgroundSize: '7px 7px'
    }
  }), /*#__PURE__*/React.createElement("h2", {
    style: {
      position: 'relative',
      margin: 0,
      fontSize: 24,
      fontWeight: 900,
      letterSpacing: '-0.01em',
      textShadow: '2px 2px 0 rgb(var(--accent)/0.9), 3px 3px 0 rgba(0,0,0,0.4)'
    }
  }, "SIGN\xA0IN"), /*#__PURE__*/React.createElement("p", {
    style: {
      position: 'relative',
      margin: '4px 0 0',
      fontSize: 10,
      fontFamily: 'var(--font-mono)',
      color: '#a1a1aa'
    }
  }, "to your library")), /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      onSignIn();
    },
    style: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      padding: 20
    }
  }, /*#__PURE__*/React.createElement(CLabel, null, "USERNAME"), /*#__PURE__*/React.createElement(Input, {
    variant: "comic",
    value: u,
    onChange: e => setU(e.target.value),
    placeholder: "your username"
  }), /*#__PURE__*/React.createElement(CLabel, null, "PASSWORD"), /*#__PURE__*/React.createElement(Input, {
    variant: "comic",
    type: "password",
    value: p,
    onChange: e => setP(e.target.value),
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 6
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "comic",
    type: "submit",
    style: {
      width: '100%',
      padding: '12px 0'
    }
  }, "Sign In \u2192"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1024,
      margin: '8px auto 0',
      width: '100%',
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 10,
      color: '#52525b'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      textTransform: 'uppercase',
      letterSpacing: '0.1em'
    }
  }, "\xB7 shinkai"), /*#__PURE__*/React.createElement("span", null, "NAS Auth \xB7 v4.2.0")));
}
function Panel({
  src,
  rot,
  area
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      gridArea: area,
      position: 'relative',
      background: '#000',
      border: '6px solid #000',
      boxShadow: '0 8px 24px rgb(0 0 0 / 0.6)',
      overflow: 'hidden',
      transform: `rotate(${rot}deg)`
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: "",
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }));
}
function CLabel({
  children
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontFamily: 'var(--font-mono)',
      textTransform: 'uppercase',
      letterSpacing: '0.2em',
      color: '#3f3f46',
      marginBottom: -6
    }
  }, children);
}
Object.assign(window, {
  Login
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/bindery-web/Login.jsx", error: String((e && e.message) || e) }); }

// ui_kits/bindery-web/Reader.jsx
try { (() => {
/* Bindery UI kit — immersive Reader. Always dark, theme-independent chrome. */

function Reader({
  series,
  chapter,
  onBack
}) {
  const total = 18 + chapter * 7 % 14;
  const [page, setPage] = React.useState(8);
  const [chromeOn, setChromeOn] = React.useState(true);
  const pct = page / total * 100;
  const go = d => setPage(p => Math.max(1, Math.min(total, p + d)));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      background: '#0a0a0a',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    title: "Back",
    "aria-label": "Back",
    style: {
      position: 'absolute',
      top: 16,
      left: 16,
      zIndex: 40,
      padding: 10,
      borderRadius: '50%',
      background: 'rgb(0 0 0 / 0.5)',
      backdropFilter: 'blur(12px)',
      color: '#fff',
      border: 'none',
      cursor: 'pointer',
      boxShadow: 'var(--shadow-lg)',
      display: 'inline-flex'
    }
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "arrow-left",
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    onClick: () => setChromeOn(c => !c),
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: '88%',
      aspectRatio: '2/3',
      maxWidth: '94%',
      background: '#15110d',
      borderRadius: 2,
      overflow: 'hidden',
      boxShadow: '0 20px 60px rgb(0 0 0 / 0.6)'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: series.cover,
    alt: `Page ${page}`,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      filter: 'grayscale(0.15) contrast(1.05)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 10,
      right: 12,
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      color: '#fff',
      background: 'rgb(0 0 0 / 0.55)',
      padding: '2px 8px',
      borderRadius: 4
    }
  }, page, " / ", total)), chromeOn && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      go(-1);
    },
    title: "Previous page",
    "aria-label": "Previous page",
    style: edgeNav('left')
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "chevron-left",
    size: 28
  })), /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      go(1);
    },
    title: "Next page",
    "aria-label": "Next page",
    style: edgeNav('right')
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "chevron-right",
    size: 28
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      transform: chromeOn ? 'translateY(0)' : 'translateY(110%)',
      transition: 'transform 250ms var(--ease)',
      background: 'rgb(0 0 0 / 0.9)',
      backdropFilter: 'blur(12px)',
      padding: '12px 18px 18px',
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 720,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      opacity: 0.7,
      textAlign: 'center',
      marginBottom: 8
    }
  }, series.name, " \xB7 Chapter ", chapter), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => go(-1),
    title: "Previous",
    "aria-label": "Previous",
    style: readerBtn
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "chevron-left",
    size: 20
  })), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "1",
    max: total,
    value: page,
    onChange: e => setPage(+e.target.value),
    style: {
      flex: 1,
      accentColor: 'rgb(var(--accent))'
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "bindery-nums",
    style: {
      fontSize: 13,
      minWidth: 54,
      textAlign: 'center'
    }
  }, page, " / ", total), /*#__PURE__*/React.createElement("button", {
    onClick: () => go(1),
    title: "Next",
    "aria-label": "Next",
    style: readerBtn
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "chevron-right",
    size: 20
  })), /*#__PURE__*/React.createElement("button", {
    title: "Fit mode",
    "aria-label": "Fit mode",
    style: readerBtn
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "maximize",
    size: 18
  })), /*#__PURE__*/React.createElement("button", {
    title: "Translate",
    "aria-label": "Translate",
    style: readerBtn
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "languages",
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 3,
      background: 'rgb(255 255 255 / 0.15)',
      borderRadius: 2,
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${pct}%`,
      background: 'rgb(var(--accent))',
      borderRadius: 2
    }
  })))));
}
const readerBtn = {
  background: 'transparent',
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
  padding: 8,
  borderRadius: 6,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center'
};
function edgeNav(side) {
  return {
    position: 'absolute',
    top: '50%',
    [side]: 18,
    transform: 'translateY(-50%)',
    zIndex: 30,
    background: 'rgb(0 0 0 / 0.4)',
    backdropFilter: 'blur(8px)',
    color: '#fff',
    border: 'none',
    width: 48,
    height: 48,
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  };
}
Object.assign(window, {
  Reader
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/bindery-web/Reader.jsx", error: String((e && e.message) || e) }); }

// ui_kits/bindery-web/Series.jsx
try { (() => {
/* Bindery UI kit — Series detail page (immersive cover hero + rich states). */

const {
  Button,
  IconButton,
  Badge,
  StatusPill,
  Tag,
  CoverThumb,
  Avatar,
  ProgressBar,
  SegmentedControl,
  Kicker
} = window.DS;
function Series({
  series,
  onBack,
  onOpenChapter,
  onOpenMenu
}) {
  const chs = window.chapters(series);
  const [fav, setFav] = React.useState(false);
  const [pinned, setPinned] = React.useState(!!series.pinned);
  const [view, setView] = React.useState('list');
  const [save, setSave] = React.useState(series.savedOffline ? 'saved' : 'idle'); // idle | saving | saved

  const pct = series.ch > 0 ? Math.round(series.read / series.ch * 100) : 0;
  const favCount = (series.favoritedBy ? series.favoritedBy.length : 0) + (fav ? 1 : 0);
  const continueN = series.read > 0 && series.read < series.ch ? series.read + 1 : 1;
  const startLabel = series.read >= series.ch ? 'Re-read' : series.read > 0 ? 'Continue reading' : 'Start reading';
  const doSave = () => {
    if (save === 'saved') {
      setSave('idle');
      return;
    }
    setSave('saving');
    setTimeout(() => setSave('saved'), 1400);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100dvh',
      background: 'var(--bg-page)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
      height: 300
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: series.cover,
    alt: "",
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      filter: 'blur(30px) brightness(0.45)',
      transform: 'scale(1.15)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(to bottom, rgb(0 0 0 / 0.25) 0%, rgb(0 0 0 / 0.45) 50%, var(--bg-page) 100%)'
    }
  })), /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    title: "Back",
    "aria-label": "Back",
    style: floatBtn('left')
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "arrow-left",
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 40,
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onOpenMenu,
    title: "Profile",
    "aria-label": "Profile",
    style: {
      ...floatBtn(),
      position: 'static',
      padding: 6
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    username: "Jammo",
    size: "md",
    variant: "onDark"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      maxWidth: 1024,
      margin: '0 auto',
      padding: '56px 24px 0',
      display: 'flex',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: series.cover,
    alt: series.name,
    style: {
      width: 188,
      aspectRatio: '2/3',
      objectFit: 'cover',
      borderRadius: 12,
      boxShadow: 'var(--shadow-2xl)',
      flexShrink: 0,
      alignSelf: 'flex-start'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 30,
      color: '#fff',
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(StatusPill, {
    status: series.status
  }), series.score > 0 && /*#__PURE__*/React.createElement(Stat, {
    icon: "star",
    tone: "#fde68a"
  }, series.score.toFixed(1)), favCount > 0 && /*#__PURE__*/React.createElement(Stat, {
    icon: "heart",
    tone: "#fca5a5"
  }, favCount), series.savedOffline && /*#__PURE__*/React.createElement(Stat, {
    icon: "download",
    tone: "#86efac"
  }, "Offline")), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 32,
      fontWeight: 700,
      lineHeight: 1.08,
      textShadow: '0 2px 10px rgb(0 0 0 / 0.5)'
    }
  }, series.name), series.en && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      opacity: 0.85,
      marginTop: 4
    }
  }, series.en), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 14,
      fontSize: 13,
      opacity: 0.9
    },
    className: "bindery-nums"
  }, /*#__PURE__*/React.createElement("span", null, series.year), /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.4
    }
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, series.ch, " chapters"), /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.4
    }
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, series.read, "/", series.ch, " read")), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 320,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6,
      background: 'rgb(255 255 255 / 0.2)',
      borderRadius: 999,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: pct + '%',
      background: 'rgb(var(--accent))',
      borderRadius: 999
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      opacity: 0.7,
      marginTop: 4
    },
    className: "bindery-nums"
  }, pct, "% complete")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 14
    }
  }, series.tags.map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      fontSize: 11,
      padding: '2px 8px',
      borderRadius: 999,
      background: 'rgb(255 255 255 / 0.18)',
      backdropFilter: 'blur(4px)',
      textTransform: 'capitalize'
    }
  }, t))), series.source && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 14,
      fontSize: 12,
      opacity: 0.8
    }
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "refresh-cw",
    size: 13
  }), " Synced from ", series.source, /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.5
    }
  }, "\xB7 ", series.lastSync), series.neww > 0 && /*#__PURE__*/React.createElement(Badge, {
    intent: "new"
  }, "+", series.neww, " New"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1024,
      margin: '0 auto',
      padding: '20px 24px 48px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      alignItems: 'center',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    iconLeft: /*#__PURE__*/React.createElement(Ic, {
      name: "book-open",
      size: 18
    }),
    onClick: () => onOpenChapter(series, continueN)
  }, startLabel), /*#__PURE__*/React.createElement(Button, {
    variant: fav ? 'primary' : 'secondary',
    size: "lg",
    iconLeft: /*#__PURE__*/React.createElement(Ic, {
      name: "heart",
      size: 18
    }),
    onClick: () => setFav(f => !f)
  }, fav ? 'Recommended' : 'Recommend'), save === 'saving' ? /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "lg",
    iconLeft: /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        animation: 'by-spin 0.9s linear infinite'
      }
    }, /*#__PURE__*/React.createElement(Ic, {
      name: "loader",
      size: 18
    }))
  }, "Saving\u2026") : /*#__PURE__*/React.createElement(Button, {
    variant: save === 'saved' ? 'primary' : 'secondary',
    size: "lg",
    iconLeft: /*#__PURE__*/React.createElement(Ic, {
      name: save === 'saved' ? 'check' : 'download',
      size: 18
    }),
    onClick: doSave
  }, save === 'saved' ? 'Saved offline' : 'Save offline'), /*#__PURE__*/React.createElement(IconButton, {
    title: pinned ? 'Unpin' : 'Pin to currently reading',
    active: pinned,
    onClick: () => setPinned(p => !p)
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "pin",
    size: 18
  })), /*#__PURE__*/React.createElement(IconButton, {
    title: "More",
    onClick: onOpenMenu
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "ellipsis",
    size: 18
  }))), series.favoritedBy && series.favoritedBy.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 18,
      padding: '8px 12px',
      background: 'rgb(var(--accent)/0.10)',
      borderRadius: 10,
      width: 'fit-content'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex'
    }
  }, series.favoritedBy.map((u, i) => /*#__PURE__*/React.createElement("span", {
    key: u,
    style: {
      marginLeft: i ? -8 : 0,
      boxShadow: '0 0 0 2px var(--bg-page)',
      borderRadius: '50%'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    username: u,
    size: "sm"
  })))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--text-secondary)'
    }
  }, "Recommended by ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--text-body)'
    }
  }, series.favoritedBy.join(', ')))), /*#__PURE__*/React.createElement("p", {
    style: {
      maxWidth: 720,
      fontSize: 15,
      lineHeight: 1.6,
      color: 'var(--text-secondary)',
      marginBottom: 28
    }
  }, series.synopsis), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Kicker, {
    count: series.ch
  }, "Chapters"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--text-muted)'
    },
    className: "bindery-nums"
  }, series.read, " read \xB7 ", series.ch - series.read, " left"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    iconLeft: /*#__PURE__*/React.createElement(Ic, {
      name: "check-check",
      size: 15
    })
  }, "Mark all read"), /*#__PURE__*/React.createElement(SegmentedControl, {
    options: [{
      value: 'list',
      label: '',
      icon: /*#__PURE__*/React.createElement(Ic, {
        name: "list",
        size: 15
      })
    }, {
      value: 'grid',
      label: '',
      icon: /*#__PURE__*/React.createElement(Ic, {
        name: "layout-grid",
        size: 15
      })
    }],
    value: view,
    onChange: setView
  })), view === 'grid' ? /*#__PURE__*/React.createElement(ChapterGrid, {
    series: series,
    chs: chs,
    onOpen: onOpenChapter
  }) : /*#__PURE__*/React.createElement(ChapterList, {
    series: series,
    chs: chs,
    onOpen: onOpenChapter
  })));
}

/* ---- Chapter grid (cover thumbnails with state badges) ---- */
function ChapterGrid({
  series,
  chs,
  onOpen
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 1fr)',
      gap: 16
    },
    className: "lib-grid"
  }, chs.map(c => /*#__PURE__*/React.createElement(CoverThumb, {
    key: c.n,
    src: series.cover,
    title: c.file,
    meta: /*#__PURE__*/React.createElement("span", {
      className: "bindery-nums"
    }, c.pages, " pages"),
    onClick: () => onOpen(series, c.n),
    read: c.read,
    progress: c.inProg ? c.progress : null,
    badgeTL: c.downloaded ? /*#__PURE__*/React.createElement("span", {
      title: "Saved offline",
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: 'rgb(var(--success)/0.95)',
        color: '#fff'
      }
    }, /*#__PURE__*/React.createElement(Ic, {
      name: "download",
      size: 10
    })) : null,
    badgeTR: c.partial ? /*#__PURE__*/React.createElement(Badge, {
      intent: "warning",
      pill: true
    }, /*#__PURE__*/React.createElement(Ic, {
      name: "triangle-alert",
      size: 9
    }), " ", c.partial.ok, "/", c.partial.total) : c.read ? /*#__PURE__*/React.createElement(Badge, {
      intent: "success",
      pill: true
    }, /*#__PURE__*/React.createElement(Ic, {
      name: "check",
      size: 9
    }), " Read") : c.inProg ? /*#__PURE__*/React.createElement(Badge, {
      intent: "accent",
      pill: true
    }, "p.", c.page) : c.isNew ? /*#__PURE__*/React.createElement(Badge, {
      intent: "new"
    }, "New") : null
  })));
}

/* ---- Chapter list (dense rows that spell out every state) ---- */
function ChapterList({
  series,
  chs,
  onOpen
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, chs.map(c => {
    const state = c.partial ? 'partial' : c.read ? 'read' : c.inProg ? 'inprog' : c.isNew ? 'new' : 'unread';
    const numBg = c.read ? 'rgb(var(--success)/0.15)' : c.inProg ? 'rgb(var(--accent)/0.15)' : 'var(--bg-subtle)';
    const numColor = c.read ? 'var(--color-success)' : c.inProg ? 'var(--color-accent)' : 'var(--text-tertiary)';
    return /*#__PURE__*/React.createElement("button", {
      key: c.n,
      onClick: () => onOpen(series, c.n),
      className: "by-card by-card--interactive",
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 14px',
        textAlign: 'left',
        background: 'var(--surface-card)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 34,
        height: 34,
        borderRadius: 8,
        background: numBg,
        color: numColor,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontWeight: 600,
        fontSize: 13
      },
      className: "bindery-nums"
    }, c.read ? /*#__PURE__*/React.createElement(Ic, {
      name: "check",
      size: 16
    }) : c.n), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 500,
        color: 'var(--text-body)',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, c.file, c.downloaded && /*#__PURE__*/React.createElement("span", {
      title: "Saved offline",
      style: {
        color: 'var(--color-success)',
        display: 'inline-flex'
      }
    }, /*#__PURE__*/React.createElement(Ic, {
      name: "download",
      size: 13
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--text-tertiary)',
        marginTop: 2
      },
      className: "bindery-nums"
    }, c.pages, " pages", c.inProg ? ` · on page ${c.page}` : '', c.partial ? ` · ${c.partial.ok} of ${c.partial.total} downloaded` : ''), c.inProg && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 6,
        maxWidth: 220
      }
    }, /*#__PURE__*/React.createElement(ProgressBar, {
      value: c.progress
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        flexShrink: 0
      }
    }, state === 'partial' && /*#__PURE__*/React.createElement(Badge, {
      intent: "warning",
      pill: true
    }, /*#__PURE__*/React.createElement(Ic, {
      name: "triangle-alert",
      size: 10
    }), " Partial"), state === 'read' && /*#__PURE__*/React.createElement(Badge, {
      intent: "success",
      pill: true
    }, "Read"), state === 'inprog' && /*#__PURE__*/React.createElement(Badge, {
      intent: "accent",
      pill: true
    }, "Reading \xB7 p.", c.page), state === 'new' && /*#__PURE__*/React.createElement(Badge, {
      intent: "new"
    }, "New"), state === 'unread' && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: 'var(--text-muted)'
      }
    }, "Unread")), /*#__PURE__*/React.createElement(Ic, {
      name: "chevron-right",
      size: 16,
      style: {
        color: 'var(--text-muted)',
        flexShrink: 0
      }
    }));
  }));
}
function Stat({
  icon,
  tone,
  children
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 13,
      color: tone
    }
  }, /*#__PURE__*/React.createElement(Ic, {
    name: icon,
    size: 13,
    style: {
      color: tone
    }
  }), " ", children);
}
function floatBtn(side) {
  return {
    position: side ? 'absolute' : 'static',
    top: 16,
    [side || '_']: 16,
    zIndex: 40,
    padding: 10,
    borderRadius: '50%',
    background: 'rgb(0 0 0 / 0.4)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-lg)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  };
}
Object.assign(window, {
  Series
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/bindery-web/Series.jsx", error: String((e && e.message) || e) }); }

// ui_kits/bindery-web/chrome.jsx
try { (() => {
/* Bindery UI kit — shared chrome: page header + profile menu sheet. */

const {
  Avatar,
  IconButton,
  SegmentedControl
} = window.DS;

/* Slim sticky page header (Library / Discover shape). */
function Header({
  onNav,
  onOpenMenu,
  route
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 30,
      background: 'var(--chrome-bg)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-default)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1280,
      margin: '0 auto',
      padding: '6px 16px',
      height: 48,
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => onNav('library'),
    style: {
      display: 'flex',
      background: 'none',
      border: 'none',
      padding: 0,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: window.ART.fox,
    alt: "Bindery",
    width: "32",
    height: "32",
    style: {
      borderRadius: 6
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(IconButton, {
    title: "Discover",
    active: route === 'discover',
    onClick: () => onNav('discover')
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "compass"
  })), /*#__PURE__*/React.createElement(NotificationBell, null), /*#__PURE__*/React.createElement("button", {
    onClick: onOpenMenu,
    title: "Profile",
    "aria-label": "Profile menu",
    style: {
      padding: 4,
      borderRadius: '50%',
      background: 'none',
      border: 'none',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    username: "Jammo",
    size: "md"
  }))));
}
function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    title: "Notifications",
    onClick: () => setOpen(o => !o)
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex'
    }
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "bell"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: -3,
      right: -3,
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--color-accent)',
      boxShadow: '0 0 0 2px var(--bg-page)'
    }
  }))), open && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 0,
      top: 44,
      width: 280,
      background: 'var(--surface-raised)',
      border: '1px solid var(--border-default)',
      borderRadius: 12,
      boxShadow: 'var(--shadow-2xl)',
      zIndex: 50,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 14px',
      borderBottom: '1px solid var(--border-subtle)'
    },
    className: "bindery-kicker"
  }, "Notifications"), [['Frieren', '3 new chapters synced'], ['Dungeon Meshi', '2 new chapters synced'], ['Witch Hat Atelier', '1 new chapter synced']].map(([t, d], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: '10px 14px',
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-accent)',
      marginTop: 1
    }
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "book-open",
    size: 16
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      color: 'var(--text-body)'
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--text-tertiary)'
    }
  }, d))))));
}

/* Profile menu — bottom-sheet feel rendered as a right-anchored dropdown. */
function ProfileSheet({
  open,
  onClose,
  onNav,
  theme,
  setTheme,
  dark,
  setDark
}) {
  if (!open) return null;
  const Row = ({
    icon,
    label,
    onClick,
    destructive
  }) => /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 16px',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      textAlign: 'left',
      color: destructive ? 'var(--color-danger)' : 'var(--text-body)',
      fontSize: 14
    },
    onMouseEnter: e => e.currentTarget.style.background = destructive ? 'rgb(var(--danger)/0.1)' : 'var(--bg-subtle)',
    onMouseLeave: e => e.currentTarget.style.background = 'none'
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: destructive ? 'var(--color-danger)' : 'var(--text-tertiary)',
      display: 'inline-flex'
    }
  }, icon), label);
  const themes = [['', 'Default'], ['midnight', 'Midnight'], ['mocha', 'Mocha'], ['tankobon-dark', 'Tankobon'], ['latte', 'Latte'], ['dawn', 'Dawn'], ['gruvbox-sand', 'Gruvbox'], ['newsprint', 'Newsprint']];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 50
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgb(0 0 0 / 0.1)',
      border: 'none',
      cursor: 'pointer'
    }
  }), /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    style: {
      position: 'fixed',
      right: 12,
      top: 56,
      width: 288,
      background: 'var(--surface-raised)',
      borderRadius: 12,
      boxShadow: 'var(--shadow-2xl)',
      border: '1px solid var(--border-default)',
      overflow: 'hidden',
      maxHeight: '85vh',
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 16px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    username: "Jammo",
    size: "lg"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--text-body)',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, "Jammo", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      padding: '2px 6px',
      borderRadius: 4,
      background: 'rgb(var(--accent)/0.15)',
      color: 'var(--color-accent)',
      fontWeight: 600
    }
  }, "Admin")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--text-muted)'
    }
  }, "Signed in"))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement(Row, {
    icon: /*#__PURE__*/React.createElement(Ic, {
      name: "home",
      size: 16
    }),
    label: "Library",
    onClick: () => {
      onClose();
      onNav('library');
    }
  }), /*#__PURE__*/React.createElement(Row, {
    icon: /*#__PURE__*/React.createElement(Ic, {
      name: "compass",
      size: 16
    }),
    label: "Discover",
    onClick: () => {
      onClose();
      onNav('discover');
    }
  }), /*#__PURE__*/React.createElement(Row, {
    icon: /*#__PURE__*/React.createElement(Ic, {
      name: "folder-plus",
      size: 16
    }),
    label: "Import",
    onClick: onClose
  }), /*#__PURE__*/React.createElement(Row, {
    icon: /*#__PURE__*/React.createElement(Ic, {
      name: "shield",
      size: 16
    }),
    label: "Admin",
    onClick: () => {
      onClose();
      onNav('admin');
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--border-subtle)',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--text-heading)'
    }
  }, "Mode"), /*#__PURE__*/React.createElement(SegmentedControl, {
    options: [{
      value: 'light',
      label: '',
      icon: /*#__PURE__*/React.createElement(Ic, {
        name: "sun",
        size: 14
      })
    }, {
      value: 'dark',
      label: '',
      icon: /*#__PURE__*/React.createElement(Ic, {
        name: "moon",
        size: 14
      })
    }],
    value: dark ? 'dark' : 'light',
    onChange: v => setDark(v === 'dark')
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--border-subtle)',
      padding: '10px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "bindery-kicker",
    style: {
      marginBottom: 8
    }
  }, "Theme"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 6
    }
  }, themes.map(([id, name]) => /*#__PURE__*/React.createElement("button", {
    key: id,
    onClick: () => setTheme(id),
    title: name,
    "data-theme": id,
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
      padding: '7px 4px',
      borderRadius: 8,
      cursor: 'pointer',
      border: theme === id ? '2px solid var(--color-accent)' : '1px solid var(--border-default)',
      background: 'var(--surface-card)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 18,
      height: 18,
      borderRadius: '50%',
      background: 'rgb(var(--accent))'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      color: 'var(--text-tertiary)'
    }
  }, name))))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement(Row, {
    icon: /*#__PURE__*/React.createElement(Ic, {
      name: "settings",
      size: 16
    }),
    label: "Settings",
    onClick: onClose
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement(Row, {
    icon: /*#__PURE__*/React.createElement(Ic, {
      name: "log-out",
      size: 16
    }),
    label: "Sign out",
    destructive: true,
    onClick: () => {
      onClose();
      onNav('login');
    }
  }))));
}
Object.assign(window, {
  Header,
  ProfileSheet
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/bindery-web/chrome.jsx", error: String((e && e.message) || e) }); }

// ui_kits/bindery-web/lib.jsx
try { (() => {
/* Bindery UI kit — shared helpers, fake data, and chrome.
   Exposes everything on window for the other Babel scripts. */

const DS = window.BinderyDesignSystem_cd2bc2;

/* ---- Lucide icon helper ----
   Renders the SVG via innerHTML (NOT createIcons) so Lucide never replaces a
   React-owned node — that swap makes React's later removeChild throw on unmount
   and blanks the whole app. innerHTML content is opaque to React, so it's safe. */
function kebabToPascal(name) {
  return name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}
function Ic({
  name,
  size = 18,
  style
}) {
  const html = React.useMemo(() => {
    const L = window.lucide;
    if (!L) return '';
    const node = L.icons && L.icons[kebabToPascal(name)] || L[kebabToPascal(name)];
    if (!node || !L.createElement) return '';
    const el = L.createElement(node);
    el.setAttribute('width', size);
    el.setAttribute('height', size);
    return el.outerHTML;
  }, [name, size]);
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: size,
      height: size,
      ...style
    },
    dangerouslySetInnerHTML: {
      __html: html
    }
  });
}

/* ---- Asset paths ---- */
const ART = {
  fox: '../../assets/logo.png',
  forest: '../../assets/login-bg/login-bg-1.jpg',
  bg2: '../../assets/login-bg/login-bg-2.jpg',
  bg3: '../../assets/login-bg/login-bg-3.jpg',
  manga: '../../assets/placeholders/manga.png',
  discover: '../../assets/placeholders/discover-online.png',
  import: '../../assets/placeholders/import-first.png',
  // Real manga / manhwa covers (user-supplied)
  cFairy: '../../assets/covers/fairy-tail.jpg',
  cDnd: '../../assets/covers/dnd.jpg',
  cDungeon: '../../assets/covers/dungeon-levelup.jpg',
  cChainsaw: '../../assets/covers/chainsaw-man.jpg',
  cGluttony: '../../assets/covers/berserk-gluttony.jpg',
  cArifureta: '../../assets/covers/arifureta.jpg',
  cRepair: '../../assets/covers/repair-skill.jpg',
  cLevel1: '../../assets/covers/level-1-player.jpg',
  cWise: '../../assets/covers/wise-man.jpg',
  cPaladin: '../../assets/covers/paladin.jpg',
  cRomcom: '../../assets/covers/skill-romcom.jpg',
  cAtm: '../../assets/covers/atm-ojisan.jpg'
};
// Discover stand-in covers, cycled from the real cover art.
const COVERS = [];

/* ---- Fake library — real titles matched to their cover art ---- */
const SERIES = [{
  id: 's1',
  name: 'Fairy Tail',
  en: null,
  year: 2006,
  ch: 12,
  read: 5,
  score: 7.6,
  status: 'ongoing',
  cover: ART.cFairy,
  neww: 3,
  pinned: true,
  tags: ['fantasy', 'adventure', 'shounen'],
  synopsis: 'A celestial-spirit mage and a fire-breathing dragon slayer take jobs for the rowdiest guild in Fiore \u2014 and find a family in the chaos.'
}, {
  id: 's2',
  name: 'Dungeons & Dragons',
  en: 'Library Collection',
  year: 2021,
  ch: 10,
  read: 10,
  score: 8.0,
  status: 'completed',
  cover: ART.cDnd,
  saved: true,
  tags: ['fantasy', 'adventure'],
  synopsis: 'A drow ranger and his companions are hunted through the Underdark in this collected run of the tabletop world\u2019s comics.'
}, {
  id: 's3',
  name: 'Level-Up Alone',
  en: 'Dungeon Monopoly',
  year: 2022,
  ch: 8,
  read: 2,
  score: 8.4,
  status: 'ongoing',
  cover: ART.cDungeon,
  neww: 2,
  tags: ['action', 'fantasy', 'manhwa'],
  synopsis: 'A weak hunter discovers a dungeon only he can enter \u2014 and starts climbing it one quiet, ruthless level at a time.'
}, {
  id: 's4',
  name: 'Chainsaw Man',
  en: null,
  year: 2018,
  ch: 16,
  read: 9,
  score: 8.6,
  status: 'ongoing',
  cover: ART.cChainsaw,
  neww: 0,
  tags: ['action', 'horror', 'seinen'],
  synopsis: 'A broke devil-hunter merges with his chainsaw dog and is drafted into a government squad that kills devils for a living.'
}, {
  id: 's5',
  name: 'Berserk of Gluttony',
  en: null,
  year: 2017,
  ch: 11,
  read: 3,
  score: 7.8,
  status: 'ongoing',
  cover: ART.cGluttony,
  neww: 1,
  tags: ['fantasy', 'action'],
  synopsis: 'A guardsman with a useless, ever-hungry skill learns it can devour the strength of anything he kills.'
}, {
  id: 's6',
  name: 'Arifureta',
  en: 'From Commonplace to Strongest',
  year: 2018,
  ch: 14,
  read: 8,
  score: 7.5,
  status: 'ongoing',
  cover: ART.cArifureta,
  neww: 0,
  tags: ['isekai', 'fantasy', 'harem'],
  synopsis: 'Betrayed and left for dead in a labyrinth, an ordinary classmate claws his way back up as something monstrous.'
}, {
  id: 's7',
  name: 'My Repair Skill',
  en: 'Became a Versatile Cheat',
  year: 2021,
  ch: 9,
  read: 0,
  score: 7.2,
  status: 'ongoing',
  cover: ART.cRepair,
  tags: ['isekai', 'fantasy', 'comedy'],
  synopsis: 'Summoned with a skill everyone calls worthless, a young man opens a weapon shop \u2014 and quietly breaks the rules of repair.'
}, {
  id: 's8',
  name: 'Level 1 Player',
  en: null,
  year: 2023,
  ch: 12,
  read: 4,
  score: 8.1,
  status: 'ongoing',
  cover: ART.cLevel1,
  neww: 4,
  tags: ['action', 'manhwa'],
  synopsis: 'Stuck at level one while the world levels past him, one player finds the single exploit the system never patched.'
}, {
  id: 's9',
  name: 'Reincarnated as a Sage',
  en: 'Adventurer Life',
  year: 2018,
  ch: 8,
  read: 8,
  score: 7.4,
  status: 'completed',
  cover: ART.cWise,
  saved: true,
  tags: ['isekai', 'fantasy'],
  synopsis: 'Reborn into a world of magic, a salaryman rebuilds spellcraft from first principles and lives the adventurer life he always wanted.'
}, {
  id: 's10',
  name: 'The Faraway Paladin',
  en: null,
  year: 2017,
  ch: 20,
  read: 14,
  score: 8.3,
  status: 'hiatus',
  cover: ART.cPaladin,
  tags: ['fantasy', 'adventure'],
  synopsis: 'Raised in a city of the dead by three undead guardians, a boy sets out to learn what it means to be alive.'
}, {
  id: 's11',
  name: 'Flirting in Another World',
  en: 'With My Given Skill',
  year: 2022,
  ch: 6,
  read: 0,
  score: 6.9,
  status: 'ongoing',
  cover: ART.cRomcom,
  tags: ['romance', 'ecchi', 'nsfw'],
  synopsis: 'A gifted appraiser would rather spend his cheat skill charming the beauties of the new world than saving it.'
}, {
  id: 's12',
  name: 'ATM Ojisan',
  en: null,
  year: 2020,
  ch: 13,
  read: 6,
  score: 7.0,
  status: 'completed',
  cover: ART.cAtm,
  tags: ['comedy', 'isekai'],
  synopsis: 'An ordinary office worker is reborn into a fantasy world where, inexplicably, he is everyone\u2019s favorite walking treasury.'
}];

// Discover stand-ins reuse the library's real cover art.
SERIES.forEach(s => COVERS.push(s.cover));

// Augment with subscription / offline / recommend state for the Series page.
SERIES.forEach((s, i) => {
  s.savedOffline = !!s.saved; // explicitly saved-for-offline
  s.source = s.status === 'ongoing' ? ['MangaDex', 'MangaFox', 'Rawkuma'][i % 3] : null;
  s.lastSync = s.status === 'ongoing' ? ['2h ago', 'yesterday', '3d ago'][i % 3] : null;
});
SERIES[0].favoritedBy = ['Kira', 'Mio']; // Fairy Tail — recommended by household
SERIES[3].favoritedBy = ['Kira']; // Chainsaw Man
SERIES[7].favoritedBy = ['Mio', 'Ren', 'Kira']; // Level 1 Player
SERIES[4].partialLast = true; // Berserk of Gluttony — last chapter partial

/* Chapter list with the full range of per-chapter states:
   read · in-progress · unread · new · downloaded (offline) · partial. */
function chapters(s) {
  const out = [];
  for (let i = 0; i < s.ch; i++) {
    const n = i + 1;
    const pages = 18 + n * 7 % 14;
    const isRead = i < s.read;
    const inProg = i === s.read && s.read > 0 && s.read < s.ch;
    const isNew = s.neww > 0 && i >= s.ch - s.neww; // last `neww` are freshly synced
    const downloaded = isRead || inProg; // cached what you've opened
    const partial = s.partialLast && i === s.ch - 1 ? {
      ok: pages - 5,
      total: pages,
      retry: 2
    } : null;
    const page = inProg ? Math.floor(pages * 0.4) : 0;
    out.push({
      n,
      file: `Chapter ${n}`,
      pages,
      read: isRead,
      inProg,
      isNew,
      downloaded,
      partial,
      page,
      progress: inProg ? 40 : 0
    });
  }
  return out;
}
const CONTINUE = [{
  s: SERIES[0],
  ch: 6,
  page: 9,
  pages: 24
}, {
  s: SERIES[5],
  ch: 10,
  page: 14,
  pages: 31
}, {
  s: SERIES[2],
  ch: 3,
  page: 5,
  pages: 20
}, {
  s: SERIES[9],
  ch: 15,
  page: 22,
  pages: 28
}];

/* ---- Admin fake data ---- */
const ADMIN_STATS = {
  version: '4.2.0',
  seriesCount: 12,
  chapterCount: 148,
  librarySize: 6_180_000_000,
  dataSize: 214_000_000
};
const TASKS = [{
  id: 't1',
  title: 'Chainsaw Man',
  status: 'downloading',
  cur: 7,
  total: 16,
  chapter: '7'
}, {
  id: 't2',
  title: 'Level 1 Player',
  status: 'downloading',
  cur: 3,
  total: 12,
  chapter: '3'
}, {
  id: 't3',
  title: 'Berserk of Gluttony',
  status: 'queued',
  cur: 0,
  total: 11,
  chapter: null
}, {
  id: 't4',
  title: 'The Faraway Paladin',
  status: 'queued',
  cur: 0,
  total: 20,
  chapter: null
}, {
  id: 't5',
  title: 'Fairy Tail',
  status: 'complete',
  cur: 12,
  total: 12,
  chapter: null
}, {
  id: 't6',
  title: 'ATM Ojisan',
  status: 'error',
  cur: 4,
  total: 13,
  chapter: null,
  error: 'Source blocked by Cloudflare — try the manga-finder extension'
}];
const SUBSCRIPTIONS = SERIES.filter(s => s.source).map(s => ({
  id: s.id,
  name: s.name,
  en: s.en,
  source: s.source,
  mangaId: s.id.replace('s', '') + '-' + s.name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 8),
  chapterCount: s.ch,
  newChapterCount: s.neww || 0,
  lastSync: s.lastSync
}));
const USERS = [{
  username: 'Jammo',
  admin: true,
  collection: 12,
  read: 64,
  tracked: 4
}, {
  username: 'Kira',
  admin: false,
  collection: 8,
  read: 41,
  tracked: 3
}, {
  username: 'Mio',
  admin: false,
  collection: 15,
  read: 92,
  tracked: 6
}, {
  username: 'Ren',
  admin: false,
  collection: 3,
  read: 7,
  tracked: 1
}];
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}
Object.assign(window, {
  DS,
  Ic,
  ART,
  COVERS,
  SERIES,
  CONTINUE,
  chapters,
  ADMIN_STATS,
  TASKS,
  SUBSCRIPTIONS,
  USERS,
  formatBytes
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/bindery-web/lib.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.StatusPill = __ds_scope.StatusPill;

__ds_ns.Kicker = __ds_scope.Kicker;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.CoverThumb = __ds_scope.CoverThumb;

__ds_ns.Card = __ds_scope.Card;

})();
