import { isArsParentOrigin } from '../branding';

export function resolveArsEmbedParent(input: {
  isIframe: boolean;
  referrer?: string;
  search?: string;
}) {
  if (!input.isIframe) return { parent: '', waiting: false };
  let parent = '';
  try {
    parent = input.referrer ? new URL(input.referrer).origin : '';
  } catch {
    parent = '';
  }
  if (isArsParentOrigin(parent)) return { parent, waiting: false };
  const waiting = new URLSearchParams(input.search ?? '').get('ars_embed') === '1';
  return { parent: '', waiting };
}

export function shouldBindArsHello(input: {
  parent?: string;
  type?: string;
  origin?: string;
}) {
  return !input.parent && input.type === 'hello' && isArsParentOrigin(input.origin ?? '');
}

export { planArsEmbedAuth } from './ars-embed-auth';
