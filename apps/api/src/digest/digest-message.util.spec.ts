import { describe, expect, it } from 'vitest';
import { composeDigestBlocks } from './digest-message.util';

const today = new Date('2026-09-16T00:00:00.000Z');

describe('composeDigestBlocks', () => {
  it('includes the client name in the header when exactly one client is claimed', () => {
    const blocks = composeDigestBlocks('Manish', today, [{ mealDate: today, mealType: 'breakfast', photoCount: 5 }]);
    expect(blocks[0]).toEqual({ type: 'header', text: { type: 'plain_text', text: '📸 Daily Digest - Manish' } });
  });

  it('omits the name from the header when there is no single client', () => {
    const blocks = composeDigestBlocks(null, today, [{ mealDate: today, mealType: 'breakfast', photoCount: 5 }]);
    expect(blocks[0]?.text.text).toBe('📸 Daily Digest');
  });

  it('only lists meal types that have claimed photos, in breakfast/lunch/dinner/snack order', () => {
    const blocks = composeDigestBlocks('Manish', today, [
      { mealDate: today, mealType: 'snack', photoCount: 1 },
      { mealDate: today, mealType: 'breakfast', photoCount: 5 },
      { mealDate: today, mealType: 'dinner', photoCount: 2 },
    ]);
    const body = blocks[1]?.text.text ?? '';
    expect(body).toBe('*Meal photos for today:*\nBreakfast: 5 photos\nDinner: 2 photos\nSnack: 1 photo');
  });

  it('adds one "remaining meal photos" section per distinct catch-up date, most recent first', () => {
    const yesterday = new Date('2026-09-15T00:00:00.000Z');
    const twoDaysAgo = new Date('2026-09-14T00:00:00.000Z');
    const blocks = composeDigestBlocks('Manish', today, [
      { mealDate: today, mealType: 'breakfast', photoCount: 5 },
      { mealDate: twoDaysAgo, mealType: 'lunch', photoCount: 3 },
      { mealDate: yesterday, mealType: 'dinner', photoCount: 1 },
    ]);
    const body = blocks[1]?.text.text ?? '';
    expect(body).toBe(
      '*Meal photos for today:*\nBreakfast: 5 photos\n\n' +
        '*Remaining meal photos for Sep 15:*\nDinner: 1 photo\n\n' +
        '*Remaining meal photos for Sep 14:*\nLunch: 3 photos',
    );
  });

  it('omits the "today" section entirely when nothing was claimed for today', () => {
    const yesterday = new Date('2026-09-15T00:00:00.000Z');
    const blocks = composeDigestBlocks('Manish', today, [{ mealDate: yesterday, mealType: 'dinner', photoCount: 1 }]);
    const body = blocks[1]?.text.text ?? '';
    expect(body).toBe('*Remaining meal photos for Sep 15:*\nDinner: 1 photo');
  });
});
