# 0002 — Android enforcement design (Phase 1)

- Status: accepted
- Date: 2026-10-15

## Context

The app must enforce parental policies on Android without Device Owner (normal
Play Store install), keep working offline, and pass Google Play review for
Accessibility, Device Admin and foreground-service use.

## Decision

- **Local Expo module `modules/device-control`** (Kotlin). Its TypeScript
  interface (`DeviceControl.types.ts`) is platform-agnostic: screens use
  `getCapabilities()` instead of `Platform.OS`, so an iOS (FamilyControls)
  implementation can plug in later.
- **Native code owns the device credentials.** After pairing, JS hands the
  tokens to native code and never refreshes them itself. Two refreshers would
  rotate the same refresh token and trip the server's reuse detection.
  Tokens are AES-256-GCM encrypted with a non-exportable Android Keystore key.
- **Policy evaluation is pure Kotlin** (`PolicyEvaluator`), unit tested on the
  JVM. The stored policy is enforced offline, including timed locks and
  schedules (evaluated on-device in the policy time zone).
- **AccessibilityService** listens to `typeWindowStateChanged` only, with
  `canRetrieveWindowContent=false`: it learns the foreground package and
  nothing else. The block screen is a `TYPE_ACCESSIBILITY_OVERLAY` window, so no
  `SYSTEM_ALERT_WINDOW` permission is needed.
- **Always-working packages**: SafeKid, system UI, phone/dialer/emergency and
  enabled keyboards. Launchers work unless the device is locked. Settings is
  _not_ essential, so allowlist mode also protects SafeKid's settings.
- **Installed apps** come from a `<queries>` launcher intent, avoiding the
  restricted `QUERY_ALL_PACKAGES` permission.
- **Device Admin** with no policies: used only to block silent uninstall;
  disable requests/disables are reported as tamper alerts.
- **Foreground service** (`specialUse`, subtype `parental_control_enforcement`)
  sends heartbeats and polls `/device/state` every 60 s until FCM is
  configured; then push becomes the primary trigger and polling a fallback.
- **Battery optimization**: the wizard opens the battery-optimization settings
  list rather than the direct `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` dialog,
  which Play restricts to specific app categories.
- **minSdk 26** (Android 8.0) via `expo-build-properties`, for `java.time` and
  modern foreground-service APIs.

## Consequences

- The block screen uses the system locale, not the in-app language (follow-up).
- 60 s polling costs some battery until FCM is set up.
- A child can still pull down quick settings (system UI); deeper tamper
  hardening is Phase 3.
- Play Console declarations needed: Accessibility API use, foreground service
  `specialUse` justification, Device Admin, prominent disclosure (implemented
  in the permission wizard).
