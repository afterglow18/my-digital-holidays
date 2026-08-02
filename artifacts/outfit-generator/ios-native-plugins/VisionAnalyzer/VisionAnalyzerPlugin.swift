import Foundation
import Capacitor
import Vision
import UIKit

/**
 * VisionAnalyzerPlugin — Capacitor plugin for on-device photo analysis.
 *
 * Runs two Vision requests synchronously on a background queue:
 *   1. VNClassifyImageRequest  — object / scene labels (confidence ≥ 0.3)
 *   2. VNRecognizeTextRequest  — text detected in the photo (accurate mode)
 *
 * Input:  base64Image (String) — raw base64 JPEG/PNG, no data-URL prefix
 * Output: { labels: [String], text: [String] }
 *
 * Falls back silently to empty arrays on any error.
 */
@objc(VisionAnalyzerPlugin)
public class VisionAnalyzerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier   = "VisionAnalyzerPlugin"
    public let jsName       = "VisionAnalyzer"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "analyze", returnType: CAPPluginReturnPromise),
    ]

    @objc func analyze(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64Image"),
              let imageData = Data(base64Encoded: base64),
              let uiImage  = UIImage(data: imageData),
              let cgImage  = uiImage.cgImage
        else {
            call.resolve(["labels": [], "text": []])
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            var labels: [String] = []
            var texts:  [String] = []
            let group = DispatchGroup()

            // ── Classification ────────────────────────────────────────────
            group.enter()
            let classifyRequest = VNClassifyImageRequest { request, _ in
                defer { group.leave() }
                labels = (request.results as? [VNClassificationObservation] ?? [])
                    .filter { $0.confidence >= 0.3 }
                    .map(\.identifier)
            }

            // ── Text recognition ──────────────────────────────────────────
            group.enter()
            let textRequest = VNRecognizeTextRequest { request, _ in
                defer { group.leave() }
                texts = (request.results as? [VNRecognizedTextObservation] ?? [])
                    .compactMap { $0.topCandidates(1).first?.string }
            }
            textRequest.recognitionLevel = .accurate

            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            do {
                try handler.perform([classifyRequest, textRequest])
            } catch {
                // non-fatal — group.leave() already called in completion blocks
            }

            group.wait()
            call.resolve(["labels": labels, "text": texts])
        }
    }
}
