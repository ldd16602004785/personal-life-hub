export function parseDateOnly(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Invalid date");
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateForYear(year: number, month: number, day: number): Date {
  const candidate = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (month === 2 && day === 29 && candidate.getMonth() !== 1) {
    return new Date(year, 1, 28, 12, 0, 0, 0);
  }
  return candidate;
}

export function nextOccurrence(
  dateValue: string,
  repeatsYearly: boolean,
  from = new Date()
): string | null {
  const parsed = parseDateOnly(dateValue);
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);

  if (!repeatsYearly) {
    const exact = dateForYear(parsed.year, parsed.month, parsed.day);
    return exact >= today ? dateValue : null;
  }

  let candidate = dateForYear(from.getFullYear(), parsed.month, parsed.day);
  if (candidate < today) {
    candidate = dateForYear(from.getFullYear() + 1, parsed.month, parsed.day);
  }
  return localDateString(candidate);
}

export function daysUntil(dateValue: string, from = new Date()): number {
  const target = parseDateOnly(dateValue);
  const end = new Date(target.year, target.month - 1, target.day, 12);
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}
