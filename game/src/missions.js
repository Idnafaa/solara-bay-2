// The story: three jobs for Lena Ortiz, then the bay is yours. Each job is a
// chain of stages — go somewhere, do something, get paid. The game asks this
// module what the current objective is and where its waypoint sits.
export const MISSIONS = [
  {
    id: 'dockside',
    title: 'DOCKSIDE PICKUP',
    giver: 'Lena Ortiz',
    brief: 'Lena has a package waiting at the Old Harbor docks. Go get it, then bring it back to her corner in Palmera Heights.',
    pay: 400,
    stages: [
      { type: 'goto', x: 150, z: 178, radius: 6, text: 'Pick up the package at the Old Harbor docks', kicker: 'JOB 1 — DOCKSIDE PICKUP' },
      { type: 'interact', x: 150, z: 178, radius: 5, text: 'Grab the package (E)', kicker: 'JOB 1 — DOCKSIDE PICKUP' },
      { type: 'goto', x: 10, z: 10, radius: 6, text: 'Bring the package back to Lena Ortiz', kicker: 'JOB 1 — DOCKSIDE PICKUP' },
      { type: 'interact', x: 10, z: 10, radius: 5, text: 'Hand the package to Lena (E)', kicker: 'JOB 1 — DOCKSIDE PICKUP' },
    ],
  },
  {
    id: 'hotwheels',
    title: 'HOT WHEELS',
    giver: 'Lena Ortiz',
    brief: 'A buyer in Canal Row wants a Vento S, no questions asked. Steal any car off the street and bring it to the chop shop — the cops will notice.',
    pay: 750,
    stages: [
      { type: 'steal', x: 0, z: 0, radius: 0, text: 'Steal a car off the street (E near any car)', kicker: 'JOB 2 — HOT WHEELS' },
      { type: 'goto', x: -150, z: -100, radius: 7, text: 'Deliver the stolen car to the Canal Row chop shop', kicker: 'JOB 2 — HOT WHEELS' },
      { type: 'interact', x: -150, z: -100, radius: 6, text: 'Hand over the keys (E)', kicker: 'JOB 2 — HOT WHEELS' },
    ],
  },
  {
    id: 'harborrun',
    title: 'THE HARBOR RUN',
    giver: 'Lena Ortiz',
    brief: 'The last job: run the payout cash to the drop boat at Marina del Sol. The whole SBPD is out tonight — lose them or outrun them, but make the drop.',
    pay: 1200,
    stages: [
      { type: 'goto', x: -100, z: 178, radius: 7, text: 'Reach the drop boat at Marina del Sol — the cops are coming', kicker: 'JOB 3 — THE HARBOR RUN' },
      { type: 'interact', x: -100, z: 178, radius: 6, text: 'Drop the cash (E)', kicker: 'JOB 3 — THE HARBOR RUN' },
    ],
  },
];

export class Story {
  constructor() {
    this.missionIndex = 0;   // 0..2, or 3 when the story is done
    this.stageIndex = 0;
    this.done = false;
    this.freeRoam = false;
  }

  get mission() {
    return MISSIONS[this.missionIndex] ?? null;
  }

  get stage() {
    const m = this.mission;
    return m ? m.stages[this.stageIndex] ?? null : null;
  }

  get objectiveText() {
    if (this.done) return 'Story complete — free roam. The bay is yours.';
    if (this.freeRoam) return 'Free roam — explore Solara Bay.';
    const s = this.stage;
    return s ? s.text : 'Talk to Lena Ortiz.';
  }

  get objectiveKicker() {
    if (this.done) return 'STORY COMPLETE';
    if (this.freeRoam) return 'FREE ROAM';
    const s = this.stage;
    return s ? s.kicker : 'SOLARA BAY';
  }

  // The waypoint the HUD and minimap point at, or null.
  get waypoint() {
    if (this.done || this.freeRoam) return null;
    const s = this.stage;
    if (!s) return null;
    if (s.type === 'steal') return null; // any car will do
    return { x: s.x, z: s.z };
  }

  // Advance a 'goto' stage when the player is inside its radius. Returns the
  // stage that was completed, or null.
  checkGoto(x, z) {
    const s = this.stage;
    if (!s || s.type !== 'goto') return null;
    const dx = x - s.x, dz = z - s.z;
    if (dx * dx + dz * dz < s.radius * s.radius) {
      this.stageIndex++;
      return s;
    }
    return null;
  }

  // Advance an 'interact' stage. Returns the stage, or null.
  checkInteract(x, z) {
    const s = this.stage;
    if (!s || s.type !== 'interact') return null;
    const dx = x - s.x, dz = z - s.z;
    if (dx * dx + dz * dz < s.radius * s.radius) {
      this.stageIndex++;
      return s;
    }
    return null;
  }

  // Advance a 'steal' stage when the player takes a car.
  checkSteal() {
    const s = this.stage;
    if (!s || s.type !== 'steal') return false;
    this.stageIndex++;
    return true;
  }

  // True when the current mission ran out of stages. Call finishMission() to
  // collect the payout and move on; returns the finished mission.
  missionComplete() {
    const m = this.mission;
    return m && this.stageIndex >= m.stages.length ? m : null;
  }

  finishMission() {
    const m = this.missionComplete();
    if (!m) return null;
    this.missionIndex++;
    this.stageIndex = 0;
    if (this.missionIndex >= MISSIONS.length) this.done = true;
    return m;
  }

  startFreeRoam() {
    this.freeRoam = true;
  }
}
