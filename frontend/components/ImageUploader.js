"use client";

import { useState } from "react";
import { compressOutfitImage } from "../lib/compressOutfitImage";

export default function ImageUploader({ onSelect, onError, onProgress, disabled = false, maxBytes = 20 * 1024 * 1024, className = "", label = "UPLOAD" }) {
  const [busy, setBusy] = useState(false);
  const handleChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const processed = await compressOutfitImage(file, { maxOriginalBytes: maxBytes, onProgress });
      onSelect?.(processed.dataUrl, file.name, processed);
      onProgress?.("Image ready.");
    } catch (error) {
      onError?.(error.message || "Image compression failed. Try another photograph.");
      onProgress?.("");
    } finally { setBusy(false); }
  };

  return (
    <label className={`inline-flex cursor-pointer items-center justify-center gap-4 rounded-full bg-[#f2c9c8] px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-900 shadow-[0_18px_26px_rgba(15,23,42,0.12)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#efbcbc] ${className}`.trim()}>
      <span>{label}</span>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-lg leading-none shadow-sm">
        ↑
      </span>
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || disabled} onChange={handleChange} className="hidden" />
    </label>
  );
}
