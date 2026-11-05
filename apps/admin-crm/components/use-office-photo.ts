"use client";
import {useEffect,useState} from "react";

const photoEvent="bc-photo-updated";
const storagePrefix="bc-office-photo:";
type PhotoChange={userId?:string;hasPhoto:boolean;version?:string};

export function notifyOfficePhotoUpdated(userId:string,hasPhoto:boolean){
 const change:PhotoChange={userId,hasPhoto,version:crypto.randomUUID()};
 try{localStorage.setItem(storagePrefix+userId,JSON.stringify(change));}catch{/* In-tab refresh still works when browser storage is unavailable. */}
 window.dispatchEvent(new CustomEvent(photoEvent,{detail:change}));
}

export function useOfficePhoto(userId:string,refreshKey:string|number=""){
 const [version,setVersion]=useState<string|null>(null);
 const [hasPhoto,setHasPhoto]=useState(true);
 useEffect(()=>{
  function refresh(change?:PhotoChange){
   if(change?.userId&&userId&&change.userId!==userId)return;
   setHasPhoto(change?.hasPhoto??true);
   setVersion(change?.version??crypto.randomUUID());
  }
  function changed(event:Event){refresh((event as CustomEvent<PhotoChange>).detail);}
  function stored(event:StorageEvent){
   if(event.key!==storagePrefix+userId)return;
   try{refresh(event.newValue?JSON.parse(event.newValue) as PhotoChange:undefined);}catch{refresh();}
  }
  function focused(){refresh();}
  function visible(){if(document.visibilityState==='visible')refresh();}
  refresh();
  window.addEventListener(photoEvent,changed);
  window.addEventListener('storage',stored);
  window.addEventListener('focus',focused);
  window.addEventListener('pageshow',focused);
  document.addEventListener('visibilitychange',visible);
  return()=>{
   window.removeEventListener(photoEvent,changed);window.removeEventListener('storage',stored);
   window.removeEventListener('focus',focused);window.removeEventListener('pageshow',focused);
   document.removeEventListener('visibilitychange',visible);
  };
 },[userId,refreshKey]);
 return {hasPhoto,photoUrl:version?'/api/admin/profile/photo?'+(userId?'userId='+encodeURIComponent(userId)+'&':'')+'v='+version:null,markMissing:()=>setHasPhoto(false)};
}
