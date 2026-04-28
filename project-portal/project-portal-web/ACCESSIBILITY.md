# CarbonScribe Accessibility Guidelines

This document outlines the accessibility (a11y) standards and best practices for the CarbonScribe project portal.

## Overview

CarbonScribe is committed to making its platform accessible to all users, including those using assistive technologies. This guide documents the accessibility patterns implemented across the application.

## ARIA Labels and Roles

### Forms

All form fields must have proper label associations:

```tsx
// ✅ Correct - Using htmlFor and id
<label htmlFor="field-id">Label Text</label>
<input id="field-id" type="text" />

// ❌ Incorrect - Missing association
<label>Label Text</label>
<input type="text" />
```

### Required Fields

Use `aria-hidden="true"` on visual indicators and provide programmatic indication:

```tsx
<label htmlFor="field-id">
  Field Name <span aria-hidden="true" className="text-red-500">*</span>
</label>
<input aria-required="true" />
```

### Error Messages

Link error messages to inputs using `aria-describedby`:

```tsx
<input
  id="field-id"
  aria-invalid={!!error}
  aria-describedby={error ? "field-error" : undefined}
/>
{error && (
  <p id="field-error" className="text-sm text-red-600" role="alert">
    {error}
  </p>
)}
```

### Buttons

Icon-only buttons require `aria-label`:

```tsx
<button aria-label="Close dialog">
  <X className="w-5 h-5" />
</button>
```

Loading buttons should announce state:

```tsx
<button aria-busy={loading}>
  {loading && <Loader2 aria-hidden="true" />}
  Submit
</button>
```

### Decorative Icons

All decorative icons must be hidden from assistive technologies:

```tsx
<Mail className="w-5 h-5" aria-hidden="true" />
```

## Modal Dialogs

Modals require specific ARIA attributes:

```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <h2 id="modal-title">Modal Title</h2>
  {/* ... */}
  <button aria-label="Close dialog">
    <X aria-hidden="true" />
  </button>
</div>
```

### Focus Management

- Modal should trap focus within the dialog
- Focus should return to trigger element on close
- Backdrop should have `role="presentation"` and `aria-hidden="true"`

## Navigation

### Skip Links

Include skip-to-content links for keyboard users:

```tsx
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
<main id="main-content" tabIndex={-1}>
```

### Navigation Labels

```tsx
<nav aria-label="Main navigation">
  {/* nav items */}
</nav>
```

### Active States

```tsx
<Link href="/path" aria-current="page">
```

## Toast Notifications

```tsx
<div role="region" aria-label="Notifications" aria-live="polite">
  {toasts.map((toast) => (
    <div key={toast.id} role="alert">
      {/* toast content */}
    </div>
  ))}
</div>
```

## Color Contrast

- Text must have a contrast ratio of at least 4.5:1 against background
- Large text (18px+ or 14px+ bold) must have at least 3:1 contrast
- UI components (borders, icons) need 3:1 contrast

## Focus States

All interactive elements must have visible focus indicators:

```css
:focus-visible {
  outline: 2px solid #059669;
  outline-offset: 2px;
}
```

Never remove focus outlines without providing an alternative:

```css
/* ❌ Incorrect */
*:focus {
  outline: none;
}

/* ✅ Correct */
*:focus {
  outline: none;
}
*:focus-visible {
  outline: 2px solid #059669;
  outline-offset: 2px;
}
```

## Testing Checklist

- [ ] All form fields have associated labels
- [ ] Error messages are linked via `aria-describedby`
- [ ] Invalid fields use `aria-invalid="true"`
- [ ] All buttons have accessible names
- [ ] Decorative icons have `aria-hidden="true"`
- [ ] Modals have `role="dialog"`, `aria-modal`, and `aria-labelledby`
- [ ] Navigation has proper `aria-label`
- [ ] Skip link is present
- [ ] Focus states are visible
- [ ] Color contrast meets WCAG AA standards

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)