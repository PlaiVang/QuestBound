# ?? QuestBound

A running app that turns your training into a fantasy RPG. Track runs with live GPS, keep a training log, and watch your hero level up, cross a world map, and defeat bosses � all powered by the kilometers you actually run.

## Features

**Training plans**
- Open **Plan** in the bottom navigation to preview an eight-week, three-session-per-week schedule before accepting it.
- Choose a steady routine at a comfortable duration, or a beginner walk/run path toward 30 minutes of easy running. These independently authored general templates are not copied from Runna and do not guarantee a 5K distance or provide medical advice.
- Select three training days with at least one recovery day between sessions. The routine does not automatically increase difficulty; the beginner plan previews its progression in advance.
- Move a session, skip it without penalty, reduce its running blocks, or keep a beginner week's difficulty for the remaining schedule.
- After an interruption, move all pending sessions forward together without piling up catch-up workouts. Completed logs and partial time progress remain.
- Start a due session from the journal. Live guidance follows warm-up, running, recovery walks, and cooldown using active time; pausing stops its clock.
- Each unfinished plan day has a **Start run** action that starts tracking directly and opens the Run screen with its current phase, countdown, and next phase. Future sessions offer **Move to today & start**, with confirmation and recovery-spacing checks.
- **Change training plan** is available throughout the schedule, between runs. Replacing the active schedule requires confirmation; saved runs and earned progress remain. Only one schedule is active at a time; unfinished old schedules are not archived.
- Optional spoken cues are best-effort browser/WebView audio. They may stop in the background or with the screen locked; do not rely on them for background workout guidance.
- Link GPS or manual logs to a planned session and explicitly confirm completion. Walking counts and pace is not a completion requirement. Unknown distance can be omitted for planned manual logs.
- Training plans and linked run history are included in JSON backups; older backups without plans still import.

**Scope:** the original distance/pace-based Realm, XP, quests, and streak mechanics remain a labeled prototype. They do not decide whether a planned workout is complete. Dungeon combat, card packs, loadouts, and party systems are deferred until the game rules are settled.

### GPS limitations and field checks

Android tracking uses a location foreground service, not a permanently illuminated screen. Browser tracking is foreground-only in practice and is not a substitute for native background tracking.

The current filter rejects malformed coordinates, reported accuracy worse than 25 meters, stale timestamps, movements below 3 meters, and speeds above 9 m/s. Gaps longer than 30 seconds start a new route segment: missing travel is not guessed, so poor reception can undercount distance. New GPS best efforts require a continuous segment and cannot bridge pauses or outages. Existing saved effort values are not retroactively recalculated. This is a basic heuristic filter, not validated parity with Strava or Runna. Elevation is GPS-derived and noisy; manual best efforts are even-pace estimates.

Before relying on it for training metrics, compare several measured routes against a reference watch or another app: open sky, trees/buildings, stationary periods, pause/resume, and at least 30 minutes with the screen locked. Record total distance, missing route sections, elapsed time, and battery use. Device power management, permissions, and satellite reception affect results. Offline tracking does not require map tiles, but basemap display requires internet.

**Training**
- Live GPS run tracking with pause/resume. It keeps tracking with the screen off (Android foreground service) and recovers the run if the app crashes.
- Manual run logging for treadmill or watch runs.
- Run log grouped by week, with run details: per-km splits, best efforts, elevation, and an animated **route replay** on a map.
- **Personal records**: fastest 1K / 5K / 10K, longest run, and biggest climb.
- Stats dashboard: weekly distance, pace trend, and distance by class.
- Units in km or miles. JSON backup export and import.

**Game**
- **XP and levels**: 10 XP per km plus 1 XP per minute. Titles go from Squire to Mythic.
- **Run classes**: each run is auto-classified, and you can override the class.

  | Class | Run type | Stat | Bonus |
  | --- | --- | --- | --- |
  | ?? Ranger | Long and easy | Endurance | Extra XP beyond 5 km |
  | ??? Rogue | Fast or intervals | Speed | +25% XP |
  | ??? Paladin | Steady and consistent | Stamina | Streak bonus |
  | ?? Berserker | Hills | Strength | XP for climbing |
- **World map**: your distance moves your hero through 9 regions. Each gate is guarded by a boss with a run challenge, such as "5 km in under 30:00".
- **Quests**: a daily quest and 3 weekly quests.
- **Achievements**: badges and level crests.
- **Weekly streaks**: at least 2 runs per week.
- **Gold and Merchant**: earn gold and spend it on real-life rewards you define.
- **Overtraining guard**: distance far beyond your usual weekly volume earns reduced XP.

All game state is derived from your run history. Editing or deleting a run recalculates everything.

## Development

```bash
npm install
npm run dev      # web version (uses browser GPS + localStorage)
npm run phone    # HTTPS on your LAN, to test GPS from a phone browser
npm test         # unit tests (vitest)
npm run build    # type-check + production build
```

## Android app

Requirements: Android Studio, JDK 21, and an Android device.

```bash
npm run build
npx cap sync android
npx cap open android   # then Run ? on your phone
```

On the device, grant location permission ("While using the app") and allow notifications. The ongoing "QuestBound is tracking your run" notification is what keeps GPS alive with the screen off. For best results, disable battery optimization for QuestBound.

## Tech

Vite, React, and TypeScript, packaged with Capacitor 8.

| Area | Library |
| --- | --- |
| Background GPS | `@capacitor-community/background-geolocation` |
| Native storage | `@capacitor-community/sqlite` (localStorage on web) |
| Maps | Leaflet with OpenStreetMap tiles |
| Charts | Recharts |

Code layout:
- `src/training/`: schedule templates, adjustments, workout phases, and adherence
- `src/game/`: rules engine (pure and unit-tested)
- `src/tracking/`: live run session
- `src/data/`: storage
- `src/pages/`: screens
