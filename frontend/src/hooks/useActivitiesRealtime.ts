'use client';
import { useEffect } from 'react';
import { API_BASE } from '@/api/config';
import { tokenStorage } from '@/api/auth-api';
export function useActivitiesRealtime(enabled: boolean, onCreated: () => void, onFavoriteUpdated?: (payload: { activity_id: string; favorite_count: number }) => void) {
  useEffect(() => { if (!enabled) return; let stopped=false; let controller: AbortController|null=null; let timer: ReturnType<typeof setTimeout>|null=null; let retry=0;
    const connect=async()=>{ if(stopped)return; const token=tokenStorage.getAccessToken(); if(!token)return; controller=new AbortController(); try{const response=await fetch(`${API_BASE}/activities/realtime`,{headers:{Authorization:`Bearer ${token}`,Accept:'text/event-stream'},signal:controller.signal}); if(!response.ok||!response.body)throw new Error('stream unavailable'); retry=0; const reader=response.body.getReader(); const decoder=new TextDecoder(); let buffer=''; while(!stopped){const {value,done}=await reader.read(); if(done)break; buffer+=decoder.decode(value,{stream:true}); const chunks=buffer.split('\n\n'); buffer=chunks.pop()||''; for(const chunk of chunks){if(chunk.includes('event: activity.created'))onCreated(); if(chunk.includes('event: activity.favorite_updated')){const data=chunk.match(/data: (.+)/)?.[1]; if(data)onFavoriteUpdated?.(JSON.parse(data));}}}}catch(error:any){if(error?.name==='AbortError'||stopped)return;} if(!stopped)timer=setTimeout(connect,Math.min(30000,1000*2**retry++));}; connect(); return()=>{stopped=true;controller?.abort();if(timer)clearTimeout(timer);};
  }, [enabled,onCreated,onFavoriteUpdated]);
}
