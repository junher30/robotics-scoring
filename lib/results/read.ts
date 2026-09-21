import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { authConfig,authFetch } from '../auth/config';
import { resultsSchema,type ResultsResponse } from './schema';
export async function readPublicResults():Promise<ResultsResponse>{
 try {
  const {url,key}=authConfig();
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:authFetch}});
  const {data,error}=await client.rpc('roboscore_public_results');
  const parsed=resultsSchema.safeParse(data);
  if(error||!parsed.success)throw new Error('Results unavailable');
  return {data:parsed.data,updatedAt:new Date().toISOString(),error:null};
 }catch{return {data:null,updatedAt:null,error:'No pudimos consultar los resultados. Intenta actualizar en unos momentos.'};}
}
