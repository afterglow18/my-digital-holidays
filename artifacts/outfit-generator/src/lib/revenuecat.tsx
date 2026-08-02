/**
 * RevenueCat integration — using @revenuecat/purchases-capacitor.
 *
 * • On iOS (Capacitor native): full purchase flow via StoreKit.
 * • In browser (Replit preview / web): purchases show "unavailable" gracefully.
 *
 * Premium access is ALWAYS derived from a live RC CustomerInfo fetch.
 * It is never stored in or read from localStorage.
 *
 * CustomerInfo is refreshed:
 *   1. On app launch (initial query mount)
 *   2. On app foreground (appStateChange listener)
 *   3. Immediately after a successful purchase (cache seeded + invalidated)
 *   4. Immediately after Restore Purchases (cache seeded + invalidated)
 *   5. Whenever RC pushes a server-side update (addCustomerInfoUpdateListener)
 *      — this catches refunds, expirations, and subscription lapses in real-time.
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ── Dev-only logger ───────────────────────────────────────────────────────────
// All [RC] / [RevenueCat] logs are stripped from production builds automatically.
const _isDev = import.meta.env.DEV;
/* eslint-disable @typescript-eslint/no-explicit-any */
const rcLog   = _isDev ? (...a: any[]) => console.log(...a)   : () => {};
const rcWarn  = _isDev ? (...a: any[]) => console.warn(...a)  : () => {};
const rcError = _isDev ? (...a: any[]) => console.error(...a) : () => {};
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Constants ─────────────────────────────────────────────────────────────────

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "My Digital Holidays Pro";

// RC public iOS keys are designed to be embedded in the app bundle — not a secret.
// Hardcoded directly to avoid any risk of a wrong env var from another RC app
// (e.g. My Digital Closet) overriding this and routing configure() to the wrong account.
const RC_IOS_KEY = "appl_QMxyPWfJlvrCqHrbLhPMTgthvKc";

function getApiKey(): string {
  if (Capacitor.isNativePlatform()) return RC_IOS_KEY;
  throw new Error("RevenueCat API key not applicable outside native platform");
}

// ── Timeout helper ────────────────────────────────────────────────────────────

// WKWebView (Capacitor iOS) throttles long setTimeout calls heavily.
// Use a 1-second setInterval polling loop instead — short intervals are
// throttled much less aggressively and reliably fire even with active
// native bridge calls pending.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let done = false;
    const start = Date.now();
    promise
      .then((v) => { done = true; resolve(v); })
      .catch((e) => { done = true; reject(e as Error); });
    const iv = setInterval(() => {
      if (done) { clearInterval(iv); return; }
      if (Date.now() - start >= ms) {
        clearInterval(iv);
        reject(new Error(`RC operation timed out after ${ms}ms`));
      }
    }, 1000);
  });
}

// ── Initialization ────────────────────────────────────────────────────────────
// The promise is stored so queries can await it — this prevents the race where
// getOfferings() / getCustomerInfo() run before configure() has finished.

let _rcInitPromise: Promise<void> | null = null;

export function initializeRevenueCat(): Promise<void> {
  if (_rcInitPromise) return _rcInitPromise;
  _rcInitPromise = (async () => {
    const isNative = Capacitor.isNativePlatform();
    const pluginAvailable = Capacitor.isPluginAvailable("Purchases");
    rcLog("[RC] initializeRevenueCat() start — isNative:", isNative, "pluginAvailable:", pluginAvailable);

    if (!isNative) {
      rcLog("[RC] Not native — skipping configure()");
      return;
    }

    let apiKey: string;
    try {
      apiKey = getApiKey();
      // RC public keys are designed to live in the app bundle; never log the key value.
    } catch (e) {
      rcError("[RC] getApiKey() threw:", e);
      throw e;
    }

    // setLogLevel — fire and forget. Do NOT await: the Capacitor bridge response
    // (Swift → JS callback) may never arrive on Capacitor 8 + SPM builds.
    void Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG })
      .then(() => rcLog("[RC] setLogLevel DEBUG ✓"))
      .catch((e: unknown) => rcWarn("[RC] setLogLevel failed:", e));

    // configure() — fire and forget. Swift Purchases.configure() is synchronous:
    // the SDK is fully initialized the moment the bridge message arrives.
    // The Promise only resolves when the bridge response comes back to JS —
    // which may never happen on Capacitor 8 + SPM. Awaiting it blocked configure()
    // from ever reaching native, causing RC dashboard to show "SDK key never used".
    rcLog("[RC] Sending configure() to native bridge…");
    void Purchases.configure({ apiKey })
      .then(() => rcLog("[RC] configure() bridge response received ✓"))
      .catch((e: unknown) => rcError("[RC] configure() error:", e));

    // One microtask tick to ensure the bridge message is dispatched before
    // queries start running.
    await Promise.resolve();
    rcLog("[RC] configure() dispatched — marking ready");
  })().finally(() => {
    rcLog("[RC] initializeRevenueCat() settled — notifying");
    notifyRcSettled();
  });
  return _rcInitPromise;
}

// ── RC readiness signal ───────────────────────────────────────────────────────
// Tracks whether configure() has settled (or timed out) so React queries can
// gate on it via `enabled` rather than blocking inside `queryFn`.

let _rcSettled = false;
const _rcSettledCallbacks: Array<() => void> = [];

function notifyRcSettled() {
  if (_rcSettled) return;
  _rcSettled = true;
  _rcSettledCallbacks.splice(0).forEach((cb) => cb());
}

/** React hook — returns true once RC has configured (or failed).
 *
 * Starts false; set to true when initializeRevenueCat() resolves OR rejects.
 * This prevents queries from firing before configure() has been dispatched,
 * while any error still unblocks them so the UI doesn't hang forever.
 */
function useRcReady(): boolean {
  const [rcReady, setRcReady] = useState(_rcSettled);
  useEffect(() => {
    if (_rcSettled) { setRcReady(true); return; }
    let cancelled = false;
    const unblock = () => { if (!cancelled) setRcReady(true); };
    initializeRevenueCat().then(unblock).catch((err) => {
      rcWarn("[RevenueCat] Init failed — unblocking queries:", err);
      unblock();
    });
    // 30 s hard timeout — if something hangs, unblock so UI can show an error.
    const t = setTimeout(unblock, 30_000);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);
  return rcReady;
}

// ── Query key ─────────────────────────────────────────────────────────────────

const CUSTOMER_INFO_KEY = ["revenuecat", "customer-info"] as const;

// ── Subscription context ──────────────────────────────────────────────────────

function useSubscriptionContext() {
  const qc = useQueryClient();
  const rcReady = useRcReady();

  const customerInfoQuery = useQuery({
    queryKey: CUSTOMER_INFO_KEY,
    enabled: rcReady,
    queryFn: async () => {
      if (!Capacitor.isNativePlatform()) return null;
      const result = await withTimeout(Purchases.getCustomerInfo(), 5000);
      return result.customerInfo ?? null;
    },
    staleTime: 0,
    retry: false,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    enabled: rcReady,
    queryFn: async () => {
      rcLog("[RC] getOfferings() — starting (12 s timeout)");
      if (!Capacitor.isNativePlatform()) {
        rcLog("[RC] getOfferings() — not native, returning null");
        return null;
      }
      let result: Awaited<ReturnType<typeof Purchases.getOfferings>>;
      try {
        // 12 s — enough for RC + StoreKit on any network; short enough to
        // surface a fast error to the user instead of a 30 s blank wait.
        result = await withTimeout(Purchases.getOfferings(), 12000);
      } catch (e) {
        rcError("[RC] getOfferings() — threw:", e);
        throw e; // rethrow so React Query retries (retry: 1)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (result as any).offerings ?? result ?? null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pkgs = data?.current?.availablePackages ?? [];
      rcLog("[RC] getOfferings() — success ✓  current offering:", data?.current?.identifier ?? "none",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "  packages:", pkgs.map((p: any) => p.identifier).join(", ") || "none");
      return data;
    },
    staleTime: 300 * 1000,
    retry: 1,
  });

  // ── Foreground + server-push listeners ─────────────────────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let appListenerHandle: Awaited<ReturnType<typeof import("@capacitor/app").App.addListener>> | null = null;
    let rcCallbackId: string | null = null;

    (async () => {
      // 1. Recheck CustomerInfo every time the app comes back to the foreground.
      try {
        const { App } = await import("@capacitor/app");
        appListenerHandle = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) {
            rcLog("[RevenueCat] App foregrounded — rechecking CustomerInfo");
            qc.invalidateQueries({ queryKey: CUSTOMER_INFO_KEY });
          }
        });
      } catch (err) {
        rcWarn("[RevenueCat] Could not add appStateChange listener:", err);
      }

      // 2. RC server-push: fires when RC detects a refund, expiry, or any
      //    server-side entitlement change — revokes access in real-time.
      try {
        rcCallbackId = await Purchases.addCustomerInfoUpdateListener(
          (customerInfo) => {
            rcLog("[RevenueCat] CustomerInfo pushed from server — updating cache");
            qc.setQueryData(CUSTOMER_INFO_KEY, customerInfo);
          }
        );
      } catch (err) {
        rcWarn("[RevenueCat] Could not add CustomerInfo listener:", err);
      }
    })();

    return () => {
      appListenerHandle?.remove();
      if (rcCallbackId !== null) {
        Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: rcCallbackId })
          .catch(() => {/* non-fatal */});
      }
    };
  }, [qc]);

  // ── Purchase ───────────────────────────────────────────────────────────────
  const purchaseMutation = useMutation({
    mutationFn: async (pkg: unknown) => {
      if (!Capacitor.isNativePlatform()) throw new Error("Purchases not available in browser");
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg as never });
      return customerInfo;
    },
    onSuccess: (customerInfo) => {
      qc.setQueryData(CUSTOMER_INFO_KEY, customerInfo);
      qc.invalidateQueries({ queryKey: ["revenuecat"] });
    },
  });

  // ── Restore ────────────────────────────────────────────────────────────────
  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!Capacitor.isNativePlatform()) throw new Error("Purchases not available in browser");
      const { customerInfo } = await Purchases.restorePurchases();
      return customerInfo;
    },
    onSuccess: (customerInfo) => {
      qc.setQueryData(CUSTOMER_INFO_KEY, customerInfo);
      qc.invalidateQueries({ queryKey: ["revenuecat"] });
    },
  });

  // ── Entitlement check — derived purely from live RC data ───────────────────
  // Never reads localStorage. If customerInfo is null (not yet loaded or
  // browser), isSubscribed is false — safe default to free tier.
  const isSubscribed =
    customerInfoQuery.data?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;

  return {
    customerInfo:     customerInfoQuery.data ?? null,
    offerings:        offeringsQuery.data ?? null,
    isSubscribed,
    isLoading:        customerInfoQuery.isLoading || offeringsQuery.isLoading,
    // rcReady guard prevents disabled queries from appearing "ready" (React Query
    // reports isLoading=false for disabled queries, which would trigger a
    // premature "couldn't load" error before configure() has even finished).
    isOfferingsReady: rcReady && !offeringsQuery.isLoading && !offeringsQuery.isFetching,
    purchase:         purchaseMutation.mutateAsync,
    restore:          restoreMutation.mutateAsync,
    isPurchasing:     purchaseMutation.isPending,
    isRestoring:      restoreMutation.isPending,
    purchaseError:    purchaseMutation.error as Error | null,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSubscription must be inside <SubscriptionProvider>");
  return ctx;
}
