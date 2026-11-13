export async function compressOutfitImage(file, {
  maxOriginalBytes = 20 * 1024 * 1024,
  targetBytes = 500 * 1024,
  maxBytes = 2 * 1024 * 1024,
  maxDimension = 1280,
  onProgress = () => {},
} = {}) {
  onProgress("Preparing image…");
  if (!(file instanceof Blob) || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPEG, PNG, or WebP photograph.");
  if (!file.size || file.size > maxOriginalBytes) throw new Error(`Choose an image smaller than ${Math.round(maxOriginalBytes / 1024 / 1024)} MB.`);
  if (![targetBytes, maxBytes, maxDimension].every(value => Number.isFinite(value) && value > 0)) throw new Error("Invalid image compression limits.");
  let decoded, objectUrl, canvas;
  try {
    if (typeof createImageBitmap === "function") {
      try { decoded = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { /* Fall back to the browser image decoder. */ }
    }
    if (!decoded) {
      objectUrl = URL.createObjectURL(file);
      decoded = new Image();
      await new Promise((resolve, reject) => {
        decoded.onload = resolve;
        decoded.onerror = () => reject(new Error("This image could not be read. Try another photograph."));
        decoded.src = objectUrl;
      });
    }
    const width = decoded.naturalWidth || decoded.width;
    const height = decoded.naturalHeight || decoded.height;
    if (!width || !height || width * height > 40000000) throw new Error("Choose a photograph under 40 megapixels.");
    onProgress("Compressing image…");
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image compression is unavailable in this browser.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(decoded, 0, 0, canvas.width, canvas.height);
    let best;
    for (const quality of [0.8, 0.72, 0.64, 0.6]) {
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Image compression failed. Try another photograph.")), "image/jpeg", quality));
      if (!best && blob.size <= maxBytes) best = blob;
      if (blob.size <= targetBytes && blob.size <= maxBytes) { best = blob; break; }
    }
    if (!best) throw new Error("This image is still too large. Try a smaller crop.");
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not prepare the compressed image."));
      reader.readAsDataURL(best);
    });
    return { dataUrl, originalBytes: file.size, compressedBytes: best.size, reduction: (1 - best.size / file.size) * 100, width: canvas.width, height: canvas.height };
  } finally {
    decoded?.close?.();
    if (objectUrl) { decoded.src = ""; URL.revokeObjectURL(objectUrl); }
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}
