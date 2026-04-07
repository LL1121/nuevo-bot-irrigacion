import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkColorContrast,
  generateAriaLabel,
  getKeyboardShortcut,
  announceToScreenReader,
  isFocusable,
  getFocusableElements,
  generateId,
  validateAriaAttributes,
} from './accessibility';

describe('accessibility utils', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('checkColorContrast', () => {
    it('should pass WCAG AA for black on white', () => {
      const result = checkColorContrast('#000000', '#FFFFFF');
      expect(result.ratio).toBe(21);
      expect(result.pass).toBe(true);
      expect(result.level).toBe('AAA');
    });

    it('should pass WCAG AA for dark gray on white', () => {
      const result = checkColorContrast('#595959', '#FFFFFF');
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
      expect(result.pass).toBe(true);
    });

    it('should fail for light gray on white', () => {
      const result = checkColorContrast('#CCCCCC', '#FFFFFF');
      expect(result.pass).toBe(false);
      expect(result.level).toBe('fail');
    });

    it('should pass for large text with lower contrast', () => {
      const result = checkColorContrast('#767676', '#FFFFFF', true);
      expect(result.pass).toBe(true);
    });

    it('should handle RGB format', () => {
      const result = checkColorContrast('rgb(0, 0, 0)', 'rgb(255, 255, 255)');
      expect(result.ratio).toBe(21);
      expect(result.pass).toBe(true);
    });

    it('should handle RGBA format', () => {
      const result = checkColorContrast('rgba(0, 0, 0, 1)', 'rgba(255, 255, 255, 1)');
      expect(result.ratio).toBe(21);
      expect(result.pass).toBe(true);
    });
  });

  describe('generateAriaLabel', () => {
    it('should generate simple label', () => {
      const label = generateAriaLabel('Send Message');
      expect(label).toBe('Send Message');
    });

    it('should clean up whitespace', () => {
      const label = generateAriaLabel('  Send   Message  ');
      expect(label).toBe('Send Message');
    });

    it('should add context', () => {
      const label = generateAriaLabel('Delete', 'Permanently remove item');
      expect(label).toBe('Delete, Permanently remove item');
    });
  });

  describe('getKeyboardShortcut', () => {
    it('should format simple key', () => {
      const shortcut = getKeyboardShortcut('s');
      expect(shortcut).toBe('S');
    });

    it('should format with ctrl modifier', () => {
      const shortcut = getKeyboardShortcut('s', ['ctrl']);
      expect(shortcut).toBe('Control + S');
    });

    it('should format with multiple modifiers', () => {
      const shortcut = getKeyboardShortcut('s', ['ctrl', 'shift']);
      expect(shortcut).toBe('Control + Shift + S');
    });

    it('should format with all modifiers', () => {
      const shortcut = getKeyboardShortcut('k', ['ctrl', 'alt', 'shift']);
      expect(shortcut).toBe('Control + Alt + Shift + K');
    });
  });

  describe('announceToScreenReader', () => {
    it('should create aria-live region', () => {
      announceToScreenReader('Test message');
      const region = document.querySelector('[role="status"]');
      expect(region).toBeTruthy();
      expect(region?.textContent).toBe('Test message');
    });

    it('should use polite priority by default', () => {
      announceToScreenReader('Test message');
      const region = document.querySelector('[aria-live="polite"]');
      expect(region).toBeTruthy();
    });

    it('should use assertive priority when specified', () => {
      announceToScreenReader('Urgent message', 'assertive');
      const region = document.querySelector('[aria-live="assertive"]');
      expect(region).toBeTruthy();
    });

    it('should remove region after timeout', (done) => {
      announceToScreenReader('Test message');
      setTimeout(() => {
        const region = document.querySelector('[role="status"]');
        expect(region).toBeFalsy();
        done();
      }, 1100);
    });
  });

  describe('isFocusable', () => {
    it('should return true for button without disabled', () => {
      const button = document.createElement('button');
      document.body.appendChild(button);
      expect(isFocusable(button)).toBe(true);
    });

    it('should return false for disabled button', () => {
      const button = document.createElement('button');
      button.setAttribute('disabled', 'true');
      document.body.appendChild(button);
      expect(isFocusable(button)).toBe(false);
    });

    it('should return false for element with negative tabindex', () => {
      const div = document.createElement('div');
      div.tabIndex = -1;
      document.body.appendChild(div);
      expect(isFocusable(div)).toBe(false);
    });

    it('should return false for hidden element', () => {
      const div = document.createElement('div');
      div.style.display = 'none';
      document.body.appendChild(div);
      expect(isFocusable(div)).toBe(false);
    });

    it('should return false for aria-hidden element', () => {
      const button = document.createElement('button');
      button.setAttribute('aria-hidden', 'true');
      document.body.appendChild(button);
      expect(isFocusable(button)).toBe(false);
    });
  });

  describe('getFocusableElements', () => {
    it('should find all focusable elements', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button>Button 1</button>
        <input type="text" />
        <a href="#">Link</a>
        <button disabled>Disabled</button>
        <div tabindex="0">Focusable div</div>
      `;
      document.body.appendChild(container);

      const elements = getFocusableElements(container);
      expect(elements.length).toBe(4); // Excludes disabled button
    });

    it('should return empty array for container with no focusable elements', () => {
      const container = document.createElement('div');
      container.innerHTML = '<p>Just text</p><span>More text</span>';
      document.body.appendChild(container);

      const elements = getFocusableElements(container);
      expect(elements.length).toBe(0);
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should use provided prefix', () => {
      const id = generateId('custom');
      expect(id).toMatch(/^custom-/);
    });

    it('should use default prefix', () => {
      const id = generateId();
      expect(id).toMatch(/^a11y-/);
    });
  });

  describe('validateAriaAttributes', () => {
    it('should return no errors for valid button with label', () => {
      const button = document.createElement('button');
      button.setAttribute('role', 'button');
      button.setAttribute('aria-label', 'Submit form');
      document.body.appendChild(button);

      const errors = validateAriaAttributes(button);
      expect(errors.length).toBe(0);
    });

    it('should detect button without accessible name', () => {
      const button = document.createElement('button');
      button.setAttribute('role', 'button');
      document.body.appendChild(button);

      const errors = validateAriaAttributes(button);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('no accessible name');
    });

    it('should detect invalid aria-labelledby reference', () => {
      const button = document.createElement('button');
      button.setAttribute('aria-labelledby', 'non-existent-id');
      document.body.appendChild(button);

      const errors = validateAriaAttributes(button);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('non-existent ID');
    });

    it('should validate aria-describedby references', () => {
      const button = document.createElement('button');
      button.setAttribute('aria-describedby', 'missing-desc');
      document.body.appendChild(button);

      const errors = validateAriaAttributes(button);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('aria-describedby');
    });
  });
});
