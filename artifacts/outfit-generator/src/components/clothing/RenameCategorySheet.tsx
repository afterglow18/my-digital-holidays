/**
 * RenameCategorySheet — bottom-sheet for renaming a shelf category label.
 *
 * Opens from the generate page when the user taps the ✏️ icon next to a shelf
 * label. The new name is persisted to IndexedDB settings and reflected on both
 * the generate and wardrobe pages immediately.
 */
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";

interface Props {
  /** The internal DB key for this row, e.g. "outfits" */
  rowKey:       string;
  /** Current display label (already custom or default) */
  currentLabel: string;
  /** Called with the trimmed new label when the user saves */
  onSave:       (newLabel: string) => void;
  onClose:      () => void;
}

export function RenameCategorySheet({ rowKey, currentLabel, onSave, onClose }: Props) {
  const [value, setValue] = useState(currentLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input and select all text when the sheet opens
  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 250);
    return () => clearTimeout(t);
  }, []);

  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSave(trimmed);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onClose();
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 90,
        }}
      />

      {/* Sheet */}
      <motion.div
        key="sheet"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 91,
          background: "#FFF8F0",
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
          padding: "20px 20px 36px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{
            fontFamily: "var(--font-display, serif)",
            fontWeight: 800,
            fontSize: 15,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#3A2210",
          }}>
            Rename Shelf
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: "#3A2210",
              opacity: 0.6,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Label */}
        <p style={{ margin: 0, fontSize: 12, color: "#8B6A50", letterSpacing: "0.04em" }}>
          This label appears on both the Matchmaker and Wardrobe shelves.
        </p>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={24}
          placeholder={currentLabel}
          style={{
            width: "100%",
            border: "2.5px solid #3A2210",
            borderRadius: 12,
            padding: "12px 14px",
            fontSize: 16,
            fontWeight: 700,
            fontFamily: "var(--font-display, serif)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            background: "#fff",
            color: "#3A2210",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!value.trim()}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            padding: "14px 0",
            borderRadius: 14,
            border: "none",
            background: value.trim() ? "#3A2210" : "#C4A882",
            color: "#FFF8F0",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: value.trim() ? "pointer" : "not-allowed",
            transition: "background 0.15s",
          }}
        >
          <Check size={16} />
          Save
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
