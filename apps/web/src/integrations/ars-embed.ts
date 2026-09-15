import { useEffect } from 'react';
import { ARS_HOME_URL } from '../branding';

export function useArsEmbed(onTheme: (theme: 'dark' | 'light') => void) {
  useEffect(() => {
    if (window.parent === window || !document.referrer || new URL(document.referrer).origin !== ARS_HOME_URL) return;
    document.documentElement.dataset.arsEmbed = 'true';
    const send = (type: string, extra = {}) => window.parent.postMessage({ channel: 'ars-app', version: 1, type, ...extra }, ARS_HOME_URL);
    const receive = (e: MessageEvent) => {
      if (e.origin !== ARS_HOME_URL || e.source !== window.parent || e.data?.channel !== 'ars-app' || e.data.version !== 1) return;
      if (e.data.type === 'sign-out') void fetch('/auth/ars/logout', { method: 'POST' });
      if (e.data.type === 'theme' && ['dark','light'].includes(e.data.theme)) {
        onTheme(e.data.theme);
      }
    };
    window.addEventListener('message', receive);
    send('ready'); let path = window.location.pathname;
    const navigation = window.setInterval(() => {
      if (path !== window.location.pathname) { path = window.location.pathname; send('navigation', { path }); }
    }, 500);
    const check = window.setInterval(() => {
      void fetch('/auth/ars/status', { cache: 'no-store' }).then((r) => { if (r.status === 401 || r.status === 403) send('session-expired'); }).catch(() => {});
    }, 10000);
    return () => { clearInterval(navigation); clearInterval(check); window.removeEventListener('message', receive); delete document.documentElement.dataset.arsEmbed; };
  }, [onTheme]);
}
