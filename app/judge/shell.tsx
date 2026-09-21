import Link from 'next/link';
import type {ReactNode} from 'react';
import {Brand} from '../components/brand';
import s from '../admin/eventos/events.module.css';
export function JudgeShell({children}:{children:ReactNode}){return <div className={s.screen}><header className={s.header}><Link className={s.brand} href="/judge"><Brand/></Link><nav aria-label="Espacio del juez" style={{flexWrap:'wrap',gap:16}}><Link href="/judge">Mis categorías</Link><Link href="/cuenta">Mi cuenta</Link><Link href="/">Resultados públicos</Link></nav></header><main className={s.main}>{children}</main></div>;}
