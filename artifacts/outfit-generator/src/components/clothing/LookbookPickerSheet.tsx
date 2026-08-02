/**
 * LookbookPickerSheet — lets the user add or remove an item from any saved lookbook group.
 *
 * Shows all saved groups, each with up to 3 item thumbnails and a filled
 * checkmark badge on groups that already contain this item.
 * Tapping a group toggles the item's membership.
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, BookMarked } from "lucide-react";
import {
  useListOutfits,
  useAddItemToOutfit,
  useRemoveItemFromOutfit,
  getListOutfitsQueryKey,
  type ClothingItem,
  type SavedOutfit,
} from "@/hooks/useLocalDB";
import { useQueryClient } from "@tanstack/react-query";
import { getImageUrl } from "@/lib/utils";

// ── Palette (mirrors ItemDetailsSheet) ───────────────────────────────────────
const C = {
  bg:         "#FFF8F0",
  bgCard:     "#FEFAF4",
  brown:      "#3A2210",
  brownMid:   "rgba(58,34,16,0.55)",
  border:     "rgba(139,26,26,0.35)",
  gold:       "#8B1A1A",
  goldLight:  "#B52020",
  btnText:    "#FFF5EE",
};

// ── Thumbnail strip ───────────────────────────────────────────────────────────

function ThumbnailStrip({ items }: { items: ClothingItem[] }) {
  const preview = items.slice(0, 3);
  if (preview.length === 0) {
    return (
      <div
        style={{
          width: 72, height: 48,
          borderRadius: 8,
          border: `1.5px dashed ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: C.bgCard,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 10, color: C.brownMid }}>empty</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
      {preview.map((item) => (
        <div
          key={item.id}
          style={{
            width: 40, height: 48,
            borderRadius: 6,
            border: `1.5px solid ${C.border}`,
            overflow: "hidden",
            background: "#F5EDD8",
            flexShrink: 0,
          }}
        >
          {item.imageObjectPath ? (
            <img
              src={getImageUrl(item.imageObjectPath)!}
              alt={item.name}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            <div style={{
              width: "100%", height: "100%",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 8, color: C.brownMid }}>—</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Group row ─────────────────────────────────────────────────────────────────

function GroupRow({
  outfit,
  itemId,
  onToggle,
  busy,
}: {
  outfit: SavedOutfit;
  itemId: number;
  onToggle: (outfitId: number, contains: boolean) => void;
  busy: boolean;
}) {
  const contains = outfit.items.some((i) => i.id === itemId);

  return (
    <button
      onClick={() => !busy && onToggle(outfit.id, contains)}
      disabled={busy}
      style={{
        width: "100%",
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px",
        background: contains ? "rgba(139,26,26,0.06)" : C.bg,
        borderBottom: `1px solid ${C.border}`,
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.6 : 1,
        textAlign: "left",
      }}
    >
      <ThumbnailStrip items={outfit.items} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: "var(--font-display, serif)",
          fontWeight: 800, fontSize: 14,
          letterSpacing: "0.04em", textTransform: "uppercase",
          color: C.brown, margin: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {outfit.name}
        </p>
        <p style={{ fontSize: 11, color: C.brownMid, margin: "2px 0 0" }}>
          {outfit.items.length} item{outfit.items.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Checkmark badge */}
      <div style={{
        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
        border: `1.5px solid ${contains ? C.gold : C.border}`,
        background: contains ? C.gold : C.bgCard,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
      }}>
        {contains && <Check size={14} color={C.btnText} />}
      </div>
    </button>
  );
}

// ── Sheet ─────────────────────────────────────────────────────────────────────

interface LookbookPickerSheetProps {
  item: ClothingItem;
  onClose: () => void;
}

export function LookbookPickerSheet({ item, onClose }: LookbookPickerSheetProps) {
  const { data: outfits = [], isLoading } = useListOutfits();
  const addMutation    = useAddItemToOutfit();
  const removeMutation = useRemoveItemFromOutfit();
  const queryClient    = useQueryClient();
  const [busyId, setBusyId] = useState<number | null>(null);

  const handleToggle = async (outfitId: number, contains: boolean) => {
    setBusyId(outfitId);
    try {
      if (contains) {
        await removeMutation.mutateAsync({ id: outfitId, itemId: item.id });
      } else {
        await addMutation.mutateAsync({ id: outfitId, data: { itemId: item.id } });
      }
      queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 80,
          background: "rgba(0,0,0,0.45)",
        }}
      />
      <motion.div
        key="sheet"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 260 }}
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 81,
          maxWidth: 480, margin: "0 auto",
          background: C.bg,
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
          maxHeight: "80vh",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border }} />
        </div>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: `1.5px solid ${C.border}`,
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BookMarked size={16} color={C.gold} />
            <h3 style={{
              fontFamily: "var(--font-display, serif)",
              fontWeight: 800, fontSize: 16,
              letterSpacing: "0.04em", textTransform: "uppercase",
              color: C.brown, margin: 0,
            }}>
              Add to Lookbook
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              border: `1.5px solid ${C.border}`,
              background: C.bgCard,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={14} color={C.brown} />
          </button>
        </div>

        {/* Item context */}
        <div style={{
          padding: "10px 16px",
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
          background: "rgba(139,26,26,0.04)",
        }}>
          <p style={{ fontSize: 12, color: C.brownMid, margin: 0 }}>
            <span style={{ fontWeight: 700, color: C.brown }}>{item.name}</span>
            {" · tap a group to add or remove"}
          </p>
        </div>

        {/* Group list */}
        <div style={{ overflowY: "auto", flex: 1, paddingBottom: "env(safe-area-inset-bottom)" }}>
          {isLoading ? (
            <div style={{ padding: 24, textAlign: "center", color: C.brownMid, fontSize: 13 }}>
              Loading…
            </div>
          ) : outfits.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center" }}>
              <p style={{ color: C.brownMid, fontSize: 13 }}>No lookbook groups yet.</p>
              <p style={{ color: C.brownMid, fontSize: 12, marginTop: 4 }}>
                Create one in the Lookbook tab first.
              </p>
            </div>
          ) : (
            outfits.map((outfit) => (
              <GroupRow
                key={outfit.id}
                outfit={outfit}
                itemId={item.id}
                onToggle={handleToggle}
                busy={busyId === outfit.id}
              />
            ))
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
