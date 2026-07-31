---
name: RevenueCat iOS debugging lessons
description: Root causes and fixes for RC purchases silently failing in a Capacitor iOS app
---

# RevenueCat iOS Purchases — Debugging Lessons

## Root causes found (and fixed)

**Why:** RC's public iOS key (`appl_...`) was never reaching the Vite bundle. `VITE_REVENUECAT_IOS_KEY` was in Codemagic's account but NOT in any group listed under `groups:` in `codemagic.yaml`. Vite only sees env vars that are explicitly grouped. Result: every build had `undefined` key → RC never called `configure()` → 0 customers in RC dashboard for weeks.

**Fix:** Add `build_env` group to `codemagic.yaml` under `environment.groups`, put `VITE_REVENUECAT_IOS_KEY` in that group in Codemagic. Also hardcode the public key as a fallback in code — RC public keys are designed to be in app bundles, not secrets.

**How to apply:** Any Capacitor + Vite app using Codemagic must have env var groups explicitly listed. Check `environment.groups` in `codemagic.yaml` matches where the secret lives in Codemagic account.

---

## WKWebView timer throttling

**Why:** `setTimeout(fn, 12000)` is aggressively throttled by iOS WKWebView — it may never fire while a native bridge call is pending. Used `Promise.race` with a long timeout expecting it to fire; it didn't.

**Fix:** Replace with a `setInterval` polling loop checking every 1 second. Short intervals (≤1s) are throttled far less than single long timeouts.

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

**Why:** `useRcReady()` hook set an 8s timer to make queries start. If the `SubscriptionProvider` component re-ran its effect cleanup for any reason, the timer was cleared and restarted. On native, `configure()` hanging meant the settle signal never fired AND the timer kept getting cleared.

**Fix:** On native platform, set `rcReady = true` immediately. RC's native SDK internally queues `getOfferings()` calls made before `configure()` finishes. No need to gate on JS-side settle signal.

```ts
const isNative = Capacitor.isNativePlatform();
const [ready, setReady] = useState(isNative || _rcSettled);
```

---

## Apple sandbox propagation delay

**Why:** Newly configured IAP products in App Store Connect (and newly connected to RC) take up to 24 hours to propagate to Apple's sandbox servers. `getOfferings()` hangs (not errors) while StoreKit waits for a product lookup response that never comes.

**Diagnosis:** RC dashboard shows 0 customers ever → RC was never reached. Debug panel showing `pending/fetching` indefinitely → StoreKit lookup hanging. All RC config correct (bundle ID, key, offerings, entitlements).

**How to apply:** When `getOfferings()` hangs with correct RC config and working sandbox Apple ID, check if products were recently created/modified. Wait 24 hours. No code change needed.

---

## RC dashboard verification checklist

When RC purchases aren't working, verify in RC dashboard:
1. **Apps → your app → Bundle ID** matches exactly (e.g. `com.mydigitalholidays.app`)
2. **Products** — all product IDs exist and are connected to Apple products
3. **Entitlements** — entitlement identifier matches code (`REVENUECAT_ENTITLEMENT_IDENTIFIER`)
4. **Offerings** — "default" offering exists with correct package identifiers (`$rc_monthly`, `$rc_annual`, `$rc_lifetime`)
5. **Overview → Sandbox Data toggle ON** — 0 customers = RC was never reached
