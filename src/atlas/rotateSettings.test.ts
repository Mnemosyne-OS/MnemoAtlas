import {beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const store=vi.hoisted(()=>({blob:{} as Record<string, unknown>,writes:[] as unknown[],read:null as null|(()=>Promise<Record<string, unknown>>),fail:null as null|string}));
vi.mock('@/mnemo/cartridgeStore',()=>({
 readStore:()=>store.read?store.read():Promise.resolve(store.blob),
 writeKey:(k:string,v:unknown)=>{if(store.fail)return Promise.reject(new Error(store.fail));store.writes.push({[k]:v});store.blob={...store.blob,[k]:v};return Promise.resolve();},
}));

beforeEach(()=>{vi.resetModules();store.blob={};store.writes=[];store.read=null;store.fail=null;});
const load=()=>import('./rotateSettings');

describe('the turn speed the person chose (2026-10-13)', () => {
 it('defaults to a turn in 20 s, faster than the old button (about 90 s)', async () => {
  const {DEFAULT_ROTATE,getRotateSpeed,secondsPerTurn}=await load();
  expect(getRotateSpeed()).toBe(DEFAULT_ROTATE);
  expect(secondsPerTurn(DEFAULT_ROTATE)).toBe(20);
 });

 it('a missing or unreadable value takes the default, never 0', async () => {
  const {parseRotate,DEFAULT_ROTATE}=await load();
  expect(parseRotate(null)).toBe(DEFAULT_ROTATE);
  expect(parseRotate({speed:0})).toBe(DEFAULT_ROTATE);
  expect(parseRotate({speed:'fast'})).toBe(DEFAULT_ROTATE);
  expect(parseRotate({speed:Number.NaN})).toBe(DEFAULT_ROTATE);
  expect(parseRotate({speed:6})).toBe(6);
 });

 it('a value out of range is brought back into it', async () => {
  const {parseRotate,ROTATE_MAX,ROTATE_MIN}=await load();
  expect(parseRotate({speed:99})).toBe(ROTATE_MAX);
  expect(parseRotate({speed:.1})).toBe(ROTATE_MIN);
 });

 it('reads the stored speed, applies a drag at once and saves on release, once', async () => {
  store.blob={rotate:{speed:4}};
  const m=await load();
  await m.loadRotate();
  expect(m.getRotateSpeed()).toBe(4);
  m.setRotateSpeed(6,{save:false});
  m.setRotateSpeed(6.5,{save:false});
  expect(m.getRotateSpeed()).toBe(6.5);
  expect(store.writes).toHaveLength(0);
  m.setRotateSpeed(6.5);
  expect(store.writes).toEqual([{rotate:{speed:6.5}}]);
 });

 it('a speed chosen before the stored one arrives wins, and is saved then', async () => {
  let open!:(v:Record<string, unknown>)=>void;
  store.read=()=>new Promise(r=>{open=r;});
  const m=await load();
  const loading=m.loadRotate();
  m.setRotateSpeed(8);
  expect(store.writes).toHaveLength(0);
  open({rotate:{speed:2}});
  await loading;
  expect(m.getRotateSpeed()).toBe(8);
  expect(store.writes).toEqual([{rotate:{speed:8}}]);
 });

 it('a store that cannot be read keeps the default and says it, and a failed save is said too', async () => {
  store.read=()=>Promise.reject(new Error('no host'));
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
  const m=await load();
  await m.loadRotate();
  expect(m.getRotateSpeed()).toBe(m.DEFAULT_ROTATE);
  expect(m.getRotateSaveState()).toEqual({kind:'unsaved',why:'no host'});

  vi.resetModules();store.read=null;store.fail='disk full';
  const n=await load();
  await n.loadRotate();
  n.setRotateSpeed(5);
  await Promise.resolve();await Promise.resolve();
  expect(n.getRotateSpeed()).toBe(5);
  expect(n.getRotateSaveState()).toEqual({kind:'unsaved',why:'disk full'});
  warn.mockRestore();
 });

 it('the scene turns by elapsed time, so a speed is turns per minute on any screen', () => {
  const scene=readFileSync(join(__dirname,'scene.tsx'),'utf8');
  // update(dt): without it OrbitControls turns a fixed angle per FRAME, so a 144 Hz screen turned 2.4× faster than the slider said
  expect(scene).toContain('controls.update(dt);if(controls.autoRotate)dirty=true;');
 });
});
