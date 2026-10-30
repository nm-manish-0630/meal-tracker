import { z } from 'zod';

export const updateSettingsSchema = z.object({
  digestTime: z.iso.time().optional(),
  digestTimeTimezone: z.string().min(1).optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
