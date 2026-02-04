import { useEffect, useRef, RefObject } from 'react';
import { createFocusTrap } from '../utils/accessibility';

interface UseFocusTrapOptions {
  enabled?: boolean;
  restoreFocus?: boolean;
}

/**
 * Hook to trap focus within a container (for modals, dialogs, etc.)
 * 
 * @example
 * function Modal({ isOpen }) {
 *   const ref = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
 *   return <div ref={ref}>...</div>;
 * }
 */
export const useFocusTrap = <T extends HTMLElement>(
  options: UseFocusTrapOptions = {}
): RefObject<T> => {
  const { enabled = true, restoreFocus = true } = options;
  const ref = useRef<T>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled || !ref.current) return;

    // Store currently focused element
    if (restoreFocus) {
      previousActiveElement.current = document.activeElement as HTMLElement;
    }

    // Create focus trap
    const cleanup = createFocusTrap(ref.current);

    return () => {
      cleanup();

      // Restore focus to previous element
      if (restoreFocus && previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [enabled, restoreFocus]);

  return ref;
};

export default useFocusTrap;
