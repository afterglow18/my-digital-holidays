/**
 * CleanUpPhotoOverlay
 *
 * Full-screen slide-up overlay that lets the user compare the original photo
 * against a background-removed version, then pick which one to keep.
 *
 * Phases (plain conditionals — NO AnimatePresence between them):
 *   "processing"  — bg removal is running; spinner + single original preview
 *   "compare"     — both cards rendered; user taps to select, then confirms
 *   "failed"      — removal errored; only original available, single CTA
 *
 * The overlay owns no DB logic. It calls onSave(chosenDataUrl) and the
 * parent updates state optimistically before firing the mutation.
 */

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Check, Loader2 } from "lucide-react";
import { removeBackground } from "@/lib/backgroundRemoval";

type Phase = "processing" | "compare" | "failed";

interface Props {
  open:        boolean;
  originalUrl: string;               // stored data URL
  onClose:     () => void;
  onSave:      (chosenDataUrl: string) => void;
}

// Generation counter lives outside — prevents a slow run from clobbering a fresh open.
let globalGen = 0;

export function CleanUpPhotoOverlay({ open, originalUrl, onClose, onSave }: Props) {
  const [phase,      setPhase]      = useState<Phase>("processing");
  const [cleanedUrl, setCleanedUrl] = useState<string | null>(null);
  const [selected,   setSelected]   = useState<"original" | "cleaned">("cleaned");
  const myGenRef = useRef(0);

  // Start removal whenever the overlay opens (or originalUrl changes while open)
  useEffect(() => {
    if (!open) return;

    const gen = ++globalGen;
    myGenRef.current = gen;
    setPhase("processing");
    setCleanedUrl(null);
    setSelected("cleaned");

    removeBackground(originalUrl)
      .then((resultUrl) => {
        if (myGenRef.current !== gen) return;
        setCleanedUrl(resultUrl);
        setPhase("compare");
      })
      .catch((err) => {
        if (myGenRef.current !== gen) return;
        console.warn("CleanUpPhotoOverlay: bg removal failed", err);
        setPhase("failed");
        setSelected("original");
      });
  }, [open, originalUrl]);

  if (!open) return null;

  const handleSave = () => {
    const url = selected === "cleaned" && cleanedUrl ? cleanedUrl : originalUrl;
    onSave(url);
  };

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
          {phase === "processing" ? "Removing Background…" : "Choose Version"}
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

      {/* Body — plain conditionals, no AnimatePresence between phases */}
      <div className="flex-1 flex flex-col overflow-y-auto">

        {/* ── PROCESSING ── */}
        {phase === "processing" && (
          <div className="flex flex-col items-center gap-6 p-5">
            {/* Hint label */}
            <p className="text-[11px] font-bold uppercase tracking-widest text-black/40 text-center">
              Running on-device — this may take a moment
            </p>

            {/* Original card with spinner overlay */}
            <div className="w-full relative rounded-2xl overflow-hidden border-[3px] border-black
                            shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              {/* Checkerboard bg */}
              <div
                style={{
                  background: "repeating-conic-gradient(#d1d5db 0% 25%, white 0% 50%) 0 0 / 14px 14px",
                  minHeight: 240,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                <img
                  src={originalUrl}
                  alt="Original"
                  style={{ width: "100%", objectFit: "contain", maxHeight: 280, display: "block" }}
                />
                {/* Spinner scrim */}
                <div className="absolute inset-0 flex items-center justify-center"
                     style={{ background: "rgba(249,244,238,0.55)" }}>
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 border-4 border-black rounded-2xl bg-white
                                    flex items-center justify-center
                                    shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <Loader2 className="w-8 h-8 animate-spin" strokeWidth={1.5} />
                    </div>
                    <p className="font-display font-bold text-sm uppercase tracking-tight">Processing…</p>
                  </div>
                </div>
              </div>
              <p className="text-center font-display font-bold text-[11px] uppercase tracking-wide
                             py-2 border-t-[3px] border-black bg-white">
                Original
              </p>
            </div>

            {/* Background removal model notice */}
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border-2 border-black/15 bg-white/60 w-full">
              <span className="text-base leading-none mt-0.5">✨</span>
              <p className="text-xs text-black/50 leading-snug font-medium">
                First use downloads a ~15 MB AI model. It runs entirely on your device — no photos leave your phone.
              </p>
            </div>
          </div>
        )}

        {/* ── COMPARE ── */}
        {phase === "compare" && (
          <div className="flex flex-col gap-4 p-5">
            <p className="text-center font-bold text-[11px] uppercase tracking-widest text-black/40">
              Tap to choose your version
            </p>

            {/* Side-by-side cards */}
            <div className="flex gap-3">
              {/* Original */}
              <PhotoCard
                label="Original"
                imageUrl={originalUrl}
                isSelected={selected === "original"}
                onSelect={() => setSelected("original")}
                checkerboard={false}
              />
              {/* Cleaned */}
              <PhotoCard
                label="Cleaned ✨"
                imageUrl={cleanedUrl!}
                isSelected={selected === "cleaned"}
                onSelect={() => setSelected("cleaned")}
                checkerboard
              />
            </div>

            {/* CTA */}
            <button
              onClick={handleSave}
              className="w-full py-3.5 border-[3px] border-black rounded-xl bg-primary
                         font-display font-bold text-sm uppercase tracking-tight text-black
                         shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
                         active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
            >
              {selected === "cleaned" ? "Save Cleaned Version" : "Save Original"}
            </button>
          </div>
        )}

        {/* ── FAILED ── */}
        {phase === "failed" && (
          <div className="flex flex-col items-center gap-6 p-5">
            <div className="w-full rounded-2xl overflow-hidden border-[3px] border-black
                            shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div
                style={{
                  background: "repeating-conic-gradient(#d1d5db 0% 25%, white 0% 50%) 0 0 / 14px 14px",
                  minHeight: 220,
                }}
              >
                <img
                  src={originalUrl}
                  alt="Original"
                  style={{ width: "100%", objectFit: "contain", maxHeight: 260, display: "block" }}
                />
              </div>
              <p className="text-center font-display font-bold text-[11px] uppercase tracking-wide
                             py-2 border-t-[3px] border-black bg-white">
                Original
              </p>
            </div>

            <p className="text-sm text-amber-700 bg-amber-50 border-2 border-amber-200 rounded-xl
                           px-4 py-3 text-center font-medium w-full">
              Background removal wasn't available — your original photo is unchanged.
            </p>

            <button
              onClick={onClose}
              className="w-full py-3.5 border-[3px] border-black rounded-xl bg-white
                         font-display font-bold text-sm uppercase tracking-tight
                         shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
                         active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── PhotoCard sub-component ────────────────────────────────────────────────────

function PhotoCard({
  label,
  imageUrl,
  isSelected,
  onSelect,
  checkerboard,
}: {
  label:        string;
  imageUrl:     string;
  isSelected:   boolean;
  onSelect:     () => void;
  checkerboard: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className="flex-1 rounded-2xl overflow-hidden border-[3px] transition-all text-left"
      style={{
        borderColor: isSelected ? "var(--color-primary, #f9a8d4)" : "rgba(0,0,0,0.18)",
        boxShadow:   isSelected ? "4px 4px 0px 0px rgba(0,0,0,1)" : "none",
        padding: 0,
        background: "none",
        outline: isSelected ? "3px solid #000" : "none",
        outlineOffset: isSelected ? "0px" : "0",
      }}
    >
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
      </div>
      <p
        className="text-center font-display font-bold text-[11px] uppercase tracking-wide py-2 border-t-[3px] bg-white"
        style={{ borderColor: isSelected ? "rgba(0,0,0,1)" : "rgba(0,0,0,0.18)" }}
      >
        {label}
      </p>
    </button>
  );
}
