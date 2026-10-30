import { describe, expect, it } from 'vitest';
import { addUtcDays, startOfUtcDay, toDateOnlyString } from './date.util';

describe('date.util', () => {
  describe('startOfUtcDay', () => {
    it('truncates the time-of-day, keeping the UTC calendar date', () => {
      const date = new Date('2026-09-16T23:45:12.000Z');
      expect(startOfUtcDay(date).toISOString()).toBe('2026-09-16T00:00:00.000Z');
    });
  });

  describe('addUtcDays', () => {
    it('adds positive days without mutating the input', () => {
      const date = new Date('2026-09-16T00:00:00.000Z');
      const result = addUtcDays(date, 2);
      expect(result.toISOString()).toBe('2026-09-18T00:00:00.000Z');
      expect(date.toISOString()).toBe('2026-09-16T00:00:00.000Z');
    });

    it('subtracts days, crossing a month boundary', () => {
      const date = new Date('2026-10-02T00:00:00.000Z');
      expect(addUtcDays(date, -7).toISOString()).toBe('2026-09-25T00:00:00.000Z');
    });
  });

  describe('toDateOnlyString', () => {
    it('formats as YYYY-MM-DD', () => {
      expect(toDateOnlyString(new Date('2026-09-16T12:00:00.000Z'))).toBe('2026-09-16');
    });
  });
});
