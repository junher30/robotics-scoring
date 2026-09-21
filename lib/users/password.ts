import {z} from 'zod';
export const passwordSchema=z.object({
  password:z.string().min(12,'Usa al menos 12 caracteres.').max(128,'Usa como máximo 128 caracteres.'),
  confirmation:z.string(),
}).refine(value=>value.password===value.confirmation,{path:['confirmation'],message:'Las contraseñas no coinciden.'});
export type PasswordState={message?:string;errors?:{password?:string[];confirmation?:string[]}};
