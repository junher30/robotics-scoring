import { readPublicResults } from '../../../lib/results/read';
export const dynamic='force-dynamic';
export async function GET(){const result=await readPublicResults();return Response.json(result,{status:result.error?503:200,headers:{'Cache-Control':'no-store'}});}
