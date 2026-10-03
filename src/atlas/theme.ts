/**
 * theme.ts — the atlas takes the app's theme, dark or light.
 *
 * The host sets `data-theme` on <html> through its config broadcasts
 * (onHostConfig in main.tsx), but those fire on CHANGES: a frame opened in a
 * dark app would sit light until someone flipped the theme. The host also
 * puts the theme in the frame's query string (`?theme=dark`), so it is read
 * once at boot, the same way the language is (useI18n.ts).
 *
 * Outside the shell there is no theme to follow and the atlas stays light.
 */
export type Theme = 'dark' | 'light';

export function themeFromQuery(search: string): Theme | null {
  const q = new URLSearchParams(search).get('theme');
  return q === 'dark' || q === 'light' ? q : null;
}

export function applyInitialTheme(): void {
  const theme = themeFromQuery(window.location.search);
  if (theme) document.documentElement.setAttribute('data-theme', theme);
}
