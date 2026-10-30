// Converts the global app_settings.digest_time (a wall-clock time in digest_time_timezone)
// into the actual UTC instant for a given calendar day, so Step 0 of the digest job can
// compare it against "now" — see docs/SYSTEM_DESIGN.md's "Digest Timing" section.
export function digestTimeToUtc(runDate: Date, digestTime: Date, timezone: string): Date {
  const naiveUtc = new Date(
    Date.UTC(
      runDate.getUTCFullYear(),
      runDate.getUTCMonth(),
      runDate.getUTCDate(),
      digestTime.getUTCHours(),
      digestTime.getUTCMinutes(),
      digestTime.getUTCSeconds(),
    ),
  );
  const offsetMinutes = getTimezoneOffsetMinutes(timezone, naiveUtc);
  return new Date(naiveUtc.getTime() - offsetMinutes * 60_000);
}

function getTimezoneOffsetMinutes(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '0';
  const wallClockAsUtc = Date.UTC(
    Number(get('year')),
    Number(get('month')) - 1,
    Number(get('day')),
    Number(get('hour')),
    Number(get('minute')),
    Number(get('second')),
  );
  return (wallClockAsUtc - at.getTime()) / 60_000;
}
