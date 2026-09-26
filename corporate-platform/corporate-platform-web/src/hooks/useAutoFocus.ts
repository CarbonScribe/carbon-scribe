import { useEffect, RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable]';

export function useAutoFocus<T extends HTMLElement = HTMLElement>(
  isOpen: boolean,
  containerRef: RefObject<T | null>,
  targetRef?: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (targetRef && targetRef.current) {
        targetRef.current.focus();
        return;
      }

      if (containerRef.current) {
        const firstFocusable = containerRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          containerRef.current.focus();
        }
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen, containerRef, targetRef]);
}