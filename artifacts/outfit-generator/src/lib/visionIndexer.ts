/**
 * visionIndexer — background photo search indexer.
 *
 * On app start, finds all items that need analysis and processes them
 * one at a time with a 350 ms delay between each so the UI stays responsive.
 *
 * Version scheme (stored as visionVersion on each ClothingItem):
 *   0 (or undefined) — unanalyzed
 *   1               — iOS Vision only (no canvas colors — outdated, re-index)
 *   2               — iOS Vision + canvas colors (current native target)
 *   4               — web canvas analyzed, labels found
 *   5               — web canvas analyzed, no labels (don't retry on web)
 *
 * Re-run logic:
 *   native iOS  → process items where visionVersion !== 2
 *                 (covers 0, 1 — v1 items get re-indexed to pick up colors)
 *   web         → process items where visionVersion < 4
 *                 (covers 0 and 1; skips 4 and 5)
 *
 * The indexer is idempotent — safe to call on every app launch.
 */

import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { listClothing, updateClothingItem } from "./localDB";
import { analyzePhoto } from "./visionExtractor";

let _running = false;

/**
 * Start the background vision indexer.
 * Silently no-ops if already running or if there's nothing to process.
 */
export async function runVisionIndexer(): Promise<void> {
  if (_running) return;
  _running = true;

  try {
    const items     = await listClothing();
    const isNative  = Capacitor.isNativePlatform();

    const queue = items.filter((item) => {
      if (!item.imageObjectPath) return false; // no photo to analyze
      const v = item.visionVersion ?? 0;
      if (isNative) return v !== 2;            // native: re-run anything not yet at v2 (Vision + canvas colors)
      return v < 4;                            // web:    re-run 0 and 1; skip 4 (done) and 5 (no labels)
    });

    if (queue.length === 0) return;

    let toastId: string | number | undefined;

    const updateToast = (done: number) => {
      const msg = `Preparing photo search… (${done}/${queue.length})`;
      if (toastId === undefined) {
        toastId = toast.loading(msg, { duration: Infinity });
      } else {
        toast.loading(msg, { id: toastId, duration: Infinity });
      }
    };

    updateToast(0);

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];

      try {
        const { labels, text, version } = await analyzePhoto(item.imageObjectPath!);
        await updateClothingItem(item.id, {
          visionLabels:  labels,
          visionText:    text,
          visionVersion: version,
        });
      } catch (err) {
        console.warn("[VisionIndexer] Failed to analyze item", item.id, err);
        // Non-fatal — continue to next item
      }

      updateToast(i + 1);

      if (i < queue.length - 1) {
        // 350 ms delay — keeps the main thread free for UI interactions
        await new Promise<void>((r) => setTimeout(r, 350));
      }
    }

    toast.dismiss(toastId);
  } catch (err) {
    console.warn("[VisionIndexer] Indexer error:", err);
  } finally {
    _running = false;
  }
}

/**
 * Schedule a single item for immediate (re)analysis.
 * Called when a new item is added or its photo is changed.
 * Runs after a short delay so the UI can finish its render first.
 */
export function scheduleItemAnalysis(itemId: number): void {
  setTimeout(async () => {
    try {
      const items = await listClothing();
      const item  = items.find((i) => i.id === itemId);
      if (!item?.imageObjectPath) return;

      const { labels, text, version } = await analyzePhoto(item.imageObjectPath);
      await updateClothingItem(itemId, {
        visionLabels:  labels,
        visionText:    text,
        visionVersion: version,
      });
    } catch (err) {
      console.warn("[VisionIndexer] scheduleItemAnalysis failed for", itemId, err);
    }
  }, 1000);
}
