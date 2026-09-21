import { describe, expect, it } from 'vitest';
import { isArsParentOrigin } from '../../src/branding';
import { resolveArsEmbedParent, shouldBindArsHello } from '../../src/integrations/ars-embed-parent';

describe('isArsParentOrigin', () => {
  it('accepts the apex and www hub origins', () => {
    expect(isArsParentOrigin('https://africanresearchsociety.org')).toBe(true);
    expect(isArsParentOrigin('https://www.africanresearchsociety.org')).toBe(true);
    expect(isArsParentOrigin('https://evil.example')).toBe(false);
  });
});

describe('resolveArsEmbedParent', () => {
  it('uses the hub referrer when it is present', () => {
    expect(
      resolveArsEmbedParent({
        isIframe: true,
        referrer: 'https://www.africanresearchsociety.org/dashboard/design',
        search: '?ars_embed=1',
      }),
    ).toEqual({ parent: 'https://www.africanresearchsociety.org', waiting: false });
  });

  it('waits for hello when the iframe referrer is stripped', () => {
    expect(
      resolveArsEmbedParent({
        isIframe: true,
        referrer: '',
        search: '?ars_embed=1',
      }),
    ).toEqual({ parent: '', waiting: true });
    expect(
      resolveArsEmbedParent({
        isIframe: true,
        referrer: '',
        search: '',
      }),
    ).toEqual({ parent: '', waiting: false });
    expect(
      shouldBindArsHello({
        parent: '',
        type: 'hello',
        origin: 'https://africanresearchsociety.org',
      }),
    ).toBe(true);
    expect(
      shouldBindArsHello({
        parent: 'https://africanresearchsociety.org',
        type: 'hello',
        origin: 'https://evil.example',
      }),
    ).toBe(false);
  });
});
