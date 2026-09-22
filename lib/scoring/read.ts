import 'server-only';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {categoryEvent} from '../categories/read';
import {createClient} from '../supabase/server';
import type {Team,CategoryOption,Board} from './schema';
export const teamColumns='id,event_id,category_id,name,institution,robot_name,team_number,participant_names,status,updated_at';
export async function eventContext(id:string) {
 const event=await categoryEvent(id);
 const client=await createClient();
 // Page explicitly to avoid the Data API default row limit hiding categories.
 const categories:CategoryOption[]=[];
 for(let from=0;;from+=500){const {data,error}=await client.from('event_categories').select('id,name,status').eq('event_id',id).order('sort_order').order('id').range(from,from+499).returns<CategoryOption[]>();if(error)throw Error('No se pudieron consultar las categorías.');categories.push(...(data??[]));if(!data||data.length<500)break;}
 return {event,categories};
}
export async function readTeam(eventId:string,id:string) {
 await categoryEvent(eventId);
 if(!z.string().uuid().safeParse(id).success)notFound();
 const client=await createClient();
 const {data,error}=await client.from('teams').select(teamColumns).eq('event_id',eventId).eq('id',id).maybeSingle<Team>();
 if(error)throw Error('No se pudo cargar el equipo.');if(!data)notFound();return data;
}
export async function readBoard(eventId:string,categoryId:string):Promise<Board> {
 await categoryEvent(eventId);
 if(!z.string().uuid().safeParse(categoryId).success)notFound();
 const client=await createClient();const {data,error}=await client.rpc('roboscore_scoring_board',{p_event:eventId,p_category:categoryId});
 if(error||!data)throw Error('No se pudieron consultar las puntuaciones.');return data as Board;
}
