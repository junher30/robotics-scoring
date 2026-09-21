import {z} from 'zod';
export const ruleLabels={EXCEL_2026:'CATA–CATD · 170 / 150 / 130',LEGACY_C:'CATEGORIA C antigua · 170 / 90 / 130',LEGACY_D:'CATEGORIA D antigua · 170 / 150 / 130'};
export type ScoringRule=keyof typeof ruleLabels;
export const teamSchema=z.object({category_id:z.string().uuid('Selecciona una categoría.'),name:z.string().trim().min(1,'Escribe el nombre.').max(150),institution:z.string().trim().min(1,'Escribe la institución.').max(200),robot_name:z.string().trim().max(150),active:z.enum(['true','false'])});
export const configSchema=z.object({rule:z.enum(['EXCEL_2026','LEGACY_C','LEGACY_D']),count:z.coerce.number().int().min(1).max(20)});
export const scoreSchema=z.object({attempt:z.string().regex(/^\d+$/,'Escribe un intento entero, desde 0.').refine(v=>Number(v)<=2147483647,'El intento es demasiado grande.'),seconds:z.string().trim().transform(v=>v.replace(',','.')).refine(v=>/^\d+(\.\d{1,3})?$/.test(v)&&Number(v)<=999999999.999,'Escribe segundos positivos o cero, con hasta 3 decimales.'),completed:z.enum(['true','false']),notes:z.string().trim().max(1000,'Usa como máximo 1000 caracteres.')});
export type FormState={message?:string;errors?:Record<string,string[]|undefined>;values?:Record<string,string>};
export type Team={id:string;event_id:string;category_id:string;name:string;institution:string;robot_name:string|null;status:'PENDING'|'APPROVED'|'ACTIVE'|'REJECTED';updated_at:string};
export type CategoryOption={id:string;name:string;status:string};
export type Score={id:string;challenge_id:string;attempt:number;seconds:number;completed:boolean;points:number;notes:string;updated_at:string};
export type Challenge={id:string;name:string;sort_order:number};
export type Board={has_scores:boolean;config:{rule:ScoringRule;challenge_count:number}|null;challenges:Challenge[];teams:{id:string;name:string;institution:string;scored_count:number;total:number|null;position:number|null;scores:Score[]}[]};
export function calculatePoints(rule:ScoringRule,attempt:number,seconds:number,completed:boolean):number {
 if((rule==='EXCEL_2026'&&attempt===0)||(rule!=='EXCEL_2026'&&!completed))return 0;
 const base=attempt===1?170:attempt===2?(rule==='LEGACY_C'?90:150):130;
 return Math.round((base-seconds)*1000)/1000;
}
export const formatPoints=(value:number)=>new Intl.NumberFormat('es-CO',{maximumFractionDigits:3}).format(value);
