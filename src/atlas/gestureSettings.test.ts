import {beforeEach,describe,expect,it,vi} from 'vitest';

const store=vi.hoisted(()=>({blob:{} as Record<string, unknown>,writes:[] as unknown[],read:null as null|(()=>Promise<Record<string, unknown>>)}));
vi.mock('@/mnemo/cartridgeStore',()=>({
 readStore:()=>store.read?store.read():Promise.resolve(store.blob),
 writeKey:(k:string,v:unknown)=>{store.writes.push(v);store.blob={...store.blob,[k]:v};return Promise.resolve();},
}));

beforeEach(()=>{vi.resetModules();store.blob={};store.writes=[];store.read=null;});
const load=()=>import('./gestureSettings');

describe('reading the stored speeds', () => {
 it('a missing or unreadable field takes its default, never 0', async () => {
  const {parseSpeeds}=await load();
  expect(parseSpeeds({orbit:2,depth:0,explode:'fast'})).toEqual({orbit:2,depth:1,explode:1});
  expect(parseSpeeds(null)).toEqual({orbit:1,depth:1,explode:1});
 });
 it('a speed out of range is brought back into it', async () => {
  const {parseSpeeds,SPEED_MAX,SPEED_MIN}=await load();
  expect(parseSpeeds({orbit:99,depth:.01}).orbit).toBe(SPEED_MAX);
  expect(parseSpeeds({orbit:99,depth:.01}).depth).toBe(SPEED_MIN);
 });
});

describe('changing a speed', () => {
 it('applies at once and saves on release, once', async () => {
  store.blob={gestures:{orbit:1.5}};
  const m=await load();
  await m.loadSpeeds();
  expect(m.getSpeeds().orbit).toBe(1.5);
  m.setSpeed('orbit',2,{save:false});
  m.setSpeed('orbit',2.25,{save:false});
  expect(m.getSpeeds().orbit).toBe(2.25);
  expect(store.writes).toHaveLength(0);
  m.setSpeed('orbit',2.25);
  expect(store.writes).toEqual([{orbit:2.25,depth:1,explode:1}]);
 });

 it('a speed chosen before the stored ones arrive wins, and is saved then', async () => {
  let open!:(v:Record<string, unknown>)=>void;
  store.read=()=>new Promise(r=>{open=r;});
  const m=await load();
  const loading=m.loadSpeeds();
  m.setSpeed('explode',2);
  open({gestures:{explode:.5}});
  await loading;
  expect(m.getSpeeds().explode).toBe(2);
  expect(store.writes).toEqual([{orbit:1,depth:1,explode:2}]);
 });

 it('an unreadable store keeps the speed for the session and says it is not saved', async () => {
  store.read=()=>Promise.reject(new Error('no host'));
  const m=await load();
  await m.loadSpeeds();
  m.setSpeed('depth',2);
  expect(m.getSpeeds().depth).toBe(2);
  expect(store.writes).toHaveLength(0);
  expect(m.getSaveState()).toEqual({kind:'unsaved',why:'no host'});
 });
});
