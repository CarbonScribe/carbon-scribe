'use client';

/**
 * Inline theme script that runs before React hydration to prevent FOUC.
 * This script is injected into the HTML head and executes immediately.
 */
export function ThemeScript() {
  // This script runs before React hydration to set the correct theme
  const script = `
    (function() {
      try {
        const storageKey = 'theme';
        const savedTheme = localStorage.getItem(storageKey);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // Determine the initial theme
        let theme = 'light';
        if (savedTheme === 'dark' || savedTheme === 'light') {
          theme = savedTheme;
        } else if (prefersDark) {
          theme = 'dark';
        }
        
        // Apply theme class immediately
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        
        // Add data attribute for CSS targeting
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.colorScheme = theme;
      } catch (e) {
        // Ignore errors - fallback to light theme
      }
    })();
  `;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: script }}
      // This script must run before React hydration
      data-hydration-script="true"
    />
  );
}