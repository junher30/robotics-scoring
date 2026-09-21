'use client';
import Link from 'next/link';
import s from '../eventos/events.module.css';
export default function ErrorPage({reset}:{reset:()=>void}) {return <main className={s.main}><section className={s.empty}><h1>No pudimos cargar las cuentas</h1><p>Revisa la conexión y la configuración de usuarios.</p><button className={s.primary} onClick={reset}>Reintentar</button> <Link href="/admin" className={s.secondary}>Volver al resumen</Link></section></main>;}
