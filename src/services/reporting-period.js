function dateAtNoon(year, month, day) {
  return new Date(year, month, day, 12, 0, 0, 0);
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function monthParts(year, month) {
  const normalized = dateAtNoon(year, month, 1);
  return { year: normalized.getFullYear(), month: normalized.getMonth() };
}

export function getClosingDate(year, month, closingDay = 5) {
  const normalized = monthParts(year, month);
  const lastDay = new Date(normalized.year, normalized.month + 1, 0).getDate();
  const rule = Number(closingDay);

  if (rule === 0) {
    return dateAtNoon(normalized.year, normalized.month, lastDay);
  }

  if (rule < 0) {
    const ordinal = Math.min(Math.max(Math.abs(Math.trunc(rule)), 1), 5);
    let businessDays = 0;
    for (let day = 1; day <= lastDay; day += 1) {
      const candidate = dateAtNoon(normalized.year, normalized.month, day);
      const weekDay = candidate.getDay();
      if (weekDay !== 0 && weekDay !== 6) {
        businessDays += 1;
        if (businessDays === ordinal) return candidate;
      }
    }
  }

  const fixedDay = Math.min(Math.max(Math.trunc(rule || 5), 1), lastDay);
  return dateAtNoon(normalized.year, normalized.month, fixedDay);
}

export function getPeriodForClosingMonth(year, month, closingDay = 5) {
  const end = getClosingDate(year, month, closingDay);
  const previous = monthParts(year, month - 1);
  const previousEnd = getClosingDate(previous.year, previous.month, closingDay);
  const start = dateAtNoon(
    previousEnd.getFullYear(),
    previousEnd.getMonth(),
    previousEnd.getDate() + 1,
  );
  return {
    start,
    end,
    startKey: localDateKey(start),
    endKey: localDateKey(end),
  };
}

export function getCurrentReportingPeriod(now = new Date(), closingDay = 5) {
  const today = localDateKey(now);
  const currentClosing = getClosingDate(now.getFullYear(), now.getMonth(), closingDay);
  const endMonthOffset = today <= localDateKey(currentClosing) ? 0 : 1;
  return getPeriodForClosingMonth(
    now.getFullYear(),
    now.getMonth() + endMonthOffset,
    closingDay,
  );
}

export function getReportingPeriods(now = new Date(), closingDay = 5, count = 12) {
  const current = getCurrentReportingPeriod(now, closingDay);
  const periods = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    periods.push(getPeriodForClosingMonth(
      current.end.getFullYear(),
      current.end.getMonth() - offset,
      closingDay,
    ));
  }
  return periods;
}

export function dateKeyInPeriod(dateKey, period) {
  return Boolean(dateKey && dateKey >= period.startKey && dateKey <= period.endKey);
}

export function formatReportingPeriod(period, locale = 'pt-BR') {
  const sameYear = period.start.getFullYear() === period.end.getFullYear();
  const start = period.start.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const end = period.end.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return start + ' – ' + end;
}
