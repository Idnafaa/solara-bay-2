# Solara Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Idnafaa/solara-bay-2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Idnafaa/solara-bay-2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game set in **Solara Bay**, a sun-soaked coastal city of
glass towers, palm-lined avenues and a working marina. You play **Dario Vega**,
a wheelman back on the street after a stretch in county lockup. **Lena Ortiz**,
the fixer who runs Palmera Heights, has three jobs for you — and the whole
Solara Bay Police Department standing between you and the payday.

## How to play

Serve the game and open it in a desktop browser:

```sh
node serve.ts
# then open http://localhost:8080
```

No build step, no network requests: everything the game loads lives under
`game/`.

### The story

1. **Dockside Pickup** — fetch a package from the Old Harbor docks and bring
   it back to Lena's corner in Palmera Heights. ($400)
2. **Hot Wheels** — steal any car off the street and deliver it to the chop
   shop in Canal Row. The cops will notice. ($750)
3. **The Harbor Run** — run the payout cash to the drop boat at Marina del
   Sol while the SBPD hunts you. ($1,200)

Finish all three and the story is complete; the city stays open for free roam.

### Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk, run, drive |
| Mouse (click to lock) | Look around |
| Shift | Sprint |
| Space | Jump |
| E | Steal a car / get out · interact with a job objective |
| Left click | Fire the pistol |
| P | Save game (restores cash, health and story progress) |
| M | Mute / unmute |
| Esc | Pause |

### Systems

- **A living city** — an 8×8 street grid with towers, a marina and docks,
  palms, billboards and traffic lights that actually cycle.
- **Traffic** — cars drive the grid and stop at red lights; pedestrians stroll
  the sidewalks and scatter when gunfire starts.
- **Stealable cars** — walk up to any car, take it, and drive it with arcade
  handling. Parked cars stay where you left them.
- **Wanted level** — crime raises your heat. Police Interceptors spawn, chase
  and ram you. Get boxed in at a crawl and the bust meter fills; stay out of
  sight and the stars drop one by one.
- **Combat** — a pistol with hit sparks, a reload, and consequences: shooting
  a local brings the heat down on you.
- **HUD** — cash, health, wanted stars, current objective, a live top-down
  minimap (streets, player, waypoint, police blips), a bust meter and a
  speedometer.
- **Screens** — title, pause, job complete, story complete, busted, wasted.
- **Sound** — everything is synthesised live with WebAudio: engine hum,
  two-tone sirens, gunshots, a bass groove and UI blips. No audio files.
- **Save / load** — progress is stored in localStorage; continue from the
  title screen.

## File layout

```
game/
  index.html            page, HUD and screens
  vendor/three.module.min.js   three.js 0.160.0 (vendored)
  src/
    main.js             boot, game loop, player, camera, combat, wanted, save
    city.js             the 8x8 city, marina, palms, traffic lights, collision
    vehicles.js         car factory, traffic, arcade driving, police pursuit
    people.js           pedestrians and panic
    missions.js         the three jobs and story state
    hud.js              HUD panels and the live minimap
    audio.js            WebAudio synth: engine, sirens, shots, bass
    input.js            keyboard, mouse, pointer lock
    rng.js              seeded random helpers
    textures.js         canvas-painted facades, ground plan, water, signs
main.ts                 entry program: copies game/ + screenshots/ to /output
serve.ts                static server for local play (port 8080)
shots.json              the four screenshot scenes
screenshots/           1-start.jpg, 2-drive.jpg, 3-chase.jpg, 4-done.jpg
```

## Screenshots

The four screenshots in `screenshots/` are real renders of the game running
in headless Chromium, staged through the game's own `?shot=` hook
(`start`, `drive`, `chase`, `done`).

<sub>Entered on [make.fun](https://make.fun/?ref=01tnmm85&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
