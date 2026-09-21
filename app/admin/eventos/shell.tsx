import Link from 'next/link';
import type {ReactNode} from 'react';
import s from './events.module.css';
export function EventShell({children}:{children:ReactNode}){return <div className={s.screen}><header className={s.header}><Link href="/admin" className={s.brand}><span>R</span>RoboScore.</Link><nav aria-label="Administración" style={{flexWrap:'wrap'}}><Link href="/admin">Resumen</Link><Link href="/admin/eventos" aria-current="page">Eventos</Link><Link href="/admin/jueces">Jueces</Link><Link href="/cuenta">Mi cuenta</Link></nav></header><main className={s.main}>{children}</main><footer className={s.footer}>RoboScore · Crear. Aprender. Competir.</footer></div>}
