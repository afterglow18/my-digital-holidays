import React, { useRef, useState, useCallback } from "react";
import {
  useListClothing,
  getListClothingQueryKey,
  useSaveOutfit,
  useListOutfits,
  getListOutfitsQueryKey,
  ClothingItem,
} from "@workspace/api-client-react";
import { Shuffle, BookmarkPlus, PersonStanding, X, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SwipeRow, SwipeRowHandle } from "@/components/SwipeRow";
import { QuickAddSheet } from "@/components/clothing/QuickAddSheet";
import { ItemDetailsSheet } from "@/components/clothing/ItemDetailsSheet";
import { MannequinView } from "@/components/MannequinView";
import { UpgradeSheet, UpgradeReason } from "@/components/paywall/UpgradeSheet";
import { PremiumSheet } from "@/components/paywall/PremiumSheet";
import { useQueryClient } from "@tanstack/react-query";
import { useEntitlements } from "@/hooks/useEntitlements";
import { FREE_ITEM_LIMIT, FREE_OUTFIT_LIMIT } from "@/lib/entitlements";

// ── Types ─────────────────────────────────────────────────────────────────────
type RowKey = "tops" | "bottoms" | "shoes";
type Category = "tops" | "bottoms" | "shoes" | "accessories" | "outerwear" | "dresses";

const ROWS: { key: RowKey; label: string; addLabel: string; emoji: string }[] = [
  { key: "tops",    label: "Tops",    addLabel: "Add Top",    emoji: "👚" },
  { key: "bottoms", label: "Bottoms", addLabel: "Add Bottom", emoji: "👖" },
  { key: "shoes",   label: "Shoes",   addLabel: "Add Shoes",  emoji: "👟" },
];

// ── Palette ───────────────────────────────────────────────────────────────────
const GOLD_ROD = "linear-gradient(180deg, #f5e070 0%, #c89820 30%, #e8c840 55%, #b88818 80%, #f0d858 100%)";
const DOOR_BG  = "linear-gradient(to right, #c89018, #f0c020, #e8b818, #f5c820, #d4a010)";
const DOOR_BG_R= "linear-gradient(to left,  #c89018, #f0c020, #e8b818, #f5c820, #d4a010)";
const INTERIOR = "linear-gradient(160deg, #fffdf7 0%, #fdf5e4 40%, #faeedd 100%)";
const PINK_ACC = "#e8a8c0";

// ── Sub-components ────────────────────────────────────────────────────────────

function ClosetDoor({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";
  return (
    <div
      className="absolute top-0 bottom-0 z-20 pointer-events-none select-none"
      style={{
        [isLeft ? "left" : "right"]: 0,
        width: 52,
        background: isLeft ? DOOR_BG : DOOR_BG_R,
        boxShadow: isLeft
          ? "inset -6px 0 16px rgba(0,0,0,0.18), 2px 0 8px rgba(0,0,0,0.12)"
          : "inset  6px 0 16px rgba(0,0,0,0.18), -2px 0 8px rgba(0,0,0,0.12)",
      }}
    >
      {/* Top inset panel */}
      <div
        className="absolute"
        style={{
          top: "6%", left: 7, right: 7, height: "30%",
          border: "2px solid rgba(255,255,255,0.30)",
          borderRadius: 6,
          boxShadow: "inset 0 2px 6px rgba(0,0,0,0.10)",
        }}
      />
      {/* Bottom inset panel */}
      <div
        className="absolute"
        style={{
          top: "42%", left: 7, right: 7, height: "52%",
          border: "2px solid rgba(255,255,255,0.30)",
          borderRadius: 6,
          boxShadow: "inset 0 2px 6px rgba(0,0,0,0.10)",
        }}
      />
      {/* Door knob */}
      <div
        className="absolute"
        style={{
          top: "44%",
          [isLeft ? "right" : "left"]: 10,
          width: 11, height: 11,
          borderRadius: "50%",
          background: "radial-gradient(circle at 35% 30%, #ffe080, #9a7010)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.4)",
        }}
      />
      {/* Vertical grain lines */}
      {[28, 36, 44].map((x) => (
        <div
          key={x}
          className="absolute top-0 bottom-0"
          style={{
            left: x,
            width: 1,
            background: "rgba(255,255,255,0.10)",
          }}
        />
      ))}
    </div>
  );
}

function Chandelier() {
  return (
    <div className="flex flex-col items-center pt-3 pb-1 select-none pointer-events-none">
      {/* Ceiling mount */}
      <div style={{ width: 24, height: 5, background: "rgba(196,155,42,0.6)", borderRadius: 3 }} />
      {/* Chain */}
      <div style={{ width: 2, height: 10, background: "rgba(196,155,42,0.5)" }} />
      {/* Main body */}
      <div
        style={{
          width: 64, height: 14,
          background: "linear-gradient(to bottom, #ffe878, #d4a020, #ffe060)",
          borderRadius: "50%",
          boxShadow: "0 3px 14px rgba(212,160,32,0.45), 0 0 0 1px rgba(212,160,32,0.25)",
        }}
      />
      {/* Crystal drops */}
      <div className="flex gap-2.5" style={{ marginTop: 1 }}>
        {[10, 15, 20, 15, 10].map((h, i) => (
          <div
            key={i}
            style={{
              width: 3.5, height: h,
              background: "linear-gradient(to bottom, rgba(255,235,120,0.9), rgba(255,210,60,0.6))",
              borderRadius: "0 0 3px 3px",
            }}
          />
        ))}
      </div>
      {/* Warm glow */}
      <div
        style={{
          marginTop: 4,
          width: 120, height: 28,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at top, rgba(255,235,120,0.35) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}

function GoldRod() {
  return (
    <div className="px-10">
      <div
        style={{
          width: "100%", height: 9,
          background: GOLD_ROD,
          borderRadius: 5,
          boxShadow: "0 3px 8px rgba(0,0,0,0.22), 0 1px 0 rgba(255,255,255,0.45) inset",
        }}
      >
        {/* End caps */}
        <div className="absolute left-0 top-0 bottom-0" style={{ width: 9, borderRadius: 5, background: "rgba(0,0,0,0.15)" }} />
        <div className="absolute right-0 top-0 bottom-0" style={{ width: 9, borderRadius: 5, background: "rgba(0,0,0,0.15)" }} />
      </div>
    </div>
  );
}

function Drawers() {
  return (
    <div className="px-6 mt-1">
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="relative"
            style={{
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(to bottom, #f5e8c4, #e8d4a0)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.7) inset, 0 2px 6px rgba(0,0,0,0.08)",
              border: "1px solid rgba(180,140,50,0.25)",
            }}
          >
            {/* Knob */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                width: 9, height: 9,
                borderRadius: "50%",
                background: "radial-gradient(circle at 35% 30%, #ffe080, #9a7010)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function PinkRug() {
  return (
    <div className="flex justify-center mt-2 mb-1 pointer-events-none select-none">
      <div
        style={{
          width: "72%", height: 18,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, #f0a8c4 0%, #e89ab8 50%, transparent 100%)",
          filter: "blur(1.5px)",
          opacity: 0.75,
        }}
      />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WardrobePage() {
  const rowRefs = {
    tops:    useRef<SwipeRowHandle>(null),
    bottoms: useRef<SwipeRowHandle>(null),
    shoes:   useRef<SwipeRowHandle>(null),
  };

  const [centred,       setCentred]       = useState<Partial<Record<RowKey, ClothingItem>>>({});
  const [addCategory,   setAddCategory]   = useState<Category | null>(null);
  const [detailsItem,   setDetailsItem]   = useState<ClothingItem | null>(null);
  const [showMannequin, setShowMannequin] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(null);
  const [showPremium,   setShowPremium]   = useState(false);
  const [isSaveOpen,    setIsSaveOpen]    = useState(false);
  const [saveName,      setSaveName]      = useState("");

  const { data: tops    = [] } = useListClothing({ category: "tops"    }, { query: { queryKey: getListClothingQueryKey({ category: "tops"    }) } });
  const { data: bottoms = [] } = useListClothing({ category: "bottoms" }, { query: { queryKey: getListClothingQueryKey({ category: "bottoms" }) } });
  const { data: shoes   = [] } = useListClothing({ category: "shoes"   }, { query: { queryKey: getListClothingQueryKey({ category: "shoes"   }) } });
  const { data: outfits = [] } = useListOutfits();

  const rowData: Record<RowKey, ClothingItem[]> = { tops, bottoms, shoes };
  const totalItems = tops.length + bottoms.length + shoes.length;

  const saveOutfit  = useSaveOutfit();
  const queryClient = useQueryClient();
  const { tier, caps, canAddItem, canSaveOutfit } = useEntitlements();

  // ── Callbacks ─────────────────────────────────────────────────────────────
  const handleCentred = useCallback(
    (key: RowKey) => (item: ClothingItem | null) =>
      setCentred((prev) => ({ ...prev, [key]: item ?? undefined })),
    []
  );

  const handleItemTap = useCallback((item: ClothingItem) => setDetailsItem(item), []);

  const handleAddClick = useCallback((category: Category) => {
    if (canAddItem(totalItems)) setAddCategory(category);
    else setUpgradeReason("items");
  }, [canAddItem, totalItems]);

  const handleSaveClick = useCallback(() => {
    if (canSaveOutfit(outfits.length)) setIsSaveOpen(true);
    else setUpgradeReason("outfits");
  }, [canSaveOutfit, outfits.length]);

  const handleMannequinClick = useCallback(() => {
    if (caps.mannequin) setShowMannequin(true);
    else setShowPremium(true);
  }, [caps.mannequin]);

  const handleShuffle = useCallback(() => {
    ROWS.forEach(({ key }, rowIndex) => {
      const data = rowData[key];
      if (data.length < 2) return;
      const ref = rowRefs[key].current;
      if (!ref) return;
      const targetIdx = Math.floor(Math.random() * data.length);
      setTimeout(() => {
        ref.scrollToIndex(data.length - 1, false);
        setTimeout(() => ref.scrollToIndex(targetIdx, true), 60);
      }, rowIndex * 80);
    });
  }, [rowData]);

  const handleSave = () => {
    if (!saveName.trim()) return;
    if (!canSaveOutfit(outfits.length)) {
      setIsSaveOpen(false); setSaveName(""); setUpgradeReason("outfits"); return;
    }
    const itemIds = (Object.values(centred) as ClothingItem[]).map((i) => i.id);
    saveOutfit.mutate(
      { data: { name: saveName.trim(), itemIds } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
          setIsSaveOpen(false); setSaveName("");
        },
      }
    );
  };

  const canSave    = ROWS.every(({ key }) => !!centred[key]);
  const isFree     = tier === "free";
  const outfitsLeft = isFree ? Math.max(0, FREE_OUTFIT_LIMIT - outfits.length) : null;
  const itemsLeft   = isFree ? Math.max(0, FREE_ITEM_LIMIT  - totalItems)      : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative min-h-full overflow-x-hidden"
      style={{ background: INTERIOR }}
    >
      {/* Interior warm glow from chandelier */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none z-0"
        style={{
          height: 200,
          background: "radial-gradient(ellipse at 50% 0%, rgba(255,235,130,0.35) 0%, transparent 70%)",
        }}
      />

      {/* Closet doors */}
      <ClosetDoor side="left" />
      <ClosetDoor side="right" />

      {/* ── Content layer ── */}
      <div className="relative z-10">

        {/* Chandelier + title */}
        <div className="flex flex-col items-center">
          <Chandelier />
          <h1
            className="font-display font-bold uppercase tracking-tight leading-none text-center"
            style={{ fontSize: "1.6rem", color: "#3d2a00", letterSpacing: "0.06em" }}
          >
            My Digital Closet
          </h1>
          <p style={{ fontSize: 10, color: PINK_ACC, fontWeight: 600, letterSpacing: "0.12em", marginTop: 2 }}>
            Inspired by digital closets of the '90s
          </p>

          {/* Free tier badge */}
          {isFree && totalItems > 0 && (
            <button
              onClick={() => setUpgradeReason("items")}
              className="mt-2 transition-opacity hover:opacity-80"
              style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
                textTransform: "uppercase",
                padding: "3px 10px",
                borderRadius: 20,
                background: itemsLeft === 0 ? "#3d2a00" : "rgba(196,155,42,0.15)",
                color:      itemsLeft === 0 ? "white"   : "#9a7010",
                border:     `1.5px solid ${itemsLeft === 0 ? "#3d2a00" : "rgba(196,155,42,0.4)"}`,
              }}
            >
              {totalItems}/{FREE_ITEM_LIMIT} items
            </button>
          )}
        </div>

        {/* ── Row sections ── */}
        <div className="mt-3">
          {ROWS.map(({ key, label, addLabel }, rowIdx) => {
            const items = rowData[key];
            return (
              <div key={key} data-testid={`row-${key}`} className="mb-1">

                {/* Gold rod */}
                <div className="relative" style={{ paddingLeft: 52, paddingRight: 52 }}>
                  <GoldRod />
                </div>

                {/* Row label + add link */}
                <div className="flex flex-col items-center" style={{ marginTop: 6, marginBottom: 4 }}>
                  <div
                    style={{
                      background: "white",
                      borderRadius: 20,
                      padding: "4px 18px",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.10)",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      className="font-display font-bold uppercase"
                      style={{ fontSize: 11, letterSpacing: "0.18em", color: "#3d2a00" }}
                    >
                      {label}
                    </span>
                    {items.length > 0 && (
                      <span style={{ fontSize: 9, color: "#aaa", fontWeight: 600 }}>
                        {items.length}
                      </span>
                    )}
                  </div>
                  {/* Add button */}
                  <button
                    onClick={() => handleAddClick(key as Category)}
                    className="transition-opacity hover:opacity-80 active:scale-95"
                    style={{
                      marginTop: 3,
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                      color: PINK_ACC, textTransform: "uppercase",
                    }}
                  >
                    + {addLabel}
                  </button>
                </div>

                {/* SwipeRow — full width so items extend toward doors */}
                <SwipeRow
                  ref={rowRefs[key]}
                  items={items}
                  addLabel={addLabel}
                  onCenteredItem={handleCentred(key)}
                  onAddClick={() => handleAddClick(key as Category)}
                  onItemTap={handleItemTap}
                  closetStyle
                />

                {/* Shelf divider between rows */}
                {rowIdx < ROWS.length - 1 && (
                  <div
                    className="mt-3"
                    style={{ paddingLeft: 52, paddingRight: 52 }}
                  >
                    <div
                      style={{
                        height: 8,
                        borderRadius: "0 0 6px 6px",
                        background: "linear-gradient(to bottom, #e8d4a8, #f5e8c4)",
                        boxShadow: "0 3px 8px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.6) inset",
                        border: "1px solid rgba(180,140,50,0.2)",
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Drawers + rug */}
        <div className="mt-3">
          <Drawers />
          <PinkRug />
        </div>

        {/* ── Action buttons ── */}
        <div className="px-4 pb-6 mt-3 flex flex-col gap-2.5">

          {/* Save outfit */}
          <AnimatePresence mode="wait">
            {isSaveOpen ? (
              <motion.div
                key="save-input"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="flex gap-2"
              >
                <input
                  autoFocus
                  type="text"
                  placeholder="Name this outfit…"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  className="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold focus:outline-none"
                  style={{
                    background: "rgba(255,252,248,0.95)",
                    border: "1.5px solid rgba(196,155,42,0.4)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    color: "#3d2a00",
                  }}
                  data-testid="input-outfit-name"
                />
                <button
                  onClick={() => { setIsSaveOpen(false); setSaveName(""); }}
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "rgba(255,252,248,0.95)",
                    border: "1.5px solid rgba(196,155,42,0.3)",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                  }}
                >
                  <X className="w-4 h-4" style={{ color: "#9a7010" }} />
                </button>
                <button
                  onClick={handleSave}
                  disabled={!saveName.trim() || saveOutfit.isPending}
                  className="px-5 py-3 rounded-xl text-sm font-bold uppercase tracking-wide disabled:opacity-40"
                  style={{
                    background: "linear-gradient(to bottom, #f5d840, #c89018)",
                    color: "#3d2a00",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(200,168,24,0.35)",
                    letterSpacing: "0.08em",
                    fontSize: 12,
                  }}
                  data-testid="button-save-outfit-confirm"
                >
                  {saveOutfit.isPending ? "…" : "Save"}
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="save-btn"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                onClick={canSave ? handleSaveClick : undefined}
                disabled={!canSave}
                className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-bold uppercase tracking-wide transition-all active:scale-[0.98]"
                style={{
                  background:  canSave
                    ? "linear-gradient(to bottom, #f5d840, #c89018)"
                    : "rgba(240,232,210,0.8)",
                  color:       canSave ? "#3d2a00" : "rgba(100,80,30,0.4)",
                  boxShadow:   canSave
                    ? "0 6px 18px rgba(200,168,24,0.4), 0 1px 0 rgba(255,255,255,0.4) inset"
                    : "none",
                  fontSize:    13,
                  letterSpacing: "0.1em",
                  border:      "none",
                  cursor:      canSave ? "pointer" : "default",
                }}
                data-testid="button-save-outfit"
              >
                <BookmarkPlus className="w-4 h-4" />
                {canSave ? (
                  <>
                    Save Outfit
                    {isFree && outfitsLeft !== null && (
                      <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 2 }}>
                        ({outfitsLeft} left)
                      </span>
                    )}
                  </>
                ) : (
                  "Select a piece from each row"
                )}
              </motion.button>
            )}
          </AnimatePresence>

          {/* Shuffle + Mannequin */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              {
                label: "Shuffle", icon: <Shuffle className="w-4 h-4" />,
                onClick: handleShuffle, disabled: false, testId: "button-shuffle",
              },
              {
                label: "Mannequin", icon: <PersonStanding className="w-4 h-4" />,
                onClick: handleMannequinClick, disabled: !canSave, testId: "button-view-mannequin",
                badge: !caps.mannequin && canSave ? "✦" : undefined,
              },
            ].map(({ label, icon, onClick, disabled, testId, badge }) => (
              <button
                key={label}
                onClick={onClick}
                disabled={disabled}
                data-testid={testId}
                className="py-3.5 rounded-2xl flex items-center justify-center gap-1.5 font-bold uppercase tracking-wide transition-all active:scale-[0.97]"
                style={{
                  background:  disabled ? "rgba(240,232,210,0.5)" : "rgba(255,252,248,0.95)",
                  border:     `1.5px solid ${disabled ? "rgba(196,155,42,0.12)" : "rgba(196,155,42,0.35)"}`,
                  color:       disabled ? "rgba(100,80,30,0.3)" : "#7a5a18",
                  boxShadow:   disabled ? "none" : "0 3px 10px rgba(0,0,0,0.07)",
                  fontSize:    12, letterSpacing: "0.08em",
                  cursor:      disabled ? "default" : "pointer",
                }}
              >
                {icon}
                {label}
                {badge && <span style={{ fontSize: 8, opacity: 0.5 }}>{badge}</span>}
              </button>
            ))}
          </div>

          {/* Sparkle accent line */}
          <div className="flex items-center justify-center gap-2 opacity-30 mt-1">
            <div style={{ flex: 1, height: 1, background: "rgba(196,155,42,0.5)" }} />
            <Sparkles className="w-3 h-3" style={{ color: "#C49B2A" }} />
            <div style={{ flex: 1, height: 1, background: "rgba(196,155,42,0.5)" }} />
          </div>
        </div>
      </div>

      {/* ── Overlays ── */}
      <AnimatePresence>
        {showMannequin && (
          <MannequinView
            top={centred.tops} bottom={centred.bottoms} shoes={centred.shoes}
            onClose={() => setShowMannequin(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {upgradeReason && (
          <UpgradeSheet reason={upgradeReason} onClose={() => setUpgradeReason(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPremium && <PremiumSheet onClose={() => setShowPremium(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {addCategory && (
          <QuickAddSheet
            key={addCategory}
            open={!!addCategory}
            onOpenChange={(open) => !open && setAddCategory(null)}
            category={addCategory}
            existingCount={rowData[addCategory as RowKey]?.length ?? 0}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailsItem && (
          <ItemDetailsSheet
            key={detailsItem.id}
            item={detailsItem}
            onClose={() => setDetailsItem(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
