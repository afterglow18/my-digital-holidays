/**
 * QuickAddSheet
 *
 * Upload flow:
 *   pick → encoding → preview (Original | Cleaned ✨) → uploading → close
 *
 * Rules from the spec that must be preserved:
 *   • No AnimatePresence around phase blocks — creates blank-screen gaps on exit.
 *     The outer sheet can still use motion.div to slide in.
 *   • encodeForUpload is defined OUTSIDE the component.
 *   • bgGenRef generation counter prevents a slow first photo from clobbering a fast second.
 *   • setBgProcessing(false) MUST fire in handleClose — close mid-removal otherwise
 *     leaves Save permanently disabled next open.
 *   • model: "isnet_fp16" — "medium" / "small" are not valid in v1.7.
 */

import React, { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Check, RotateCcw } from "lucide-react";
import {
  useCreateClothingItem,
  getListClothingQueryKey,
  getWardrobeStatsQueryKey,
} from "@/hooks/useLocalDB";
import { useQueryClient } from "@tanstack/react-query";
import {
  removeBackground,
  blobToDataUrl,
  dataUrlToBlob,
} from "@/lib/backgroundRemoval";

// ── Types ──────────────────────────────────────────────────────────────────────

type Category = "outfits" | "beauty" | "toiletries" | "essentials";

const CATEGORY_LABELS: Record<Category, string> = {
  outfits:    "Outfits",
  beauty:     "Beauty",
  toiletries: "Toiletries",
  essentials: "Essentials",
};

type Phase = "pick" | "encoding" | "preview" | "uploading";

// ── encodeForUpload (outside component — spec requirement) ─────────────────────

async function encodeForUpload(input: File | Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(input);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX   = 2048;
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w     = Math.round(img.naturalWidth  * scale);
      const h     = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (b) => (b && b.size > 1000 ? resolve(b) : reject(new Error("blank image"))),
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("failed to load image"));
    };
    img.src = objectUrl;
  });
}

// ── Static copy ────────────────────────────────────────────────────────────────

const PHOTO_TIPS = [
  "Photograph individual products or bundle multiple items together.",
  "Lay everything flat on a plain background.",
  "Take the photo from directly above.",
  "Keep all items fully in frame.",
] as const;

const CATEGORY_EXAMPLES: Record<string, { emoji: string; items: string[] }> = {
  outfits:    { emoji: "👗", items: ["Tops", "Bottoms", "Shoes", "Swim", "Undergarments", "Dresses", "Accessories"] },
  beauty:     { emoji: "💄", items: ["Makeup", "Skincare", "Hair", "Jewelry", "Nail Polish"] },
  toiletries: { emoji: "🪥", items: ["Shower", "Dental", "Medicine", "Feminine Care", "First Aid"] },
  essentials: { emoji: "🧳", items: ["Travel Docs", "Tech", "Snacks", "Books", "Accessories"] },
};

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  category:      Category;
  existingCount: number;
  onCreated?:    (item: import("@/lib/db").ClothingItem) => void;
}

export function QuickAddSheet({ open, onOpenChange, category, existingCount, onCreated }: Props) {
  const [phase,        setPhase]        = useState<Phase>("pick");
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);
  const [originalBlob, setOriginalBlob] = useState<Blob | null>(null);
  const [originalUrl,  setOriginalUrl]  = useState<string | null>(null);
  const [cleanedBlob,  setCleanedBlob]  = useState<Blob | null>(null);
  const [cleanedUrl,   setCleanedUrl]   = useState<string | null>(null);
  const [bgProcessing, setBgProcessing] = useState(false);
  const [bgFailed,     setBgFailed]     = useState(false);
  const [selected,     setSelected]     = useState<"original" | "cleaned">("original");

  // Generation counter — prevents a slow first photo from clobbering a fast second.
  const bgGenRef = useRef(0);

  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const createItem  = useCreateClothingItem();
  const queryClient = useQueryClient();

  // ── handleClose ────────────────────────────────────────────────────────────
  // MUST reset bgProcessing here — close can happen mid-removal, leaving
  // Save disabled with no explanation on next open.
  const handleClose = useCallback(() => {
    bgGenRef.current += 1;
    setBgProcessing(false);
    setPhase("pick");
    setErrorMsg(null);
    setOriginalBlob(null);
    setOriginalUrl(null);
    setCleanedBlob(null);
    setCleanedUrl(null);
    setBgFailed(false);
    setSelected("original");
    onOpenChange(false);
  }, [onOpenChange]);

  // ── handleFile ─────────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File | Blob) => {
    setErrorMsg(null);
    // Switch to "encoding" BEFORE any async work so user sees a spinner
    // immediately instead of the pick screen hanging for 1-3 s.
    const myGen = ++bgGenRef.current;
    setOriginalBlob(null);
    setOriginalUrl(null);
    setCleanedBlob(null);
    setCleanedUrl(null);
    setBgFailed(false);
    setBgProcessing(false);
    setSelected("original");
    setPhase("encoding");

    // Resize to JPEG ≤ 2048px
    let jpeg: Blob;
    try {
      jpeg = await encodeForUpload(file);
    } catch (err) {
      if (bgGenRef.current !== myGen) return;
      setErrorMsg(`Could not read the photo: ${err instanceof Error ? err.message : String(err)}`);
      setPhase("pick");
      return;
    }
    if (bgGenRef.current !== myGen) return;

    // Show original, switch to comparison screen
    setOriginalBlob(jpeg);
    setOriginalUrl(URL.createObjectURL(jpeg));
    setPhase("preview");

    // Background removal — generation guard discards stale results
    setBgProcessing(true);
    try {
      const dataUrl    = await blobToDataUrl(jpeg);
      if (bgGenRef.current !== myGen) return;
      const resultUrl  = await removeBackground(dataUrl);
      if (bgGenRef.current !== myGen) return;
      const resultBlob    = await dataUrlToBlob(resultUrl);
      const resultObjUrl  = URL.createObjectURL(resultBlob);
      if (bgGenRef.current !== myGen) { URL.revokeObjectURL(resultObjUrl); return; }
      setCleanedBlob(resultBlob);
      setCleanedUrl(resultObjUrl);
      setSelected("cleaned");
    } catch (err) {
      if (bgGenRef.current !== myGen) return;
      console.warn("Background removal failed:", err);
      setBgFailed(true);
    } finally {
      if (bgGenRef.current === myGen) setBgProcessing(false);
    }
  }, []);

  // ── handleSave ─────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const blob = selected === "cleaned" && cleanedBlob ? cleanedBlob : originalBlob;
    if (!blob) return;
    setPhase("uploading");
    try {
      const dataUrl  = await blobToDataUrl(blob);
      const label    = CATEGORY_LABELS[category];
      const autoName = existingCount === 0 ? label : `${label} ${existingCount + 1}`;
      await new Promise<void>((resolve, reject) => {
        createItem.mutate(
          { data: { name: autoName, category, imageObjectPath: dataUrl } },
          {
            onSuccess: (createdItem) => {
              queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
              queryClient.invalidateQueries({ queryKey: getWardrobeStatsQueryKey() });
              if (onCreated) onCreated(createdItem);
              resolve();
            },
            onError: reject,
          },
        );
      });
      handleClose();
    } catch (err) {
      setErrorMsg(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
      setPhase("preview");
    }
  }, [selected, cleanedBlob, originalBlob, category, existingCount, createItem, queryClient, onCreated, handleClose]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  if (!open) return null;

  const label = CATEGORY_LABELS[category];

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[70] flex flex-col max-w-md mx-auto bg-[#f9f4ee]"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 bg-white border-b-2 border-black flex-shrink-0"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
      >
        <h2 className="font-display font-bold text-xl uppercase tracking-tight">
          {phase === "preview" ? "Choose Version" : `Add ${label}`}
        </h2>
        {(phase === "pick" || phase === "preview") && (
          <button
            onClick={handleClose}
            className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                       bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                       active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Body — NO AnimatePresence here (creates blank-screen gaps between phases) */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>

        {/* ── PICK ── */}
        {phase === "pick" && (
          <div className="flex flex-col p-5 gap-5">
            {errorMsg && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                {errorMsg}
              </p>
            )}

            {/* Two big action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-3 py-8
                           border-4 border-black rounded-2xl bg-primary
                           shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
              >
                <span className="text-4xl leading-none">📷</span>
                <span className="font-display font-bold text-base uppercase tracking-tight text-center leading-tight">
                  Take<br />Photo
                </span>
              </button>

              <button
                onClick={() => galleryInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-3 py-8
                           border-4 border-black rounded-2xl bg-white
                           shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
              >
                <span className="text-4xl leading-none">🖼️</span>
                <span className="font-display font-bold text-base uppercase tracking-tight text-center leading-tight">
                  Upload<br />Photo
                </span>
              </button>
            </div>

            {/* Background removal notice */}
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border-2 border-black/15 bg-white/60">
              <span className="text-base leading-none mt-0.5">✨</span>
              <p className="text-xs text-black/50 leading-snug font-medium">
                Background removal runs on-device after you pick a photo. First use downloads a ~15 MB model.
              </p>
            </div>

            {/* What to add */}
            {CATEGORY_EXAMPLES[category] && (
              <div className="border-2 border-black rounded-2xl bg-white p-4
                              shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <p className="font-display font-bold text-sm uppercase tracking-tight mb-2 flex items-center gap-2">
                  <span>{CATEGORY_EXAMPLES[category].emoji}</span> WHAT TO ADD
                </p>
                <p className="text-sm text-black/70 leading-snug">
                  {CATEGORY_EXAMPLES[category].items.join(", ")}
                </p>
              </div>
            )}

            {/* Photo tips */}
            <div className="border-2 border-black rounded-2xl bg-white p-4
                            shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <p className="font-display font-bold text-sm uppercase tracking-tight mb-3 flex items-center gap-2">
                <span>📸</span> PHOTO TIPS
              </p>
              <ul className="flex flex-col gap-2">
                {PHOTO_TIPS.map((tip) => (
                  <li key={tip} className="flex items-start gap-2 text-sm text-black/70 leading-snug">
                    <span className="mt-0.5 w-4 h-4 border-2 border-black rounded-sm bg-primary
                                     flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ── ENCODING — full-screen spinner, shown immediately after photo is picked ── */}
        {phase === "encoding" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6">
            <div className="w-28 h-28 border-4 border-black rounded-3xl bg-white
                            flex items-center justify-center
                            shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <Loader2 className="w-12 h-12 animate-spin" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-2xl uppercase tracking-tight">Processing…</p>
              <p className="text-sm text-muted-foreground mt-1">Getting your photo ready.</p>
            </div>
          </div>
        )}

        {/* ── PREVIEW — side-by-side Original | Cleaned ✨ comparison ── */}
        {phase === "preview" && (
          <div className="flex flex-col gap-4 p-5">
            {errorMsg && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                {errorMsg}
              </p>
            )}

            {/* Instruction label */}
            <p className="text-center font-bold text-[11px] uppercase tracking-widest text-black/40">
              {bgProcessing
                ? "Removing background… This will take a moment."
                : bgFailed
                ? "Background removal unavailable — using original"
                : "Tap to choose your version"}
            </p>

            {/* Side-by-side cards */}
            <div className="flex gap-3">
              {/* Original card */}
              <button
                onClick={() => setSelected("original")}
                className="flex-1 rounded-2xl overflow-hidden border-[3px] transition-all"
                style={{
                  borderColor: selected === "original" ? "#000" : "rgba(0,0,0,0.18)",
                  boxShadow: selected === "original" ? "4px 4px 0px 0px rgba(0,0,0,1)" : "none",
                  background: "none",
                  padding: 0,
                }}
              >
                <div className="relative bg-black" style={{ minHeight: 180 }}>
                  <img
                    src={originalUrl!}
                    alt="Original"
                    style={{ width: "100%", objectFit: "contain", maxHeight: 180, display: "block" }}
                  />
                  {selected === "original" && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black
                                    flex items-center justify-center border-2 border-white">
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <p className="text-center font-display font-bold text-[11px] uppercase tracking-wide
                               py-2 border-t-[3px]"
                   style={{ borderColor: selected === "original" ? "#000" : "rgba(0,0,0,0.18)" }}>
                  Original
                </p>
              </button>

              {/* Cleaned card */}
              <button
                onClick={() => cleanedUrl && setSelected("cleaned")}
                disabled={!cleanedUrl}
                className="flex-1 rounded-2xl overflow-hidden border-[3px] transition-all"
                style={{
                  borderColor: selected === "cleaned" && cleanedUrl ? "#000" : "rgba(0,0,0,0.18)",
                  boxShadow: selected === "cleaned" && cleanedUrl ? "4px 4px 0px 0px rgba(0,0,0,1)" : "none",
                  background: "none",
                  padding: 0,
                  opacity: cleanedUrl ? 1 : 0.65,
                }}
              >
                {/* Checkerboard reveals transparency */}
                <div
                  style={{
                    background: "repeating-conic-gradient(#d1d5db 0% 25%, white 0% 50%) 0 0 / 12px 12px",
                    minHeight: 180,
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {cleanedUrl ? (
                    <>
                      <img
                        src={cleanedUrl}
                        alt="Background removed"
                        style={{ width: "100%", objectFit: "contain", maxHeight: 180, display: "block" }}
                      />
                      {selected === "cleaned" && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black
                                        flex items-center justify-center border-2 border-white">
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </div>
                      )}
                    </>
                  ) : bgFailed ? (
                    <p className="text-[11px] font-bold uppercase text-black/40 text-center px-3">
                      Could not remove background
                    </p>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin opacity-40" />
                      <p className="text-[11px] font-bold uppercase text-black/40">Processing</p>
                    </div>
                  )}
                </div>
                <p className="text-center font-display font-bold text-[11px] uppercase tracking-wide
                               py-2 border-t-[3px]"
                   style={{ borderColor: selected === "cleaned" && cleanedUrl ? "#000" : "rgba(0,0,0,0.18)" }}>
                  Cleaned ✨
                </p>
              </button>
            </div>

            {/* Action row */}
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => setPhase("pick")}
                className="flex items-center justify-center gap-1.5 px-5 py-3
                           border-[3px] border-black rounded-xl bg-white font-display font-bold
                           text-sm uppercase tracking-tight
                           shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Retake
              </button>

              <button
                onClick={handleSave}
                disabled={selected === "cleaned" && !cleanedUrl}
                className="flex-1 py-3 border-[3px] border-black rounded-xl bg-primary font-display font-bold
                           text-sm uppercase tracking-tight text-black
                           shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
                           disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                style={{ boxShadow: (selected === "cleaned" && !cleanedUrl) ? "none" : "3px 3px 0px 0px rgba(0,0,0,1)" }}
              >
                {selected === "cleaned" && !cleanedUrl
                  ? "Processing…"
                  : selected === "cleaned"
                  ? "✓ Save Cleaned Version"
                  : "✓ Save to Wardrobe"}
              </button>
            </div>
          </div>
        )}

        {/* ── UPLOADING ── */}
        {phase === "uploading" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6">
            <div className="w-28 h-28 border-4 border-black rounded-3xl bg-white
                            flex items-center justify-center
                            shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <Loader2 className="w-12 h-12 animate-spin" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-2xl uppercase tracking-tight">Saving…</p>
              <p className="text-sm text-muted-foreground mt-1">Adding to your wardrobe.</p>
            </div>
          </div>
        )}

      </div>

      {/* Hidden file inputs — single file each (one at a time for preview flow) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />
    </motion.div>
  );
}
