import { z } from 'zod';
export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Escribe tu correo.').max(254, 'El correo es demasiado largo.').email('Escribe un correo válido.'),
  password: z.string().min(1, 'Escribe tu contraseña.').max(256, 'La contraseña es demasiado larga.'),
  remember: z.boolean(),
});
export type LoginState = { message?: string; errors?: { email?: string[]; password?: string[] }; email?: string; remember?: boolean };
