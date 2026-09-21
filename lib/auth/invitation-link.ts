// Parse only Supabase invitation callbacks. Never persist or log these values.
export type InvitationLink={kind:'session';accessToken:string;refreshToken:string}|{kind:'error';message:string}|null;
export function parseInvitationFragment(hash:string):InvitationLink{
 const params=new URLSearchParams(hash.replace(/^#/,''));
 if(params.get('type')!=='invite')return null;
 if(params.has('error')||params.has('error_code'))return {kind:'error',message:'El enlace de invitación venció o no se pudo confirmar. Solicita ayuda al organizador.'};
 const accessToken=params.get('access_token')??'',refreshToken=params.get('refresh_token')??'';
 if(!accessToken||!refreshToken||accessToken.length>16000||refreshToken.length>4096)return {kind:'error',message:'El enlace de invitación está incompleto. Abre el enlace original del correo.'};
 return {kind:'session',accessToken,refreshToken};
}
