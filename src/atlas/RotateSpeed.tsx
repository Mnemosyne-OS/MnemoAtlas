/**
 * RotateSpeed — the speed of the turn, next to the rotate button.
 *
 * Shown only while the body turns: that is when the person can see what the
 * slider changes. The value reads as the time of one turn, which the scene
 * keeps true on any screen (it turns by elapsed time, not by frames).
 * The readout is the turn on screen: an agent's « fast » is twice the
 * person's speed, so the slider edits the speed and the value says the turn.
 */
import {useSyncExternalStore} from 'react';
import {Rabbit,TriangleAlert,Turtle} from 'lucide-react';
import {Slider} from '@/components/ui/slider';
import {useI18n} from '@/i18n/useI18n';
import {
 ROTATE_MAX,ROTATE_MIN,ROTATE_STEP,getRotateSaveState,getRotateSpeed,secondsPerTurn,setRotateSpeed,subscribeRotate,
} from './rotateSettings';

const first=(v:number|readonly number[])=>Array.isArray(v)?(v as readonly number[])[0]:(v as number);

export function RotateSpeed({pace}:{pace:number}){
 const {t}=useI18n();
 const speed=useSyncExternalStore(subscribeRotate,getRotateSpeed);
 const save=useSyncExternalStore(subscribeRotate,getRotateSaveState);
 return <div className="rotate-speed glass" role="group" aria-label={t('ui.rotateSpeed')}>
  <Turtle size={16} aria-hidden/>
  <Slider aria-label={t('ui.rotateSpeed')} min={ROTATE_MIN} max={ROTATE_MAX} step={ROTATE_STEP} value={[speed]}
   onValueChange={v=>setRotateSpeed(first(v),{save:false})}
   onValueCommitted={v=>setRotateSpeed(first(v))}/>
  <Rabbit size={16} aria-hidden/>
  <output>{t('ui.turnTime',{s:secondsPerTurn(speed*pace)})}</output>
  {save.kind==='unsaved'&&<span className="rotate-speed-warn" role="alert" title={t('ui.rotateUnsaved',{why:save.why})} aria-label={t('ui.rotateUnsaved',{why:save.why})}><TriangleAlert size={15}/></span>}
 </div>;
}
