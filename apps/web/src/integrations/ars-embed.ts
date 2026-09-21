import { useEffect } from 'react';
import { planArsEmbedAuth } from './ars-embed-auth';
import { resolveArsEmbedParent, shouldBindArsHello } from './ars-embed-parent';

export { planArsEmbedAuth } from './ars-embed-auth';
export { resolveArsEmbedParent, shouldBindArsHello };

export function useArsEmbed(onTheme: (theme: 'dark' | 'light') => void) {
  useEffect(() => {
    const { parent: initial, waiting } = resolveArsEmbedParent({
      isIframe: window.parent !== window,
      referrer: document.referrer,
      search: window.location.search,
    });
    if (!initial && !waiting) return;
    let parent = initial;
    const bind = (origin: string) => {
      parent = origin;
      document.documentElement.dataset.arsEmbed = 'true';
    };
    if (parent) bind(parent);
    const send = (type: string, extra = {}) => {
      if (!parent) return;
      window.parent.postMessage({ channel: 'ars-app', version: 1, type, ...extra }, parent);
    };
    let announced = false;
    const applyAuth = (status: number) => {
      const plan = planArsEmbedAuth({ announced, status });
      if (plan === 'ready') {
        announced = true;
        send('ready');
        send('navigation', { path: window.location.pathname });
      }
      if (plan === 'expire') send('session-expired');
    };
    const announce = () => {
      if (!parent) return;
      void fetch('/auth/ars/status', { cache: 'no-store' })
        .then((r) => applyAuth(r.status))
        .catch(() => {});
    };
    const receive = (e: MessageEvent) => {
      if (e.source !== window.parent || e.data?.channel !== 'ars-app' || e.data.version !== 1) return;
      if (shouldBindArsHello({ parent, type: e.data.type, origin: e.origin })) {
        bind(e.origin);
        announce();
        return;
      }
      if (!parent || e.origin !== parent) return;
      if (e.data.type === 'hello') announce();
      if (e.data.type === 'sign-out') void fetch('/auth/ars/logout', { method: 'POST' });
      if (e.data.type === 'theme' && ['dark', 'light'].includes(e.data.theme)) {
        onTheme(e.data.theme);
      }
    };
    window.addEventListener('message', receive);
    if (parent) announce();
    let path = window.location.pathname;
    const navigation = window.setInterval(() => {
      if (!parent) return;
      if (path !== window.location.pathname) {
        path = window.location.pathname;
        send('navigation', { path });
      }
    }, 500);
    const check = window.setInterval(() => {
      if (!parent) return;
      void fetch('/auth/ars/status', { cache: 'no-store' })
        .then((r) => applyAuth(r.status))
        .catch(() => {});
    }, 10000);
    return () => {
      clearInterval(navigation);
      clearInterval(check);
      window.removeEventListener('message', receive);
      delete document.documentElement.dataset.arsEmbed;
    };
  }, [onTheme]);
}
