/**
 * UpgradeSheet — three-tier paywall (Monthly / Yearly / Lifetime).
 *
 * Tier cards are selectable; lifetime is pre-selected as "Best Value".
 * Prices are pulled live from the RevenueCat offering when on-device,
 * and fall back to hardcoded values in the browser.
 *
 * RC package identifiers expected in the default offering:
 *   $rc_monthly   → Monthly $1.99
 *   $rc_annual    → Yearly  $19.99
 *   $rc_lifetime  → Lifetime $9.99 (one-time)
 */
import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Check } from "lucide-react";
import { useSubscription } from "@/lib/revenuecat";

export type UpgradeReason = "items" | "outfits" | "mannequin";
type TierId = "monthly" | "yearly" | "lifetime";

interface Props {
  reason:  UpgradeReason;
  onClose: () => void;
}

// ── Static copy ───────────────────────────────────────────────────────────────

const FEATURES = [
  "Unlimited clothing items",
  "Unlimited saved outfits",
  "Save your entire wardrobe",
  "One-time payment options",
  "Choose monthly, yearly or lifetime!",
] as const;

const HEADLINES: Record<UpgradeReason, string> = {
  items:     "UNLOCK YOUR UNLIMITED DIGITAL SUITCASE",
  outfits:   "UNLOCK YOUR UNLIMITED DIGITAL SUITCASE",
  mannequin: "UNLOCK YOUR UNLIMITED DIGITAL SUITCASE",
};

const SUBTITLES: Record<UpgradeReason, string> = {
  items:     "You've reached the free limit. Upgrade to pack everything.",
  outfits:   "You've hit the free outfit limit. Upgrade to save every look.",
  mannequin: "A premium feature — unlock it once.",
};

// Fallback tier definitions (used when RC packages aren't loaded yet)
const TIER_DEFAULTS: Record<TierId, {
  label: string;
  price: string;
  period: string;
  notes: string[];
  pkgId: string;
  best?: true;
}> = {
  monthly:  { label: "MONTHLY",  price: "$1.99",  period: "/month",    notes: ["Cancel anytime",  "Billed monthly"],  pkgId: "$rc_monthly"  },
  yearly:   { label: "YEARLY",   price: "$19.99", period: "/year",     notes: ["Save 17%",        "Billed yearly"],   pkgId: "$rc_annual"   },
  lifetime: { label: "LIFETIME", price: "$9.99",  period: "one-time",  notes: ["Pay once",        "Yours forever"],   pkgId: "$rc_lifetime", best: true },
};

const TIER_ORDER: TierId[] = ["monthly", "yearly", "lifetime"];

// ── Helpers ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRcPackage(offerings: any, pkgId: string): any | undefined {
  return offerings?.current?.availablePackages?.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p: any) => p.identifier === pkgId,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPriceString(offerings: any, pkgId: string, fallback: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getRcPackage(offerings, pkgId) as any)?.product?.priceString ?? fallback;
}

// ── Tier card ─────────────────────────────────────────────────────────────────

function TierCard({
  id,
  selected,
  onSelect,
  price,
  period,
  notes,
  label,
  best,
}: {
  id:       TierId;
  selected: boolean;
  onSelect: (id: TierId) => void;
  price:    string;
  period:   string;
  notes:    string[];
  label:    string;
  best?:    true;
}) {
  return (
    <button
      onClick={() => onSelect(id)}
      className="flex-1 flex flex-col rounded-2xl border-[3px] transition-all relative overflow-hidden text-left"
      style={{
        borderColor:    selected ? "#000" : "#D4C9B8",
        background:     selected && id === "lifetime" ? "#F5C842"
                      : selected                      ? "#FFF8E8"
                      :                                 "#F0EBE3",
        boxShadow: selected ? "3px 3px 0px 0px rgba(0,0,0,1)" : "none",
      }}
    >
      {best && (
        <span
          className="absolute top-0 right-0 text-[9px] font-bold uppercase tracking-tight
                     px-1.5 py-0.5 rounded-bl-xl"
          style={{ background: "#E53935", color: "#fff" }}
        >
          BEST ★ VALUE
        </span>
      )}
      <div className="px-2.5 pt-3 pb-2.5 flex flex-col gap-1 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-black/50">{label}</p>
        <p className="font-display font-bold text-xl leading-none text-black">{price}</p>
        <p className="text-[10px] font-semibold text-black/50">{period}</p>
        <ul className="flex flex-col gap-0.5 mt-1">
          {notes.map((n) => (
            <li key={n} className="flex items-center gap-1">
              <Check className="w-2.5 h-2.5 shrink-0 text-black/60" strokeWidth={3} />
              <span className="text-[9px] font-semibold text-black/60 leading-tight">{n}</span>
            </li>
          ))}
        </ul>
      </div>
    </button>
  );
}

// ── Main sheet ────────────────────────────────────────────────────────────────

export function UpgradeSheet({ reason, onClose }: Props) {
  const { offerings, purchase } = useSubscription();
  const [selected,  setSelected] = useState<TierId>("lifetime");
  const [status, setStatus] = useState<"idle" | "pending">("idle");

  const tier = TIER_DEFAULTS[selected];

  // Live prices from RC (or fallback)
  const prices: Record<TierId, string> = {
    monthly:  getPriceString(offerings, "$rc_monthly",  "$1.99"),
    yearly:   getPriceString(offerings, "$rc_annual",   "$19.99"),
    lifetime: getPriceString(offerings, "$rc_lifetime", "$9.99"),
  };

  const ctaLabel = status === "pending" ? "Opening…"
    : selected === "lifetime" ? `UNLOCK FOREVER – ${prices.lifetime} ›`
    : selected === "yearly"   ? `SUBSCRIBE – ${prices.yearly}/YR ›`
    :                           `SUBSCRIBE – ${prices.monthly}/MO ›`;

  const handlePurchase = useCallback(async () => {
    if (status === "pending") return;
    setStatus("pending");

    const rcPkg = getRcPackage(offerings, tier.pkgId);
    if (!rcPkg) {
      // No RC on browser — nothing to do
      setStatus("idle");
      return;
    }

    try {
      await purchase(rcPkg);
      onClose();
    } catch (err: unknown) {
      setStatus("idle");
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      if (!msg.includes("cancel") && !msg.includes("dismiss")) {
        console.error("Purchase error:", err);
      }
    }
  }, [status, offerings, tier.pkgId, purchase, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[80] flex flex-col max-w-md mx-auto overflow-hidden"
      style={{ background: "#F8F4ED" }}
    >
      {/* Top strip + close */}
      <div
        className="flex-shrink-0 flex items-start justify-end px-4 pt-4 pb-3"
        style={{
          background:  "repeating-linear-gradient(45deg, #F5C842 0px, #F5C842 12px, #F0B800 12px, #F0B800 24px)",
          minHeight:   64,
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="w-9 h-9 rounded-full border-2 border-black flex items-center justify-center
                     bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                     active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
        <div className="px-5 pt-4 pb-2 flex flex-col gap-3">

          {/* Headline */}
          <div>
            <h1 className="font-display font-bold text-[2.4rem] uppercase tracking-tight leading-[0.9]">
              {HEADLINES[reason]}
            </h1>
            <p className="text-sm font-semibold text-black/45 mt-2">
              {SUBTITLES[reason]}
            </p>
          </div>

          {/* Features card */}
          <div
            className="rounded-2xl border-[3px] border-black overflow-hidden"
            style={{ background: "#111" }}
          >
            <p className="px-4 pt-3 pb-2 text-xs font-bold uppercase tracking-widest text-[#F5C842]">
              Upgrade to Premium &amp; Get:
            </p>
            <ul className="px-4 pb-3 flex flex-col gap-1.5">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "#F5C842" }}
                  >
                    <Check className="w-2.5 h-2.5 text-black" strokeWidth={3.5} />
                  </span>
                  <span className="text-white text-sm font-medium leading-snug">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Plan selector */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 text-center mb-2">
              Choose Your Plan
            </p>
            <div className="flex gap-2">
              {TIER_ORDER.map((id) => {
                const t = TIER_DEFAULTS[id];
                return (
                  <TierCard
                    key={id}
                    id={id}
                    selected={selected === id}
                    onSelect={setSelected}
                    label={t.label}
                    price={prices[id]}
                    period={t.period}
                    notes={t.notes}
                    best={t.best}
                  />
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* CTA footer */}
      <div
        className="px-5 pt-3 flex flex-col gap-3 flex-shrink-0"
        style={{ paddingBottom: "max(1.75rem, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={handlePurchase}
          disabled={status === "pending"}
          className="w-full py-4 rounded-2xl font-display font-bold text-lg uppercase
                     tracking-tight border-[3px] border-black text-black
                     active:translate-x-0.5 active:translate-y-0.5 transition-all
                     disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background:  "#F5C842",
            boxShadow: status === "pending" ? "none" : "4px 4px 0px 0px rgba(0,0,0,1)",
          }}
        >
          {ctaLabel}
        </button>
        <button
          onClick={onClose}
          className="text-sm font-semibold text-black/35 text-center
                     hover:text-black/55 transition-colors"
        >
          Maybe Later
        </button>
      </div>
    </motion.div>
  );
}
