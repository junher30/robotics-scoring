import type {Metadata} from 'next';
import {UserDirectory,type DirectoryQuery} from '../usuarios/directory';
export const metadata:Metadata={title:'Administradores | RoboScore',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<DirectoryQuery>}) {return <UserDirectory kind="admins" query={await searchParams}/>;}
