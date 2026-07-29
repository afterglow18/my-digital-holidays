/**
 * CleanUpPhotoOverlay
 *
 * Full-screen slide-up overlay with a side-by-side Original | Cleaned ✨ layout
 * that's visible from the moment the overlay opens.
 *
 * - Original is selectable and saveable immediately — no waiting required.
 * - Cleaned card shows an inline spinner while bg removal runs.
 * - When cleaning finishes, Cleaned becomes tappable. If the user hasn't
 *   already chosen, the selection auto-switches to Cleaned.
 * - If bg removal fails, Cleaned card shows an error state; Original stays.
 *
 * Phases (plain conditionals — NO AnimatePresence):
 *   "compare"   — normal flow; cleanedUrl may be null (loading) or set
 *   "failed"    — bg removal errored; only Original available
 */

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Check, Loader2 } from "lucide-react";
import { removeBackground } from "@/lib/backgroundRemoval";

type Phase = "compare" | "failed";

interface Props {
  open:        boolean;
  originalUrl: string;               // stored data URL
  onClose:     () => void;
  onSave:      (chosenDataUrl: string) => void;
}

// Module-level generation counter prevents a slow removal from a previous open
// from clobbering a freshly opened overlay.
let globalGen = 0;

export function CleanUpPhotoOverlay({ open, originalUrl, onClose, onSave }: Props) {
  const [phase,      setPhase]      = useState<Phase>("compare");
  const [cleanedUrl, setCleanedUrl] = useState<string | null>(null);
  // Start on "original" so the user can save immediately without waiting.
  const [selected,   setSelected]   = useState<"original" | "cleaned">("original");
  // Track whether the user has explicitly tapped a card so we don't override
  // their choice when cleaning finishes.
  const userHasChosenRef = useRef(false);
  const myGenRef         = useRef(0);

  useEffect(() => {
    if (!open) return;

    const gen = ++globalGen;
    myGenRef.current = gen;
    // Reset to initial state each time the overlay opens.
    setPhase("compare");
    setCleanedUrl(null);
    setSelected("original");
    userHasChosenRef.current = false;

    removeBackground(originalUrl)
      .then((resultUrl) => {
        if (myGenRef.current !== gen) return;
        setCleanedUrl(resultUrl);
        // Only auto-select Cleaned if the user hasn't already tapped a card.
        if (!userHasChosenRef.current) setSelected("cleaned");
      })
      .catch((err) => {
        if (myGenRef.current !== gen) return;
        console.warn("CleanUpPhotoOverlay: bg removal failed", err);
        setPhase("failed");
      });
  }, [open, originalUrl]);

  if (!open) return null;

  const handleSelect = (choice: "original" | "cleaned") => {
    userHasChosenRef.current = true;
    setSelected(choice);
  };

  const handleSave = () => {
    const url = selected === "cleaned" && cleanedUrl ? cleanedUrl : originalUrl;
    onSave(url);
  };

  const bgProcessing = cleanedUrl === null && phase !== "failed";

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[80] flex flex-col max-w-md mx-auto bg-[#f9f4ee]"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 bg-white border-b-2 border-black flex-shrink-0"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
      >
        <h2 className="font-display font-bold text-xl uppercase tracking-tight">
          Choose Version
        </h2>
        <button
          onClick={onClose}
          className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                     bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                     active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="flex flex-col gap-4 p-5">

          {/* Status label */}
          <p className="text-center font-bold text-[11px] uppercase tracking-widest text-black/40">
            {phase === "failed"
              ? "Background removal unavailable"
              : bgProcessing
              ? "Removing background… tap Original to skip"
              : "Tap to choose your version"}
          </p>

          {/* Side-by-side cards — always visible */}
          <div className="flex gap-3">

            {/* Original — always ready */}
            <PhotoCard
              label="Original"
              imageUrl={originalUrl}
              isSelected={selected === "original"}
              onSelect={() => handleSelect("original")}
              checkerboard={false}
              loading={false}
              failed={false}
            />

            {/* Cleaned — loading spinner until ready */}
            <PhotoCard
              label="Cleaned ✨"
              imageUrl={cleanedUrl ?? ""}
              isSelected={selected === "cleaned" && !!cleanedUrl}
              onSelect={() => cleanedUrl && handleSelect("cleaned")}
              checkerboard
              loading={bgProcessing}
              failed={phase === "failed"}
            />

          </div>

          {/* On-device note */}
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border-2 border-black/15 bg-white/60">
            <span className="text-base leading-none mt-0.5">✨</span>
            <p className="text-xs text-black/50 leading-snug font-medium">
              Runs entirely on your device — no photos leave your phone.
            </p>
          </div>

          {/* CTA */}
          <button
            onClick={handleSave}
            disabled={selected === "cleaned" && !cleanedUrl}
            className="w-full py-3.5 border-[3px] border-black rounded-xl bg-primary
                       font-display font-bold text-sm uppercase tracking-tight text-black
                       shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
                       active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {selected === "cleaned" && cleanedUrl
              ? "Save Cleaned Version"
              : selected === "cleaned" && bgProcessing
              ? "Waiting for Cleaned…"
              : "Save Original"}
          </button>

        </div>
      </div>
    </motion.div>
  );
}

// ── PhotoCard ─────────────────────────────────────────────────────────────────

function PhotoCard({
  label,
  imageUrl,
  isSelected,
  onSelect,
  checkerboard,
  loading,
  failed,
}: {
  label:        string;
  imageUrl:     string;
  isSelected:   boolean;
  onSelect:     () => void;
  checkerboard: boolean;
  loading:      boolean;
  failed:       boolean;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={loading || failed}
      className="flex-1 rounded-2xl overflow-hidden border-[3px] transition-all text-left"
      style={{
        borderColor: isSelected ? "#000" : "rgba(0,0,0,0.18)",
        boxShadow:   isSelected ? "4px 4px 0px 0px rgba(0,0,0,1)" : "none",
        outline:     isSelected ? "3px solid #000" : "none",
        outlineOffset: "0",
        padding: 0,
        background: "none",
        opacity: (loading || failed) ? 0.65 : 1,
      }}
    >
      {/* Image area */}
      <div
        style={{
          background: checkerboard
            ? "repeating-conic-gradient(#d1d5db 0% 25%, white 0% 50%) 0 0 / 12px 12px"
            : "#000",
          minHeight: 160,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <Loader2 className="w-8 h-8 animate-spin opacity-40" />
            <p className="text-[10px] font-bold uppercase text-black/40">Processing</p>
          </div>
        ) : failed ? (
          <p className="text-[10px] font-bold uppercase text-black/40 text-center px-3 py-8">
            Unavailable
          </p>
        ) : (
          <>
            <img
              src={imageUrl}
              alt={label}
              style={{ width: "100%", objectFit: "contain", maxHeight: 180, display: "block" }}
            />
            {isSelected && (
              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black
                              flex items-center justify-center border-2 border-white">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Label bar */}
      <p
        className="text-center font-display font-bold text-[11px] uppercase tracking-wide py-2 border-t-[3px] bg-white"
        style={{ borderColor: isSelected ? "#000" : "rgba(0,0,0,0.18)" }}
      >
        {label}
      </p>
    </button>
  );
}
