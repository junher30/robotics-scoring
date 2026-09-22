import type { Metadata } from 'next';
import './globals.css';
import { InvitationSessionBridge } from './auth/invitacion/session-bridge';
export const metadata: Metadata = {
  title: 'RoboScore | Competencias de robótica',
  description: 'Explora competencias, conoce los equipos y consulta los resultados de RoboScore.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}<InvitationSessionBridge/></body></html>;
}
