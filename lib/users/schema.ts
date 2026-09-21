import { z } from 'zod';
export const roleLabels = { SUPER_ADMIN: 'Superadministrador', ADMIN: 'Administrador', JUDGE: 'Juez' };
export const userFields = z.object({
  first_name: z.string().trim().min(1,'Escribe el nombre.').max(100,'Usa como máximo 100 caracteres.'),
  last_name: z.string().trim().min(1,'Escribe el apellido.').max(150,'Usa como máximo 150 caracteres.'),
  phone: z.string().trim().max(40,'Usa como máximo 40 caracteres.'),
  role: z.enum(['ADMIN','JUDGE']),
});
export const inviteSchema = userFields.extend({ email: z.string().trim().toLowerCase().email('Escribe un correo válido.').max(254,'El correo es demasiado largo.') });
export const editUserSchema = userFields.extend({ active: z.enum(['true','false']) });
export type UserValues = { first_name: string; last_name: string; email: string; phone: string; role: string; active: string };
export type UserState = { message?: string; success?: boolean; errors?: Partial<Record<keyof UserValues,string[]>>; values?: UserValues };
export type ManagedUser = { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; role: keyof typeof roleLabels; active: boolean; managed_by: string | null; created_at: string; updated_at: string; deleted_at:string|null };
export const blankUser: UserValues = { first_name:'',last_name:'',email:'',phone:'',role:'JUDGE',active:'true' };
export function userValues(user: ManagedUser): UserValues {
  return { first_name:user.first_name,last_name:user.last_name,email:user.email ?? '',phone:user.phone ?? '',role:user.role,active:String(user.active) };
}
