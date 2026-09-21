'use client';
import { useFormStatus } from 'react-dom';
import { logout } from '../login/actions';
import styles from '../login/login.module.css';
function Button() { const { pending } = useFormStatus(); return <button className={styles.submit} disabled={pending}>{pending ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>; }
export function LogoutButton() { return <form action={logout}><Button/></form>; }
