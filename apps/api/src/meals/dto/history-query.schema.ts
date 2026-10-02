import { z } from 'zod';

export const historyQuerySchema = z.object({
  clientId: z.uuid(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export type HistoryQueryInput = z.infer<typeof historyQuerySchema>;
