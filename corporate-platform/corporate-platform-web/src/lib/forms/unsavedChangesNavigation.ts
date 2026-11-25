import { hasUnsavedChanges } from './unsavedChangesRegistry';

type NavigationListener = (navigate: () => void) => void;

const navigationListeners = new Set<NavigationListener>();

export function subscribeToUnsavedNavigation(
  listener: NavigationListener,
): () => void {
  navigationListeners.add(listener);
  return () => navigationListeners.delete(listener);
}

export function requestUnsavedChangesNavigation(navigate: () => void): void {
  if (!hasUnsavedChanges()) {
    navigate();
    return;
  }

  navigationListeners.forEach((listener) => listener(navigate));
}
