import { buildBlogRss } from '../../../_lib/blog-rss';
import { DEFAULT_LOCALE, LANDING_LOCALES } from '../../../i18n';

export function getStaticPaths() {
  return LANDING_LOCALES.filter((locale) => locale.code !== DEFAULT_LOCALE).map((locale) => ({
    params: { locale: locale.code },
  }));
}

export async function GET(context: { site: URL; params: { locale?: string } }) {
  const response = await buildBlogRss(context);
  const locale = context.params.locale;
  const active = LANDING_LOCALES.some((entry) => entry.code === locale && entry.code !== DEFAULT_LOCALE);
  if (!active || !locale) return response;

  const xml = await response.text();
  return new Response(xml.replaceAll('https://open-design.ai/blog/', new URL(`/${locale}/blog/`, context.site).toString()), {
    headers: response.headers,
    status: response.status,
  });
}
