import 'server-only';
import { requireAccess } from '../auth/authorization';
import { createClient } from '../supabase/server';
import { dashboardSchema, type DashboardResult } from './schema';
export async function readDashboard(): Promise<DashboardResult> {
  await requireAccess('admin');
  try {
    const client = await createClient();
    const { data, error } = await client.rpc('admin_dashboard');
    if (error) return { data: null, error: error.code === 'PGRST202' ? 'setup' : 'unavailable' };
    const result = dashboardSchema.safeParse(data);
    return result.success ? { data: result.data, error: null } : { data: null, error: 'unavailable' };
  } catch { return { data: null, error: 'unavailable' }; }
}
