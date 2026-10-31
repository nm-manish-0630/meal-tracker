import { z } from 'zod';
import { USER_ROLES } from './user-role';

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.email().optional(),
  role: z.enum(USER_ROLES).optional(),
  trainerGroupId: z.uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
