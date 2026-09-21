import { z } from 'zod';
const id=z.string().uuid();
export const resultsSchema=z.object({
 events:z.array(z.object({id,name:z.string(),city:z.string().nullable(),status:z.enum(['ACTIVE','FINISHED'])})),
 categories:z.array(z.object({id,event_id:id,name:z.string(),rule:z.string().nullable(),challenge_count:z.number().int().positive().nullable()})),
 teams:z.array(z.object({id,event_id:id,category_id:id,name:z.string(),institution:z.string(),robot_name:z.string().nullable(),status:z.enum(['PENDING','APPROVED','ACTIVE','REJECTED']),scored_count:z.number().int().nonnegative(),total:z.number().nullable(),position:z.number().int().positive().nullable(),last_scored_at:z.string().nullable()})),
});
export type Results=z.infer<typeof resultsSchema>;
export type PublicTeam=Results['teams'][number];
export type ResultsResponse={data:Results|null;updatedAt:string|null;error:string|null};
export const points=(value:number)=>new Intl.NumberFormat('es-CO',{maximumFractionDigits:3}).format(value);
export function progress(total:number|null,count:number|null){return total===null||!count?0:Math.min(100,Math.max(0,total/(170*count)*100));}
export function teamStatus(team:PublicTeam,count:number|null){return team.status==='REJECTED'?'Retirado':team.status!=='ACTIVE'?'Pendiente':team.total===null?'Sin calificar':count&&team.scored_count>=count?'Completo':'Parcial';}
