'use client';
import { useMemo,type CSSProperties } from 'react';
import { BASE_PATH } from '../../lib/base-path';
import s from './easter-eggs.module.css';

// Huevos de pascua de Junior: solo aparecen si alguien escribe una de estas palabras en el buscador.
// Para agregar otro, copia un bloque: words (sin tildes, en minúscula), pieces (emojis, o rutas de imágenes PNG sin fondo en /public como '/eggs/goku.png'), title y text.
type Egg={id:string;words:string[];pieces:string[];motion:'fall'|'rise';title:string;text:string};
export const EGGS:Egg[]=[
 {id:'junior',words:['junior'],pieces:['🤖','⭐','✨','💛'],motion:'rise',title:'Hecho por Junior',text:'Esta página la armó Junior: anime, fútbol y legos incluidos. ¡Gracias por buscar!'},
 {id:'anime',words:['anime','otaku','nakama','naruto','goku','luffy','pikachu','saiyajin','kamehameha','manga'],pieces:['🌸','🍥','⚡','✨'],motion:'fall',title:'¡Modo anime activado!',text:'Tu equipo tiene poder de protagonista. Un robot bien entrenado también sube de nivel.'},
 {id:'futbol',words:['futbol','gol','messi','balon','cancha','golazo'],pieces:['⚽','🥅','🏆'],motion:'fall',title:'¡GOOOOL!',text:'Pase de Junior, definición de tu equipo. Aquí también se juega en equipo.'},
 {id:'harry',words:['harry','potter','hogwarts','lumos','hechizo','quidditch','snitch','gryffindor','slytherin','ravenclaw','hufflepuff'],pieces:['⚡','🪄','🦉','⭐'],motion:'rise',title:'¡Lumos!',text:'Un buen robot también tiene su magia: la de las personas que lo construyeron. Diez puntos para tu equipo.'},
 {id:'lego',words:['lego','legos','ladrillo','ladrillos','brick','bricks'],pieces:['🧱','🟥','🟦','🟨'],motion:'fall',title:'Pieza por pieza',text:'Todo gran robot empieza con ladrillos bien puestos. ¡Sigue construyendo!'}
];

const isImage=(piece:string)=>piece.startsWith('/');
const show=(piece:string,className?:string)=>isImage(piece)?<img className={className} src={`${BASE_PATH}${piece}`} alt="" draggable={false}/>:piece;
const norm=(text:string)=>text.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
function findEgg(query:string){
 const q=norm(query);if(q.length<3)return null;
 const tokens=q.split(/[^a-z0-9]+/).filter(Boolean);
 return EGGS.find(egg=>egg.words.some(word=>q===word||tokens.includes(word)))??null;
}

export default function EasterEgg({query}:{query:string}){
 const egg=findEgg(query);
 const pieces=useMemo(()=>egg?Array.from({length:26},(_,i)=>({char:egg.pieces[i%egg.pieces.length],left:Math.round(Math.random()*96),delay:Math.round(Math.random()*18)/10,duration:2.6+Math.random()*2.2,size:22+Math.round(Math.random()*20),sway:Math.round(Math.random()*80-40)})):[],[egg]);
 if(!egg)return null;
 return <>
  <div key={egg.id} className={`${s.rain} ${egg.motion==='rise'?s.rise:s.fall}`} aria-hidden="true">{pieces.map((p,i)=><span key={i} style={{left:`${p.left}%`,fontSize:p.size,animationDelay:`${p.delay}s`,animationDuration:`${p.duration}s`,'--sway':`${p.sway}px`} as CSSProperties}>{show(p.char)}</span>)}</div>
  <aside className={s.card} role="status"><span className={s.icon} aria-hidden="true">{show(egg.pieces[0])}</span><div><small>🥚 Easter egg encontrado</small><strong>{egg.title}</strong><p>{egg.text}</p></div></aside>
 </>;
}
