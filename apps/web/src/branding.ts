export const ARS_BRANDED = true;
export const ARS_PRODUCT_NAME = 'ARS Design';
export const ARS_ORGANIZATION_NAME = 'African Research Society';
export const ARS_HOME_URL = 'https://africanresearchsociety.org';
export const ARS_PARENT_ORIGINS = [
  ARS_HOME_URL,
  'https://www.africanresearchsociety.org',
] as const;

function isLoopbackHubOrigin(origin: string) {
  try {
    const url = new URL(origin);
    if (url.origin !== origin) return false;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  } catch {
    return false;
  }
}

export function isArsParentOrigin(origin: string) {
  return (ARS_PARENT_ORIGINS as readonly string[]).includes(origin) || isLoopbackHubOrigin(origin);
}
