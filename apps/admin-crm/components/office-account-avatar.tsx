"use client";
import Image from "next/image";
import {useOfficePhoto} from "@/components/use-office-photo";
import {ShieldCheck} from "@/components/crm-icons";

export function OfficeAccountAvatar({userId,version}:{userId:string;version:number}){
 const {hasPhoto,photoUrl,markMissing}=useOfficePhoto(userId,version);
 return <span className="resident-avatar fallback" aria-hidden="true">{!hasPhoto||!photoUrl?<ShieldCheck size={19}/>:<Image unoptimized width={38} height={38} src={photoUrl} alt="" onError={markMissing} style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"inherit"}}/>}</span>;
}
