"use client";

import { useEffect, useRef, useState } from "react";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default function OutfitImageCapture({ source, mode, onCancel, onSelect }) {
  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const gestureRef = useRef(null);
  const loadedImageRef = useRef(null);
  const [cameraError, setCameraError] = useState("");
  const [captured, setCaptured] = useState("");
  const [crop, setCrop] = useState({ x: 10, y: 10, w: 80, h: 80 });
  const [imageSize, setImageSize] = useState(null);

  useEffect(() => {
    if (mode !== "camera") return undefined;
    let stream;
    let active = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser does not support camera access.");
      return undefined;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((result) => {
        stream = result;
        if (active && videoRef.current) videoRef.current.srcObject = stream;
        else result.getTracks().forEach((track) => track.stop());
      })
      .catch(() => setCameraError("Camera access is unavailable. Check your browser permission and try again."));
    return () => {
      active = false;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [mode]);

  const previewSource = mode === "camera" ? captured : source;

  useEffect(() => {
    if (!previewSource) return;
    const img = new Image();
    img.onload = () => {
      loadedImageRef.current = img;
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      setCrop({ x: 10, y: 10, w: 80, h: 80 });
    };
    img.src = previewSource;
  }, [previewSource]);

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    setCaptured(canvas.toDataURL("image/jpeg", 0.92));
  };

  const startGesture = (event, type) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current = { type, pointerX: event.clientX, pointerY: event.clientY, ...crop };
  };

  const moveGesture = (event) => {
    const gesture = gestureRef.current;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!gesture || !rect) return;
    const dx = ((event.clientX - gesture.pointerX) / rect.width) * 100;
    const dy = ((event.clientY - gesture.pointerY) / rect.height) * 100;
    if (gesture.type === "move") {
      setCrop((current) => ({ ...current, x: clamp(gesture.x + dx, 0, 100 - current.w), y: clamp(gesture.y + dy, 0, 100 - current.h) }));
    } else {
      setCrop((current) => ({ ...current, w: clamp(gesture.w + dx, 12, 100 - current.x), h: clamp(gesture.h + dy, 12, 100 - current.y) }));
    }
  };

  const finish = () => {
    if (!previewSource || !imageSize || !stageRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((crop.w / 100) * imageSize.width));
    canvas.height = Math.max(1, Math.round((crop.h / 100) * imageSize.height));
    canvas.getContext("2d").drawImage(
      loadedImageRef.current,
      (crop.x / 100) * imageSize.width,
      (crop.y / 100) * imageSize.height,
      canvas.width,
      canvas.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    onSelect(canvas.toDataURL("image/jpeg", 0.92));
  };

  const waitingForCapture = mode === "camera" && !captured;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="crop-title">
      <section className="my-auto w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
        <h2 id="crop-title" className="text-xl font-bold">{waitingForCapture ? "Capture your garment" : "Crop your garment"}</h2>
        <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{mode === "camera" ? "Fit one clothing on the camera for the best results." : "Please crop one clothing/garment per image for the best results."}</p>
        <div className="mx-auto mt-4 flex max-h-[55vh] min-h-48 w-full max-w-[460px] items-center justify-center overflow-hidden rounded-xl bg-slate-100">
          {waitingForCapture ? <video ref={videoRef} autoPlay playsInline muted className="max-h-[55vh] w-full object-contain" /> : previewSource ? (
            <div ref={stageRef} className="relative inline-block max-h-[55vh] max-w-full touch-none select-none" onPointerMove={moveGesture} onPointerUp={() => { gestureRef.current = null; }}>
              <img src={previewSource} alt="Garment crop preview" draggable="false" className="block h-auto max-h-[55vh] w-auto max-w-full" />
              <div className="absolute inset-0 bg-black/35" />
              <div className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.w}%`, height: `${crop.h}%` }} onPointerDown={(event) => startGesture(event, "move")}>
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {[...Array(2)].map((_, index) => <span key={`v${index}`} className="absolute bottom-0 top-0 border-l border-white/70" style={{ left: `${((index + 1) / 3) * 100}%` }} />)}
                  {[...Array(2)].map((_, index) => <span key={`h${index}`} className="absolute left-0 right-0 border-t border-white/70" style={{ top: `${((index + 1) / 3) * 100}%` }} />)}
                </div>
                <button type="button" aria-label="Resize crop area" onPointerDown={(event) => startGesture(event, "resize")} className="absolute -bottom-2 -right-2 h-5 w-5 cursor-nwse-resize rounded-sm border-2 border-white bg-blue-500 shadow" />
              </div>
            </div>
          ) : null}
        </div>
        {cameraError ? <p className="mt-3 text-sm text-rose-700">{cameraError}</p> : null}
        {!waitingForCapture && previewSource ? <p className="mt-2 text-xs text-slate-500">Drag the crop area to move it. Drag the blue corner to resize.</p> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button onClick={onCancel} className="rounded-xl border border-slate-300 px-4 py-2 font-semibold">Cancel</button>
          {waitingForCapture ? <button onClick={capture} disabled={!!cameraError} className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50">Freeze / capture</button> : <button onClick={finish} disabled={!imageSize} className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50">Use cropped image</button>}
          {mode === "camera" && captured ? <button onClick={() => { setCaptured(""); setImageSize(null); }} className="rounded-xl border border-slate-300 px-4 py-2 font-semibold">Retake</button> : null}
        </div>
      </section>
    </div>
  );
}
