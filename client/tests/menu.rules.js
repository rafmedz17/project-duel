import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {CINEMATIC_SHOTS,SHOT_SECONDS,shotAt} from '../src/menu/cinematic.js'
import {composeMenuTheme,MENU_THEME} from '../src/audio/menuTheme.js'

test('cinematic loops four maps with a black cut between shots and a clear middle',()=>{
  assert.deepEqual(CINEMATIC_SHOTS.map(shot=>shot.mapId),['facility','neon','orbital','training'])
  for(let shot=0;shot<4;shot++) {
    assert.equal(shotAt(shot*SHOT_SECONDS).shot,shot)
    assert.equal(shotAt(shot*SHOT_SECONDS).fade,1)
    assert.equal(shotAt((shot+.5)*SHOT_SECONDS).fade,0)
    assert.ok(shotAt((shot+.99)*SHOT_SECONDS).fade>.8)
    for(const key of ['from','to','look','endLook']) assert.ok(CINEMATIC_SHOTS[shot][key].every(Number.isFinite))
  }
  assert.deepEqual(shotAt(40),shotAt(0))
})

test('shipped original score matches its composer, has stereo dynamics and stays below clipping',()=>{
  const score=composeMenuTheme(),wav=readFileSync(new URL('../src/audio/limit-break.wav',import.meta.url))
  assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE')
  assert.equal(wav.readUInt16LE(22),2);assert.equal(wav.readUInt32LE(24),score.sampleRate)
  assert.equal(wav.readUInt32LE(40),score.left.length*4)
  assert.ok(Math.abs(score.duration-MENU_THEME.bars*4*60/MENU_THEME.tempo)<1/score.sampleRate)
  let power=0,difference=0,first=0,second=0
  for(let i=0;i<score.left.length;i++) {
    const l=score.left[i],r=score.right[i]
    assert.ok(Number.isFinite(l) && Number.isFinite(r) && Math.abs(l)<=.77 && Math.abs(r)<=.77)
    power+=l*l+r*r;difference+=Math.abs(l-r)
    if(i<score.left.length/2) first+=l*l;else second+=l*l
    if(i%997===0) {
      assert.equal(wav.readInt16LE(44+i*4),Math.round(l*32767))
      assert.equal(wav.readInt16LE(46+i*4),Math.round(r*32767))
    }
  }
  assert.ok(Math.sqrt(power/(score.left.length*2))>.06)
  assert.ok(difference/score.left.length>.01)
  assert.ok(second>first*1.1,'the second half builds into the full drum and melody arrangement')
})
