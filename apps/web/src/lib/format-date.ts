function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(year, month - 1, day);
}

export function todayDateString(): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function dateToDateString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatMonthDay(dateStr: string): string {
  return parseDateOnly(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatMonthDayLong(dateStr: string): string {
  return parseDateOnly(dateStr).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

export function formatWeekdayMonthDay(dateStr: string): string {
  return parseDateOnly(dateStr).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function formatMonthYearLabel(dateStr: string): string {
  return parseDateOnly(dateStr).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }).toUpperCase();
}

export function formatDayNumber(dateStr: string): number {
  return parseDateOnly(dateStr).getDate();
}

export function formatWeekdayAbbrev(dateStr: string): string {
  return parseDateOnly(dateStr).toLocaleDateString(undefined, { weekday: 'short' });
}

export function formatRelativeDayTime(date: Date): string {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (diffDays <= 0) return `Today · ${time}`;
  if (diffDays === 1) return `Yesterday · ${time}`;
  return `${diffDays} days ago · ${time}`;
}
