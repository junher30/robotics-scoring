'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserManager } from '../../../lib/users/access';
import { inviteSchema,editUserSchema,type UserState,type UserValues } from '../../../lib/users/schema';
import { createClient } from '../../../lib/supabase/server';
import { createAdminClient,invitationConfig } from '../../../lib/supabase/admin';
function values(form: FormData): UserValues {
  return { first_name:String(form.get('first_name') ?? ''),last_name:String(form.get('last_name') ?? ''),email:String(form.get('email') ?? ''),phone:String(form.get('phone') ?? ''),role:String(form.get('role') ?? ''),active:String(form.get('active') ?? 'true') };
}
function databaseMessage(error: {code?: string;message?: string}) {
  if (['42501','22023','23505','40001','P0001'].includes(error.code ?? '')) {
    const message = error.message ?? 'No se pudo completar el cambio.';
    return message.startsWith('La cuenta ya existe') ? `${message} Si esa persona todavía no creó su contraseña, dile que use «Restablecer mi contraseña» en la pantalla de inicio de sesión.` : message;
  }
  return 'No pudimos completar la operación. Revisa la conexión y que esté aplicado el SQL de usuarios.';
}
function refreshUsers() { ['/admin','/admin/usuarios','/admin/jueces','/admin/administradores'].forEach(path=>revalidatePath(path)); }
export async function inviteUser(_previous: UserState,form: FormData): Promise<UserState> {
  const actor = await requireUserManager();
  const raw = values(form), parsed = inviteSchema.safeParse(raw);
  if (!parsed.success) return {values:raw,message:'Revisa los campos indicados.',errors:parsed.error.flatten().fieldErrors};
  if (actor.role !== 'SUPER_ADMIN' && parsed.data.role !== 'JUDGE') return {values:raw,message:'Solo el superadministrador puede invitar administradores.'};
  let redirectTo: string;
  try { redirectTo = invitationConfig().redirectTo; } catch { return {values:raw,message:'Falta configurar el servicio de invitaciones en el servidor. Sigue la guía de la fase 11.'}; }
  try {
    const client = await createClient();
    const v = parsed.data;
    const {data:invitation,error} = await client.rpc('roboscore_prepare_user_invitation',{p_email:v.email,p_first_name:v.first_name,p_last_name:v.last_name,p_phone:v.phone,p_role:v.role});
    if (error) return {values:raw,message:databaseMessage(error)};
    if (!z.string().uuid().safeParse(invitation).success) return {values:raw,message:'No se pudo preparar la invitación.'};
    const admin = createAdminClient();
    const result = await admin.auth.admin.inviteUserByEmail(v.email,{redirectTo,data:{roboscore_invitation_id:invitation}});
    if (result.error) return {values:raw,message:result.error.status === 429 ? 'Supabase limitó los envíos. Espera unos minutos antes de reintentar.' : 'No se pudo enviar el correo. Revisa el servicio de correo de Supabase; si la cuenta ya existe, busca su ficha. Puedes reintentar después de un minuto.'};
    refreshUsers();
    return {success:true,message:'Invitación enviada. La persona recibirá un enlace para crear su contraseña.',values:raw};
  } catch { return {values:raw,message:'No pudimos confirmar el envío. Revisa el listado antes de reintentar; si no llegó el correo, espera un minuto y usa el mismo correo.'}; }
}
export async function updateUser(id: string,version: string,_previous: UserState,form: FormData): Promise<UserState> {
  const actor = await requireUserManager();
  const raw = values(form), parsed = editUserSchema.safeParse(raw);
  if (!parsed.success) return {values:raw,message:'Revisa los campos indicados.',errors:parsed.error.flatten().fieldErrors};
  if (!z.string().uuid().safeParse(id).success || !z.string().datetime({offset:true}).safeParse(version).success) return {values:raw,message:'Abre de nuevo la ficha de la cuenta.'};
  if (id === actor.id || (actor.role !== 'SUPER_ADMIN' && parsed.data.role !== 'JUDGE')) return {values:raw,message:'No puedes modificar esta cuenta o asignar ese rol.'};
  try {
    const client = await createClient(), v = parsed.data;
    const {data,error} = await client.rpc('roboscore_update_managed_user',{p_id:id,p_version:version,p_first_name:v.first_name,p_last_name:v.last_name,p_phone:v.phone,p_role:v.role,p_active:v.active === 'true'});
    if (error) return {values:raw,message:databaseMessage(error)};
    if (data !== id) return {values:raw,message:'No se pudo confirmar el cambio. Recarga la ficha antes de intentar otra vez.'};
  } catch { return {values:raw,message:'No pudimos confirmar el cambio. Conserva tus datos y vuelve a cargar la ficha.'}; }
  refreshUsers(); revalidatePath(`/admin/usuarios/${id}`);
  redirect(`/admin/usuarios/${id}?resultado=guardado`);
}
