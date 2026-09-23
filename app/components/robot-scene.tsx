'use client';
import { useEffect,useRef,useState,type CSSProperties } from 'react';
import s from './robot-scene.module.css';

// Each scene plays only while it is on screen (top banner at the top of the page, duel at the bottom) and replays every 2.5 minutes if the visitor is still looking at it.
const REPLAY_MS=150000;
const LETTERS:[string,number,'ink'|'red'][]=[['R',196,'ink'],['o',238,'ink'],['b',276,'ink'],['o',314,'ink'],['K',356,'red'],['i',388,'red'],['d',416,'red'],['s',451,'red']];
const DELAYS=[1.8,2.15,2.5,2.8,3.15,3.4,3.65,3.95];
const CONFETTI:[number,number,string][]=[[-150,-34,'#de0028'],[-95,-56,'#ffd23f'],[-40,-62,'#202831'],[20,-64,'#de0028'],[80,-58,'#ffd23f'],[135,-40,'#202831'],[170,-8,'#de0028'],[-175,-6,'#ffd23f']];

function Robot({tone,body,arm,leg}:{tone:'red'|'ink';body?:string;arm?:string;leg?:string}){
 const main=tone==='red'?'#de0028':'#2f3b48',accent=tone==='red'?'#202831':'#de0028';
 return <g className={body}>
  <line x1="0" y1="-88" x2="0" y2="-78" stroke={accent} strokeWidth="3"/><circle className={s.antenna} cx="0" cy="-91" r="4" fill="#ffd23f"/>
  <rect x="-17" y="-78" width="34" height="25" rx="7" fill={accent}/><circle cx="-7" cy="-66" r="3.5" fill="#7ff3ff"/><circle cx="7" cy="-66" r="3.5" fill="#7ff3ff"/>
  <rect x="-28" y="-50" width="8" height="24" rx="4" fill={accent}/>
  <rect x="-20" y="-53" width="40" height="31" rx="7" fill={main}/><circle cx="0" cy="-38" r="5" fill="#fff" opacity=".85"/>
  <rect x="-14" y="-23" width="10" height="23" rx="3" fill={accent}/><rect x="-16" y="-5" width="14" height="6" rx="3" fill={accent}/>
  <g transform="translate(9 -23)"><g className={leg}><rect x="-5" y="0" width="10" height="21" rx="3" fill={accent}/><rect x="-5" y="17" width="15" height="6" rx="3" fill={accent}/></g></g>
  <g transform="translate(24 -50)"><g className={arm}><rect x="-4" y="0" width="8" height="24" rx="4" fill={accent}/><circle cx="0" cy="27" r="5.5" fill={main}/></g></g>
 </g>;
}

// A robot runs across the stage; each letter of "RoboKids" drops in as it passes, and confetti bursts at the end.
function Build(){
 return <>
  <rect x="0" y="130" width="640" height="3" rx="1.5" fill="#dfe4ea"/>
  {LETTERS.map(([ch,x,tone],i)=><text key={i} className={`${s.letter} ${tone==='red'?s.red:s.ink}`} x={x} y="104" textAnchor="middle" style={{animationDelay:`${DELAYS[i]}s`}}>{ch}</text>)}
  {CONFETTI.map(([dx,dy,color],i)=><circle key={i} className={s.confetti} cx="320" cy="72" r="4.5" fill={color} style={{'--dx':`${dx}px`,'--dy':`${dy}px`} as CSSProperties}/>)}
  <g transform="translate(0 130) scale(.75)"><g className={s.run}><Robot tone="red" body={s.hopper} arm={s.swing} leg={s.stride}/></g></g>
 </>;
}

function Spark({x,className}:{x:number;className:string}){
 return <g transform={`translate(${x} 79)`}><path className={className} d="M0-14l4 9 10-3-6 8 6 8-10-3-4 9-4-9-10 3 6-8-6-8 10 3z" fill="#ffd23f" stroke="#de0028" strokeWidth="1.5"/></g>;
}

function Fight(){
 return <>
  <rect x="190" y="130" width="260" height="8" rx="4" fill="#202831"/><rect x="0" y="136" width="640" height="2" fill="#dfe4ea"/>
  <g transform="translate(280 130)"><Robot tone="red" body={s.leftBody} arm={s.leftArm}/></g>
  <g transform="translate(360 130) scale(-1 1)"><Robot tone="ink" body={s.rightBody} arm={s.rightArm}/></g>
  <Spark x={338} className={s.sparkOne}/><Spark x={304} className={s.sparkTwo}/>
  <text className={s.cheer} x="320" y="30" textAnchor="middle">¡Juego limpio!</text>
 </>;
}

export default function RobotScene({variant,label}:{variant:'build'|'fight';label:string}){
 const [run,setRun]=useState(0);
 const box=useRef<HTMLElement>(null);
 useEffect(()=>{
  const el=box.current;if(!el)return;
  let visible=false,last=0;
  const play=()=>{last=Date.now();setRun(r=>r+1);};
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible&&Date.now()-last>=REPLAY_MS)play();},{threshold:0.5});
  observer.observe(el);
  const timer=setInterval(()=>{if(visible&&document.visibilityState==='visible'&&Date.now()-last>=REPLAY_MS)play();},5000);
  return()=>{observer.disconnect();clearInterval(timer);};
 },[]);
 const top=variant==='build';
 return <figure ref={box} className={`${s.stage} ${top?s.stageTop:s.stageBottom}`} {...(top?{role:'img','aria-label':label}:{'aria-hidden':true})}>{run>0&&<svg key={run} aria-hidden="true" className={top?s.build:s.fight} viewBox={top?'0 0 640 150':'0 0 640 142'} preserveAspectRatio="xMidYMax meet">{top?<Build/>:<Fight/>}</svg>}</figure>;
}
