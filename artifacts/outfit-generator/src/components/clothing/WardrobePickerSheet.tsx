/**
 * WardrobePickerSheet
 *
 * Slide-up sheet that shows existing wardrobe items for a given category.
 * Tapping an item adds it to the outfit. An "Add New" button at the bottom
 * falls through to QuickAddSheet so the user can upload a brand-new piece.
 *
 * Category labels read from useCategoryLabels() so custom shelf names show here too.
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus } from "lucide-react";
import {
  useListClothing,
  useCategoryLabels,
  getListClothingQueryKey,
  type ListClothingCategory,
  type ClothingItem,
} from "@/hooks/useLocalDB";
import { getImageUrl } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { QuickAddSheet } from "./QuickAddSheet";

// ── Palette (matches ItemDetailsSheet) ────────────────────────────────────────
const C = {
  bg:         "#FFF8F0",
  bgCard:     "#FEFAF4",
  brown:      "#3A2210",
  brownFaint: "rgba(58,34,16,0.28)",
  border:     "rgba(180,140,90,0.40)",
  gold:       "#8B1A1A",   // deep red accent
  goldLight:  "#B52020",   // lighter red for gradient top
  btnText:    "#FFF5EE",   // off-white text on accent buttons
};

type Category = "outfits" | "beauty" | "toiletries" | "essentials";

interface Props {
  open:             boolean;
  onOpenChange:     (open: boolean) => void;
  /** When omitted, shows all categories (for picking extras) */
  category?:        Category;
  onPick:           (item: ClothingItem) => void;
  existingItemIds?: number[];
}

export function WardrobePickerSheet({ open, onOpenChange, category, onPick, existingItemIds = [] }: Props) {
  const [showQuickAdd, setShowQuickAdd]             = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [quickAddCategory, setQuickAddCategory]     = useState<Category>("outfits");
  const queryClient = useQueryClient();
  const { labels: catLabels } = useCategoryLabels();

  const params = category ? { category: category as ListClothingCategory } : {};
  const { data: items, isLoading } = useListClothing(
    params,
    { query: { queryKey: getListClothingQueryKey(params), enabled: open } },
  );

  const categoryLabel = (key: Category) => catLabels[key] ?? key;
  const label = category ? categoryLabel(category) : "Extra";

  const handleClose = () => onOpenChange(false);

  const handlePick = (item: ClothingItem) => {
    onPick(item);
    onOpenChange(false);
  };

  const handleNewlyAdded = (item: ClothingItem) => {
    queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
    setShowQuickAdd(false);
    onPick(item);
    onOpenChange(false);
  };

  if (!open) return null;

  const articleFor = (s: string) => /^[aeiou]/i.test(s) ? "an" : "a";

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 240 }}
        style={{
          position: "fixed", inset: 0, zIndex: 70,
          display: "flex", flexDirection: "column",
          maxWidth: 480, margin: "0 auto",
          background: C.bg,
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "max(0.75rem, env(safe-area-inset-top)) 16px 12px",
          background: C.bg,
          borderBottom: `1.5px solid ${C.border}`,
          flexShrink: 0,
        }}>
          <h2 style={{
            fontFamily: "var(--font-display, serif)",
            fontWeight: 800, fontSize: 18,
            letterSpacing: "0.04em", textTransform: "uppercase",
            color: C.brown, margin: 0,
          }}>
            Pick {articleFor(label)} {label}
          </h2>
          <button
            onClick={handleClose}
            style={{
              width: 36, height: 36, borderRadius: "50%",
              border: `1.5px solid ${C.border}`,
              background: C.bgCard,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={16} color={C.brown} />
          </button>
        </div>

        {/* Item grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {isLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160 }}>
              <span style={{ fontSize: 13, color: C.brownFaint, fontWeight: 500 }} className="animate-pulse">
                Loading your wardrobe…
              </span>
            </div>
          ) : items && items.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {items.map((item) => {
                const alreadyIn = existingItemIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => handlePick(item)}
                    style={{
                      display: "flex", flexDirection: "column", gap: 4,
                      textAlign: "left", background: "none", border: "none",
                      padding: 0, cursor: "pointer",
                    }}
                  >
                    <div style={{
                      position: "relative", width: "100%", aspectRatio: "1",
                      border: `1.5px solid ${C.border}`,
                      borderRadius: 10,
                      overflow: "hidden",
                      background: "#F5EDD8",
                    }}>
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
                          fontSize: 24,
                        }}>
                          👕
                        </div>
                      )}
                      {alreadyIn && (
                        <div style={{
                          position: "absolute", inset: 0,
                          background: "rgba(58,34,16,0.35)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <span style={{
                            color: C.goldLight,
                            fontSize: 10, fontWeight: 700,
                            letterSpacing: "0.10em", textTransform: "uppercase",
                            background: "rgba(58,34,16,0.60)",
                            padding: "2px 6px", borderRadius: 4,
                          }}>
                            In look
                          </span>
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      letterSpacing: "0.10em", textTransform: "uppercase",
                      color: C.brownFaint,
                      overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap", display: "block", width: "100%",
                    }}>
                      {item.name}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              height: 160, gap: 10, textAlign: "center",
            }}>
              <span style={{ fontSize: 36 }}>💄</span>
              <p style={{ fontSize: 13, color: C.brownFaint, fontWeight: 500 }}>
                No {label.toLowerCase()} in your wardrobe yet.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 16px",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          borderTop: `1.5px solid ${C.border}`,
          background: C.bg,
          flexShrink: 0,
        }}>
          {category ? (
            /* Known-category: direct Add New button */
            <button
              onClick={() => setShowQuickAdd(true)}
              style={{
                width: "100%", padding: "13px 0",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                borderRadius: 14,
                border: `1.5px solid ${C.gold}`,
                background: `linear-gradient(to bottom, ${C.goldLight}, ${C.gold})`,
                color: C.btnText,
                fontSize: 13, fontWeight: 800,
                letterSpacing: "0.08em", textTransform: "uppercase",
                cursor: "pointer",
                boxShadow: "0 3px 12px rgba(100,10,10,0.22)",
              }}
            >
              <Plus size={16} />
              Add New {label} to Wardrobe
            </button>
          ) : showCategoryPicker ? (
            /* Extras: category chips */
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.18em",
                textTransform: "uppercase", color: C.brownFaint,
                textAlign: "center", margin: 0,
              }}>
                Choose a category
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {(["outfits", "beauty", "toiletries", "essentials"] as Category[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setQuickAddCategory(cat);
                      setShowQuickAdd(true);
                      setShowCategoryPicker(false);
                    }}
                    style={{
                      padding: "10px 0",
                      borderRadius: 12,
                      border: `1.5px solid ${C.border}`,
                      background: C.bgCard,
                      color: C.brown,
                      fontFamily: "var(--font-display, serif)",
                      fontSize: 13, fontWeight: 700,
                      letterSpacing: "0.04em", textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    {categoryLabel(cat)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Extras: Add New that reveals category picker */
            <button
              onClick={() => setShowCategoryPicker(true)}
              style={{
                width: "100%", padding: "13px 0",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                borderRadius: 14,
                border: `1.5px solid ${C.gold}`,
                background: `linear-gradient(to bottom, ${C.goldLight}, ${C.gold})`,
                color: C.btnText,
                fontSize: 13, fontWeight: 800,
                letterSpacing: "0.08em", textTransform: "uppercase",
                cursor: "pointer",
                boxShadow: "0 3px 12px rgba(100,10,10,0.22)",
              }}
            >
              <Plus size={16} />
              Add New Item to Wardrobe
            </button>
          )}
        </div>
      </motion.div>

      {/* QuickAddSheet for uploading a brand-new item */}
      <AnimatePresence>
        {showQuickAdd && (
          <QuickAddSheet
            open
            onOpenChange={(o) => {
              setShowQuickAdd(o);
              if (!o) setShowCategoryPicker(false);
            }}
            category={category ?? quickAddCategory}
            existingCount={items?.length ?? 0}
            onCreated={handleNewlyAdded}
          />
        )}
      </AnimatePresence>
    </>
  );
}
