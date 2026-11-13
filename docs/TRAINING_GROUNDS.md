# Training grounds

Enter Training spawns you on the floor of a safe central hub. The layout follows a cross, with wide, level doorways and a colored sign for each course:

```text
                  01 / PRECISION RANGE
                  10 stationary robots
                          |
04 / LIVE FIRE ---- TRAINING NEXUS ---- 02 / REFLEX LAB
5 armed robots          safe hub        45-second flick challenge
and solid cover           |
                    03 / TRACKING BAY
                    6 strafing robots
```

The directions above are relative to the view when you first deploy. The HUD highlights your current room and shows the course control. **G** acts on the room you are in; it does nothing in the hub.

| Course | Behavior | G control |
| --- | --- | --- |
| Precision Range | Ten robots with 100 HP and regional damage. Defeated robots reset after three seconds. | Reset all ten robots immediately |
| Reflex Lab | One glowing circle at a time. Each hit moves it to a new height and horizontal position; the HUD tracks hits, shots, accuracy and remaining time. Spheres do not award kill combos. | Start a fresh 45-second run or stop the current run |
| Tracking Bay | Six robots strafe at different phases and depths. Their rendered bodies, colliders, scan markers and hit detection move together. Stun freezes affected robots. | Pause movement or restart tracking |
| Live Fire | Five robots guard a course with cover. They remain disarmed until you start. Visible targets trigger a short wind-up before eight-damage shots every 1.5 seconds, with muzzle flashes, positional sound and bullet trails. Cover and smoke block sight; flashbang interrupts targeting. | Arm a fresh course or disarm it |

Defeat all five live-fire robots to clear their course. They stay down until you restart it. Leaving the live-fire room disarms them. Leaving the Reflex Lab stops that run. Training pause freezes course clocks, targeting, movement and weapon timers.

Press **B** while playing or paused to open the **Field Armory**. Click the character, primary, pistol, melee or unique-skill card to open a picker. Every selection automatically saves to your presets and equips the selected slot's primary with fresh magazines and abilities while preserving position, health, score and course progress. Your character determines your ultimate; Dash and Shield stay equipped. **Return to Training** or the X resumes training. Escape closes a picker first, then closes the armory to the pause screen. Browsing or closing a picker without choosing an item leaves equipment unchanged. B toggles the armory when focus is outside a picker, text field or selector.

Field-armory saves update the same presets as Character & Loadout: on this device for guests, or to the account for signed-in players. They survive restarts and refreshes and are used the next time you join multiplayer. All other slots keep their contents unless you edit them. A failed save keeps your latest choices visible with **Retry Auto-Save**; training equipment is applied after saving succeeds. Closing is disabled while a save is running; additional equipment choices queue behind it.

Training Settings and the B Field Armory offer **Normal magazines / reload** or **Unlimited ammo / no reload**. Unlimited mode refills every firearm, cancels a reload in progress and prevents ammunition consumption and reloads. Normal mode retains magazine sizes and automatic/manual reloads, with unlimited reserve ammunition. Changing the option applies and saves immediately on this device, including through restarts. It does not affect multiplayer or shorten weapon cooldowns, burst timings or rotary spin-up.
