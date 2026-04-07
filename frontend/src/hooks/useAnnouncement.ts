import { useEffect, useRef, RefObject } from 'react';

interface UseAnnouncementOptions {
  priority?: 'polite' | 'assertive';
  clearAfter?: number;
}

/**
 * Hook to announce messages to screen readers via aria-live region
 * 
 * @example
 * const announcer = useAnnouncement();
 * announcer.announce('Message sent successfully');
 */
export const useAnnouncement = (options: UseAnnouncementOptions = {}) => {
  const { priority = 'polite', clearAfter = 1000 } = options;
  const regionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create aria-live region if it doesn't exist
    if (!regionRef.current) {
      const region = document.createElement('div');
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', priority);
      region.setAttribute('aria-atomic', 'true');
      region.className = 'sr-only';
      region.style.cssText = `
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      `;
      document.body.appendChild(region);
      regionRef.current = region;
    }

    return () => {
      if (regionRef.current) {
        document.body.removeChild(regionRef.current);
        regionRef.current = null;
      }
    };
  }, [priority]);

  const announce = (message: string) => {
    if (!regionRef.current) return;

    regionRef.current.textContent = message;

    // Clear after timeout
    if (clearAfter > 0) {
      setTimeout(() => {
        if (regionRef.current) {
          regionRef.current.textContent = '';
        }
      }, clearAfter);
    }
  };

  return { announce };
};

/**
 * Hook to auto-focus an element when component mounts
 * 
 * @example
 * const inputRef = useAutoFocus<HTMLInputElement>();
 * return <input ref={inputRef} />;
 */
export const useAutoFocus = <T extends HTMLElement>(): RefObject<T> => {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
    }
  }, []);

  return ref;
};

/**
 * Hook to manage focus visibility (hide focus ring for mouse, show for keyboard)
 */
export const useFocusVisible = () => {
  useEffect(() => {
    let isUsingKeyboard = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        isUsingKeyboard = true;
        document.body.classList.add('keyboard-navigation');
      }
    };

    const handleMouseDown = () => {
      isUsingKeyboard = false;
      document.body.classList.remove('keyboard-navigation');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);
};

export default useAnnouncement;
