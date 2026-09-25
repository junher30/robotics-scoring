import {z} from 'zod';
export const passwordSchema=z.object({
  password:z.string().min(12,'Usa al menos 12 caracteres.').max(128,'Usa como máximo 128 caracteres.'),
  confirmation:z.string(),
}).refine(value=>value.password===value.confirmation,{path:['confirmation'],message:'Las contraseñas no coinciden.'});
export type PasswordState={message?:string;errors?:{password?:string[];confirmation?:string[]}};
type AuthFailure={code?:string;status?:number;name?:string;reasons?:string[]};
// Supabase Auth rejects a password change for several distinct reasons; tell the person which one instead of one generic line.
export function passwordErrorMessage(error:AuthFailure):string{
  const code=error.code??'';
  if(code==='weak_password'||error.name==='AuthWeakPasswordError'){
    const reasons=error.reasons??[];
    if(reasons.includes('pwned'))return 'Esa contraseña aparece en filtraciones de datos conocidas. Elige otra distinta.';
    if(reasons.includes('characters'))return 'La contraseña debe mezclar mayúsculas, minúsculas, números y símbolos.';
    return 'La contraseña no cumple los requisitos de seguridad. Prueba con una frase más larga y variada.';
  }
  if(code==='same_password')return 'Elige una contraseña diferente a la que ya tenía la cuenta.';
  if(code==='reauthentication_needed')return 'Por seguridad debes confirmar tu identidad. Abre de nuevo el enlace de tu invitación.';
  if(code==='session_not_found'||code==='session_expired'||error.name==='AuthSessionMissingError'||error.status===401)return 'Tu sesión de invitación venció. Abre de nuevo el enlace del correo o pide una nueva invitación.';
  if(code==='over_request_rate_limit'||error.status===429)return 'Hiciste demasiados intentos seguidos. Espera unos minutos e inténtalo otra vez.';
  return 'No se pudo guardar la contraseña. Inténtalo de nuevo; si sigue igual, pide una nueva invitación al organizador.';
}
