import type {Metadata} from 'next';
import {UserDirectory,type DirectoryQuery} from '../usuarios/directory';
export const metadata:Metadata={title:'Jueces | RoboScore',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<DirectoryQuery>}) {return <UserDirectory kind="judges" query={await searchParams}/>;}
