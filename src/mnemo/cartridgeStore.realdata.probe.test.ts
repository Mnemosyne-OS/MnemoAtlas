/**
 * Verification probe (session 00e76b4c, doc 106 §32): the two REAL state
 * blobs found on this machine, fed through the new merging store and the
 * gesture settings. The suite's fixtures are hand-made ({review:{cards:3}});
 * these are the files the host actually wrote on 09/09 and 23/09, review
 * schedules nobody wants erased by a speed slider.
 */
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {readStore,setStoreInvoker,writeKey,type Invoke} from './cartridgeStore';

vi.mock('@mnemosyne_os/cartridge-sdk',()=>({MnemoCartridgeSDK:class{invoke(){return Promise.reject(new Error('not used'));}onGestures(){return {ready:Promise.resolve({takes:[],actions:[]}),off:()=>{}};}}}));

// cartridge-state/@mnemosyne-plugins%2fmnemo-atlas.json, 2026-09-23 (159 bytes)
const ATLAS_FILE={id:'@mnemosyne-plugins/mnemo-atlas',state:{review:{v:1,cards:{FMA23881:{b:0,d:20719,n:1}},best:0}},updatedAt:'2026-09-23T18:53:38.529Z'};
// cartridge-state/@mnemosyne-plugins%2fmnemo-molecule.json, 2026-09-09 (317 bytes)
const MOLECULE_FILE={id:'@mnemosyne-plugins/mnemo-molecule',state:{review:{v:1,cards:{'CHEBI:16235':{b:0,d:20705,n:1},'CHEBI:17568':{b:0,d:20705,n:1},'CHEBI:16750':{b:1,d:20706,n:1},'CHEBI:17821':{b:1,d:20706,n:1},'CHEBI:16708':{b:0,d:20705,n:1}},best:2}},updatedAt:'2026-09-09T18:21:03.967Z'};

/** The host as `state.get` / `state.set` see it: the `state` member replaced whole, read back inside its envelope. */
function hostHolding(file:{state:Record<string, unknown>,updatedAt:string}){
 let blob:Record<string, unknown>=structuredClone(file.state);
 const invoke:Invoke=async<T,>(action:string,payload?:Record<string, unknown>)=>{
  await Promise.resolve();
  if(action==='state.get')return {state:structuredClone(blob),updatedAt:file.updatedAt} as T;
  if(action==='state.set'){blob=payload!.state as Record<string, unknown>;return undefined as T;}
  throw new Error(action);
 };
 setStoreInvoker(invoke);
 return {get:()=>blob};
}

describe('real blobs from this machine', () => {
 beforeEach(()=>{vi.resetModules();});

 it('saving a speed over the real Atlas file keeps the FMA23881 card byte for byte', async () => {
  const host=hostHolding(ATLAS_FILE);
  await writeKey('gestures',{orbit:2,depth:1,explode:1});
  expect(host.get().review).toEqual(ATLAS_FILE.state.review);
  expect(host.get().gestures).toEqual({orbit:2,depth:1,explode:1});
 });

 it('the real Atlas file has no gestures key: the speeds read as 1× everywhere, never 0', async () => {
  hostHolding(ATLAS_FILE);
  const {parseSpeeds}=await import('../atlas/gestureSettings');
  const data=await readStore();
  expect(data.gestures).toBeUndefined();
  expect(parseSpeeds(data.gestures)).toEqual({orbit:1,depth:1,explode:1});
 });

 it('the real Molecule file (5 cards, best 2) survives a gesture save through the same store shape', async () => {
  const host=hostHolding(MOLECULE_FILE);
  await writeKey('gestures',{turn:1.5,zoom:1});
  expect(host.get().review).toEqual(MOLECULE_FILE.state.review);
  expect(Object.keys(host.get()).sort()).toEqual(['gestures','review']);
 });

 it('a review write after a gesture write keeps the gestures (the other direction)', async () => {
  const host=hostHolding(ATLAS_FILE);
  await writeKey('gestures',{orbit:2,depth:1,explode:1});
  await writeKey('review',{...ATLAS_FILE.state.review,best:3});
  expect(host.get().gestures).toEqual({orbit:2,depth:1,explode:1});
  expect((host.get().review as {best:number}).best).toBe(3);
 });
});
