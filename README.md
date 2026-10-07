# ?? QuestBound

A running app that turns your training into a fantasy RPG. Track runs with live GPS, keep a training log, and watch your hero level up, cross a world map, and defeat bosses � all powered by the kilometers you actually run.

## Features

Outdoor GPS runs show lightweight route-outline thumbnails in the Adventure Log, with no map-tile downloads. Pauses and signal gaps stay disconnected; manual runs and runs without usable route data keep a workout icon. Open a run for the full map and replay.
The original starter pixel-art pack lives in `src/art/sprites.ts`: four hero classes, an adventurer, eight bosses, five navigation sprites, coin, chest, and a mystery icon. SVG pixels render consistently offline across devices; dashboard, class chips, log placeholders, navigation, and boss encounters use them. Scenery and some secondary utility/reward icons remain emoji placeholders for later art passes.
Run-detail splits follow Settings units: full kilometers or full miles. GPS mile splits are recalculated from recorded route points; manual splits are estimated at even pace. Saved kilometer splits remain unchanged for backup compatibility.
Run details include a workout summary, Map/Charts switch, smoothed GPS pace and elevation charts, and a lap table including the final partial mile/kilometer. GPS lap timing excludes pauses and missing route segments; manual laps assume even pace. Stats shows twelve weeks of training time and completed sessions, this/previous-week summaries, and 30-day comparisons. These descriptive trends do not prescribe more exercise.

Average/maximum heart rate can be entered from a real watch or sensor on each saved run, edited/removed, and included in JSON backups. Missing readings say "Not recorded"; GPS never estimates heart rate. Samsung Health imports can include available measured heart-rate samples. Live watch recording, Bluetooth heart-rate recording, and heart-rate zones are not implemented; a standalone Wear OS recording app is a separate project.

Saved GPS routes have a **Pace colors** switch: blue/green/gold/orange/red show faster-to-slower smoothed pace relative to that run's 10th/90th percentile range. Gray means insufficient data. Pauses and GPS gaps stay disconnected; the legend follows km/mile settings. Colors are not heart-rate or effort zones.

### Samsung Health import (Android)

This experimental UI is default-off. Enable `VITE_ENABLE_HEALTH_IMPORT=true` only in a device-validation build; see [FEATURE_FLAGS.md](FEATURE_FLAGS.md).

In Samsung Health, enable Health Connect sharing for exercise, distance and heart rate. In QuestBound **Settings > Samsung Health**, tap **Import Samsung runs** and grant the three read permissions. Health Connect is built into Android 14+; older supported devices need the Health Connect app. The app now requires Android 8+ for the Health Connect SDK; actual Health Connect availability depends on the device/provider.

This is a user-initiated, read-only import of Samsung Health running/treadmill sessions from the last 30 days, not background or two-way sync. Imported summaries appear in the log, trends and game progression. Stable Health Connect IDs prevent re-imports; sessions starting within one minute of an existing log are conservatively skipped to avoid double logging. Deleting an imported run allows it to be imported again. Existing imports are not refreshed when Samsung records change. Imports do not mark training-plan sessions complete automatically.

Duration is elapsed session time (including pauses), laps/best efforts are even-pace estimates, and only Samsung-origin distance records fully contained within the session are summed. If no distance was shared it is recorded as zero, not guessed. Average heart rate is the mean of the available valid samples, not Samsung's displayed summary; maximum is the highest sample. Route/elevation import is **not** included, so Samsung runs have no pace map. No health records are sent to Supabase or written to Health Connect. Native permissions and real Samsung records need physical-device validation; compiling the bridge is not proof that every Samsung version shares all metrics.

Health Connect is a simpler first integration than a standalone watch app. Direct [Samsung Health Data SDK](https://developer.samsung.com/health/data/process.html) distribution requires Samsung partner approval. Health Connect still requires user consent, compatible Samsung sharing, and Health Connect declarations/privacy-policy review for Play distribution. The native permission rationale explains local storage and exports; a hosted public privacy policy and Play Console declarations must be supplied before release.

### Optional accounts

Account identity uses Supabase Auth and is **default-off** behind `VITE_ENABLE_ACCOUNTS=false`. No hosting/configuration is needed for normal local use. Its UI and client are disabled even if credentials are present. Keep it off until you want to configure hosting; see [FEATURE_FLAGS.md](FEATURE_FLAGS.md) for implemented flags, planned infrastructure, removable test runs and local diagnostics. To enable it later:

1. Create a Supabase project. Copy `.env.example` to `.env.local`, set `VITE_ENABLE_ACCOUNTS=true`, and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` with the project URL and **public publishable** (or legacy anon) key. Never put a service-role/secret key or provider secret in Vite configuration; everything prefixed `VITE_` ships to the app.
2. Enable email/password and configure Google and Apple providers in the Supabase dashboard. Provider credentials stay in Supabase, not in this repository. Use Supabase's displayed `/auth/v1/callback` URL as the provider's OAuth callback. Apple requires the appropriate Apple developer service/key configuration; provider availability is not automatic.
3. Allow the exact QuestBound redirects in Supabase Auth URL Configuration: `com.plaivang.questbound://auth/callback` for Android, and the web origin plus deployment pathname (for example `http://localhost:5173/` or `https://your-domain.example/`). Do not include `#/settings` in the allowlist; successful callbacks navigate there after code exchange. Set the production Site URL and production email delivery configuration.
4. Restart Vite or rebuild, then `npx cap sync android`. PKCE confirmation/reset links must open on the same browser/device where the request was made. Cross-device email links require a different verified-link flow; they are not supported by this initial setup.

Configured builds support Google/Apple browser sign-in, email signup/sign-in, password reset/update, and local logout. Malformed configuration shows an error instead of crashing startup. Real authentication requires the hosted project/provider configuration and must be tested there.

**Identity only:** accounts do not upload, back up, partition, or own runs/settings. All accounts and signed-out users on the same installation see the same local log. Logout keeps local data. Settings includes unit/hero preferences and JSON backup export/import; backups include health data but no authentication session. Cloud sync, remote account deletion, profile synchronization and secure-native token storage are not implemented. Supabase currently persists authentication sessions in the WebView/browser's local storage. Do not deploy this as a shared-device/private cloud-account product without account isolation, secure token storage and deletion/privacy lifecycle work.

Android SQLite is configured without encryption, matching the existing database connection. If startup reports `CapacitorSQLitePlugin: null`, rebuild, sync, and install the updated app over the existing installation; do not clear app data or uninstall to troubleshoot, as that removes local runs.

**Training plans**
- Plan includes a monthly calendar with scheduled/completed/skipped sessions and logged runs. Select a day to view its workouts, start a session, or open a run log.
- All new live runs have a cancellable five-second countdown. Countdown time is excluded from the run and workout clocks. Resuming an existing paused run does not restart the countdown; manual logging has none.
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
