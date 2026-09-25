// Parse only Supabase invitation and password-recovery callbacks. Never persist or log these values.
export type LinkFlow='invite'|'recovery';
export type InvitationLink={kind:'session';flow:LinkFlow;accessToken:string;refreshToken:string}|{kind:'error';flow:LinkFlow;message:string}|null;
export function parseInvitationFragment(hash:string):InvitationLink{
 const params=new URLSearchParams(hash.replace(/^#/,''));
 const type=params.get('type');
 if(type!=='invite'&&type!=='recovery')return null;
 const flow:LinkFlow=type;
 if(params.has('error')||params.has('error_code'))return {kind:'error',flow,message:flow==='invite'?'El enlace de invitación venció o no se pudo confirmar. Solicita ayuda al organizador.':'El enlace para restablecer tu contraseña venció o no se pudo confirmar. Pide uno nuevo desde «Restablecer mi contraseña».'};
 const accessToken=params.get('access_token')??'',refreshToken=params.get('refresh_token')??'';
 if(!accessToken||!refreshToken||accessToken.length>16000||refreshToken.length>4096)return {kind:'error',flow,message:flow==='invite'?'El enlace de invitación está incompleto. Abre el enlace original del correo.':'El enlace está incompleto. Abre el enlace original del correo.'};
 return {kind:'session',flow,accessToken,refreshToken};
}
