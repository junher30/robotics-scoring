'use client';
import { useEffect,useState } from 'react';
import s from './robot-scene.module.css';

// Plays once on mount (so every load/reload starts it fresh) and replays every 2.5 minutes while the tab is visible.
const REPLAY_MS=150000;

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

function Kick(){
 return <>
  <rect x="0" y="130" width="640" height="3" rx="1.5" fill="#dfe4ea"/>
  <g className={s.net}><path d="M548 130V62h62v68" fill="none" stroke="#202831" strokeWidth="4" strokeLinejoin="round"/><path d="M556 70v60M568 70v60M580 70v60M592 70v60M604 70v60M552 82h56M552 96h56M552 110h56M552 122h56" stroke="#9aa6b3" strokeWidth="1"/></g>
  <g transform="translate(150 130)"><Robot tone="red" body={s.kicker} leg={s.kickLeg}/></g>
  <g transform="translate(186 121)"><g className={s.ball}><g className={s.spin}><circle r="9" fill="#fff" stroke="#202831" strokeWidth="2"/><path d="M0-4l4 3-1.5 4.5h-5L-4-1z" fill="#202831"/></g></g></g>
  <text className={s.cheer} x="470" y="46" textAnchor="middle">¡GOL!</text>
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

export default function RobotScene({variant,label}:{variant:'kick'|'fight';label:string}){
 const [run,setRun]=useState(0);
 useEffect(()=>{const timer=setInterval(()=>{if(document.visibilityState==='visible')setRun(r=>r+1);},REPLAY_MS);return()=>clearInterval(timer);},[]);
 return <figure className={s.scene} aria-hidden="true"><svg key={run} className={variant==='kick'?s.kick:s.fight} viewBox="0 0 640 142" preserveAspectRatio="xMidYMax meet">{variant==='kick'?<Kick/>:<Fight/>}</svg><figcaption>{label}</figcaption></figure>;
}
