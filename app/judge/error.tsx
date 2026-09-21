'use client';
import Link from 'next/link';
import s from '../admin/eventos/events.module.css';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className={s.main}><section className={s.empty}><h1>No pudimos cargar tus asignaciones.</h1><p>Intenta nuevamente. Si es la primera vez, el organizador debe activar el módulo de jueces en Supabase.</p><button className={s.primary} onClick={reset}>Reintentar</button><p><Link href="/cuenta">Volver a mi cuenta</Link></p></section></main>;}
