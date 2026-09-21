import { z } from 'zod';
export const statuses = ['DRAFT','ACTIVE','FINISHED','CANCELLED'] as const;
// Compatibilidad de lectura con eventos antiguos; el formulario solo guarda los cuatro estados actuales.
export const statusLabels: Record<typeof statuses[number] | 'REGISTRATION', string> = {DRAFT:'Borrador',REGISTRATION:'Borrador',ACTIVE:'Activo',FINISHED:'Finalizado',CANCELLED:'Cancelado'};
const text = (max: number) => z.string().trim().max(max, `Usa como máximo ${max} caracteres.`);
const localDate = z.string().refine(value => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const parsed = new Date(value + ':00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,16) === value && Number(value.slice(0,4)) >= 2000;
}, 'Escribe una fecha y hora válidas (año 2000 o posterior).');
const url = text(2000).refine(value => { if (!value) return true; try { const u = new URL(value); return ['http:','https:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; } }, 'Usa una URL completa http:// o https:// sin credenciales.');
export const eventSchema = z.object({
  name:text(150).min(1,'El nombre del evento es obligatorio.'), description:text(5000),
  start_date:localDate, end_date:localDate,
  location:text(200), city:text(150), address:text(300), organizer_name:text(200),
  max_teams:z.string().trim().refine(v=>v==='' || (/^[1-9]\d*$/.test(v) && Number(v)<=2147483647),'Escribe un número entero positivo (máximo 2147483647).'),
  status:z.enum(statuses), public:z.boolean(), logo_url:url, rules_url:url,
}).superRefine((v,c)=>{
  const issue=(path:string,message:string)=>c.addIssue({code:'custom',path:[path],message});
  if(v.end_date<v.start_date) issue('end_date','La fecha final no puede ser anterior a la inicial.');
});
export type EventValues = z.infer<typeof eventSchema>;
export type EventState = {message?:string; errors?:Partial<Record<keyof EventValues,string[]>>; values?:EventValues};
type NullableField = 'description'|'location'|'city'|'address'|'organizer_name'|'logo_url'|'rules_url';
export type EventRecord = Omit<EventValues,'max_teams'|'status'|NullableField> & {[K in NullableField]:string|null} & {status:EventValues['status']|'REGISTRATION';id:string;slug:string;created_by:string;updated_at:string;max_teams:number|null};
export const emptyValues: EventValues = {name:'',description:'',start_date:'',end_date:'',location:'',city:'',address:'',organizer_name:'',max_teams:'',status:'DRAFT',public:false,logo_url:'',rules_url:''};
export function toLocalDate(value:string|null|undefined) { return value ? new Date(new Date(value).getTime()-5*60*60*1000).toISOString().slice(0,16) : ''; }
// Desactiva las fechas antiguas al guardar para que no restrinjan la duración del evento.
export function toPayload(v:EventValues) {return {...v, start_date:new Date(v.start_date+':00-05:00').toISOString(), end_date:new Date(v.end_date+':00-05:00').toISOString(),registration_start:null,registration_end:null,max_teams:v.max_teams?Number(v.max_teams):null};}
export function recordValues(event:EventRecord):EventValues {const values={...emptyValues}; for(const key of Object.keys(values) as (keyof EventValues)[]) { if(key==='public') values.public=event.public; else if(key==='status') values.status=event.status==='REGISTRATION'?'DRAFT':event.status; else if(key==='max_teams') values.max_teams=event.max_teams?.toString()??''; else if(['start_date','end_date'].includes(key)) values[key]=toLocalDate(event[key]); else values[key]=event[key]??''; } return values;}
