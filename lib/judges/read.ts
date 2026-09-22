import 'server-only';
import {z} from 'zod';
import {notFound} from 'next/navigation';
import {requireAccess} from '../auth/authorization';
import {createClient} from '../supabase/server';
import type {ScoringRule,Score,Challenge} from '../scoring/schema';
export type Assignment={id:string;event_id:string;event_name:string;event_status:string;category_id:string;category_name:string;category_status:string;rule:ScoringRule|null;challenge_count:number|null;teams:number};
export type JudgeCategory=Omit<Assignment,'teams'|'id'>&{teams:{id:string;name:string;institution:string;robot_name:string|null;team_number:number|null;scored_count:number;total:number|null}[]};
export type JudgeTeam=Omit<Assignment,'teams'|'id'>&{team:{id:string;name:string;institution:string;status:string;team_number:number|null;participant_names:string[]};challenges:Challenge[];scores:Score[]};
export async function judgeData<T>(name:'roboscore_judge_home'|'roboscore_judge_category'|'roboscore_judge_team',id?:string):Promise<T>{
 await requireAccess('judge');
 if(id&&!z.string().uuid().safeParse(id).success)notFound();
 const client=await createClient();const {data,error}=await client.rpc(name,id?{[name==='roboscore_judge_team'?'p_team':'p_category']:id}:{});
 if(error?.code==='42501')notFound();
 if(error||!data)throw Error('No se pudieron consultar las asignaciones.');return data as T;
}
