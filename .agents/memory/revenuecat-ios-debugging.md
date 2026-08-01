---
name: RevenueCat iOS debugging lessons
description: Root causes and fixes for RC purchases silently failing in a Capacitor iOS app
---

# RevenueCat iOS Purchases — Debugging Lessons

## ROOT CAUSE 1: initializeRevenueCat() never called at startup

**Why:** `main.tsx` never imported or called `initializeRevenueCat()`. The hook calls it as a fallback when a component mounts, but by that point the SDK is already needed for purchase flows.

**Fix:** Add to `main.tsx`, before `createRoot`:
```ts
import { initializeRevenueCat } from './lib/revenuecat';
initializeRevenueCat().catch(console.warn);
```

---

## ROOT CAUSE 2: pnpm symlinks — RC Swift code never compiled into binary

**Why:** pnpm stores packages as symlinks. Xcode's SPM resolver cannot follow symlinks. The RC plugin gets "added" to the Xcode project but its Swift code is never compiled in. All Capacitor bridge calls to `Purchases.*` hang.

**Diagnostic:** `Capacitor.isPluginAvailable('Purchases')` returns `false`.

**Fix:** In Codemagic build script, before `cap add ios`:
```bash
cd artifacts/outfit-generator
RC_PATH="node_modules/@revenuecat/purchases-capacitor"
if [ -L "$RC_PATH" ]; then
  cp -rL "$RC_PATH" "${RC_PATH}-real"
  rm "$RC_PATH"
  mv "${RC_PATH}-real" "$RC_PATH"
fi
```

**How to apply:** Any Codemagic build for a Capacitor app in a pnpm monorepo must dereference plugin symlinks before `cap add ios`.

---

## ROOT CAUSE 3: Awaiting bridge responses that never return (RC "SDK never used")

**Why:** RC Capacitor v13's `configure()` and `setLogLevel()` both require a bridge response callback from Swift → JS to resolve their Promises. If this callback lags or never fires (observed on some Capacitor 8 + SPM builds), awaiting either call blocks indefinitely. `setLogLevel()` was awaited BEFORE configure(), so configure() was **never called at all** — causing RC dashboard to show "SDK key never used" forever.

**`configure()` returns `Promise<void>`** — the native Swift `Purchases.configure()` is synchronous. RC is fully initialized the moment the JS bridge message reaches Swift. Awaiting the Promise response is unnecessary.

**Fix:** Fire both calls without awaiting:
```ts
// setLogLevel — fire and forget
import("@revenuecat/purchases-capacitor")
  .then(({ LOG_LEVEL }) =>
    Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG })
      .then(() => console.log("[RC] setLogLevel ✓"))
      .catch((e: unknown) => console.warn("[RC] setLogLevel failed:", e))
  )
  .catch(() => {});

// configure() — fire and forget. SDK initializes on native the moment message arrives.
void Purchases.configure({ apiKey })
  .then(() => console.log("[RC] configure() bridge response ✓"))
  .catch((e: unknown) => console.error("[RC] configure() error:", e));

await Promise.resolve(); // one microtask tick before marking ready
setDiag("ok");
```

**How to apply:** Never await `configure()` or `setLogLevel()` in RC Capacitor on iOS. The native side is synchronous; the JS Promise response is unreliable on Capacitor 8 + SPM.

---

## isPluginAvailable('Purchases') does NOT prove the bridge works

**Why:** `Capacitor.isPluginAvailable()` is a synchronous JS-side check of the plugin registry. It returns `true` if the JS module is loaded and registered — it does NOT confirm that native bridge calls will succeed or that the Swift response callback will fire.

**How to apply:** Don't use `isPluginAvailable` as proof that configure() will work. The real test is whether RC dashboard shows "SDK version data" after a build.

---

## useRcReady pattern — start false, wait for configure to settle

**Fix:**
```ts
function useRcReady(): boolean {
  const [rcReady, setRcReady] = useState(_rcSettled);
  useEffect(() => {
    if (_rcSettled) { setRcReady(true); return; }
    let cancelled = false;
    const unblock = () => { if (!cancelled) setRcReady(true); };
    initializeRevenueCat().then(unblock).catch((err) => {
      console.warn("[RevenueCat] Init failed — unblocking queries:", err);
      unblock();
    });
    const t = setTimeout(unblock, 30_000); // hard fallback
    return () => { cancelled = true; clearTimeout(t); };
  }, []);
  return rcReady;
}
```

Always unblock queries even on error (the `.catch` calling `unblock()`).

---

## isOfferingsReady false positive when queries disabled

**Why:** React Query v5: disabled queries have `isLoading = false`, so `isOfferingsReady = true` before queries ever run.

**Fix:** Gate on `rcReady`:
```ts
isOfferingsReady: rcReady && !offeringsQuery.isLoading && !offeringsQuery.isFetching,
```

---

## Wrong env var overriding hardcoded RC key

**Why:** `VITE_REVENUECAT_IOS_KEY` in Codemagic's env group may contain another app's RC key.

**Fix:** Hardcode the RC iOS public key directly — RC public keys are designed to be in app bundles:
```ts
const RC_IOS_KEY = "appl_QMxyPWfJlvrCqHrbLhPMTgthvKc"; // My Digital Holidays
```

---

## Apple sandbox propagation delay

Newly configured IAP products take up to 24 hours to appear in Apple's sandbox.
