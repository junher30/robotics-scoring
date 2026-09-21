import type {Metadata} from 'next';
import {UserDirectory,type DirectoryQuery} from './directory';
export const metadata:Metadata={title:'Usuarios | RoboScore',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<DirectoryQuery>}) {return <UserDirectory kind="all" query={await searchParams}/>;}
