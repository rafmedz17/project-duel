// Local input only. The server always computes the actual projectile and hits.
export const throwAim={id:null,code:null,scope:null}
export function beginThrow(id,code,scope) {Object.assign(throwAim,{id,code,scope})}
export function cancelThrow() {Object.assign(throwAim,{id:null,code:null,scope:null})}
