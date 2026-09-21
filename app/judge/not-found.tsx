import Link from 'next/link';
import s from '../admin/eventos/events.module.css';
export default function NotFound(){return <main className={s.main}><section className={s.empty}><h1>Esta asignación no está disponible.</h1><p>Puede haber sido retirada o corresponder a otro juez.</p><Link className={s.primary} href="/judge">Ver mis categorías</Link></section></main>;}
