import { z } from 'zod';
import { USER_ROLES } from './user-role';

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  role: z.enum(USER_ROLES),
  trainerGroupId: z.uuid().nullable().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
