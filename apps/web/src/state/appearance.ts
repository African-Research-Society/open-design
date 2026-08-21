import { getOpenDesignHost } from '@open-design/host';
import type { AppTheme } from '../types';

const ACCENT_VARS = [
  '--accent',
  '--accent-strong',
  '--accent-soft',
  '--accent-tint',
  '--accent-hover',
] as const;

export const DEFAULT_ACCENT_COLOR = '#7f5a0c';
export const DEFAULT_APP_THEME = 'light' as const;
export type ResolvedAppTheme = Exclude<AppTheme, 'system'>;

const DARK_ACCENT_COLORS: Readonly<Record<string, string>> = {
  '#7f5a0c': '#e8b23a',
  '#17161b': '#efede4',
  '#666157': '#c9c8d6',
  '#176f47': '#5cc493',
  '#5b46c4': '#a99bf0',
  '#a33227': '#e59a90',
};
export const ACCENT_SWATCHES = [
  DEFAULT_ACCENT_COLOR,
  '#17161b',
  '#666157',
  '#176f47',
  '#5b46c4',
  '#a33227',
] as const;

export function normalizeAccentColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : null;
}

export function resolveAccentColor(value: unknown): string {
  return normalizeAccentColor(value) ?? DEFAULT_ACCENT_COLOR;
}

function accentVars(accentColor: string): Record<(typeof ACCENT_VARS)[number], string> {
  return {
    '--accent': accentColor,
    // Keep these mix ratios in sync with the pre-hydration script in app/layout.tsx.
    '--accent-strong': `color-mix(in srgb, ${accentColor} 82%, var(--text-strong))`,
    '--accent-soft': `color-mix(in srgb, ${accentColor} 12%, var(--bg-subtle))`,
    '--accent-tint': `color-mix(in srgb, ${accentColor} 6%, var(--bg-panel))`,
    '--accent-hover': `color-mix(in srgb, ${accentColor} 86%, var(--text-strong))`,
  };
}

/** Resolve the two explicit workspace themes. Legacy `system` values fall back
 * to light so every theme reader sees a stable data-theme attribute. */
export function resolveAppTheme(persisted?: AppTheme | null): ResolvedAppTheme {
  return persisted === 'dark' ? 'dark' : DEFAULT_APP_THEME;
}

function accentColorForTheme(accentColor: string, theme: ResolvedAppTheme): string {
  return theme === 'dark' ? DARK_ACCENT_COLORS[accentColor] ?? accentColor : accentColor;
}

export function applyAppearanceToDocument({
  accentColor,
  theme,
}: {
  accentColor?: string;
  theme?: AppTheme;
}): void {
  const root = document.documentElement;
  const resolvedTheme = resolveAppTheme(theme);
  root.setAttribute('data-theme', resolvedTheme);
  root.style.colorScheme = resolvedTheme;
  // Keep the native window material in step with the explicit workspace theme.
  // Feature-detected because browsers and older host builds have no appearance
  // capability.
  getOpenDesignHost()?.appearance?.setTheme(resolvedTheme);

  const normalized = accentColorForTheme(resolveAccentColor(accentColor), resolvedTheme);
  const vars = accentVars(normalized);
  for (const name of ACCENT_VARS) {
    root.style.setProperty(name, vars[name]);
  }
}
