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
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
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
  outfits:    "Decor",
  beauty:     "Gifts",
  toiletries: "Treats",
  essentials: "Storage",
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
  "Lay everything flat on a plain background.",
  "Take the photo from directly above.",
  "Keep all items fully in frame.",
] as const;

const CATEGORY_EXAMPLES: Record<string, { emoji: string; items: string[] }> = {
  outfits:    { emoji: "🎄", items: ["Fairy Lights", "Ornaments", "Wreaths", "Tree Decorations", "Candles", "Garlands", "Stockings"] },
  beauty:     { emoji: "🎁", items: ["Wrapped Presents", "Gift Bags", "Ribbons", "Cards", "Tags", "Stocking Fillers"] },
  toiletries: { emoji: "🍫", items: ["Christmas Cake", "Cookies", "Chocolates", "Sweets", "Mulled Wine", "Festive Snacks"] },
  essentials: { emoji: "📦", items: ["Wrapping Paper", "Tape", "Scissors", "Boxes", "Tissue Paper", "Gift Bags"] },
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
  const [batchTotal,   setBatchTotal]   = useState(0);
  const [batchDone,    setBatchDone]    = useState(0);

  // Generation counter — prevents a slow first photo from clobbering a fast second.
  const bgGenRef = useRef(0);
  // Batch queue — remaining webPaths to process after the current photo.
  const photoQueueRef  = useRef<string[]>([]);
  // How many items have been saved so far (used for auto-naming, avoids stale closure).
  const savedCountRef  = useRef(0);

  const createItem  = useCreateClothingItem();
  const queryClient = useQueryClient();

  // ── handleClose ────────────────────────────────────────────────────────────
  // MUST reset bgProcessing here — close can happen mid-removal, leaving
  // Save disabled with no explanation on next open.
  const handleClose = useCallback(() => {
    bgGenRef.current += 1;
    photoQueueRef.current = [];
    savedCountRef.current = 0;
    setBgProcessing(false);
    setPhase("pick");
    setErrorMsg(null);
    setOriginalBlob(null);
    setOriginalUrl(null);
    setCleanedBlob(null);
    setCleanedUrl(null);
    setBgFailed(false);
    setSelected("original");
    setBatchTotal(0);
    setBatchDone(0);
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

  // ── saveWithVersion ────────────────────────────────────────────────────────
  // Saves the chosen version. In batch mode, advances to the next queued photo
  // instead of closing after save.
  const saveWithVersion = useCallback(async (version: "original" | "cleaned") => {
    const blob = version === "cleaned" && cleanedBlob ? cleanedBlob : originalBlob;
    if (!blob) return;
    setPhase("uploading");
    try {
      const dataUrl  = await blobToDataUrl(blob);
      const label    = CATEGORY_LABELS[category];
      const n        = existingCount + savedCountRef.current;
      const autoName = n === 0 ? label : `${label} ${n + 1}`;
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

      savedCountRef.current += 1;
      const nextWebPath = photoQueueRef.current.shift();
      if (nextWebPath) {
        // Advance to next photo in batch — go back through encode → preview flow
        setBatchDone(savedCountRef.current);
        try {
          const nextBlob = await fetch(nextWebPath).then(r => r.blob());
          handleFile(nextBlob);
        } catch {
          // Skip unreadable photo and close
          handleClose();
        }
      } else {
        handleClose();
      }
    } catch (err) {
      setErrorMsg(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
      setPhase("preview");
    }
  }, [cleanedBlob, originalBlob, category, existingCount, createItem, queryClient, onCreated, handleClose, handleFile]);

  // ── Native camera / gallery via Capacitor plugin ───────────────────────────
  // Using @capacitor/camera instead of a hidden file input avoids the
  // WKWebView crash that occurs when forcing the camera through the browser's
  // file-upload mechanism on iOS.
  // Shared photo picker — uses CameraSource.Prompt which shows the native iOS
  // action sheet (Take Photo / Choose from Library / Browse). This is more
  // stable than CameraSource.Camera which forces the camera directly and can
  // crash in WKWebView environments.
  const openPhotoPicker = useCallback(async (preferCamera: boolean) => {
    try {
      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: preferCamera ? CameraSource.Prompt : CameraSource.Photos,
        correctOrientation: true,
        saveToGallery: false,
      });
      if (!photo.dataUrl) return;
      const blob = await fetch(photo.dataUrl).then(r => r.blob());
      handleFile(blob);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes("cancel") && !msg.toLowerCase().includes("user cancelled")) {
        setErrorMsg("Could not open camera. Please try again.");
      }
    }
  }, [handleFile]);

  const handleCameraCapture = useCallback(() => openPhotoPicker(true), [openPhotoPicker]);

  // Gallery — multi-select via Camera.pickImages().
  // Each photo gets its own compare screen (Original vs Cleaned).
  // Remaining photos are queued in photoQueueRef and advanced after each save.
  const handleGalleryCapture = useCallback(async () => {
    try {
      const { photos } = await Camera.pickImages({ quality: 85, limit: 0 });
      if (!photos.length) return;

      if (photos.length > 1) {
        // Store the rest of the queue; saveWithVersion will advance through them
        photoQueueRef.current = photos.slice(1).map(p => p.webPath!);
        savedCountRef.current = 0;
        setBatchTotal(photos.length);
        setBatchDone(0);
      }

      // Process first photo through the normal encode → preview flow
      const blob = await fetch(photos[0].webPath!).then(r => r.blob());
      handleFile(blob);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes("cancel") && !msg.toLowerCase().includes("user cancelled")) {
        setErrorMsg("Could not open photo library. Please try again.");
      }
    }
  }, [handleFile]);

  if (!open) return null;

  const label = CATEGORY_LABELS[category];

  // Palette tokens (matches ItemDetailsSheet / WardrobePickerSheet)
  const C = {
    bg: "#FFF8F0", bgCard: "#FEFAF4", brown: "#3A2210",
    brownFaint: "rgba(58,34,16,0.72)", border: "rgba(180,140,90,0.40)",
    gold: "#8B1A1A", goldLight: "#B52020", btnText: "#FFF5EE",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto", background: C.bg }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "max(0.75rem, env(safe-area-inset-top)) 16px 12px",
        background: C.bg, borderBottom: `1.5px solid ${C.border}`, flexShrink: 0,
      }}>
        <h2 style={{
          fontFamily: "var(--font-display, serif)", fontWeight: 800, fontSize: 18,
          letterSpacing: "0.04em", textTransform: "uppercase", color: C.brown, margin: 0,
        }}>
          {phase === "preview"
            ? batchTotal > 1
              ? `Photo ${batchDone + 1} of ${batchTotal}`
              : "Choose Version"
            : `Add ${label}`}
        </h2>
        {(phase === "pick" || phase === "preview") && (
          <button
            onClick={handleClose}
            style={{
              width: 36, height: 36, borderRadius: "50%",
              border: `1.5px solid ${C.border}`, background: C.bgCard,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            <X size={16} color={C.brown} />
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
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={handleCameraCapture}
                style={{
                  flex: 1, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 10, padding: "28px 0",
                  borderRadius: 18, border: `2px solid ${C.gold}`,
                  background: `linear-gradient(to bottom, ${C.goldLight}, ${C.gold})`,
                  cursor: "pointer", boxShadow: "0 4px 16px rgba(100,10,10,0.25)",
                }}
              >
                <span style={{ fontSize: 36, lineHeight: 1 }}>📷</span>
                <span style={{
                  fontFamily: "var(--font-display, serif)", fontWeight: 800,
                  fontSize: 15, letterSpacing: "0.04em", textTransform: "uppercase",
                  color: C.btnText, textAlign: "center", lineHeight: 1.2,
                }}>
                  Take<br />Photo
                </span>
              </button>

              <button
                onClick={handleGalleryCapture}
                style={{
                  flex: 1, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 10, padding: "28px 0",
                  borderRadius: 18, border: `1.5px solid ${C.border}`,
                  background: C.bgCard, cursor: "pointer",
                  boxShadow: "0 2px 10px rgba(120,80,40,0.10)",
                }}
              >
                <span style={{ fontSize: 36, lineHeight: 1 }}>🖼️</span>
                <span style={{
                  fontFamily: "var(--font-display, serif)", fontWeight: 800,
                  fontSize: 15, letterSpacing: "0.04em", textTransform: "uppercase",
                  color: C.brown, textAlign: "center", lineHeight: 1.2,
                }}>
                  Upload<br />Photo
                </span>
              </button>
            </div>

            {/* Background removal notice */}
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              padding: "10px 12px", borderRadius: 12,
              border: `1px solid ${C.border}`, background: C.bgCard,
            }}>
              <span style={{ fontSize: 15, lineHeight: 1, marginTop: 1 }}>✨</span>
              <p style={{ fontSize: 12, color: C.brownFaint, lineHeight: 1.5, fontWeight: 500, margin: 0 }}>
                Background removal runs on-device after you pick a photo.
              </p>
            </div>


            {/* Photo tips */}
            <div style={{
              border: `1.5px solid ${C.border}`, borderRadius: 16,
              background: C.bgCard, padding: 16,
            }}>
              <p style={{
                fontFamily: "var(--font-display, serif)", fontWeight: 700,
                fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase",
                color: C.brown, marginBottom: 12, display: "flex", alignItems: "center", gap: 6,
              }}>
                <span>📸</span> Photo Tips
              </p>
              <ul style={{ display: "flex", flexDirection: "column", gap: 8, margin: 0, padding: 0, listStyle: "none" }}>
                {PHOTO_TIPS.map((tip) => (
                  <li key={tip} style={{
                    display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13,
                    color: C.brownFaint, lineHeight: 1.4,
                    border: "1.5px solid #8B1A1A", borderRadius: 8,
                    padding: "6px 8px",
                  }}>
                    <span style={{
                      marginTop: 1, width: 16, height: 16, flexShrink: 0,
                      border: "1.5px solid #8B1A1A", borderRadius: 4,
                      background: C.bgCard, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Check size={9} strokeWidth={3} color="#8B1A1A" />
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
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 24 }}>
            <div style={{
              width: 100, height: 100, borderRadius: 24,
              border: `1.5px solid ${C.border}`, background: C.bgCard,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 20px rgba(120,80,40,0.12)",
            }}>
              <Loader2 size={44} strokeWidth={1.5} color={C.gold} className="animate-spin" />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-display, serif)", fontWeight: 800, fontSize: 22, letterSpacing: "0.04em", textTransform: "uppercase", color: C.brown, margin: 0 }}>
                {batchTotal > 1 ? `Adding ${batchDone + 1} of ${batchTotal}…` : "Processing…"}
              </p>
              <p style={{ fontSize: 13, color: C.brownFaint, marginTop: 6 }}>
                {batchTotal > 1 ? "Removing backgrounds and saving." : "Getting your photo ready."}
              </p>
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
            <p style={{
              textAlign: "center", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(58,34,16,0.40)",
              margin: 0,
            }}>
              {bgProcessing
                ? "Removing background… won't be long."
                : bgFailed
                ? "Background removal unavailable — tap Original to save"
                : "Tap a version to save it"}
            </p>

            {/* Side-by-side cards — tapping saves that version directly */}
            <div style={{ display: "flex", gap: 12 }}>
              {/* Original card */}
              <button
                onClick={() => saveWithVersion("original")}
                style={{
                  flex: 1, borderRadius: 16, overflow: "hidden",
                  border: `1.5px solid ${C.border}`,
                  background: "none", padding: 0, cursor: "pointer",
                }}
              >
                <div style={{ position: "relative", background: "#222", minHeight: 180 }}>
                  <img src={originalUrl!} alt="Original" style={{ width: "100%", objectFit: "contain", maxHeight: 180, display: "block" }} />
                </div>
                <p style={{
                  textAlign: "center", fontFamily: "var(--font-display, serif)", fontWeight: 700,
                  fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
                  padding: "7px 0", margin: 0,
                  borderTop: `1.5px solid ${C.border}`,
                  color: "rgba(58,34,16,0.55)",
                }}>
                  Original
                </p>
              </button>

              {/* Cleaned card */}
              <button
                onClick={() => cleanedUrl && saveWithVersion("cleaned")}
                disabled={!cleanedUrl}
                style={{
                  flex: 1, borderRadius: 16, overflow: "hidden",
                  border: `1.5px solid ${C.border}`,
                  background: "none", padding: 0,
                  opacity: cleanedUrl ? 1 : 0.65,
                  cursor: cleanedUrl ? "pointer" : "default",
                }}
              >
                <div style={{
                  background: "repeating-conic-gradient(#e8e0d5 0% 25%, #f5f0ea 0% 50%) 0 0 / 12px 12px",
                  minHeight: 180, position: "relative",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {cleanedUrl ? (
                    <img src={cleanedUrl} alt="Background removed" style={{ width: "100%", objectFit: "contain", maxHeight: 180, display: "block" }} />
                  ) : bgFailed ? (
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "rgba(58,34,16,0.35)", textAlign: "center", padding: "0 12px" }}>
                      Could not remove background
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <Loader2 size={28} strokeWidth={1.5} color={C.gold} className="animate-spin" />
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "rgba(58,34,16,0.35)" }}>Processing</p>
                    </div>
                  )}
                </div>
                <p style={{
                  textAlign: "center", fontFamily: "var(--font-display, serif)", fontWeight: 700,
                  fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
                  padding: "7px 0", margin: 0,
                  borderTop: `1.5px solid ${C.border}`,
                  color: "rgba(58,34,16,0.55)",
                }}>
                  Cleaned ✨
                </p>
              </button>
            </div>

            {/* Save Original — always visible so users can skip cleaning any time */}
            <button
              onClick={() => saveWithVersion("original")}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "12px 0", borderRadius: 12, width: "100%",
                border: `1.5px solid ${C.border}`, background: C.bgCard,
                fontFamily: "var(--font-display, serif)", fontWeight: 700,
                fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: C.brownFaint,
                cursor: "pointer",
              }}
            >
              Save Original — skip cleaning
            </button>

            {/* Retake — hidden in batch mode (can't retake one of a queued set) */}
            {batchTotal <= 1 && (
              <button
                onClick={() => setPhase("pick")}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "10px 0", borderRadius: 12, width: "100%",
                  border: `1.5px solid ${C.border}`, background: C.bgCard,
                  fontFamily: "var(--font-display, serif)", fontWeight: 700,
                  fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: C.brownFaint,
                  cursor: "pointer",
                }}
              >
                <RotateCcw size={13} />
                Retake
              </button>
            )}
          </div>
        )}

        {/* ── UPLOADING ── */}
        {phase === "uploading" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 24 }}>
            <div style={{
              width: 100, height: 100, borderRadius: 24,
              border: `1.5px solid ${C.border}`, background: C.bgCard,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 20px rgba(120,80,40,0.12)",
            }}>
              <Loader2 size={44} strokeWidth={1.5} color={C.gold} className="animate-spin" />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-display, serif)", fontWeight: 800, fontSize: 22, letterSpacing: "0.04em", textTransform: "uppercase", color: C.brown, margin: 0 }}>Saving…</p>
              <p style={{ fontSize: 13, color: C.brownFaint, marginTop: 6 }}>Adding to your wardrobe.</p>
            </div>
          </div>
        )}

      </div>

    </motion.div>
  );
}
