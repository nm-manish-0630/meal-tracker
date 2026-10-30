import { MEAL_TYPES, type MealType } from '@repo/shared/meal-type';
import { toDateOnlyString } from '../common/date.util';

export interface ClaimedDeliveryInfo {
  mealDate: Date;
  mealType: MealType;
  photoCount: number;
}

export interface SlackBlock {
  type: string;
  text: { type: string; text: string };
}

// Composes the single consolidated header message for one trainer's one daily digest —
// a "today" section plus one "remaining meal photos for <date>" section per distinct
// earlier date, most recent first. See ADR-013 and SYSTEM_DESIGN.md's Slack Message Format.
export function composeDigestBlocks(clientName: string | null, today: Date, claimed: ClaimedDeliveryInfo[]): SlackBlock[] {
  const todayKey = toDateOnlyString(today);
  const byDate = new Map<string, { date: Date; counts: Map<MealType, number> }>();

  for (const item of claimed) {
    const key = toDateOnlyString(item.mealDate);
    let bucket = byDate.get(key);
    if (!bucket) {
      bucket = { date: item.mealDate, counts: new Map() };
      byDate.set(key, bucket);
    }
    bucket.counts.set(item.mealType, (bucket.counts.get(item.mealType) ?? 0) + item.photoCount);
  }

  const sections: string[] = [];
  const todayBucket = byDate.get(todayKey);
  if (todayBucket) {
    sections.push(formatSection('Meal photos for today:', todayBucket.counts));
  }

  const earlierDates = [...byDate.entries()].filter(([key]) => key !== todayKey).sort((a, b) => b[0].localeCompare(a[0]));

  for (const [, bucket] of earlierDates) {
    const label = bucket.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    sections.push(formatSection(`Remaining meal photos for ${label}:`, bucket.counts));
  }

  const headerText = clientName ? `📸 Daily Digest - ${clientName}` : '📸 Daily Digest';

  return [
    { type: 'header', text: { type: 'plain_text', text: headerText } },
    { type: 'section', text: { type: 'mrkdwn', text: sections.join('\n\n') } },
  ];
}

function formatSection(title: string, counts: Map<MealType, number>): string {
  const lines = MEAL_TYPES.filter((type) => (counts.get(type) ?? 0) > 0).map((type) => {
    const count = counts.get(type) ?? 0;
    return `${capitalize(type)}: ${count} photo${count === 1 ? '' : 's'}`;
  });
  return `*${title}*\n${lines.join('\n')}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
