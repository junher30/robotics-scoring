import type {Metadata} from 'next';
import {InvitePage} from '../../usuarios/invite-page';
export const metadata:Metadata={title:'Invitar juez | RoboScore',robots:{index:false,follow:false}};
export default function Page() {return <InvitePage judgeOnly/>;}
