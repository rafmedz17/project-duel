import { ultimateModifiers } from '../../../../shared/characters.js'

export function loadTrainingOptions() {
  try { return { noReload:JSON.parse(localStorage.getItem('duel-training-options'))?.noReload===true } }
  catch { return { noReload:false } }
}
export const trainingNoReload=(state,time)=>state.trainingOptions?.noReload===true || ultimateModifiers(state,time).noReload
