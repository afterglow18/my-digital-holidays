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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ── Constants ─────────────────────────────────────────────────────────────────

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "My Digital Holidays Pro";

const RC_TEST_KEY = import.meta.env.VITE_REVENUECAT_TEST_KEY as string | undefined;
const RC_IOS_KEY  = import.meta.env.VITE_REVENUECAT_IOS_KEY  as string | undefined;
// RC public iOS keys are designed to be embedded in the app bundle.
// This is the fallback for when the build-time env var is not injected.
const RC_IOS_KEY_FALLBACK = "appl_QMxyPWfJlvrCqHrbLhPMTgthvKc";

function getApiKey(): string {
  const isNative = Capacitor.isNativePlatform();
  if (isNative && RC_IOS_KEY) return RC_IOS_KEY;
  if (isNative) return RC_IOS_KEY_FALLBACK;
  if (RC_TEST_KEY) return RC_TEST_KEY;
  throw new Error("RevenueCat API key not configured");
}

// ── Timeout helper ────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

// ── Lazy-import Purchases so it doesn't crash in the browser ─────────────────

type PurchasesType = typeof import("@revenuecat/purchases-capacitor").Purchases;
let _Purchases: PurchasesType | null = null;

async function getPurchases(): Promise<PurchasesType | null> {
  if (!Capacitor.isNativePlatform()) return null;
  if (_Purchases) return _Purchases;
  try {
    const mod = await import("@revenuecat/purchases-capacitor");
    _Purchases = mod.Purchases;
    return _Purchases;
  } catch {
    return null;
  }
}

// ── Initialization ────────────────────────────────────────────────────────────
// The promise is stored so queries can await it — this prevents the race where
// getOfferings() / getCustomerInfo() run before configure() has finished.

let _rcInitPromise: Promise<void> | null = null;

export function initializeRevenueCat(): Promise<void> {
  if (_rcInitPromise) return _rcInitPromise;
  _rcInitPromise = (async () => {
    const Purchases = await getPurchases();
    if (!Purchases) return;

    const apiKey = getApiKey();

    try {
      const { LOG_LEVEL } = await import("@revenuecat/purchases-capacitor");
      await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
    } catch { /* non-fatal */ }

    await Purchases.configure({ apiKey });
    console.log("[RevenueCat] Configured");
  })().finally(() => notifyRcSettled());
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

/** React hook — returns true once RC has configured (or after 8 s timeout). */
function useRcReady(): boolean {
  const [ready, setReady] = useState(_rcSettled);
  useEffect(() => {
    if (_rcSettled) { setReady(true); return; }
    const onReady = () => setReady(true);
    _rcSettledCallbacks.push(onReady);
    // 8 s hard fallback — unblocks queries even if configure() never settles
    const t = setTimeout(() => { notifyRcSettled(); }, 8_000);
    return () => {
      clearTimeout(t);
      const i = _rcSettledCallbacks.indexOf(onReady);
      if (i !== -1) _rcSettledCallbacks.splice(i, 1);
    };
  }, []);
  return ready;
}

// ── Query key ─────────────────────────────────────────────────────────────────

const CUSTOMER_INFO_KEY = ["revenuecat", "customer-info"] as const;

// ── Subscription context ──────────────────────────────────────────────────────

function useSubscriptionContext() {
  const qc = useQueryClient();
  // Gate both queries on RC being configured (or 8 s timeout elapsed).
  // While rcReady is false, isLoading stays false — button shows fallback prices.
  const rcReady = useRcReady();

  const customerInfoQuery = useQuery({
    queryKey: CUSTOMER_INFO_KEY,
    enabled: rcReady,
    queryFn: async () => {
      const Purchases = await getPurchases();
      if (!Purchases) return null;
      const result = await withTimeout(Purchases.getCustomerInfo(), 5000);
      return result?.customerInfo ?? null;
    },
    staleTime: 0,
    retry: false,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    enabled: rcReady,
    queryFn: async () => {
      const Purchases = await getPurchases();
      if (!Purchases) return null;
      // 30 s — RC must fetch from its servers then StoreKit; 5 s was too short.
      const result = await withTimeout(Purchases.getOfferings(), 30000);
      if (!result) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (result as any).offerings ?? result ?? null;
    },
    staleTime: 300 * 1000,
    retry: false,
  });

  // ── Foreground + server-push listeners ─────────────────────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // PluginListenerHandle has remove(): Promise<void>
    let appListenerHandle: Awaited<ReturnType<typeof import("@capacitor/app").App.addListener>> | null = null;
    let rcCallbackId: string | null = null;

    (async () => {
      // 1. Recheck CustomerInfo every time the app comes back to the foreground.
      try {
        const { App } = await import("@capacitor/app");
        appListenerHandle = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) {
            console.log("[RevenueCat] App foregrounded — rechecking CustomerInfo");
            qc.invalidateQueries({ queryKey: CUSTOMER_INFO_KEY });
          }
        });
      } catch (err) {
        console.warn("[RevenueCat] Could not add appStateChange listener:", err);
      }

      // 2. RC server-push: fires when RC detects a refund, expiry, or any
      //    server-side entitlement change — revokes access in real-time.
      try {
        const Purchases = await getPurchases();
        if (Purchases) {
          rcCallbackId = await Purchases.addCustomerInfoUpdateListener(
            (customerInfo) => {
              console.log("[RevenueCat] CustomerInfo pushed from server — updating cache");
              qc.setQueryData(CUSTOMER_INFO_KEY, customerInfo);
            }
          );
        }
      } catch (err) {
        console.warn("[RevenueCat] Could not add CustomerInfo listener:", err);
      }
    })();

    return () => {
      appListenerHandle?.remove();
      if (rcCallbackId !== null) {
        getPurchases().then((Purchases) => {
          Purchases?.removeCustomerInfoUpdateListener({ listenerToRemove: rcCallbackId! });
        }).catch(() => {/* non-fatal */});
      }
    };
  }, [qc]);

  // ── Purchase ───────────────────────────────────────────────────────────────
  const purchaseMutation = useMutation({
    mutationFn: async (pkg: unknown) => {
      const Purchases = await getPurchases();
      if (!Purchases) throw new Error("Purchases not available in browser");
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg as never });
      return customerInfo;
    },
    onSuccess: (customerInfo) => {
      // Seed the cache immediately with the fresh CustomerInfo RC just returned,
      // then invalidate to schedule a background re-fetch for confirmation.
      qc.setQueryData(CUSTOMER_INFO_KEY, customerInfo);
      qc.invalidateQueries({ queryKey: ["revenuecat"] });
    },
  });

  // ── Restore ────────────────────────────────────────────────────────────────
  const restoreMutation = useMutation({
    mutationFn: async () => {
      const Purchases = await getPurchases();
      if (!Purchases) throw new Error("Purchases not available in browser");
      const { customerInfo } = await Purchases.restorePurchases();
      return customerInfo;
    },
    onSuccess: (customerInfo) => {
      // Same pattern: seed immediately, then confirm in background.
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
    isOfferingsReady: !offeringsQuery.isLoading && !offeringsQuery.isFetching,
    purchase:         purchaseMutation.mutateAsync,
    restore:       restoreMutation.mutateAsync,
    isPurchasing:  purchaseMutation.isPending,
    isRestoring:   restoreMutation.isPending,
    purchaseError: purchaseMutation.error as Error | null,
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
