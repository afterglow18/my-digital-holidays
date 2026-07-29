import React, { useState, useRef, useEffect } from "react";
import {
  useListOutfits,
  useDeleteOutfit,
  useRenameOutfit,
  useAddItemToOutfit,
  useRemoveItemFromOutfit,
  getListOutfitsQueryKey,
  useCategoryLabels,
  type ClothingItem,
} from "@/hooks/useLocalDB";
import { Trash2, Bookmark, Plus, Pencil, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getImageUrl } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useEntitlements } from "@/hooks/useEntitlements";
import { UpgradeSheet } from "@/components/paywall/UpgradeSheet";
import { FREE_OUTFIT_LIMIT } from "@/lib/entitlements";
import { WardrobePickerSheet } from "@/components/clothing/WardrobePickerSheet";
import { ItemDetailsSheet } from "@/components/clothing/ItemDetailsSheet";

const SLOT_ORDER = ["outfits", "beauty", "toiletries", "essentials"] as const;
type SlotKey = (typeof SLOT_ORDER)[number];

const SLOT_LABELS: Record<SlotKey, string> = {
  outfits:    "Outfits",
  beauty:     "Beauty",
  toiletries: "Toiletries",
  essentials: "Essentials",
};

function ItemPhoto({
  item,
  size = "md",
  onClick,
}: {
  item: ClothingItem;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}) {
  const sizeClass = size === "lg" ? "h-28" : size === "md" ? "h-20" : "h-14";
  return (
    <button
      onClick={onClick}
      className={`w-full ${sizeClass} border-2 border-black overflow-hidden relative`}
      style={{ background: "#F5EDD8", padding: 0, display: "block" }}
    >
      {item.imageObjectPath ? (
        <img
          src={getImageUrl(item.imageObjectPath)!}
          alt={item.name}
          className="w-full h-full object-contain"
          style={{ objectFit: "contain", objectPosition: "center" }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-1">
          <span className="text-[9px] font-bold uppercase text-center leading-tight text-black/30">—</span>
        </div>
      )}
      {item.isFavorite && (
        <span className="absolute top-1 right-1 text-[10px] leading-none">❤️</span>
      )}
    </button>
  );
}

export default function SavedPage() {
  const { data: outfits, isLoading } = useListOutfits();
  const deleteOutfit = useDeleteOutfit();
  const renameOutfit = useRenameOutfit();
  const removeItemFromOutfit = useRemoveItemFromOutfit();
  const addItemToOutfit = useAddItemToOutfit();
  const queryClient = useQueryClient();
  const { tier } = useEntitlements();
  const { labels: categoryLabels } = useCategoryLabels();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [replacingSlot, setReplacingSlot] = useState<{ outfitId: number; category: SlotKey } | null>(null);
  const [addingExtra, setAddingExtra]     = useState<number | null>(null);
  const [detailsItem, setDetailsItem] = useState<ClothingItem | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [editingNotesId, setEditingNotesId] = useState<number | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const notesInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (renamingId !== null) renameInputRef.current?.focus();
  }, [renamingId]);

  useEffect(() => {
    if (editingNotesId !== null) notesInputRef.current?.focus();
  }, [editingNotesId]);

  const startRename = (id: number, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const commitRename = (id: number) => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== outfits?.find((o) => o.id === id)?.name) {
      renameOutfit.mutate(
        { id, data: { name: trimmed } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() }) }
      );
    }
    setRenamingId(null);
  };

  const startEditNotes = (id: number, currentNotes: string | null | undefined) => {
    setEditingNotesId(id);
    setNotesValue(currentNotes ?? "");
  };

  const commitNotes = (id: number) => {
    const trimmed = notesValue.trim();
    const current = outfits?.find((o) => o.id === id)?.notes ?? "";
    if (trimmed !== (current ?? "")) {
      renameOutfit.mutate(
        { id, data: { notes: trimmed || null } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() }) }
      );
    }
    setEditingNotesId(null);
  };

  const isFree = tier === "free";
  const outfitCount = outfits?.length ?? 0;
  const atLimit = isFree && outfitCount >= FREE_OUTFIT_LIMIT;

  const handleDelete = (id: number) => {
    deleteOutfit.mutate(
      { id },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() }) }
    );
  };

  const handleRemoveItem = (outfitId: number, itemId: number) => {
    removeItemFromOutfit.mutate(
      { id: outfitId, itemId },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() }) }
    );
  };

  const handlePickedItem = (item: ClothingItem) => {
    if (replacingSlot == null) return;
    addItemToOutfit.mutate(
      { id: replacingSlot.outfitId, data: { itemId: item.id } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() }) }
    );
    setReplacingSlot(null);
  };

  const handlePickedExtra = (item: ClothingItem) => {
    if (addingExtra == null) return;
    addItemToOutfit.mutate(
      { id: addingExtra, data: { itemId: item.id } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() }) }
    );
    setAddingExtra(null);
  };

  return (
    <div className="min-h-full flex flex-col pb-8 relative" style={{ background: "#F5F0E8" }}>

      {/* ── Holiday red header band ── */}
      <header
        className="px-5 pb-5 mb-6"
        style={{
          background: "linear-gradient(160deg, #8B1A1A 0%, #6B1010 100%)",
          paddingTop: "max(2rem, env(safe-area-inset-top))",
        }}
      >
        <div style={{
          fontFamily: "var(--font-display, serif)",
          fontWeight: 800,
          fontSize: 11,
          letterSpacing: "0.20em",
          textTransform: "uppercase",
          color: "rgba(255,245,238,0.65)",
          lineHeight: 1,
          marginBottom: 4,
          textShadow: "0 1px 6px rgba(0,0,0,0.40)",
        }}>
          My Digital Holidays
        </div>
        <div className="flex items-end justify-between gap-2">
          <h1 style={{
            fontFamily: "var(--font-display, serif)",
            fontWeight: 800,
            fontSize: 34,
            letterSpacing: "0.03em",
            color: "#FFF5EE",
            lineHeight: 1.05,
            textShadow: "0 2px 12px rgba(0,0,0,0.50)",
            margin: 0,
            textTransform: "uppercase",
          }}>
            Lookbook
          </h1>

          {isFree && outfitCount > 0 && (
            <button
              onClick={() => setShowUpgrade(true)}
              className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border-2 transition-colors shrink-0 mb-1"
              style={atLimit
                ? { background: "#FFF5EE", color: "#8B1A1A", borderColor: "#FFF5EE" }
                : outfitCount >= FREE_OUTFIT_LIMIT - 1
                ? { background: "rgba(255,245,238,0.25)", color: "#FFF5EE", borderColor: "rgba(255,245,238,0.6)" }
                : { background: "transparent", color: "rgba(255,245,238,0.55)", borderColor: "rgba(255,245,238,0.30)" }
              }
            >
              {outfitCount}/{FREE_OUTFIT_LIMIT} saved
            </button>
          )}
        </div>
        <p style={{
          fontWeight: 600,
          color: "rgba(255,245,238,0.65)",
          fontSize: 12,
          marginTop: 4,
          letterSpacing: "0.03em",
        }}>
          Hall of fame.
        </p>
      </header>

      <div className="px-4">

      {atLimit && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 border-2 border-black rounded-xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          style={{ background: "linear-gradient(135deg, #B52020 0%, #8B1A1A 100%)" }}
        >
          <p className="font-display font-bold text-sm uppercase tracking-tight" style={{ color: "#FFF5EE" }}>
            🔓 Lookbook is full
          </p>
          <p className="text-xs mt-1 mb-3 leading-snug" style={{ color: "rgba(255,245,238,0.70)" }}>
            You've saved {FREE_OUTFIT_LIMIT} looks — the free limit.
            Unlock Forever to save unlimited cases.
          </p>
          <button
            onClick={() => setShowUpgrade(true)}
            className="w-full py-2.5 rounded-lg border-2 font-bold uppercase text-xs tracking-wide shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
            style={{ background: "#FFF5EE", color: "#8B1A1A", borderColor: "#FFF5EE" }}
          >
            Unlock Forever – $4.99
          </button>
        </motion.div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-52 bg-muted animate-pulse border-2 border-black rounded-xl" />
          ))}
        </div>
      ) : outfits && outfits.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {outfits.map((outfit) => {
            // Group items by category — first match per slot wins
            const bySlot = (outfit.items ?? []).reduce<Partial<Record<SlotKey, ClothingItem>>>(
              (acc, item) => {
                const key = item.category as SlotKey;
                if (SLOT_ORDER.includes(key) && !acc[key]) acc[key] = item;
                return acc;
              },
              {}
            );

            // Any items whose category isn't a known slot (e.g. legacy data)
            const knownIds = new Set(Object.values(bySlot).map((i) => i?.id));
            const extras = (outfit.items ?? []).filter((i) => !knownIds.has(i.id));

            return (
              <motion.div
                key={outfit.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden"
                data-testid={`outfit-card-${outfit.id}`}
              >
                {/* Card header */}
                <div
                  className="px-4 py-3 border-b-2 border-black flex justify-between items-center gap-2"
                  style={{ background: "linear-gradient(135deg, #B52020 0%, #8B1A1A 100%)" }}
                >
                  {renamingId === outfit.id ? (
                    <form
                      className="flex-1 flex items-center gap-1"
                      onSubmit={(e) => { e.preventDefault(); commitRename(outfit.id); }}
                    >
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => commitRename(outfit.id)}
                        maxLength={60}
                        className="flex-1 font-display font-bold text-lg uppercase tracking-tight bg-white/20 border-2 border-white/40 rounded-lg px-2 py-0.5 outline-none min-w-0"
                        style={{ color: "#FFF5EE" }}
                      />
                      <button
                        type="submit"
                        className="w-7 h-7 flex items-center justify-center border-2 border-white/40 rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] shrink-0"
                        style={{ background: "rgba(255,245,238,0.20)", color: "#FFF5EE" }}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => startRename(outfit.id, outfit.name)}
                      className="flex-1 flex items-center gap-1.5 text-left group min-w-0"
                    >
                      <h3
                        className="font-display font-bold text-lg uppercase tracking-tight truncate"
                        style={{ color: "#FFF5EE", textShadow: "0 1px 6px rgba(0,0,0,0.35)" }}
                      >
                        {outfit.name}
                      </h3>
                      <Pencil className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: "#FFF5EE" }} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(outfit.id)}
                    className="w-8 h-8 flex items-center justify-center border-2 border-white/40 rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all shrink-0"
                    style={{ background: "rgba(255,245,238,0.15)", color: "#FFF5EE" }}
                    data-testid={`button-delete-outfit-${outfit.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Notes */}
                <div className="px-4 py-2 border-b border-black/10">
                  {editingNotesId === outfit.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); commitNotes(outfit.id); }} className="flex gap-2">
                      <textarea
                        ref={notesInputRef}
                        value={notesValue}
                        onChange={(e) => setNotesValue(e.target.value)}
                        onBlur={() => commitNotes(outfit.id)}
                        rows={2}
                        maxLength={300}
                        placeholder="Add notes…"
                        className="flex-1 text-xs border-2 border-black rounded-lg px-2 py-1.5 resize-none outline-none focus:ring-2 focus:ring-primary bg-white"
                      />
                      <button type="submit" className="self-start w-7 h-7 flex items-center justify-center bg-black text-white border-2 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => startEditNotes(outfit.id, outfit.notes)}
                      className="w-full text-left group"
                    >
                      {outfit.notes ? (
                        <p className="text-xs text-black/60 leading-snug flex items-start gap-1">
                          <span className="flex-1">{outfit.notes}</span>
                          <Pencil className="w-3 h-3 shrink-0 mt-0.5 opacity-0 group-hover:opacity-40 transition-opacity" />
                        </p>
                      ) : (
                        <p className="text-xs text-black/25 italic">Add notes…</p>
                      )}
                    </button>
                  )}
                </div>

                {/* 4-slot grid: outfits / beauty / toiletries / essentials */}
                <div className="p-3">
                  <div className="grid grid-cols-4 gap-2">
                    {SLOT_ORDER.map((slot) => {
                      const item = bySlot[slot];
                      return (
                        <div key={slot} className="flex flex-col gap-0.5">
                          {item ? (
                            <>
                              <ItemPhoto item={item} size="lg" onClick={() => setDetailsItem(item)} />
                              <div className="flex items-center justify-between px-0.5">
                                <span className="text-[8px] font-bold uppercase text-muted-foreground truncate">
                                  {(categoryLabels[slot] ?? SLOT_LABELS[slot])}
                                </span>
                                <button
                                  onClick={() => handleRemoveItem(outfit.id, item.id)}
                                  className="w-3.5 h-3.5 flex items-center justify-center rounded-full bg-black/10 hover:bg-red-100 transition-colors flex-shrink-0"
                                >
                                  <X className="w-2.5 h-2.5 text-black/50" />
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setReplacingSlot({ outfitId: outfit.id, category: slot })}
                                className="h-28 w-full border-2 border-dashed border-black/25 rounded flex flex-col items-center justify-center gap-1 hover:border-black/50 hover:bg-black/5 transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5 text-black/30" />
                              </button>
                              <span className="text-[8px] font-bold uppercase text-black/25 text-center truncate">
                                {(categoryLabels[slot] ?? SLOT_LABELS[slot])}
                              </span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* 5 fixed extra slots */}
                  <div className="mt-3 pt-3 border-t border-black/10">
                    <p className="text-[8px] font-bold uppercase tracking-widest text-black/30 mb-2">Extras</p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {Array.from({ length: 10 }).map((_, i) => {
                        const item = extras[i];
                        return item ? (
                          <div key={item.id} className="relative flex flex-col gap-0.5">
                            <button
                              onClick={() => setDetailsItem(item)}
                              className="w-full aspect-square border-2 border-black overflow-hidden rounded"
                              style={{ background: "#F5EDD8" }}
                            >
                              {item.imageObjectPath ? (
                                <img src={getImageUrl(item.imageObjectPath)!} alt={item.name} className="w-full h-full object-contain" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-[8px] font-bold text-black/30">—</span>
                                </div>
                              )}
                            </button>
                            {item.isFavorite && (
                              <span className="absolute top-0 left-0 text-[10px] leading-none z-20 pointer-events-none">⭐</span>
                            )}
                            <button
                              onClick={() => handleRemoveItem(outfit.id, item.id)}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-white border border-black rounded-full flex items-center justify-center shadow-sm z-10"
                            >
                              <X className="w-2 h-2" />
                            </button>
                          </div>
                        ) : (
                          <button
                            key={`empty-${i}`}
                            onClick={() => setAddingExtra(outfit.id)}
                            className="aspect-square border-2 border-dashed border-black/25 rounded flex items-center justify-center hover:border-black/50 hover:bg-black/5 transition-colors"
                          >
                            <Plus className="w-3 h-3 text-black/25" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer: item count */}
                <div className="px-3 pb-3">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">
                    {outfit.items?.length ?? 0} product{(outfit.items?.length ?? 0) !== 1 ? "s" : ""}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl mt-8">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center border-2 border-black mb-4"
            style={{ background: "linear-gradient(135deg, #B52020 0%, #8B1A1A 100%)" }}
          >
            <Bookmark className="w-7 h-7" style={{ color: "#FFF5EE" }} />
          </div>
          <h3 className="font-display font-bold text-xl mb-2">No looks saved yet.</h3>
          <p className="text-sm font-medium text-muted-foreground">
            Head to the Holidays tab, spin the slots, and save looks you love. ❤️
          </p>
        </div>
      )}
      </div>{/* /px-4 */}

      {/* Upgrade sheet */}
      <AnimatePresence>
        {showUpgrade && (
          <UpgradeSheet reason="outfits" onClose={() => setShowUpgrade(false)} />
        )}
      </AnimatePresence>

      {/* Wardrobe picker for replacing a slot */}
      <AnimatePresence>
        {replacingSlot !== null && (
          <WardrobePickerSheet
            key={`${replacingSlot.outfitId}-${replacingSlot.category}`}
            open
            onOpenChange={(open) => { if (!open) setReplacingSlot(null); }}
            category={replacingSlot.category}
            existingItemIds={
              outfits?.find((o) => o.id === replacingSlot.outfitId)?.items?.map((i) => i.id) ?? []
            }
            onPick={handlePickedItem}
          />
        )}
      </AnimatePresence>

      {/* All-category picker for extras */}
      <AnimatePresence>
        {addingExtra !== null && (
          <WardrobePickerSheet
            key={`extra-${addingExtra}`}
            open
            onOpenChange={(open) => { if (!open) setAddingExtra(null); }}
            existingItemIds={
              outfits?.find((o) => o.id === addingExtra)?.items?.map((i) => i.id) ?? []
            }
            onPick={handlePickedExtra}
          />
        )}
      </AnimatePresence>

      {/* Item details sheet */}
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
