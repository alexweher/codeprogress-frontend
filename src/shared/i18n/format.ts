import type { Locale } from './messages';

const localeTags: Record<Locale, string> = { en: 'en-US', ru: 'ru-RU' };

export function formatLocalDateForLocale(value: string, locale: Locale) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  if (locale === 'en') return `${match[3]}.${match[2]}.${match[1]}`;
  return new Intl.DateTimeFormat(localeTags[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function formatLocalDateTimeForLocale(value: string, locale: Locale) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  if (locale === 'en') return `${match[3]}.${match[2]}.${match[1]}, ${match[4]}:${match[5]}`;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
  return new Intl.DateTimeFormat(localeTags[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
