/**
 * VisionAnalyzer — Capacitor bridge to the native iOS Vision plugin.
 *
 * On iOS the native Swift plugin runs:
 *   • VNClassifyImageRequest  — object/scene labels (confidence ≥ 0.3)
 *   • VNRecognizeTextRequest  — text detected in the photo (accurate mode)
 *
 * On web / non-native platforms the plugin is not available; callers
 * should fall back to the web canvas color extractor.
 */

import { registerPlugin } from "@capacitor/core";

export interface VisionResult {
  labels: string[];
  text:   string[];
}

export interface VisionAnalyzerPlugin {
  analyze(options: { base64Image: string }): Promise<VisionResult>;
}

// registerPlugin is safe to call on any platform — returns a no-op stub on web.
export const VisionAnalyzer = registerPlugin<VisionAnalyzerPlugin>("VisionAnalyzer", {
  // Web fallback — resolves with empty arrays so callers don't need to branch.
  web: () =>
    Promise.resolve({
      analyze: () => Promise.resolve({ labels: [], text: [] }),
    }),
});
