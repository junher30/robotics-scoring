// Colombia uses UTC-5 year-round. Numeric UTC getters avoid different Intl
// punctuation/spacing between Node and browsers during hydration.
export function colombiaTime(iso:string):string{
 const timestamp=Date.parse(iso);
 if(!Number.isFinite(timestamp))return '—';
 const date=new Date(timestamp-5*60*60*1000);
 return [date.getUTCHours(),date.getUTCMinutes(),date.getUTCSeconds()].map(n=>String(n).padStart(2,'0')).join(':');
}
