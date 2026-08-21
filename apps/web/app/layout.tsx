import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { I18nProvider } from '../src/i18n';
import { AnalyticsProvider } from '../src/analytics/provider';
import '@excalidraw/excalidraw/index.css';
import '../src/index.css';
import '../src/styles/home/index.css';

export const metadata: Metadata = {
  title: 'ARS Design | African Research Society',
  description: 'The African Research Society design workspace.',
  icons: {
    icon: '/ars-mark.svg',
    apple: '/ars-mark.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#f2ede2',
};

/**
 * Inline script that runs before React hydrates so the first paint already
 * carries the app's appearance — no flash of unstyled content.
 *
 * `data-theme` is resolved before hydration and deliberately set outside any
 * React effect, preventing a light flash when a saved dark workspace opens.
 * Keep the accent variable mix ratios in sync with `accentVars()` in
 * `src/state/appearance.ts`; this script cannot import application modules.
 */
const themeInitScript = `(function(){var r=document.documentElement,t='light';try{var c=JSON.parse(localStorage.getItem('open-design:config')||'{}');t=c.theme==='dark'?'dark':'light';var a=typeof c.accentColor==='string'&&/^#[0-9a-fA-F]{6}$/.test(c.accentColor.trim())?c.accentColor.trim().toLowerCase():'#7f5a0c';if(c.configMigrationVersion!==4&&(a==='#87ea5c'||a==='#c96442'||a==='#353535'||a==='#bf2025'))a='#7f5a0c';if(t==='dark'){var m={'#7f5a0c':'#e8b23a','#17161b':'#efede4','#666157':'#c9c8d6','#176f47':'#5cc493','#5b46c4':'#a99bf0','#a33227':'#e59a90'};a=m[a]||a;}var s=r.style;s.setProperty('--accent',a);s.setProperty('--accent-strong','color-mix(in srgb, '+a+' 82%, var(--text-strong))');s.setProperty('--accent-soft','color-mix(in srgb, '+a+' 12%, var(--bg-subtle))');s.setProperty('--accent-tint','color-mix(in srgb, '+a+' 6%, var(--bg-panel))');s.setProperty('--accent-hover','color-mix(in srgb, '+a+' 86%, var(--text-strong))');}catch(e){}r.setAttribute('data-theme',t);r.style.colorScheme=t;})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning>
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: intentional theme-init inline script to prevent FOUC */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning>
        <I18nProvider>
          <AnalyticsProvider>{children}</AnalyticsProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
