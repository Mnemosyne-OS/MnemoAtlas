import {describe,expect,it,vi} from 'vitest';

vi.mock('@mnemosyne_os/cartridge-sdk',()=>({MnemoCartridgeSDK:class{onGestures(){return {ready:Promise.resolve({takes:[],actions:[]}),off:()=>{}};}}}));

import {dollyDistance,explodeAfter,orbitOffset,panAmount} from './gestures';

const len=(v:{x:number;y:number;z:number})=>Math.hypot(v.x,v.y,v.z);

describe('the hand turns the atlas like the mouse does', () => {
 it('a horizontal drag turns around the target and keeps the distance', () => {
  const start={x:0,y:0,z:4};
  const next=orbitOffset(start,800,100,0)!;
  expect(len(next)).toBeCloseTo(4,6);
  expect(next.x).toBeLessThan(0);
  expect(next.y).toBeCloseTo(0,6);
 });

 it('a vertical drag never flips over the pole', () => {
  const next=orbitOffset({x:0,y:0,z:4},800,0,100000)!;
  expect(next.y).toBeLessThan(4);
  expect(next.y).toBeGreaterThan(3.99);
 });

 it('respects the scene\'s own lowest angle, so the hand cannot go under the floor', () => {
  const max=Math.PI*.96;
  const next=orbitOffset({x:0,y:0,z:4},800,0,-100000,max)!;
  expect(Math.acos(next.y/len(next))).toBeCloseTo(max,6);
 });

 it('an unreadable step leaves the camera where it is', () => {
  expect(orbitOffset({x:0,y:0,z:4},0,1,1)).toBeNull();
  expect(orbitOffset({x:0,y:0,z:4},800,Number.NaN,1)).toBeNull();
  expect(orbitOffset({x:0,y:0,z:0},800,1,1)).toBeNull();
 });
});

describe('closer and farther', () => {
 it('a factor above 1 comes closer, clamped to the controls\' limits', () => {
  expect(dollyDistance(4,2,.07,40)).toBe(2);
  expect(dollyDistance(.1,10,.07,40)).toBe(.07);
  expect(dollyDistance(30,.1,.07,40)).toBe(40);
 });
 it('refuses a factor it cannot read', () => {
  expect(dollyDistance(4,0,.07,40)).toBeNull();
  expect(dollyDistance(4,Number.NaN,.07,40)).toBeNull();
 });
});

describe('the exploded board slides', () => {
 it('one screen height of drag moves one visible height of the scene', () => {
  const visible=2*4*Math.tan(Math.PI/180*34/2);
  const m=panAmount(4,34,800,0,800)!;
  expect(m.up).toBeCloseTo(visible,6);
  expect(m.right).toBeCloseTo(0,6);
  expect(panAmount(4,34,800,800,0)!.right).toBeCloseTo(-visible,6);
 });
 it('refuses an empty viewport', () => {
  expect(panAmount(4,34,0,1,1)).toBeNull();
 });
});

describe('both hands open the body by stages', () => {
 it('spreading opens, closing closes, and a stop holds the stage', () => {
  const half=explodeAfter(0,Math.exp(.5/.9))!;
  expect(half).toBeCloseTo(.5,6);
  expect(explodeAfter(half,1)).toBe(half);
  expect(explodeAfter(half,1/Math.exp(.5/.9))!).toBeCloseTo(0,6);
 });
 it('never goes past assembled nor past every piece apart', () => {
  expect(explodeAfter(.9,100)).toBe(1);
  expect(explodeAfter(.1,.01)).toBe(0);
 });
 it('an unreadable step leaves the body as it is', () => {
  expect(explodeAfter(.4,0)).toBeNull();
  expect(explodeAfter(.4,Number.NaN)).toBeNull();
 });
});

describe('the explode speed', () => {
 it('doubles the opening for the same spread', () => {
  const f=Math.exp(.25/.9);
  expect(explodeAfter(0,f,2)!).toBeCloseTo(.5,6);
  expect(explodeAfter(0,f,0)).toBeNull();
 });
});
