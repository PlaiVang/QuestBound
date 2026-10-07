# Feature flags and infrastructure

QuestBound remains a local-first prototype. **No Supabase project or hosting is needed right now.** Account login is default-off; its client is not initialized and its UI/provider are not mounted while disabled, even if credentials are present.

## Implemented build flags

Set flags in an ignored `.env.local`, then restart Vite or rebuild and sync Android. Only the literal `true` enables a flag; `false` disables it. Invalid nonempty values fail closed. These are build-time rollout flags, not access controls; public `VITE_` values are visible in the app.

| Variable | Default | What it controls | Enable when |
| --- | --- | --- | --- |
| `VITE_ENABLE_ACCOUNTS` | `false` | Account screen, auth provider, Supabase initialization and callback handling | Hosted auth/providers, redirect URLs and lifecycle/privacy requirements are ready |
| `VITE_ENABLE_HEALTH_IMPORT` | `false` | Experimental Android Samsung Health import UI | Native permissions and Samsung sharing have been verified on supported devices |
| `VITE_ENABLE_TEST_TOOLS` | `true` in Vite development; `false` in production builds | Add/remove simulated runs in Settings | Making a private QA build; do not enable in public releases |
| `VITE_ENABLE_DIAGNOSTICS` | `true` | Bounded device-local diagnostic recorder and export UI | Local troubleshooting; user can disable and clear it in Settings |
| `VITE_ENABLE_PACE_COLORS` | `true` | Saved GPS route pace-color switch | Normal local use; disable to roll back the visual feature |

Native Health Connect permission declarations/dependency remain packaged when its UI is disabled. No health read request is made automatically. Native custom auth URL declarations also remain packaged; disabling accounts means callbacks are not processed.

For a private Android test build in PowerShell:

```powershell
$env:VITE_ENABLE_TEST_TOOLS='true'
npm.cmd run build
npx.cmd cap sync android
Remove-Item Env:VITE_ENABLE_TEST_TOOLS
```

Then build/install through Android Studio. Keep `VITE_ENABLE_ACCOUNTS=false`. Flags are not remotely configurable and changing them requires rebuilding/reinstalling. Install updates over the existing app; do not uninstall or clear storage.

## Infrastructure that should stay gated

The following are **planned requirements**, not working flags or integrations. Introduce their flags only with the implementation and tests; flipping a name in an environment file cannot create missing infrastructure.

| Capability / proposed flag | Infrastructure and release prerequisites |
| --- | --- |
| Accounts / existing `VITE_ENABLE_ACCOUNTS` | Supabase Auth project; Google/Apple provider registrations; production email delivery; HTTPS web origin; redirect allowlists; account deletion and support flows |
| Cloud runs / proposed `VITE_ENABLE_CLOUD_SYNC` | Versioned run/route schema; authenticated API; row-level ownership/security; account-isolated local storage; migration opt-in; offline queue; conflict resolution; idempotency; deletion propagation; encrypted transport; backup/restore testing |
| Native secure sessions / proposed `VITE_ENABLE_SECURE_SESSION_STORAGE` | Android Keystore-backed token storage; migration from WebView storage; recovery/logout tests; explicit failure handling rather than insecure fallback |
| Health imports / existing `VITE_ENABLE_HEALTH_IMPORT` | Health Connect availability/permissions; Samsung sharing tests; deduplication; privacy policy and Play Console declarations; record-change handling; optional per-route consent before route import |
| Background health sync / proposed `VITE_ENABLE_BACKGROUND_HEALTH_SYNC` | Supported background/history permissions; durable change tokens; revoked-access handling; workers; battery limits; backfill and deletion semantics |
| Live watch/heart rate / proposed `VITE_ENABLE_WATCH_RECORDING` | Wear OS companion or Bluetooth sensor bridge; pairing/permissions; timestamp alignment; disconnect/reconnect; background service and physical-device battery/accuracy tests |
| Remote crash reports / proposed `VITE_ENABLE_REMOTE_DIAGNOSTICS` | Explicit consent; ingestion backend; auth/rate limits; secret/PII scrubbing; retention/deletion policy; monitoring; build/source-map linkage. Current diagnostics never upload |
| Remote flags / proposed `VITE_ENABLE_REMOTE_FLAGS` | Validated signed/cached configuration; safe offline defaults; rollout cohorts; kill switches; audit trail. Never use client flags as authorization |
| Offline basemaps / proposed `VITE_ENABLE_OFFLINE_MAPS` | Licensed tile provider/download service; cache limits; attribution; privacy review; offline/failure testing. GPS recording already works without tiles |
| Automated device regression / proposed `VITE_ENABLE_AUTOMATION` | CI Android emulator/device matrix; test-only intent or UI harness; deterministic fixtures; artifact capture; cleanup guards. Test controls must not become production backdoors |

## Local test data and diagnostics

Settings > Testing & diagnostics adds six deterministic, labeled simulated runs when test tools are enabled. Fixtures include GPS routes with varied pace, a segmented route, missing elevation, partial laps, a manual treadmill-style entry, and synthetic heart-rate values. They intentionally affect charts, personal records and progression. Adding again skips existing fixture IDs. Remove simulated runs deletes only records marked `simulated: true`, not real runs, preferences, training schedules or rewards. No account is required.

Diagnostics use a separate `questbound-diagnostics:` local-storage namespace and keep the latest 200 events, including run/countdown/pause/resume/recovery transitions, GPS verdict counts batched every 30 fixes (flushed on pause/finish/export), storage results, import/testing outcomes and generic runtime error codes. Exports have a versioned JSON schema, timestamp/elapsed ordering, platform, app version, build revision and active flags. This is suitable as reproducible test evidence; it is not a replay of a runner's real route. App timestamps may still reveal when the app was used.

Coordinates, run IDs, health readings, names, emails, credentials, URLs, raw exception messages and stacks are excluded. Metadata is allowlisted numeric counters; error text remains in the user-facing error UI, not the diagnostic file. No upload is performed. A preference disables collection and clears stored/in-memory events. Storage failures are surfaced in Settings/export; logging must not interrupt an active run.

For troubleshooting, reproduce the issue, export diagnostics, and note the expected/actual behavior and the build used. JSON run backups are separate and contain private workout/route/health data; do not attach them automatically. Unit tests assert flags, redaction/bounds/storage failures, run transitions, fixture behavior, backup compatibility, partial laps and GPS gaps. Physical-device/watch/auth-provider validation remains necessary before enabling those integrations in production.
