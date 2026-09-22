import type { Metadata } from 'next';
import './globals.css';
import { InvitationSessionBridge } from './auth/invitacion/session-bridge';
import { BASE_PATH } from '../lib/base-path';
export const metadata: Metadata = {
  title: 'RoboScore | Competencias de robótica',
  description: 'Explora competencias, conoce los equipos y consulta los resultados de RoboScore.',
  icons: { icon: `${BASE_PATH}/robokids-logo.jpg` },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}<InvitationSessionBridge/></body></html>;
}
