import { describe, expect, it } from 'vitest';
import { digestTimeToUtc } from './digest-window.util';

function time(hours: number, minutes: number): Date {
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
}

describe('digestTimeToUtc', () => {
  it('returns the time as-is when the timezone is UTC', () => {
    const runDate = new Date('2026-09-16T00:00:00.000Z');
    const target = digestTimeToUtc(runDate, time(20, 0), 'UTC');
    expect(target.toISOString()).toBe('2026-09-16T20:00:00.000Z');
  });

  it('converts a positive offset (IST, UTC+5:30) back to UTC on the same day', () => {
    const runDate = new Date('2026-09-16T00:00:00.000Z');
    const target = digestTimeToUtc(runDate, time(20, 0), 'Asia/Kolkata');
    expect(target.toISOString()).toBe('2026-09-16T14:30:00.000Z');
  });

  it('converts a negative offset (America/New_York, EDT UTC-4) rolling into the next UTC day', () => {
    const runDate = new Date('2026-09-16T00:00:00.000Z');
    const target = digestTimeToUtc(runDate, time(20, 0), 'America/New_York');
    expect(target.toISOString()).toBe('2026-09-17T00:00:00.000Z');
  });
});
