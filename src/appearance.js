import {useEffect,useState} from 'react';
export function useAppearance(){
 const [appearance,setAppearance]=useState(()=>{try{const value=localStorage.getItem('rifttask.appearance');return ['light','dark','system'].includes(value)?value:'system';}catch{return 'system';}});
 const [theme,setTheme]=useState('dark');
 useEffect(()=>{
  const media=window.matchMedia?.('(prefers-color-scheme: dark)');
  const apply=()=>{const next=appearance==='system'?(media?.matches?'dark':'light'):appearance;document.documentElement.dataset.theme=next;setTheme(next);};
  apply();try{localStorage.setItem('rifttask.appearance',appearance);}catch{/* Appearance still works when storage is unavailable. */}
  media?.addEventListener?.('change',apply);return()=>media?.removeEventListener?.('change',apply);
 },[appearance]);
 return {appearance,setAppearance,theme};
}
