import 'server-only';
import { requireAccess } from '../auth/authorization';
import { createClient } from '../supabase/server';
import type { EventRecord } from './schema';
export const eventColumns = 'id,slug,name,description,start_date,end_date,location,city,address,organizer_name,max_teams,status,public,shared_with_admins,logo_url,rules_url,created_by,updated_at';
export async function readEvent(id:string) {
  await requireAccess('admin');
  try {const client=await createClient();const {data,error}=await client.from('events').select(eventColumns).eq('id',id).maybeSingle<EventRecord>();return {data,error:Boolean(error)};}
  catch{return {data:null,error:true};}
}
