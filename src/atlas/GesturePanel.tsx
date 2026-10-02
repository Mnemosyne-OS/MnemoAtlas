/**
 * GesturePanel — the sheet that says which hand gestures the Atlas takes,
 * whether the host granted them, and how fast each one moves the body.
 *
 * The gesture lines are the host's own descriptions (shell locale
 * `gestures.hud.app.*`), so the sheet and the shell's cheat-sheet name the
 * same pose the same way.
 */
import {useEffect,useSyncExternalStore} from 'react';
import {Sheet,SheetContent,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {Slider} from '@/components/ui/slider';
import {Button} from '@/components/ui/button';
import {useI18n} from '@/i18n/useI18n';
import type {Key} from '@/i18n/strings';
import {
 SPEED_MAX,SPEED_MIN,SPEED_STEP,getGrant,getSaveState,getSpeeds,loadSpeeds,resetSpeeds,setSpeed,
 subscribeGrant,subscribeSpeeds,type GestureSpeeds,
} from './gestureSettings';

const SPEED_ROWS:{id:keyof GestureSpeeds;label:Key}[]=[
 {id:'orbit',label:'gest.speed.orbit'},
 {id:'depth',label:'gest.speed.depth'},
 {id:'explode',label:'gest.speed.explode'},
];
const ATLAS_ROWS:{icon:string;label:Key}[]=[
 {icon:'🔄',label:'gest.orbit'},
 {icon:'🤏',label:'gest.orbitFlat'},
 {icon:'↕️',label:'gest.depth'},
 {icon:'🤏🤏',label:'gest.explode'},
 {icon:'✋✋',label:'gest.recenter'},
 {icon:'👌',label:'gest.select'},
 {icon:'✋',label:'gest.action'},
];
const OS_ROWS:{icon:string;label:Key}[]=[
 {icon:'🖐️',label:'gest.osFull'},
 {icon:'✊',label:'gest.osClose'},
 {icon:'🤏',label:'gest.osWindow'},
];

const first=(v:number|readonly number[])=>Array.isArray(v)?(v as readonly number[])[0]:(v as number);
const times=(n:number)=>`${Number.isInteger(n)?n:n.toFixed(2).replace(/0$/,'')}×`;

export function GesturePanel({open,onOpenChange}:{open:boolean;onOpenChange:(v:boolean)=>void}){
 const {t}=useI18n();
 const speeds=useSyncExternalStore(subscribeSpeeds,getSpeeds);
 const save=useSyncExternalStore(subscribeSpeeds,getSaveState);
 const grant=useSyncExternalStore(subscribeGrant,getGrant);
 useEffect(()=>{void loadSpeeds();},[]);

 const status=grant.kind==='granted'?t('gest.granted'):grant.kind==='refused'?t('gest.refused',{why:grant.why}):t('gest.asking');

 return <Sheet open={open} onOpenChange={onOpenChange}>
  <SheetContent className="about-sheet glass gesture-sheet">
   <SheetTitle className="structure-title">{t('gest.title')}</SheetTitle>
   <SheetDescription>{t('gest.lead')}</SheetDescription>
   <p className={`gesture-status ${grant.kind}`} role="status">{status}</p>

   <h3>{t('gest.speeds')}</h3>
   {save.kind==='loading'&&<p className="gesture-note">{t('gest.loading')}</p>}
   {SPEED_ROWS.map(r=><div key={r.id} className="gesture-speed">
    <div className="gesture-speed-head"><span>{t(r.label)}</span><span className="gesture-speed-value">{times(speeds[r.id])}</span></div>
    <Slider aria-label={t(r.label)} min={SPEED_MIN} max={SPEED_MAX} step={SPEED_STEP} value={[speeds[r.id]]}
     onValueChange={v=>setSpeed(r.id,first(v),{save:false})}
     onValueCommitted={v=>setSpeed(r.id,first(v))}/>
   </div>)}
   <Button variant="ghost" onClick={resetSpeeds}>{t('gest.reset')}</Button>
   {save.kind==='unsaved'&&<p className="gesture-note warn" role="alert">{t('gest.unsaved',{why:save.why})}</p>}

   <h3>{t('gest.inAtlas')}</h3>
   <ul className="gesture-list">{ATLAS_ROWS.map(r=><li key={r.label}><span aria-hidden>{r.icon}</span>{t(r.label)}</li>)}</ul>
   <h3>{t('gest.os')}</h3>
   <ul className="gesture-list">{OS_ROWS.map(r=><li key={r.label}><span aria-hidden>{r.icon}</span>{t(r.label)}</li>)}</ul>
  </SheetContent>
 </Sheet>;
}
