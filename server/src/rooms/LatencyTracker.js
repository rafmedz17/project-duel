import { randomUUID } from 'node:crypto'

export class LatencyTracker {
  constructor({ now=()=>performance.now(),nonce=randomUUID,timeout=10000 }={}) {
    this.now=now;this.nonce=nonce;this.timeout=timeout;this.entries=new Map()
  }
  enable(id) {
    if(this.entries.has(id)) return false
    this.entries.set(id,{ pending:null,ping:-1,sampledAt:-Infinity });return true
  }
  probe(id,send) {
    const entry=this.entries.get(id),now=this.now()
    if(!entry || (entry.pending && now-entry.pending.sentAt<this.timeout)) return false
    const nonce=this.nonce()
    entry.pending={ nonce,sentAt:now };send({ nonce });return true
  }
  acknowledge(id,payload) {
    const entry=this.entries.get(id),pending=entry?.pending
    if(!pending || !payload || typeof payload!=='object' || Array.isArray(payload) || Object.keys(payload).length!==1 || payload.nonce!==pending.nonce) return false
    const elapsed=this.now()-pending.sentAt
    if(elapsed<0 || elapsed>=this.timeout) return false
    entry.pending=null;entry.ping=Math.max(1,Math.round(elapsed));entry.sampledAt=this.now()
    return true
  }
  value(id) {
    const entry=this.entries.get(id)
    return entry && this.now()-entry.sampledAt<this.timeout ? entry.ping : -1
  }
  drop(id) { this.entries.delete(id) }
  clear() { this.entries.clear() }
}
