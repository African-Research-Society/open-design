import { describe, expect, it } from 'vitest';
import { isArsParentOrigin } from '../../src/branding';

describe('isArsParentOrigin', () => {
  it('accepts the apex and www hub origins', () => {
    expect(isArsParentOrigin('https://africanresearchsociety.org')).toBe(true);
    expect(isArsParentOrigin('https://www.africanresearchsociety.org')).toBe(true);
    expect(isArsParentOrigin('https://evil.example')).toBe(false);
  });
});
