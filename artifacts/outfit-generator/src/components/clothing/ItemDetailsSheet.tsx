/**
 * ItemDetailsSheet — full-screen overlay showing a clothing item's details.
 * Styled to match the warm holiday palette of the rest of the app.
 * Category dropdown uses custom shelf labels from useCategoryLabels().
 *
 * Props:
 *   showAddToLookbook — when true (search results / favorites):
 *     • Shows "Wearing Today" + "Add to Lookbook" buttons in the footer.
 *     • Hides the "Clean Up Photo" button.
 *   showAddToLookbook — when false/undefined (wardrobe / lookbook):
 *     • Shows "Wearing Today" button in the footer.
 *     • Shows "Clean Up Photo" button below the photo (existing behaviour).
 */
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, Trash2, Save, ChevronDown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { CleanUpPhotoOverlay } from "./CleanUpPhotoOverlay";
import { LookbookPickerSheet } from "./LookbookPickerSheet";
import {
  type ClothingItem,
  type ClothingItemUpdateCategory,
  useUpdateClothingItem,
  useDeleteClothingItem,
  useCategoryLabels,
  getListClothingQueryKey,
  getListOutfitsQueryKey,
  getWardrobeStatsQueryKey,
} from "@/hooks/useLocalDB";
import { useQueryClient } from "@tanstack/react-query";
import { getImageUrl } from "@/lib/utils";

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg:          "#FFF8F0",
  bgCard:      "#FEFAF4",
  brown:       "#3A2210",
  brownMid:    "rgba(58,34,16,0.55)",
  brownFaint:  "rgba(58,34,16,0.30)",
  border:      "rgba(139,26,26,0.35)",
  borderFocus: "#8B1A1A",
  gold:        "#8B1A1A",
  goldLight:   "#B52020",
  btnText:     "#FFF5EE",
};

// ── Shared field styles ───────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700,
  letterSpacing: "0.18em", textTransform: "uppercase",
  color: C.brownMid, marginBottom: 4, display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  border: `1.5px solid ${C.border}`,
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 13, fontWeight: 500,
  color: C.brown,
  background: C.bgCard,
  outline: "none",
};

// ── Field components ──────────────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string;
  onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? label}
        style={inputStyle}
      />
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: "relative" }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ ...inputStyle, paddingRight: 32, appearance: "none", cursor: "pointer" }}
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>
              {o.label || `— ${label} —`}
            </option>
          ))}
        </select>
        <ChevronDown
          size={15}
          style={{
            position: "absolute", right: 10, top: "50%",
            transform: "translateY(-50%)",
            color: C.brownFaint, pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}

// ── Static option sets ────────────────────────────────────────────────────────
const SEASON_OPTIONS = [
  { value: "",           label: "— Season —"      },
  { value: "Spring",     label: "Spring"           },
  { value: "Summer",     label: "Summer"           },
  { value: "Fall",       label: "Fall"             },
  { value: "Winter",     label: "Winter"           },
  { value: "All Season", label: "All Season"       },
];

const OCCASION_OPTIONS = [
  { value: "",              label: "— Occasion —"   },
  { value: "Casual",        label: "Casual"         },
  { value: "Work",          label: "Work"           },
  { value: "Formal",        label: "Formal"         },
  { value: "Sport",         label: "Sport"          },
  { value: "Special Event", label: "Special Event"  },
];

const CATEGORY_KEYS = ["outfits", "beauty", "toiletries", "essentials"] as const;

// ── Component ─────────────────────────────────────────────────────────────────

interface ItemDetailsSheetProps {
  item: ClothingItem | null;
  onClose: () => void;
  onDeleted?: () => void;
  /** When true (search / favorites): show Add to Lookbook + Wearing Today.
   *  When false/undefined (wardrobe / lookbook): show Clean Up Photo + Wearing Today. */
  showAddToLookbook?: boolean;
}

interface FormState {
  name: string; brand: string; color: string; size: string;
  season: string; occasion: string; purchasePrice: string;
  purchaseDate: string; notes: string; isFavorite: boolean; category: string;
}

function toForm(item: ClothingItem): FormState {
  return {
    name:          item.name          ?? "",
    brand:         item.brand         ?? "",
    color:         item.color         ?? "",
    size:          item.size          ?? "",
    season:        item.season        ?? "",
    occasion:      item.occasion      ?? "",
    purchasePrice: item.purchasePrice ?? "",
    purchaseDate:  item.purchaseDate  ?? "",
    notes:         item.notes         ?? "",
    isFavorite:    item.isFavorite    ?? false,
    category:      item.category      ?? "",
  };
}

function isDirty(form: FormState, item: ClothingItem): boolean {
  return (
    form.name          !== (item.name          ?? "") ||
    form.brand         !== (item.brand         ?? "") ||
    form.color         !== (item.color         ?? "") ||
    form.size          !== (item.size          ?? "") ||
    form.season        !== (item.season        ?? "") ||
    form.occasion      !== (item.occasion      ?? "") ||
    form.purchasePrice !== (item.purchasePrice ?? "") ||
    form.purchaseDate  !== (item.purchaseDate  ?? "") ||
    form.notes         !== (item.notes         ?? "") ||
    form.isFavorite    !== (item.isFavorite    ?? false) ||
    form.category      !== (item.category      ?? "")
  );
}

export function ItemDetailsSheet({
  item, onClose, onDeleted, showAddToLookbook = false,
}: ItemDetailsSheetProps) {
  const [form, setForm]                           = useState<FormState | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCleanUp, setShowCleanUp]             = useState(false);
  const [showLookbookPicker, setShowLookbookPicker] = useState(false);
  const [displayImageUrl, setDisplayImageUrl]     = useState<string | null>(null);
  const [cleanedThisSession, setCleanedThisSession] = useState(false);

  const updateItem          = useUpdateClothingItem();
  const deleteItem          = useDeleteClothingItem();
  const queryClient         = useQueryClient();
  const { labels: catLabels } = useCategoryLabels();

  useEffect(() => {
    if (item) setForm(toForm(item));
    setShowDeleteConfirm(false);
    setShowCleanUp(false);
    setShowLookbookPicker(false);
    setDisplayImageUrl(null);
    setCleanedThisSession(false);
  }, [item?.id]);

  if (!item || !form) return null;

  const dirty = isDirty(form, item);
  const patch = (key: keyof FormState) => (value: string | boolean) =>
    setForm(prev => prev ? { ...prev, [key]: value } : prev);

  const categoryOptions = CATEGORY_KEYS.map(key => ({
    value: key,
    label: catLabels[key] ?? key,
  }));

  const handleSave = () => {
    updateItem.mutate(
      {
        id: item.id,
        data: {
          name:          form.name.trim() || item.name,
          brand:         form.brand.trim(),
          color:         form.color.trim(),
          size:          form.size.trim(),
          season:        form.season,
          occasion:      form.occasion,
          purchasePrice: form.purchasePrice.trim(),
          purchaseDate:  form.purchaseDate.trim(),
          notes:         form.notes.trim(),
          isFavorite:    form.isFavorite,
          category:      (form.category || item.category) as ClothingItemUpdateCategory,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getWardrobeStatsQueryKey() });
          onClose();
        },
      },
    );
  };

  const handleCleanUpSave = (chosenUrl: string) => {
    setDisplayImageUrl(chosenUrl);
    setShowCleanUp(false);
    setCleanedThisSession(true);
    updateItem.mutate(
      { id: item.id, data: { imageObjectPath: chosenUrl, isBackgroundRemoved: true } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
          queryClient.invalidateQueries({ queryKey: getWardrobeStatsQueryKey() });
        },
      },
    );
  };

  const handleDelete = () => {
    deleteItem.mutate(
      { id: item.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getWardrobeStatsQueryKey() });
          onDeleted?.();
          onClose();
        },
      },
    );
  };

  // "Clean Up Photo" is shown: only when showAddToLookbook=false, photo exists,
  // background hasn't been removed, and not cleaned this session.
  const showCleanUpButton =
    !showAddToLookbook &&
    !!item.imageObjectPath &&
    !item.isBackgroundRemoved &&
    !cleanedThisSession;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 240 }}
        style={{
          position: "fixed", inset: 0, zIndex: 65,
          display: "flex", flexDirection: "column",
          maxWidth: 480, margin: "0 auto",
          background: C.bg,
          overflowY: "auto",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          position: "sticky", top: 0, zIndex: 10, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "max(0.75rem, env(safe-area-inset-top)) 16px 12px",
          background: C.bg,
          borderBottom: `1.5px solid ${C.border}`,
        }}>
          <h2 style={{
            fontFamily: "var(--font-display, serif)",
            fontWeight: 800, fontSize: 18,
            letterSpacing: "0.04em", textTransform: "uppercase",
            color: C.brown, margin: 0,
          }}>
            Item Details
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Favourite toggle */}
            <button
              onClick={() => {
                const next = !form.isFavorite;
                patch("isFavorite")(next);
                updateItem.mutate(
                  { id: item.id, data: { isFavorite: next } },
                  {
                    onSuccess: () => {
                      queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
                      queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
                      queryClient.invalidateQueries({ queryKey: getWardrobeStatsQueryKey() });
                    },
                  },
                );
              }}
              title="Favourite"
              style={{
                width: 36, height: 36, borderRadius: "50%",
                border: `1.5px solid ${form.isFavorite ? "#e05555" : C.border}`,
                background: form.isFavorite ? "#e05555" : C.bgCard,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
                boxShadow: form.isFavorite ? "0 2px 8px rgba(220,60,60,0.30)" : "none",
              }}
            >
              <Heart
                size={15}
                fill={form.isFavorite ? "white" : "none"}
                stroke={form.isFavorite ? "white" : C.brownMid}
              />
            </button>
            {/* Close */}
            <button
              onClick={onClose}
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
        </div>

        {/* ── Photo ── */}
        {item.imageObjectPath && (
          <div style={{ flexShrink: 0, borderBottom: `1.5px solid ${C.border}` }}>
            <div style={{
              width: "100%", height: 210,
              backgroundImage: "repeating-conic-gradient(#ede8e0 0% 25%, #f9f4ee 0% 50%)",
              backgroundSize: "16px 16px",
            }}>
              <img
                src={displayImageUrl ?? getImageUrl(item.imageObjectPath)!}
                alt={item.name}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </div>
          </div>
        )}

        {/* ── Form ── */}
        <div style={{ flex: 1, padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

          <Field label="Item Name" value={form.name} onChange={patch("name") as (v: string) => void} placeholder="e.g. White Linen Shirt" />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Brand" value={form.brand} onChange={patch("brand") as (v: string) => void} placeholder="Nike, Zara…" />
            <Field label="Color" value={form.color} onChange={patch("color") as (v: string) => void} placeholder="Navy Blue" />
          </div>

          <Field label="Size / Volume" value={form.size} onChange={patch("size") as (v: string) => void} placeholder="30ml, 50ml, Full Size…" />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <SelectField label="Season"   value={form.season}   onChange={patch("season") as (v: string) => void}   options={SEASON_OPTIONS} />
            <SelectField label="Occasion" value={form.occasion} onChange={patch("occasion") as (v: string) => void} options={OCCASION_OPTIONS} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Purchase Price" value={form.purchasePrice} onChange={patch("purchasePrice") as (v: string) => void} placeholder="$49.99" />
            <Field label="Date"  value={form.purchaseDate}  onChange={patch("purchaseDate") as (v: string) => void}  type="date" />
          </div>

          {/* Notes */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={labelStyle}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => patch("notes")(e.target.value)}
              placeholder="Anything worth remembering…"
              rows={3}
              style={{
                ...inputStyle,
                resize: "none",
                fontFamily: "inherit",
                lineHeight: 1.5,
              }}
            />
          </div>

          {/* Category + Times Worn */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <SelectField
              label="Shelf"
              value={form.category}
              onChange={patch("category") as (v: string) => void}
              options={categoryOptions}
            />
            <div style={{ display: "flex", flexDirection: "column", opacity: 0.5 }}>
              <label style={labelStyle}>Times Worn</label>
              <div style={{ ...inputStyle, color: C.brownMid, pointerEvents: "none" }}>
                {item.timesWorn ?? 0}
              </div>
            </div>
          </div>

        </div>

        {/* ── Footer ── */}
        <div style={{
          position: "sticky", bottom: 0, flexShrink: 0,
          padding: "12px 16px",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          background: C.bg,
          borderTop: `1.5px solid ${C.border}`,
          display: "flex", flexDirection: "column", gap: 8,
        }}>

          {/* Save (only when dirty) */}
          <AnimatePresence>
            {dirty && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                onClick={handleSave}
                disabled={updateItem.isPending}
                style={{
                  width: "100%", padding: "13px 0",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  borderRadius: 14,
                  border: `1.5px solid ${C.gold}`,
                  background: updateItem.isPending
                    ? C.goldLight
                    : `linear-gradient(to bottom, ${C.goldLight}, ${C.gold})`,
                  color: C.btnText,
                  fontSize: 13, fontWeight: 800,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  cursor: updateItem.isPending ? "not-allowed" : "pointer",
                  boxShadow: "0 3px 12px rgba(120,80,40,0.25)",
                }}
              >
                <Save size={14} />
                {updateItem.isPending ? "Saving…" : "Save Changes"}
              </motion.button>
            )}
          </AnimatePresence>

          {/* ── Context button ── */}
          {showAddToLookbook ? (
            <button
              onClick={() => setShowLookbookPicker(true)}
              style={{
                width: "100%", padding: "11px 0",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                borderRadius: 14,
                border: `1.5px solid ${C.gold}`,
                background: C.bgCard,
                color: C.gold,
                fontSize: 12, fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              🎄
              Lookbook
            </button>
          ) : showCleanUpButton ? (
            <button
              onClick={() => setShowCleanUp(true)}
              style={{
                width: "100%", padding: "11px 0",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                borderRadius: 14,
                border: `1.5px solid ${C.border}`,
                background: C.bgCard,
                color: C.brown,
                fontSize: 12, fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              <Sparkles size={13} />
              Clean Up Photo
            </button>
          ) : null}

          {/* Delete */}
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                width: "100%", padding: "11px 0",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                borderRadius: 14,
                border: `1.5px solid ${C.border}`,
                background: "transparent",
                color: C.brownFaint,
                fontSize: 12, fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              <Trash2 size={13} />
              Delete from Holidays Forever
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 14,
                  border: `1.5px solid ${C.border}`,
                  background: C.bgCard,
                  color: C.brown,
                  fontSize: 12, fontWeight: 700,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteItem.isPending}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 14,
                  border: "1.5px solid #c0392b",
                  background: "#e74c3c",
                  color: "#fff",
                  fontSize: 12, fontWeight: 700,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  cursor: deleteItem.isPending ? "not-allowed" : "pointer",
                  opacity: deleteItem.isPending ? 0.6 : 1,
                }}
              >
                {deleteItem.isPending ? "Removing…" : "Yes, Remove"}
              </button>
            </div>
          )}
        </div>

        {/* ── Clean Up Photo overlay ── */}
        {item.imageObjectPath && (
          <CleanUpPhotoOverlay
            open={showCleanUp}
            originalUrl={displayImageUrl ?? getImageUrl(item.imageObjectPath)!}
            onClose={() => setShowCleanUp(false)}
            onSave={handleCleanUpSave}
          />
        )}
      </motion.div>

      {/* ── Lookbook picker (renders above this sheet) ── */}
      {showLookbookPicker && (
        <LookbookPickerSheet
          item={item}
          onClose={() => setShowLookbookPicker(false)}
        />
      )}
    </>
  );
}
