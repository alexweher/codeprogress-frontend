export const MAX_ACTIVITY_PERIOD_DAYS = 366;
export const DEFAULT_ACTIVITY_PERIOD_DAYS = 30;

export type ActivityRange = {
  from: string;
  to: string;
};

export function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getRecentActivityRange(today = new Date()): ActivityRange {
  const periodEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodStart.getDate() - (DEFAULT_ACTIVITY_PERIOD_DAYS - 1));

  return {
    from: formatLocalDate(periodStart),
    to: formatLocalDate(periodEnd),
  };
}

export function getInclusivePeriodDays(range: ActivityRange) {
  if (range.from > range.to) {
    throw new RangeError('Activity range start must not be after its end');
  }

  const [year, month, day] = range.from.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new RangeError('Activity range contains an invalid date');
  }

  const cursor = new Date(year, month - 1, day);
  let count = 1;

  while (formatLocalDate(cursor) !== range.to) {
    cursor.setDate(cursor.getDate() + 1);
    count += 1;

    if (count > MAX_ACTIVITY_PERIOD_DAYS) {
      return count;
    }
  }

  return count;
}

export function assertValidActivityRange(range: ActivityRange) {
  const days = getInclusivePeriodDays(range);
  if (days > MAX_ACTIVITY_PERIOD_DAYS) {
    throw new RangeError(`Activity range must not exceed ${MAX_ACTIVITY_PERIOD_DAYS} days`);
  }
}
