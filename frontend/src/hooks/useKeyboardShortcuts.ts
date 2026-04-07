import { useEffect, useCallback } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  callback: (e: KeyboardEvent) => void;
  description?: string;
  preventDefault?: boolean;
}

/**
 * Hook to register keyboard shortcuts with accessibility support
 * 
 * @example
 * useKeyboardShortcuts([
 *   { key: 's', ctrl: true, callback: handleSave, description: 'Save changes' },
 *   { key: 'Escape', callback: handleClose, description: 'Close dialog' }
 * ]);
 */
export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[]) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      shortcuts.forEach((shortcut) => {
        const keyMatches = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
        const altMatches = shortcut.alt ? e.altKey : !e.altKey;
        const shiftMatches = shortcut.shift ? e.shiftKey : !e.shiftKey;

        if (keyMatches && ctrlMatches && altMatches && shiftMatches) {
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }
          shortcut.callback(e);
        }
      });
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

/**
 * Hook to handle arrow key navigation in lists
 * 
 * @example
 * const { currentIndex, setCurrentIndex } = useArrowNavigation(items.length);
 */
export const useArrowNavigation = (itemCount: number, options?: { loop?: boolean }) => {
  const { loop = true } = options || {};

  const handleKeyDown = useCallback(
    (e: KeyboardEvent, currentIndex: number, onChange: (index: number) => void) => {
      let newIndex = currentIndex;

      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault();
          newIndex = currentIndex + 1;
          if (newIndex >= itemCount) {
            newIndex = loop ? 0 : itemCount - 1;
          }
          break;

        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault();
          newIndex = currentIndex - 1;
          if (newIndex < 0) {
            newIndex = loop ? itemCount - 1 : 0;
          }
          break;

        case 'Home':
          e.preventDefault();
          newIndex = 0;
          break;

        case 'End':
          e.preventDefault();
          newIndex = itemCount - 1;
          break;

        default:
          return;
      }

      onChange(newIndex);
    },
    [itemCount, loop]
  );

  return { handleKeyDown };
};

/**
 * Hook to manage roving tabindex for keyboard navigation
 * Used in toolbars, menus, listboxes, etc.
 * 
 * @example
 * const { focusedIndex, setFocusedIndex } = useRovingTabIndex(items.length);
 */
export const useRovingTabIndex = (itemCount: number) => {
  const { handleKeyDown } = useArrowNavigation(itemCount, { loop: true });

  return {
    handleKeyDown,
  };
};

export default useKeyboardShortcuts;
