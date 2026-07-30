/**
 * WHY everything here uses dynamic import():
 *
 * 1. @imgly/background-removal static import spins up WASM workers immediately
 *    at module parse time. On iOS WKWebView (TestFlight), this causes memory
 *    pressure *before* the user even opens the camera, causing a crash when iOS
 *    tries to allocate the camera GPU buffer. Dynamic import defers all WASM
 *    allocation until after a photo has already been taken.
 *
 * 2. Object.defineProperty to lock wasm.proxy = true
 *    @imgly/background-removal internally sets ort.env.wasm.proxy = false right before
 *    it creates the ONNX inference session (it only enables the proxy when WebGPU is
 *    available, which it isn't on iOS Safari / WKWebView). Using defineProperty with a
 *    no-op setter means that write is silently ignored and the value stays true.
 *    ONNX Runtime then runs inference in a sub-worker, freeing the main thread.
 *
 * 3. numThreads = 1
 *    iOS Safari has no SharedArrayBuffer, which WASM multithreading requires.
 *    Leaving threads > 1 causes a silent crash. Single-threaded avoids it.
 */

let ortConfigured = false;

async function configureOrt() {
  if (ortConfigured) return;
  ortConfigured = true;

  // Dynamic import — avoids Vite pre-bundle reload on module parse.
  const ort = await import("onnxruntime-web");

  // Lock proxy = true so imgly's internal `proxy = false` write is ignored.
  Object.defineProperty(ort.env.wasm, "proxy", {
    get: () => true,
    set: () => {},        // no-op — blocks imgly from resetting it
    configurable: true,   // allows us to redefine if needed later
  });

  // Single thread — iOS Safari has no SharedArrayBuffer; > 1 thread silent-crashes.
  ort.env.wasm.numThreads = 1;
}

/**
 * Remove the background from a JPEG/PNG base64 data-URL.
 * Returns a PNG data-URL with transparent background.
 *
 * Both @imgly/background-removal AND onnxruntime-web are imported dynamically
 * so zero WASM workers are created before the user actually takes a photo.
 * This prevents the iOS WKWebView camera crash caused by WASM memory pressure.
 *
 * On first call: downloads the ~15 MB isnet_fp16 ONNX model from the imgly CDN
 * (cached by WKWebView after that). Throws on network error or unreadable image.
 */
export async function removeBackground(dataUrl: string): Promise<string> {
  await configureOrt();

  // Dynamic import — defers ALL WASM/worker allocation until after photo is taken.
  const { removeBackground: imglyRemoveBackground } = await import("@imgly/background-removal");

  const sourceBlob = await dataUrlToBlob(dataUrl);
  const resultBlob = await imglyRemoveBackground(sourceBlob, {
    model: "isnet_fp16",
    output: { format: "image/png", quality: 0.9 },
  });
  return blobToDataUrl(resultBlob);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
