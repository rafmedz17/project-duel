import test from 'node:test'
import assert from 'node:assert/strict'
import { LatencyTracker } from '../src/rooms/LatencyTracker.js'

test('ping uses server elapsed time and accepts exactly one response to its own outstanding probe',()=> {
  let now=100,serial=0
  const latency=new LatencyTracker({ now:()=>now,nonce:()=>`probe-${++serial}` }),sent=[]
  assert.equal(latency.enable('one'),true);assert.equal(latency.enable('one'),false)
  assert.equal(latency.value('one'),-1);assert.equal(latency.probe('one',p=>sent.push(p)),true)
  assert.equal(latency.probe('one',p=>sent.push(p)),false);assert.equal(sent.length,1)
  now=145.6;assert.equal(latency.acknowledge('one',sent[0]),true);assert.equal(latency.value('one'),46)
  assert.equal(latency.acknowledge('one',sent[0]),false)
  assert.equal(latency.probe('one',p=>sent.push(p)),true);now=166.6
  assert.equal(latency.acknowledge('one',sent[1]),true);assert.equal(latency.value('one'),21)
})
test('forged, cross-player, malformed and stale responses cannot set a ping; old samples expire',()=> {
  let now=0,serial=0
  const latency=new LatencyTracker({ now:()=>now,nonce:()=>`nonce-${++serial}` }),sent=[]
  latency.enable('one');latency.enable('two');latency.probe('one',p=>sent.push(p));latency.probe('two',p=>sent.push(p))
  for(const payload of [null,[],{},'nonce-1',{ nonce:'wrong' },{ nonce:sent[0].nonce,ping:0 }]) assert.equal(latency.acknowledge('one',payload),false)
  assert.equal(latency.acknowledge('two',sent[0]),false);assert.equal(latency.value('two'),-1)
  now=5;assert.equal(latency.acknowledge('one',sent[0]),true);assert.equal(latency.value('one'),5)
  now=10005;assert.equal(latency.value('one'),-1);assert.equal(latency.acknowledge('two',sent[1]),false)
  assert.equal(latency.probe('two',p=>sent.push(p)),true)
  now++;assert.equal(latency.acknowledge('two',sent[2]),true);assert.equal(latency.value('two'),1)
  latency.drop('two');assert.equal(latency.value('two'),-1);assert.equal(latency.probe('two',()=>{}),false)
  latency.enable('two');assert.equal(latency.acknowledge('two',sent[2]),false)
  latency.clear();assert.equal(latency.entries.size,0)
})
