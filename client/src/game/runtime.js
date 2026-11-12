import { TARGETS, OPPONENT } from './config.js'

// Read-only diagnostics for local development and browser acceptance tests.
// Kept outside React state so movement does not trigger UI renders.
export const runtime = { position: [0, 1, 15], grounded: false, peakHeight: 1, yaw: 0, pitch: 0,
  scanMarkers:Array.from({ length:TARGETS.length+1 },() => ({ visible:false,x:0,y:0,distance:0 })),
  opponent:{ position:[...OPPONENT.spawn],phase:'offline',projectiles:[] },
}

