import { Brand } from '../../components/brand';
import Link from 'next/link';
import type {ReactNode} from 'react';
import s from '../eventos/events.module.css';
import styles from './users.module.css';
export function UserShell({children,superAdmin=false}:{children:ReactNode;superAdmin?:boolean}) {
  return <div className={s.screen}><header className={s.header}><Link href="/admin" className={s.brand}><Brand/></Link><nav aria-label="Administración" className={styles.navigation}><Link href="/admin">Resumen</Link><Link href="/admin/eventos">Eventos</Link><Link href="/admin/jueces">Jueces</Link>{superAdmin && <Link href="/admin/usuarios">Usuarios</Link>}<Link href="/cuenta">Mi cuenta</Link></nav></header><main className={s.main}>{children}</main><footer className={s.footer}>RoboScore · Crear. Aprender. Competir.</footer></div>;
}
