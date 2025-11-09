import { getRequestConfig } from 'next-intl/server';

type IntlMessages = Record<string, unknown>;

export default getRequestConfig(async ({ locale }) => {
  const currentLocale = locale ?? 'ko';
  const messages = (
    (await import(`./messages/${currentLocale}.json`)) as { default: IntlMessages }
  ).default;

  return {
    locale: currentLocale,
    messages,
  };
});


