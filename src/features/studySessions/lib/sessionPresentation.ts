import type { Locale } from '../../../shared/i18n/messages';

const localeTag: Record<Locale, string> = { en: 'en-US', ru: 'ru-RU' };

export function formatSessionDate(value: string, locale: Locale) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat(localeTag[locale], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatSessionDuration(minutes: number, locale: Locale) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (locale === 'en') {
    if (!hours) return `${minutes} minutes`;
    return [
      hours ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : '',
      remainder ? `${remainder} min` : '',
    ]
      .filter(Boolean)
      .join(' ');
  }
  const hourWord =
    hours % 10 === 1 && hours % 100 !== 11
      ? 'час'
      : hours % 10 >= 2 && hours % 10 <= 4 && (hours % 100 < 12 || hours % 100 > 14)
        ? 'часа'
        : 'часов';
  return [hours ? `${hours} ${hourWord}` : '', remainder ? `${remainder} мин` : '']
    .filter(Boolean)
    .join(' ');
}
