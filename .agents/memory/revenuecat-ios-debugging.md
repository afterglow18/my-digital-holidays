---
name: RevenueCat iOS debugging lessons
description: Root causes and fixes for RC purchases silently failing in a Capacitor iOS app
---

# RevenueCat iOS Purchases — Debugging Lessons

## ROOT CAUSE 1: initializeRevenueCat() never called at startup

**Why:** `main.tsx` never imported or called `initializeRevenueCat()`. The hook calls it as a fallback when a component mounts, but by that point the SDK is already needed for purchase flows. RC's native bridge was never touched at launch → RC dashboard showed "No SDK version data yet" forever.

**Fix:** Add to `main.tsx`, before `createRoot`:
```ts
import { initializeRevenueCat } from './lib/revenuecat';
initializeRevenueCat().catch(console.warn);
```

**How to apply:** For any Capacitor app using RevenueCat, `Purchases.configure()` must be called at app startup in `main.tsx` (or equivalent entry point), not lazily inside a React component or hook.

---

## ROOT CAUSE 2: pnpm symlinks — RC Swift code never compiled into binary

**Why:** pnpm stores packages as symlinks. Xcode's SPM resolver cannot follow symlinks for local package references. The RC plugin (`@revenuecat/purchases-capacitor`) gets "added" to the Xcode project but its Swift code is never compiled in. All Capacitor bridge calls to `Purchases.*` hang forever — no response, no error.

**Diagnostic:** `Capacitor.isPluginAvailable('Purchases')` returns `false` (even though isNativePlatform is true).

**Fix:** In the Codemagic build script, before `cap add ios`:
```bash
cd artifacts/outfit-generator
RC_PATH="node_modules/@revenuecat/purchases-capacitor"
if [ -L "$RC_PATH" ]; then
  cp -rL "$RC_PATH" "${RC_PATH}-real"
  rm "$RC_PATH"
  mv "${RC_PATH}-real" "$RC_PATH"
fi
```

**How to apply:** Any Codemagic/CI build for a Capacitor app in a pnpm monorepo must dereference plugin symlinks before `cap add ios`. Apply to any other Capacitor plugins that have a `Package.swift` if they also fail.

---

## ROOT CAUSE 3: configure() awaited but returns CustomerInfo (network call)

**Why:** RC Capacitor v13's `configure()` returns `Promise<CustomerInfo>` — it awaits an initial network fetch to RC's servers, not just local SDK initialization. Awaiting it blocks until RC responds (can be 5–30+ seconds or timeout). RC `plugin:true` but `RC:init` forever.

**Fix:** Wrap `configure()` in a short timeout (5s). Timeout = CustomerInfo fetch is slow, but the SDK IS configured (native init is synchronous). Treat timeout as success:
```ts
try {
  await withTimeout(Purchases.configure({ apiKey }), 5000);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (!msg.includes("timed out")) {
    setDiag("err", msg.slice(0, 60));
    throw e;
  }
  // timeout = just slow CustomerInfo fetch; SDK is ready
}
setDiag("ok");
```

**How to apply:** Never await `configure()` without a timeout in RC Capacitor v13+. The SDK initializes synchronously on the native side; the async part is the first customer info network call.

---

## useRcReady pattern — start false, wait for configure to settle

**Why:** Starting `rcReady = true` immediately (even on native) causes queries to fire before configure() has run. RC's internal queue may not be reliable. Starting `false` and setting to `true` after configure() resolves/rejects ensures queries start on a configured SDK.

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

**How to apply:** Always unblock queries even on error (the `.catch` calling `unblock()`). Without this, any init error leaves the UI stuck loading forever.

---

## isOfferingsReady false positive when queries disabled

**Why:** React Query v5: disabled queries have `isLoading = false` and `isFetching = false`, so `isOfferingsReady = true` even when queries haven't run yet. This causes "Subscription products couldn't be loaded" to appear immediately before configure() has even started.

**Fix:** Gate `isOfferingsReady` on `rcReady`:
```ts
isOfferingsReady: rcReady && !offeringsQuery.isLoading && !offeringsQuery.isFetching,
```

---

## Wrong env var overriding hardcoded RC key

**Why:** `VITE_REVENUECAT_IOS_KEY` in Codemagic's `build_env` group may contain a DIFFERENT app's RC key (e.g. My Digital Closet). Since the env var is non-empty, it overrides the hardcoded fallback. `configure()` authenticates against the wrong RC account.

**Fix:** Hardcode the RC iOS public key directly. RC public keys are designed to be in app bundles (not secrets):
```ts
const RC_IOS_KEY = "appl_QMxyPWfJlvrCqHrbLhPMTgthvKc"; // My Digital Holidays
```

---

## RC dashboard verification checklist

When RC purchases aren't working, check in this order:
1. `Capacitor.isPluginAvailable('Purchases')` → false = pnpm symlink issue (fix build script)
2. `RC:init` with `plugin:true` → configure() hanging = await timeout issue (fix configure call)
3. `RC:ok` but `offerings:no` → RC dashboard not configured (products, offering, packages)
4. `RC:ok` and `offerings:yes` but purchase fails → Apple sandbox / StoreKit issue
5. **RC dashboard → SDK Compatibility** shows "No SDK version data yet" = configure() never reached RC

## Apple sandbox propagation delay

Newly configured IAP products take up to 24 hours to appear in Apple's sandbox. StoreKit hangs waiting for a product lookup that never returns. After confirming RC is connected (`RC:ok`), wait 24 hours if products still don't load.
