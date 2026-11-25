import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export interface PreviewTopBarProps {
  mangaTitle: string;
  chapterLabel: string;
  onClose: () => void;
  /** Right-hand slot, e.g. the page counter. */
  children?: ReactNode;
}

/** The preview reader's top bar: close X, title and chapter label. */
export default function PreviewTopBar({ mangaTitle, chapterLabel, onClose, children }: PreviewTopBarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-900/90 backdrop-blur-sm shrink-0 z-10">
      <button
        onClick={onClose}
        className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
        aria-label="Close reader"
      >
        <X size={20} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{mangaTitle}</div>
        <div className="text-xs text-gray-400 truncate">{chapterLabel}</div>
      </div>
      {children}
    </div>
  );
}
