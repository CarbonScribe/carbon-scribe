import { useEffect } from 'react';

export function useInert(isOpen: boolean, rootId = '__next') {
  useEffect(() => {
    if (!isOpen) return;

    const rootElement = document.getElementById(rootId) || document.body.firstElementChild;
    if (!rootElement) return;

    const originalInert = rootElement.hasAttribute('inert');
    rootElement.setAttribute('inert', 'true');
    rootElement.setAttribute('aria-hidden', 'true');

    return () => {
      if (!originalInert) {
        rootElement.removeAttribute('inert');
        rootElement.removeAttribute('aria-hidden');
      }
    };
  }, [isOpen, rootId]);
}