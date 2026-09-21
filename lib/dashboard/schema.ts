import { z } from 'zod';
const count = z.number().int().nonnegative();
export const dashboardSchema = z.object({
  events: count, active_events: count, upcoming_events: count,
  teams: count, participants: count, judges: count,
  next_events: z.array(z.object({
    id: z.string().uuid(), name: z.string(), status: z.enum(['DRAFT', 'REGISTRATION', 'ACTIVE']).transform(value => value === 'REGISTRATION' ? 'DRAFT' : value),
    start_date: z.string().datetime({ offset: true }), end_date: z.string().datetime({ offset: true }),
    city: z.string().nullable(), location: z.string().nullable(),
  })).max(5),
});
export type DashboardData = z.infer<typeof dashboardSchema>;
export type DashboardResult = { data: DashboardData; error: null } | { data: null; error: 'setup' | 'unavailable' };
