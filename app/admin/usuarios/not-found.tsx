import Link from 'next/link';
import s from '../eventos/events.module.css';
export default function NotFound() {return <main className={s.main}><section className={s.empty}><h1>Cuenta no disponible</h1><p>Este enlace no está disponible o no tienes permisos para consultar la cuenta.</p><Link className={s.primary} href="/admin">Volver al resumen</Link></section></main>;}
