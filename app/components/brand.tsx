import Image from 'next/image';
import { BASE_PATH } from '../../lib/base-path';
export function Brand(){return <><Image src={`${BASE_PATH}/robokids-logo.jpg`} alt="Robo Kids" width={52} height={52} style={{borderRadius:12,flexShrink:0,objectFit:'contain'}}/><span style={{background:'none',color:'inherit',transform:'none',width:'auto',height:'auto',fontSize:'inherit'}}>RoboScore.</span></>;}
