---
name: RevenueCat iOS debugging lessons
description: Root causes and fixes for RC purchases silently failing in a Capacitor iOS app
---

# RevenueCat iOS Purchases — Debugging Lessons

## ROOT CAUSE: initializeRevenueCat() never called at startup

**Why:** `main.tsx` never imported or called `initializeRevenueCat()`. The hook (`useRevenueCat`) calls it as a fallback when a component mounts, but by that point the SDK is already needed for purchase flows. RC's native bridge was never touched at launch → RC dashboard showed "No SDK version data yet" forever.

**Fix:** Add to `main.tsx`, before `createRoot`:
```ts
import { initializeRevenueCat } from './lib/revenuecat';
initializeRevenueCat().catch(console.warn);
```

**How to apply:** For any Capacitor app using RevenueCat, `Purchases.configure()` must be called at app startup in `main.tsx` (or equivalent entry point), not lazily inside a React component or hook.

---

## Wrong Xcode workspace in Codemagic (CocoaPods not linked)

**Why:** Codemagic was building with `App.xcodeproj/project.xcworkspace` (the raw Xcode project workspace). When `cap add ios` runs, CocoaPods generates `App.xcworkspace` that wraps both the project AND all native Capacitor plugin frameworks (RevenueCat, Camera, etc.). Building from the wrong workspace means native plugin frameworks are never compiled in. JS `Purchases.configure()` hits the bridge and gets nothing back — silently. RC shows "No SDK version data yet" because the native code was never in the binary.

**Fix:**
1. Add `pod install --repo-update` as an explicit Codemagic step after `cap sync ios`
2. Use `App.xcworkspace` (not `App.xcodeproj/project.xcworkspace`) in ALL three places: `resolvePackageDependencies`, `archive`, and the `XCODE_WORKSPACE` variable

**How to apply:** Any Codemagic build for a Capacitor app must use `App.xcworkspace`. Check `codemagic.yaml` for any reference to `App.xcodeproj/project.xcworkspace` in build steps and replace with `App.xcworkspace`. Add `pod install` explicitly.

---

## Wrong env var overriding hardcoded RC key

**Why:** `VITE_REVENUECAT_IOS_KEY` in Codemagic's `build_env` group may contain a DIFFERENT app's RC key (e.g. My Digital Closet). Since the env var is non-empty, it overrides the hardcoded fallback in code. `configure()` then authenticates against the wrong RC account — that other app sees SDK connections, this app sees none.

**Fix:** Hardcode the RC iOS public key directly in code. Remove env var lookup. RC public keys are designed to be in app bundles (not secrets).

```ts
// Hardcoded — RC public keys are meant to be in the bundle
const RC_IOS_KEY = "appl_QMxyPWfJlvrCqHrbLhPMTgthvKc";
function getApiKey(): string {
  if (Capacitor.isNativePlatform()) return RC_IOS_KEY;
  throw new Error("RC key not applicable outside native");
}
```

**How to apply:** When an RC key is registered for a specific app, never let a shared env var group override it. Hardcode per-app keys directly.

---

## WKWebView timer throttling

**Why:** `setTimeout(fn, 12000)` is aggressively throttled by iOS WKWebView — it may never fire while a native bridge call is pending.

**Fix:** Replace with a `setInterval` polling loop checking every 1 second.

```ts
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let done = false;
    const start = Date.now();
    promise.then(v => { done = true; resolve(v); }).catch(e => { done = true; reject(e); });
    const iv = setInterval(() => {
      if (done) { clearInterval(iv); return; }
      if (Date.now() - start >= ms) { clearInterval(iv); reject(new Error(`Timed out after ${ms}ms`)); }
    }, 1000);
  });
}
```

---

## rcReady gate causing queries to never start

**Why:** Gating queries on a JS-side settle signal from `configure()` — if `configure()` hangs, queries never run.

**Fix:** On native platform, set `rcReady = true` immediately. RC's native SDK internally queues calls made before `configure()` finishes.

```ts
const isNative = Capacitor.isNativePlatform();
const [ready, setReady] = useState(isNative || _rcSettled);
```

---

## RC dashboard verification checklist

When RC purchases aren't working, verify in RC dashboard:
1. **Apps → your app → Bundle ID** matches exactly
2. **Products** — all product IDs exist and connected to Apple
3. **Entitlements** — identifier matches code constant
4. **Offerings** — "default" offering with correct package identifiers
5. **SDK Compatibility section** — "No SDK version data yet" = RC was NEVER reached by the native binary

If SDK data is missing: check CocoaPods workspace issue above first, then check key override issue.

---

## Apple sandbox propagation delay

**Why:** Newly configured IAP products take up to 24 hours to appear in Apple's sandbox servers. StoreKit hangs (not errors) while waiting for a product lookup that never returns.

**How to apply:** After confirming RC config is correct AND the CocoaPods fix is deployed, if products still don't load, wait 24 hours. No code change needed.
