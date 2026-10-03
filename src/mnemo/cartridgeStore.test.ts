import {beforeEach,describe,expect,it} from 'vitest';
import {readStore,setStoreInvoker,writeKey,type Invoke} from './cartridgeStore';

/**
 * A host whose state.set REPLACES the blob, as the real one does (doc 73),
 * and whose state.get answers the blob inside an envelope, as the real one does.
 */
function fakeHost(initial:Record<string, unknown>|null, opts:{failGet?:boolean}={}){
 let blob=initial;
 const sets:Record<string, unknown>[]=[];
 const invoke:Invoke=async<T,>(action:string,payload?:Record<string, unknown>)=>{
  await Promise.resolve();
  if(action==='state.get'){if(opts.failGet)throw new Error('host unreachable');return {state:blob,updatedAt:blob===null?null:'2026-10-03T15:23:26.520Z'} as T;}
  if(action==='state.set'){blob=payload!.state as Record<string, unknown>;sets.push(blob);return undefined as T;}
  throw new Error(action);
 };
 setStoreInvoker(invoke);
 return {get:()=>blob,sets};
}

describe('one blob, two features', () => {
 beforeEach(()=>{fakeHost(null);});

 it('saving the gesture speeds keeps the review history', async () => {
  const host=fakeHost({review:{cards:3}});
  await writeKey('gestures',{orbit:2});
  expect(host.get()).toEqual({review:{cards:3},gestures:{orbit:2}});
 });

 it('two saves in the same instant both land', async () => {
  const host=fakeHost({});
  await Promise.all([writeKey('review',{cards:1}),writeKey('gestures',{orbit:2})]);
  expect(host.get()).toEqual({review:{cards:1},gestures:{orbit:2}});
 });

 it('an unreadable store is never written over', async () => {
  const host=fakeHost({review:{cards:9}},{failGet:true});
  await expect(writeKey('gestures',{orbit:2})).rejects.toThrow('host unreachable');
  expect(host.sets).toHaveLength(0);
 });

 it('a failed save does not stop the next one', async () => {
  fakeHost({},{failGet:true});
  await expect(writeKey('a',1)).rejects.toThrow();
  const host=fakeHost({});
  await writeKey('b',2);
  expect(host.get()).toEqual({b:2});
 });

 it('an empty host reads as an empty blob', async () => {
  fakeHost(null);
  expect(await readStore()).toEqual({});
 });
 it('reads the blob inside the envelope, not the envelope', async () => {
  fakeHost({review:{cards:3}});
  expect(await readStore()).toEqual({review:{cards:3}});
 });
});

/** One level of what the wrapped writes left on disk: the previous answer, plus the key written. */
const level=(review:unknown,inner:unknown,at:string|null)=>({state:inner,updatedAt:at,review});

describe('the blob the wrapped writes left on disk (2026-10-03)', () => {
 // cartridge-state/@mnemosyne-plugins%2fmnemo-atlas.json had this shape six levels deep.
 const nested=()=>level({v:1,best:4},level({v:1,best:3},level({v:1,best:2},{review:{v:1,best:1}},'2026-09-23T18:53:38.529Z'),'2026-10-03T15:23:15.110Z'),'2026-10-03T15:23:24.401Z');

 it('reads the newest review, the one at the first level', async () => {
  fakeHost(nested());
  expect(await readStore()).toEqual({review:{v:1,best:4}});
 });

 it('the next write lands flat, and stays flat', async () => {
  const host=fakeHost(nested());
  await writeKey('gestures',{orbit:2});
  expect(host.get()).toEqual({review:{v:1,best:4},gestures:{orbit:2}});
  await writeKey('review',{v:1,best:5});
  expect(host.get()).toEqual({review:{v:1,best:5},gestures:{orbit:2}});
 });

 it('a first write over an empty store leaves no nesting to strip', async () => {
  const host=fakeHost(null);
  await writeKey('review',{v:1,best:1});
  expect(host.get()).toEqual({review:{v:1,best:1}});
 });
});
