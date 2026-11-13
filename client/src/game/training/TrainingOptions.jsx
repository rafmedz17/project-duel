export default function TrainingOptions({ value,onChange,disabled=false }) {
  return <div className="training-options"><label>Training ammo<select disabled={disabled} aria-label="Training ammo" value={value.noReload ? 'unlimited' : 'normal'} onChange={event=>onChange({ noReload:event.target.value==='unlimited' })}>
    <option value="normal">Normal magazines / reload</option><option value="unlimited">Unlimited ammo / no reload</option>
  </select></label><p>Applies to every gun in training. Multiplayer uses normal ammunition rules.</p></div>
}
