/**
 * visionExtractor — photo analysis for the search indexer.
 *
 * On native iOS: delegates to the Swift VisionAnalyzer Capacitor plugin
 * (VNClassifyImageRequest + VNRecognizeTextRequest).
 *
 * On web: extracts dominant colors from the photo using a 48×48 canvas.
 * Background is detected by sampling 4×4 pixel patches from each corner,
 * then excluded so studio/white backgrounds don't pollute the results.
 * Colors covering < 10 % of foreground pixels are dropped.
 *
 * Color name mapping follows the spec exactly:
 *   black / dark grey / grey / light grey / white /
 *   beige / tan / brown / red / orange / yellow /
 *   green / teal / blue / purple / pink
 */

import { Capacitor } from "@capacitor/core";
import { VisionAnalyzer, type VisionResult } from "./visionPlugin";

// ── Color name mapping ────────────────────────────────────────────────────────

function pixelToColorName(r: number, g: number, b: number): string {
  const brightness = (r * 0.299 + g * 0.587 + b * 0.114); // perceptual luminance

  // Greyscale family
  if (brightness < 80)  return "black";
  if (brightness < 110) return "dark grey";

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;

  // Low saturation → grey family
  if (sat < 0.15) {
    if (brightness < 175) return "grey";
    if (brightness < 225) return "light grey";
    return "white";
  }

  // Hue-based classification (0–360°)
  const rc = (max - r) / (max - min);
  const gc = (max - g) / (max - min);
  const bc = (max - b) / (max - min);
  let hue: number;
  if (r === max)      hue = (bc - gc) * 60;
  else if (g === max) hue = (2 + rc - bc) * 60;
  else                hue = (4 + gc - rc) * 60;
  if (hue < 0) hue += 360;

  // Warm neutrals (brownish / beige / tan) — low saturation reds/oranges
  if (hue < 40 || hue >= 330) {
    if (sat < 0.40 && brightness > 180) return "beige";
    if (sat < 0.50 && brightness > 130) return "tan";
    if (sat < 0.55 && brightness < 130) return "brown";
  }

  if (hue < 15 || hue >= 345) return "red";
  if (hue < 45)               return "orange";
  if (hue < 65)               return "yellow";
  if (hue < 150)              return "green";
  if (hue < 195)              return "teal";
  if (hue < 255)              return "blue";
  if (hue < 290)              return "purple";
  if (hue < 345)              return "pink";
  return "red";
}

// ── Web canvas color extraction ───────────────────────────────────────────────

export async function extractColorsFromDataUrl(dataUrl: string): Promise<string[]> {
  return new Promise<string[]>((resolve) => {
    const img = new Image();

    img.onload = () => {
      try {
        const SIZE = 48;
        const canvas = document.createElement("canvas");
        canvas.width  = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve([]); return; }

        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

        // ── Detect background by sampling 4×4 corner patches ─────────────
        let bgR = 0, bgG = 0, bgB = 0, bgN = 0;
        const PATCH = 4;
        const corners = [[0, 0], [SIZE - PATCH, 0], [0, SIZE - PATCH], [SIZE - PATCH, SIZE - PATCH]];
        for (const [cx, cy] of corners) {
          for (let dy = 0; dy < PATCH; dy++) {
            for (let dx = 0; dx < PATCH; dx++) {
              const i = ((cy + dy) * SIZE + (cx + dx)) * 4;
              bgR += data[i]; bgG += data[i + 1]; bgB += data[i + 2]; bgN++;
            }
          }
        }
        bgR /= bgN; bgG /= bgN; bgB /= bgN;

        // ── Count foreground pixel colors ─────────────────────────────────
        const counts: Record<string, number> = {};
        let fgTotal = 0;

        for (let y = 0; y < SIZE; y++) {
          for (let x = 0; x < SIZE; x++) {
            const i = (y * SIZE + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];

            if (a < 32) continue; // transparent — skip

            // Background exclusion: within ±30 of sampled bg colour
            if (
              Math.abs(r - bgR) < 30 &&
              Math.abs(g - bgG) < 30 &&
              Math.abs(b - bgB) < 30
            ) continue;

            const name = pixelToColorName(r, g, b);
            counts[name] = (counts[name] ?? 0) + 1;
            fgTotal++;
          }
        }

        if (fgTotal === 0) { resolve([]); return; }

        // Keep colors that cover ≥ 10 % of foreground
        const result = Object.entries(counts)
          .filter(([, n]) => n / fgTotal >= 0.10)
          .sort((a, b) => b[1] - a[1])
          .map(([name]) => name);

        resolve(result);
      } catch {
        resolve([]);
      }
    };

    img.onerror = () => resolve([]);
    img.src = dataUrl;
  });
}

// ── Unified analysis entry point ──────────────────────────────────────────────

export async function analyzePhoto(
  dataUrl: string,
): Promise<{ labels: string[]; text: string[]; version: number }> {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("VisionAnalyzer")) {
    try {
      // Strip "data:image/...;base64," prefix — native plugin wants raw base64
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      const result: VisionResult = await VisionAnalyzer.analyze({ base64Image: base64 });
      return { labels: result.labels ?? [], text: result.text ?? [], version: 1 };
    } catch (err) {
      console.warn("[Vision] Native analysis failed, falling back to web:", err);
    }
  }

  // Web fallback: canvas color extraction only (no text)
  const labels = await extractColorsFromDataUrl(dataUrl);
  return { labels, text: [], version: labels.length > 0 ? 4 : 5 };
}
