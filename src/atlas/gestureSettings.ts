/**
 * gestureSettings — how fast the hand moves the atlas, and whether the host
 * grants the gestures at all.
 *
 * Two small stores the scene reads on every gesture (never through React
 * state, so a slider never restarts the 3D scene) and the settings sheet
 * renders. The speeds are saved in the cartridge's durable state under one
 * key; the grant is what the host answered this session, never saved.
 */
import {readStore,writeKey} from '@/mnemo/cartridgeStore';

export interface GestureSpeeds {
 /** Turning the body with a pinch drag. */
 orbit:number;
 /** Coming closer with the hand's depth. */
 depth:number;
 /** Opening the body with both hands. */
 explode:number;
}

export const SPEED_MIN=0.25;
export const SPEED_MAX=3;
export const SPEED_STEP=0.25;
export const DEFAULT_SPEEDS:GestureSpeeds={orbit:1,depth:1,explode:1};
export const SETTINGS_KEY='gestures';

const clampSpeed=(n:number)=>Math.max(SPEED_MIN,Math.min(SPEED_MAX,n));

/**
 * Read a stored blob. A field that is missing or unreadable takes its
 * default; it is never set to 0, which would freeze that gesture.
 */
export function parseSpeeds(raw:unknown):GestureSpeeds{
 const o=(raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{}) as Record<string, unknown>;
 const pick=(k:keyof GestureSpeeds)=>{const v=o[k];return typeof v==='number'&&Number.isFinite(v)&&v>0?clampSpeed(v):DEFAULT_SPEEDS[k];};
 return {orbit:pick('orbit'),depth:pick('depth'),explode:pick('explode')};
}

// ── speeds ─────────────────────────────────────────────────────────────────
let speeds:GestureSpeeds={...DEFAULT_SPEEDS};
/** 'loading' until the stored speeds are read; 'unsaved' when they cannot be. */
export type SaveState={kind:'loading'}|{kind:'ready'}|{kind:'unsaved';why:string};
let save:SaveState={kind:'loading'};
const speedListeners=new Set<()=>void>();
const emit=()=>{for(const cb of [...speedListeners])cb();};

export const getSpeeds=():GestureSpeeds=>speeds;
export const getSaveState=():SaveState=>save;
export function subscribeSpeeds(cb:()=>void):()=>void{speedListeners.add(cb);return()=>{speedListeners.delete(cb);};}

let loaded:Promise<void>|null=null;
/** A speed chosen before the stored ones arrived: it wins, and is saved then. */
let changedWhileLoading=false;
/** Read the stored speeds once per session. */
export function loadSpeeds():Promise<void>{
 loaded??=readStore().then(data=>{
  save={kind:'ready'};
  if(changedWhileLoading){persist();}else{speeds=parseSpeeds(data[SETTINGS_KEY]);}
  emit();
 }).catch((err:unknown)=>{
  const why=err instanceof Error?err.message:String(err);
  console.warn('[Atlas] gesture settings unavailable:',why);
  save={kind:'unsaved',why};emit();
 });
 return loaded;
}

/**
 * Change one speed. It applies at once; the save follows, and a failed save
 * is said in the sheet rather than undone (the person just chose it).
 * A slider passes `save: false` while it is dragged and saves on release,
 * so one drag is one write and not one per pixel.
 */
export function setSpeed(k:keyof GestureSpeeds, value:number, opts:{save?:boolean}={}):void{
 if(!Number.isFinite(value))return;
 speeds={...speeds,[k]:clampSpeed(value)};emit();
 if(opts.save===false)return;
 if(save.kind==='loading'){changedWhileLoading=true;return;}
 if(save.kind==='ready')persist();
}

function persist():void{
 writeKey(SETTINGS_KEY,speeds).catch((err:unknown)=>{
  const why=err instanceof Error?err.message:String(err);
  console.warn('[Atlas] gesture settings not saved:',why);
  save={kind:'unsaved',why};emit();
 });
}

/** Back to 1× everywhere. */
export function resetSpeeds():void{
 speeds={...DEFAULT_SPEEDS};emit();
 if(save.kind==='loading'){changedWhileLoading=true;return;}
 if(save.kind==='ready')persist();
}

// ── what the host granted ──────────────────────────────────────────────────
export type GrantState=
 |{kind:'asking'}
 |{kind:'granted';takes:string[];actions:string[]}
 |{kind:'refused';why:string};
let grant:GrantState={kind:'asking'};
const grantListeners=new Set<()=>void>();
export const getGrant=():GrantState=>grant;
export function setGrant(next:GrantState):void{grant=next;for(const cb of [...grantListeners])cb();}
export function subscribeGrant(cb:()=>void):()=>void{grantListeners.add(cb);return()=>{grantListeners.delete(cb);};}
