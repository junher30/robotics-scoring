import 'server-only';
import { z } from 'zod';
import { createClient } from '../supabase/server';
export const profileSchema = z.object({ id: z.string().uuid(), email: z.string().nullable(), first_name: z.string(), last_name: z.string(), role: z.enum(['SUPER_ADMIN','ADMIN','JUDGE']), active: z.boolean() });
export type UserProfile = z.infer<typeof profileSchema>;
export async function readAccess() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { profile: null, reason: 'session' } as const;
  const { data, error: profileError } = await supabase.from('profiles').select('id,email,first_name,last_name,role,active').eq('id', user.id).single();
  const result = profileSchema.safeParse(data);
  if (profileError || !result.success) return { profile: null, reason: 'profile' } as const;
  if (!result.data.active) return { profile: null, reason: 'inactive' } as const;
  return { profile: result.data, reason: null } as const;
}
