// Accessibility utilities for WCAG AA compliance

/**
 * Check if color contrast meets WCAG AA standards
 * @param foreground - Foreground color (hex, rgb, or rgba)
 * @param background - Background color (hex, rgb, or rgba)
 * @param isLargeText - Whether text is large (18pt+ or 14pt+ bold)
 * @returns Object with contrast ratio and pass/fail status
 */
export const checkColorContrast = (
  foreground: string,
  background: string,
  isLargeText: boolean = false
): { ratio: number; pass: boolean; level: 'AA' | 'AAA' | 'fail' } => {
  const fg = parseColor(foreground);
  const bg = parseColor(background);

  const l1 = getRelativeLuminance(fg);
  const l2 = getRelativeLuminance(bg);

  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

  // WCAG AA requirements:
  // Normal text: 4.5:1
  // Large text: 3:1
  const requiredRatio = isLargeText ? 3 : 4.5;
  const aaaRatio = isLargeText ? 4.5 : 7;

  return {
    ratio: Math.round(ratio * 100) / 100,
    pass: ratio >= requiredRatio,
    level: ratio >= aaaRatio ? 'AAA' : ratio >= requiredRatio ? 'AA' : 'fail',
  };
};

/**
 * Parse color string to RGB values
 */
const parseColor = (color: string): { r: number; g: number; b: number } => {
  // Remove whitespace
  color = color.trim();

  // Hex format
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r, g, b };
  }

  // RGB/RGBA format
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return {
      r: parseInt(match[1]),
      g: parseInt(match[2]),
      b: parseInt(match[3]),
    };
  }

  // Default to black if parsing fails
  return { r: 0, g: 0, b: 0 };
};

/**
 * Calculate relative luminance per WCAG formula
 */
const getRelativeLuminance = (rgb: { r: number; g: number; b: number }): number => {
  const rsRGB = rgb.r / 255;
  const gsRGB = rgb.g / 255;
  const bsRGB = rgb.b / 255;

  const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * Generate accessible label from text
 */
export const generateAriaLabel = (text: string, context?: string): string => {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  return context ? `${cleaned}, ${context}` : cleaned;
};

/**
 * Get keyboard shortcut description for screen readers
 */
export const getKeyboardShortcut = (key: string, modifiers?: string[]): string => {
  const parts: string[] = [];
  if (modifiers?.includes('ctrl')) parts.push('Control');
  if (modifiers?.includes('alt')) parts.push('Alt');
  if (modifiers?.includes('shift')) parts.push('Shift');
  parts.push(key.toUpperCase());
  return parts.join(' + ');
};

/**
 * Announce to screen readers using aria-live region
 */
export const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only'; // Visually hidden but accessible
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement is made
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

/**
 * Check if element is focusable
 */
export const isFocusable = (element: HTMLElement): boolean => {
  if (element.tabIndex < 0) return false;
  if (element.hasAttribute('disabled')) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;

  return true;
};

/**
 * Get all focusable elements within a container
 */
export const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(', ');

  const elements = Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
  return elements.filter(isFocusable);
};

/**
 * Create focus trap within a container (for modals, dialogs)
 */
export const createFocusTrap = (container: HTMLElement) => {
  const focusableElements = getFocusableElements(container);
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  // Focus first element
  firstElement?.focus();

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
};

/**
 * Generate unique ID for ARIA relationships
 */
let idCounter = 0;
export const generateId = (prefix: string = 'a11y'): string => {
  return `${prefix}-${++idCounter}-${Date.now()}`;
};

/**
 * Validate ARIA attributes
 */
export const validateAriaAttributes = (element: HTMLElement): string[] => {
  const errors: string[] = [];

  // Check for common mistakes
  const role = element.getAttribute('role');
  const ariaLabel = element.getAttribute('aria-label');
  const ariaLabelledBy = element.getAttribute('aria-labelledby');
  const ariaDescribedBy = element.getAttribute('aria-describedby');

  // Interactive elements should have accessible names
  if (['button', 'link'].includes(role || '') && !ariaLabel && !ariaLabelledBy && !element.textContent?.trim()) {
    errors.push(`Element with role="${role}" has no accessible name`);
  }

  // Check for invalid ARIA references
  if (ariaLabelledBy) {
    const ids = ariaLabelledBy.split(' ');
    ids.forEach((id) => {
      if (!document.getElementById(id)) {
        errors.push(`aria-labelledby references non-existent ID: ${id}`);
      }
    });
  }

  if (ariaDescribedBy) {
    const ids = ariaDescribedBy.split(' ');
    ids.forEach((id) => {
      if (!document.getElementById(id)) {
        errors.push(`aria-describedby references non-existent ID: ${id}`);
      }
    });
  }

  return errors;
};

export default {
  checkColorContrast,
  generateAriaLabel,
  getKeyboardShortcut,
  announceToScreenReader,
  isFocusable,
  getFocusableElements,
  createFocusTrap,
  generateId,
  validateAriaAttributes,
};
