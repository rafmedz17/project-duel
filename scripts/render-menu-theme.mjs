import {writeFile} from 'node:fs/promises'
import {composeMenuTheme,MENU_THEME} from '../client/src/audio/menuTheme.js'

// Rebuild the original score without synthesizing a full song on a player's CPU.
const score=composeMenuTheme(),length=score.left.length,data=Buffer.alloc(44+length*4)
data.write('RIFF',0);data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8)
data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(2,22)
data.writeUInt32LE(score.sampleRate,24);data.writeUInt32LE(score.sampleRate*4,28)
data.writeUInt16LE(4,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(length*4,40)
for(let i=0;i<length;i++) {
  data.writeInt16LE(Math.round(score.left[i]*32767),44+i*4)
  data.writeInt16LE(Math.round(score.right[i]*32767),46+i*4)
}
await writeFile(new URL('../client/src/audio/limit-break.wav',import.meta.url),data)
console.log(`${MENU_THEME.title}: ${score.duration.toFixed(2)}s, ${MENU_THEME.tempo} BPM, ${(data.length/1e6).toFixed(2)} MB stereo WAV`)
