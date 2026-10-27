/**
 * rotateSettings — how fast the body turns by itself, chosen by the person.
 *
 * One number, in turns per minute: the scene passes the frame's real time to
 * OrbitControls, so `autoRotateSpeed` IS turns per minute and one turn takes
 * `60 / speed` seconds on any screen. The scene reads it on every frame
 * (never through React state, so the slider never restarts the 3D scene),
 * and the agent's paces are multiples of it (agentResolve ROTATE_SPEEDS), so
 * one setting moves the button and the agent alike.
 *
 * Saved in the cartridge's durable state under its own key, like the gesture
 * speeds (gestureSettings.ts), through the same merge-one-key store.
 */
import {readStore,writeKey} from '@/mnemo/cartridgeStore';

/** One turn in 60 s. */
export const ROTATE_MIN=1;
/** One turn in 5 s. */
export const ROTATE_MAX=12;
export const ROTATE_STEP=0.5;
/** One turn in 20 s. Before it, the button turned once in about 90 s. */
export const DEFAULT_ROTATE=3;
export const ROTATE_KEY='rotate';

const clamp=(n:number)=>Math.max(ROTATE_MIN,Math.min(ROTATE_MAX,n));

/** Seconds for one turn at this speed, rounded for display. */
export const secondsPerTurn=(speed:number)=>Math.round(60/speed);

/**
 * Read the stored value. Missing or unreadable takes the default; it is
 * never 0, which would freeze a turn the person just asked for.
 */
export function parseRotate(raw:unknown):number{
 const o=(raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{}) as Record<string, unknown>;
 const v=o.speed;
 return typeof v==='number'&&Number.isFinite(v)&&v>0?clamp(v):DEFAULT_ROTATE;
}

let speed=DEFAULT_ROTATE;
/** 'loading' until the stored value is read; 'unsaved' when it cannot be. */
export type RotateSaveState={kind:'loading'}|{kind:'ready'}|{kind:'unsaved';why:string};
let save:RotateSaveState={kind:'loading'};
const listeners=new Set<()=>void>();
const emit=()=>{for(const cb of [...listeners])cb();};

export const getRotateSpeed=():number=>speed;
export const getRotateSaveState=():RotateSaveState=>save;
export function subscribeRotate(cb:()=>void):()=>void{listeners.add(cb);return()=>{listeners.delete(cb);};}

let loaded:Promise<void>|null=null;
/** A speed chosen before the stored one arrived: it wins, and is saved then. */
let changedWhileLoading=false;
/** Read the stored speed once per session. */
export function loadRotate():Promise<void>{
 loaded??=readStore().then(data=>{
  save={kind:'ready'};
  if(changedWhileLoading){persist();}else{speed=parseRotate(data[ROTATE_KEY]);}
  emit();
 }).catch((err:unknown)=>{
  const why=err instanceof Error?err.message:String(err);
  console.warn('[Atlas] rotation speed unavailable:',why);
  save={kind:'unsaved',why};emit();
 });
 return loaded;
}

/**
 * Change the speed. It applies at once; the save follows. A slider passes
 * `save: false` while it is dragged and saves on release (one write per drag).
 */
export function setRotateSpeed(value:number, opts:{save?:boolean}={}):void{
 if(!Number.isFinite(value))return;
 speed=clamp(value);emit();
 if(opts.save===false)return;
 if(save.kind==='loading'){changedWhileLoading=true;return;}
 if(save.kind==='ready')persist();
}

function persist():void{
 writeKey(ROTATE_KEY,{speed}).catch((err:unknown)=>{
  const why=err instanceof Error?err.message:String(err);
  console.warn('[Atlas] rotation speed not saved:',why);
  save={kind:'unsaved',why};emit();
 });
}
