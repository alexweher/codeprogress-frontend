import { describe, expect, it } from 'vitest';
import { formatSessionDate, formatSessionDuration } from './sessionPresentation';

describe('study session presentation', () => {
  it('keeps LocalDate stable in both languages', () => {
    expect(formatSessionDate('2026-11-14', 'en')).toBe('November 14, 2026');
    expect(formatSessionDate('2026-11-14', 'ru')).toMatch(/14 ноября 2026/);
  });

  it('formats minutes as a readable duration', () => {
    expect(formatSessionDuration(30, 'en')).toBe('30 minutes');
    expect(formatSessionDuration(90, 'en')).toBe('1 hour 30 min');
    expect(formatSessionDuration(90, 'ru')).toBe('1 час 30 мин');
  });
});
