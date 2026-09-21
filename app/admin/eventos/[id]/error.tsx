'use client';
import Link from 'next/link';
import s from '../events.module.css';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className={s.main}><section className={s.empty}><h1>No pudimos cargar el evento</h1><p>Comprueba la conexión y que las migraciones de este módulo estén aplicadas.</p><button className={s.primary} onClick={reset}>Reintentar</button> <Link className={s.secondary} href="/admin/eventos">Volver a eventos</Link></section></main>;}
