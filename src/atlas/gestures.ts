/**
 * gestures — the hand moves the atlas's camera (doc 106 §32).
 *
 * The host never shows the camera nor the hand to a cartridge: it sends
 * intentions (« turn by 12 px », « come closer by 3 % »), and only while
 * the Atlas window is full screen. This module turns them into the same
 * moves the mouse makes with OrbitControls, so a hand and a drag agree.
 *
 * The maths are pure and tested; `listenToGestures` is the one seam with the
 * host, and it says out loud why it receives nothing.
 */
import {MnemoCartridgeSDK, type MnemoGestureHandlers} from '@mnemosyne_os/cartridge-sdk';
import {setGrant} from './gestureSettings';

export interface Vec3 {x:number;y:number;z:number}

/** Same speed as the shell's neural map, so the hand feels the same everywhere. */
export const ORBIT_GESTURE_SPEED = 0.5;
/** The orbit never reaches the poles, like OrbitControls. */
const POLE_EPS = 1e-3;

/**
 * The camera's offset from its target after a hand drag of (dx, dy) px,
 * turned around the target the way OrbitControls turns it (world up = y).
 * @returns null when an input is unreadable — the camera stays where it is.
 */
export function orbitOffset(offset:Vec3, viewportH:number, dx:number, dy:number, maxPolar=Math.PI-POLE_EPS):Vec3|null{
 if(![offset.x,offset.y,offset.z,viewportH,dx,dy].every(Number.isFinite)||viewportH<=0)return null;
 const r=Math.hypot(offset.x,offset.y,offset.z);
 if(r<=0)return null;
 const k=(2*Math.PI*ORBIT_GESTURE_SPEED)/viewportH;
 const theta=Math.atan2(offset.x,offset.z)-dx*k;
 const phi=Math.max(POLE_EPS,Math.min(maxPolar,Math.acos(Math.max(-1,Math.min(1,offset.y/r)))-dy*k));
 return {x:r*Math.sin(phi)*Math.sin(theta),y:r*Math.cos(phi),z:r*Math.sin(phi)*Math.cos(theta)};
}

/**
 * The new camera-to-target distance for a factor (> 1 = closer), clamped to
 * the orbit controls' own limits.
 * @returns null when the factor or the distance is unreadable.
 */
export function dollyDistance(distance:number, factor:number, min:number, max:number):number|null{
 if(!Number.isFinite(distance)||!Number.isFinite(factor)||factor<=0||distance<=0)return null;
 return Math.max(min,Math.min(max,distance/factor));
}

/**
 * How far a hand drag of (dx, dy) px slides the camera and its target, in
 * world units along the camera's right and up axes: one screen height of
 * drag moves one visible height of the scene, as the mouse pan does.
 */
export function panAmount(distance:number, fovDeg:number, viewportH:number, dx:number, dy:number):{right:number;up:number}|null{
 if(![distance,fovDeg,viewportH,dx,dy].every(Number.isFinite)||viewportH<=0||distance<=0)return null;
 const visible=2*distance*Math.tan((fovDeg*Math.PI/180)/2);
 return {right:-dx*visible/viewportH,up:dy*visible/viewportH};
}

/**
 * How far one spread of both hands opens the body: hands that go from
 * shoulder width to arms wide (a factor of about 3) take it from assembled
 * to every piece apart, and bringing them back closes it the same way.
 */
export const EXPLODE_PER_LOG_FACTOR=0.9;

/**
 * The explode level after a two-hand step (Tony, 2026-10-02: one hand's
 * spread is the OS's full screen, so the body opens with both hands). The
 * level is continuous, so every stage between assembled and apart is
 * reachable and held when the hands stop.
 * `speed` is the person's choice in the settings sheet (1 = the default).
 * @returns null when the step is unreadable — the body stays as it is.
 */
export function explodeAfter(current:number, factor:number, speed=1):number|null{
 if(!Number.isFinite(current)||!Number.isFinite(factor)||factor<=0||!Number.isFinite(speed)||speed<=0)return null;
 return Math.max(0,Math.min(1,current+Math.log(factor)*EXPLODE_PER_LOG_FACTOR*speed));
}

/** The one gesture of the Atlas's own, taught by the person in « My gestures ». */
export const EXPLODE_ACTION='explode';

const sdk=new MnemoCartridgeSDK('@mnemosyne-plugins/mnemo-atlas');

/**
 * Subscribe to the host's gestures. Returns the unsubscribe.
 *
 * A refusal is logged with the host's own reason (permission denied, no
 * host, manifest refused): the person tries a gesture, nothing moves, and
 * the console is the only place that can say which of the three it was.
 */
export function listenToGestures(handlers:MnemoGestureHandlers):()=>void{
 const sub=sdk.onGestures(handlers);
 sub.ready
  .then(({takes,actions})=>{
   console.info('[Atlas] gestures granted:',takes.join(', '),actions.length?`+ ${actions.join(', ')}`:'');
   setGrant({kind:'granted',takes,actions});
  })
  .catch((err:unknown)=>{
   const why=err instanceof Error?err.message:String(err);
   console.warn('[Atlas] no hand gestures:',why);
   setGrant({kind:'refused',why});
  });
 return sub.off;
}
