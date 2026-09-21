import type {Metadata} from 'next';
import {InvitePage} from '../invite-page';
export const metadata:Metadata={title:'Invitar usuario | RoboScore',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{rol?:string}>}) {return <InvitePage role={(await searchParams).rol}/>;}
