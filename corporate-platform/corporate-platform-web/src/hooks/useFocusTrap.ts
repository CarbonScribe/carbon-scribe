import { useEffect, useRef, RefObject, useCallback, useState } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable]';

export interface FocusTrapOptions {
  /** Whether the focus trap is active */
  active: boolean;
  /** Whether to auto-focus the first focusable element on activation */
  autoFocus?: boolean;
  /** Callback when focus is trapped */
  onFocusTrap?: () => void;
  /** Callback when focus leaves the trap */
  onFocusLeave?: () => void;
}

/**
 * Hook for trapping focus within a container
 * Useful for modals, dialogs, and banners
 * 
 * @param options - Configuration options for the focus trap
 * @param containerRef - Optional external ref for the container element
 * @returns Object containing containerRef, getFocusableElements, and isTrapped
 * 
 * @example
 * const { containerRef } = useFocusTrap({ active: isOpen });
 * return <div ref={containerRef}>...</div>
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  options: FocusTrapOptions | boolean,
  containerRef?: RefObject<T | null>
) {
  // Handle both boolean and object parameters for backward compatibility
  const opts: FocusTrapOptions = typeof options === 'boolean'
    ? { active: options, autoFocus: true }
    : options;

  const {
    active,
    autoFocus = true,
    onFocusTrap,
    onFocusLeave,
  } = opts;

  const localRef = useRef<T>(null);
  const ref = containerRef || localRef;
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const isTrapped = useRef(false);
  const [isReady, setIsReady] = useState(false);

  /**
   * Get all focusable elements within the container
   */
  const getFocusableElements = useCallback((): HTMLElement[] => {
    const container = ref.current;
    if (!container) return [];

    const elements = Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    return elements;
  }, [ref]);

  /**
   * Trap focus within the container when Tab key is pressed
   */
  const trapFocus = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !ref.current) return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        e.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const currentElement = document.activeElement as HTMLElement;

      // Check if current focus is within the container
      const isInside = ref.current?.contains(currentElement);

      if (e.shiftKey) {
        // Shift + Tab - move to previous element
        if (currentElement === firstElement || !isInside) {
          e.preventDefault();
          lastElement.focus();
          onFocusTrap?.();
        }
      } else {
        // Tab - move to next element
        if (currentElement === lastElement || !isInside) {
          e.preventDefault();
          firstElement.focus();
          onFocusTrap?.();
        }
      }
    },
    [getFocusableElements, ref, onFocusTrap]
  );

  /**
   * Handle focus leaving the container
   */
  const handleFocusOut = useCallback(
    (e: FocusEvent) => {
      const container = ref.current;
      if (!container || !isTrapped.current) return;

      const relatedTarget = e.relatedTarget as HTMLElement;
      if (relatedTarget && !container.contains(relatedTarget)) {
        // Focus left the container - trap it back
        const focusableElements = getFocusableElements();
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
          onFocusLeave?.();
        }
      }
    },
    [ref, getFocusableElements, onFocusLeave]
  );

  /**
   * Main effect for focus trap activation
   */
  useEffect(() => {
    if (!active) {
      isTrapped.current = false;
      setIsReady(false);
      // Restore previous focus
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
      return;
    }

    const container = ref.current;
    if (!container) return;

    // Store previous focus
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Auto-focus first element
    if (autoFocus) {
      const focusableElements = getFocusableElements();
      if (focusableElements.length > 0) {
        setTimeout(() => {
          focusableElements[0].focus();
          isTrapped.current = true;
          setIsReady(true);
          onFocusTrap?.();
        }, 100);
      }
    } else {
      setIsReady(true);
    }

    // Add event listeners
    document.addEventListener('keydown', trapFocus);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('keydown', trapFocus);
      document.removeEventListener('focusout', handleFocusOut);
      isTrapped.current = false;
      setIsReady(false);
    };
  }, [active, autoFocus, trapFocus, handleFocusOut, getFocusableElements, ref, onFocusTrap]);

  /**
   * Helper function to restore focus to the container
   */
  const restoreFocus = useCallback(() => {
    const container = ref.current;
    if (container) {
      container.focus();
    }
  }, [ref]);

  /**
   * Helper function to focus the first focusable element
   */
  const focusFirst = useCallback(() => {
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }, [getFocusableElements]);

  /**
   * Helper function to focus the last focusable element
   */
  const focusLast = useCallback(() => {
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[focusableElements.length - 1].focus();
    }
  }, [getFocusableElements]);

  return {
    containerRef: ref,
    getFocusableElements,
    isTrapped: isTrapped.current,
    isReady,
    restoreFocus,
    focusFirst,
    focusLast,
  };
}

/**
 * Simplified version of useFocusTrap for backward compatibility
 * @param isOpen - Whether the trap should be active
 * @param containerRef - Optional external ref for the container element
 * @returns The container ref
 */
export function useFocusTrapSimple<T extends HTMLElement = HTMLElement>(
  isOpen: boolean,
  containerRef?: RefObject<T | null>
) {
  const { containerRef: ref } = useFocusTrap(
    { active: isOpen, autoFocus: true },
    containerRef
  );
  return ref;
}

export default useFocusTrap;