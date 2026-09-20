export const ARS_BRANDED = true;
export const ARS_PRODUCT_NAME = 'ARS Design';
export const ARS_ORGANIZATION_NAME = 'African Research Society';
export const ARS_HOME_URL = 'https://africanresearchsociety.org';
export const ARS_PARENT_ORIGINS = [
  ARS_HOME_URL,
  'https://www.africanresearchsociety.org',
] as const;

export function isArsParentOrigin(origin: string) {
  return (ARS_PARENT_ORIGINS as readonly string[]).includes(origin);
}
