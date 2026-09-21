import type { Metadata } from 'next';
import { requireAccess } from '../../lib/auth/authorization';
import { RoleHome } from '../components/role-home';
export const metadata: Metadata = { title: 'Jueces | RoboScore', robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const profile = await requireAccess('judge');
  const params = await searchParams;
  return <RoleHome profile={profile} denied={params.aviso === 'permisos'}/>;
}
