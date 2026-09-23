type Searchable={name:string;institution:string;robot_name:string|null;team_number:number|null};
const normalize=(text:string)=>text.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
// A numeric search ("7" or "#7") matches the team number, or a standalone number in the team's text; anything else matches names.
export function matchesTeamQuery(team:Searchable,raw:string){
 const q=normalize(raw.trim()).replace(/^#/,'');if(!q)return true;
 const text=normalize(`${team.name} ${team.institution} ${team.robot_name??''}`);
 if(/^\d+$/.test(q))return team.team_number===Number(q)||new RegExp(`(^|\\D)${q}(\\D|$)`).test(text);
 return text.includes(q);
}
// Team numbers ascending, unnumbered teams last, names only break ties.
export const byTeamNumber=<T extends {name:string;team_number:number|null}>(a:T,b:T)=>a.team_number===b.team_number?a.name.localeCompare(b.name,'es'):a.team_number==null?1:b.team_number==null?-1:a.team_number-b.team_number;
