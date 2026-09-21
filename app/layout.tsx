import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'RoboScore | Competencias de robótica',
  description: 'Explora competencias, conoce los equipos y consulta los resultados de RoboScore.',
  icons: { icon: '/icon.svg' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
