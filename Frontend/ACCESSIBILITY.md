# Accessibility (a11y) Guide

## 🎯 Overview

Sistema completo de accesibilidad siguiendo **WCAG 2.1 Level AA** standards:
- ♿ ARIA labels y roles
- ⌨️ Keyboard navigation
- 🎯 Focus management
- 📢 Screen reader support
- 🎨 Color contrast (WCAG AA)

## 🛠️ Utilities & Hooks

### Color Contrast Checker

```typescript
import { checkColorContrast } from '@/utils/accessibility';

const result = checkColorContrast('#595959', '#FFFFFF');
// { ratio: 7.47, pass: true, level: 'AAA' }

// For large text (18pt+ or 14pt+ bold)
const largeText = checkColorContrast('#767676', '#FFFFFF', true);
// { ratio: 4.54, pass: true, level: 'AA' }
```

**WCAG Thresholds:**
- Normal text: 4.5:1 (AA), 7:1 (AAA)
- Large text: 3:1 (AA), 4.5:1 (AAA)

### Screen Reader Announcements

```typescript
import { announceToScreenReader } from '@/utils/accessibility';

// Polite (default) - announce when screen reader is idle
announceToScreenReader('Message sent successfully');

// Assertive - interrupt current announcement
announceToScreenReader('Error: Connection lost', 'assertive');
```

### useAnnouncement Hook

```typescript
import { useAnnouncement } from '@/hooks/useAnnouncement';

function MessageForm() {
  const { announce } = useAnnouncement();

  const handleSubmit = () => {
    // ... send message
    announce('Message sent');
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

## ⌨️ Keyboard Navigation

### Focus Trap (Modals, Dialogs)

```typescript
import { useFocusTrap } from '@/hooks/useFocusTrap';

function Modal({ isOpen, onClose }) {
  const ref = useFocusTrap<HTMLDivElement>({ 
    enabled: isOpen,
    restoreFocus: true // Focus returns to trigger element on close
  });

  if (!isOpen) return null;

  return (
    <div ref={ref} role="dialog" aria-modal="true">
      <h2 id="dialog-title">Modal Title</h2>
      <button onClick={onClose}>Close</button>
    </div>
  );
}
```

### Keyboard Shortcuts

```typescript
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

function Editor() {
  useKeyboardShortcuts([
    {
      key: 's',
      ctrl: true,
      callback: handleSave,
      description: 'Save changes',
    },
    {
      key: 'Escape',
      callback: handleCancel,
      description: 'Cancel editing',
    },
  ]);

  return <div>...</div>;
}
```

### Arrow Navigation

```typescript
import { useArrowNavigation } from '@/hooks/useKeyboardShortcuts';

function Menu({ items }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const { handleKeyDown } = useArrowNavigation(items.length, { loop: true });

  return (
    <div
      role="menu"
      onKeyDown={(e) => handleKeyDown(e.nativeEvent, activeIndex, setActiveIndex)}
    >
      {items.map((item, i) => (
        <div
          key={i}
          role="menuitem"
          tabIndex={i === activeIndex ? 0 : -1}
        >
          {item}
        </div>
      ))}
    </div>
  );
}
```

## 🎯 Focus Management

### Auto Focus

```typescript
import { useAutoFocus } from '@/hooks/useAnnouncement';

function Dialog() {
  const closeButtonRef = useAutoFocus<HTMLButtonElement>();

  return (
    <dialog>
      <h2>Dialog Title</h2>
      <button ref={closeButtonRef}>Close</button>
    </dialog>
  );
}
```

### Focus Visible (Keyboard Only)

```typescript
import { useFocusVisible } from '@/hooks/useAnnouncement';

function App() {
  useFocusVisible(); // Adds .keyboard-navigation class on Tab key

  return <div>...</div>;
}
```

CSS automatically hides focus ring for mouse users:

```css
/* Only show focus ring when using keyboard */
body.keyboard-navigation *:focus-visible {
  outline: 2px solid hsl(var(--ring));
}
```

## 📢 ARIA Labels & Roles

### Basic ARIA Attributes

```tsx
// Button with accessible name
<button aria-label="Send message">
  <SendIcon />
</button>

// Link with description
<a href="/help" aria-describedby="help-desc">
  Help
</a>
<span id="help-desc" className="sr-only">
  Opens help documentation in new tab
</span>

// Input with label
<label htmlFor="email">Email</label>
<input 
  id="email" 
  type="email"
  aria-required="true"
  aria-invalid={hasError}
  aria-errormessage={hasError ? "email-error" : undefined}
/>
{hasError && (
  <span id="email-error" role="alert">
    Please enter a valid email
  </span>
)}
```

### Dialog/Modal

```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <h2 id="dialog-title">Delete Message</h2>
  <p id="dialog-description">
    Are you sure you want to delete this message? This action cannot be undone.
  </p>
  <button onClick={handleDelete}>Delete</button>
  <button onClick={handleCancel}>Cancel</button>
</div>
```

### Combobox (Autocomplete)

```tsx
<div role="combobox" aria-expanded={isOpen} aria-haspopup="listbox">
  <input
    aria-autocomplete="list"
    aria-controls="suggestions-list"
    aria-activedescendant={activeId}
  />
  <ul id="suggestions-list" role="listbox">
    {suggestions.map((item) => (
      <li key={item.id} role="option" aria-selected={item.id === activeId}>
        {item.name}
      </li>
    ))}
  </ul>
</div>
```

### Status/Alert Messages

```tsx
// Polite announcement
<div role="status" aria-live="polite">
  {message}
</div>

// Urgent announcement
<div role="alert" aria-live="assertive">
  {errorMessage}
</div>
```

## 🎨 Color Contrast

### Testing Contrast

```typescript
import { checkColorContrast } from '@/utils/accessibility';

// Test all color combinations
const colors = {
  primary: '#10b981',
  background: '#ffffff',
  text: '#1f2937',
};

console.log(checkColorContrast(colors.text, colors.background));
// { ratio: 16.07, pass: true, level: 'AAA' }
```

### Design Tokens (Tailwind)

Ensure all color combinations meet WCAG AA:

```javascript
// tailwind.config.js - accessible color palette
colors: {
  // ✅ AA compliant on white background
  emerald: {
    600: '#059669', // 4.5:1 contrast
    700: '#047857', // 7:1 contrast
  },
  // ❌ Fails AA on white
  emerald: {
    300: '#6ee7b7', // Only 2.5:1 - use for decorative only
  }
}
```

## ♿ Components

### Skip Link

Allows keyboard users to skip navigation:

```tsx
import SkipLink from '@/components/SkipLink';

function Layout() {
  return (
    <>
      <SkipLink />
      <nav>...</nav>
      <main id="main-content" tabIndex={-1}>
        {/* Main content */}
      </main>
    </>
  );
}
```

Press **Tab** after page load to reveal skip link.

### Accessible Button

```tsx
function IconButton({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="p-2 rounded hover:bg-gray-100"
    >
      {icon}
    </button>
  );
}

// Usage
<IconButton 
  icon={<TrashIcon />} 
  label="Delete message" 
  onClick={handleDelete}
/>
```

## 🧪 Testing Accessibility

### Automated Tests

```typescript
import { validateAriaAttributes } from '@/utils/accessibility';

const button = document.querySelector('button[role="button"]');
const errors = validateAriaAttributes(button);

if (errors.length > 0) {
  console.error('ARIA validation errors:', errors);
}
```

### Manual Testing Checklist

#### Keyboard Navigation
- [ ] Can tab through all interactive elements
- [ ] Tab order is logical (left-to-right, top-to-bottom)
- [ ] Focus indicator is visible
- [ ] Can activate buttons with Enter/Space
- [ ] Can close modals with Escape
- [ ] Skip link works (Tab on page load)

#### Screen Reader Testing
- [ ] All images have alt text
- [ ] Form inputs have labels
- [ ] Buttons have accessible names
- [ ] Status messages announce correctly
- [ ] Headings are hierarchical (h1 → h2 → h3)
- [ ] Lists use `<ul>/<ol>` properly

#### Color & Contrast
- [ ] Text has ≥4.5:1 contrast (normal size)
- [ ] Large text has ≥3:1 contrast
- [ ] Focus indicators are visible
- [ ] Don't rely on color alone for meaning
- [ ] Works in dark mode

### Screen Reader Testing

**NVDA (Windows - Free)**
```bash
# Download from https://www.nvaccess.org/
# Ctrl+NVDA to toggle on/off
# Use arrow keys to navigate
```

**JAWS (Windows - Commercial)**
```bash
# Download trial from https://www.freedomscientific.com/
```

**VoiceOver (macOS/iOS - Built-in)**
```bash
# macOS: Cmd+F5 to toggle
# iOS: Settings → Accessibility → VoiceOver
```

## 🎮 Browser Extensions

Install these for dev testing:

1. **axe DevTools** - Automated a11y testing
   - [Chrome](https://chrome.google.com/webstore/detail/axe-devtools/lhdoppojpmngadmnindnejefpokejbdd)
   - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/axe-devtools/)

2. **WAVE** - Visual feedback on accessibility issues
   - [Chrome](https://chrome.google.com/webstore/detail/wave-evaluation-tool/jbbplnpkjmmeebjpijfedlgcdilocofh)

3. **Lighthouse** - Built into Chrome DevTools
   - Run audit: DevTools → Lighthouse → Accessibility

## 🚨 Common Issues & Fixes

### Issue: Button without accessible name

```tsx
// ❌ Bad
<button onClick={handleClick}>
  <Icon />
</button>

// ✅ Good
<button onClick={handleClick} aria-label="Delete item">
  <TrashIcon />
</button>
```

### Issue: Missing form labels

```tsx
// ❌ Bad
<input placeholder="Email" />

// ✅ Good
<label htmlFor="email">Email</label>
<input id="email" type="email" />
```

### Issue: Non-semantic HTML

```tsx
// ❌ Bad
<div onClick={handleClick}>Click me</div>

// ✅ Good
<button onClick={handleClick}>Click me</button>
```

### Issue: Images without alt text

```tsx
// ❌ Bad
<img src="chart.png" />

// ✅ Good - Informative image
<img src="chart.png" alt="Sales chart showing 25% increase in Q4" />

// ✅ Good - Decorative image
<img src="divider.png" alt="" role="presentation" />
```

## 📊 Accessibility Metrics

Track these in Lighthouse CI:

| Metric | Target | Description |
|--------|--------|-------------|
| **Accessibility Score** | ≥90 | Overall a11y score |
| **Color Contrast** | 100% pass | All text meets WCAG AA |
| **ARIA Attributes** | 0 errors | Valid ARIA usage |
| **Keyboard Navigation** | 100% | All interactive elements reachable |
| **Focus Order** | Logical | Tab order makes sense |

## 📚 Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)

## 🎯 Next Steps

1. Audit current components with axe DevTools
2. Add ARIA labels to icon buttons
3. Test with screen reader (NVDA/VoiceOver)
4. Run Lighthouse accessibility audit
5. Add keyboard shortcuts documentation
6. Test with keyboard only (no mouse)
