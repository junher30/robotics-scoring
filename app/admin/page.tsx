import type { Metadata } from 'next';
import { requireAccess } from '../../lib/auth/authorization';
import { readDashboard } from '../../lib/dashboard/read';
import { Dashboard } from './components/dashboard';
export const metadata: Metadata = { title: 'Administración | RoboScore', robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const profile = await requireAccess('admin');
  const [params, result] = await Promise.all([searchParams, readDashboard()]);
  return <Dashboard profile={profile} result={result} denied={params.aviso === 'permisos'}/>;
}
