import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Compass, FolderPlus, Shield, Home, Settings, LogOut,
  Sun, Moon,
} from 'lucide-react';
import { useAuth } from '../App';
import { useTheme } from '../lib/theme';
import Avatar from './Avatar';

/**
 * The user's persistent menu — replaces the old hamburger + UserMenu nesting.
 *
 * The trigger is the user's Avatar (initial circle). One tap opens a single
 * flat menu — no nested popups.
 *
 *   - Mobile (< sm): bottom sheet with drag handle.
 *   - Desktop (sm+): right-anchored dropdown.
 *
 * Identity surfaces at the top (avatar + username + Admin pill).
 * Page-specific actions can be injected via the `items` prop — they render
 * directly under the identity header, BEFORE global navigation. Used by
 * AdminPage for bulk actions and SeriesPage for series admin actions.
 */
export interface ProfileMenuItem {
  icon?: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  /** Don't auto-close the menu on click. Use for in-place progress (e.g. Save offline). */
  keepOpen?: boolean;
}

export interface ProfileMenuSection {
  title?: string;
  items: ProfileMenuItem[];
}

interface ProfileMenuProps {
  /** Per-page action sections shown above global navigation. */
  sections?: ProfileMenuSection[];
  /**
   * Trigger styling.
   *   `header`   — plain avatar in a hover-bg button. Use in page headers.
   *   `floating` — avatar inside a `bg-black/40 backdrop-blur-md` pill, for
   *                pages with a colorful hero (Series page over the cover backdrop).
   */
  triggerVariant?: 'header' | 'floating';
}

export default function ProfileMenu({ sections, triggerVariant = 'header' }: ProfileMenuProps) {
  const { username, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleDarkLight } = useTheme();
  const [open, setOpen] = useState(false);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Lock body scroll while sheet is open (mobile)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!username) return null;

  const go = (path: string) => () => { setOpen(false); navigate(path); };
  const handleItem = (item: ProfileMenuItem) => () => {
    item.onClick();
    if (!item.keepOpen) setOpen(false);
  };

  // Skip the current page from the navigation list.
  const onAdmin = location.pathname === '/admin';
  const onImport = location.pathname === '/import';
  const onDiscover = location.pathname === '/discover';
  const onLibrary = location.pathname === '/';

  return (
    <>
      {/* ===== Trigger ===== */}
      {triggerVariant === 'floating' ? (
        <button
          onClick={() => setOpen(true)}
          aria-label={`Profile menu for ${username}`}
          title="Profile"
          className="p-1.5 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 transition-colors shadow-lg"
        >
          <Avatar username={username} size="md" variant="onDark" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label={`Profile menu for ${username}`}
          title="Profile"
          className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
        >
          <Avatar username={username} size="md" />
        </button>
      )}

      {/* ===== Sheet / dropdown =====
          Portaled to document.body so it escapes any ancestor containing-block
          (e.g. headers with `backdrop-filter`/`transform` would otherwise trap
          a `position: fixed` child and clip the sheet to the header's box). */}
      {open && createPortal(
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-menu-username"
            className="fixed left-0 right-0 bottom-0 sm:left-auto sm:right-3 sm:bottom-auto sm:top-14 sm:w-72 bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 max-h-[90dvh] overflow-y-auto"
            style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
          >
            {/* Drag handle (mobile only) */}
            <div className="sm:hidden flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
            </div>

            {/* Identity header */}
            <div className="px-4 pt-3 sm:pt-4 pb-3 flex items-center gap-3">
              <Avatar username={username} size="lg" />
              <div className="flex-1 min-w-0">
                <p
                  id="profile-menu-username"
                  className="text-sm font-medium truncate flex items-center gap-1.5"
                >
                  {username}
                  {isAdmin && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/15 text-accent font-semibold">
                      Admin
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">Signed in</p>
              </div>
            </div>

            {/* Per-page action sections */}
            {sections && sections.map((section, idx) => (
              <SectionGroup key={idx} title={section.title}>
                {section.items.map((item, i) => (
                  <MenuRow
                    key={i}
                    icon={item.icon}
                    label={item.label}
                    hint={item.hint}
                    disabled={item.disabled}
                    destructive={item.destructive}
                    onClick={handleItem(item)}
                    keepOpen={item.keepOpen}
                  />
                ))}
              </SectionGroup>
            ))}

            {/* Global navigation — skip current page */}
            <SectionGroup>
              {!onLibrary && (
                <MenuRow icon={<Home size={16} />} label="Library" onClick={go('/')} />
              )}
              {isAdmin && !onAdmin && (
                <MenuRow icon={<Shield size={16} />} label="Admin" onClick={go('/admin')} />
              )}
              {!onImport && (
                <MenuRow icon={<FolderPlus size={16} />} label="Import" onClick={go('/import')} />
              )}
              {!onDiscover && (
                <MenuRow icon={<Compass size={16} />} label="Discover" onClick={go('/discover')} />
              )}
            </SectionGroup>

            {/* Theme — segmented control instead of a toggle button */}
            <SectionGroup>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-gray-700 dark:text-gray-300">Theme</span>
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-md p-0.5">
                  <button
                    onClick={() => { if (isDark) toggleDarkLight(); }}
                    aria-label="Light theme"
                    aria-pressed={!isDark}
                    className={`p-1.5 rounded transition-colors ${
                      !isDark
                        ? 'bg-white dark:bg-gray-700 text-amber-500 shadow-sm'
                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
                  >
                    <Sun size={14} />
                  </button>
                  <button
                    onClick={() => { if (!isDark) toggleDarkLight(); }}
                    aria-label="Dark theme"
                    aria-pressed={isDark}
                    className={`p-1.5 rounded transition-colors ${
                      isDark
                        ? 'bg-white dark:bg-gray-700 text-accent shadow-sm'
                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
                  >
                    <Moon size={14} />
                  </button>
                </div>
              </div>
            </SectionGroup>

            {/* Settings */}
            <SectionGroup>
              <MenuRow icon={<Settings size={16} />} label="Settings" onClick={go('/settings')} />
            </SectionGroup>

            {/* Sign out — destructive, last */}
            <SectionGroup>
              <MenuRow
                icon={<LogOut size={16} />}
                label="Sign out"
                destructive
                onClick={() => { setOpen(false); logout(); }}
              />
            </SectionGroup>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// ----- Subcomponents -----

function SectionGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 dark:border-gray-800">
      {title && (
        <p className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function MenuRow({
  icon, label, hint, onClick, disabled, destructive, keepOpen,
}: ProfileMenuItem & { onClick: () => void }) {
  return (
    <button
      onClick={(e) => { if (keepOpen) e.stopPropagation(); onClick(); }}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors disabled:opacity-50 disabled:cursor-default ${
        destructive
          ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
    >
      {icon && (
        <span className={destructive ? 'text-red-500 dark:text-red-400 shrink-0' : 'text-gray-500 dark:text-gray-400 shrink-0'}>
          {icon}
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-[11px] text-gray-400 dark:text-gray-500 truncate">{hint}</span>}
      </span>
    </button>
  );
}
