"use client";
import { useState } from "react";
import ImageUploader from "../components/ImageUploader";

export default function Home() {
  const [uploadedImage, setUploadedImage] = useState("");
  const [fileName, setFileName] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeOutfit = async (imageDataUrl, selectedFileName) => {
    setUploadedImage(imageDataUrl);
    setFileName(selectedFileName || "");
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setErrorMessage("");

    try {
      const response = await fetch("http://localhost:8000/predict-outfit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image_base64: imageDataUrl }),
      });

      const data = await response.json();
      if (!response.ok || data.status === "error") {
        throw new Error(data.message || "Prediction failed");
      }

      setAnalysisResult(data);
    } catch (error) {
      console.error("Failed to connect to backend:", error);
      setErrorMessage(error.message || "Failed to analyze outfit.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fcfbf8] px-4 py-4 text-slate-950 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(244,211,208,0.45),transparent_28%),radial-gradient(circle_at_top_right,rgba(192,210,230,0.42),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.75),rgba(251,248,243,0.98))]" />
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-rose-200/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-28 h-80 w-80 rounded-full bg-sky-200/20 blur-3xl" />

      <div className="relative mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-8">
          <div className="inline-flex rounded-full border border-black/10 bg-white/80 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-700 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur">
            Ano Tara? OOTD
          </div>

          <div className="space-y-5">
            <h1 className="max-w-xl text-4xl font-black uppercase leading-[0.95] tracking-[-0.04em] text-slate-950 sm:text-5xl lg:text-6xl">
              Outfit picker.
              <br />
              Upload your look and we’ll match it.
            </h1>
            <p className="max-w-lg text-lg leading-8 text-slate-600 sm:text-xl">
              Drop in a clothing photo and let the model predict which weather it fits best, with confidence and a quick summary.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <ImageUploader onSelect={analyzeOutfit} />
            {fileName ? (
              <span className="rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm text-slate-600 shadow-sm">
                {fileName}
              </span>
            ) : null}
          </div>

          {isAnalyzing && (
            <p className="text-sm font-medium text-rose-700 animate-pulse">
              Analyzing outfit with AI...
            </p>
          )}

          {errorMessage && (
            <div className="max-w-xl rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-[0_16px_40px_rgba(251,113,133,0.08)]">
              {errorMessage}
            </div>
          )}

          <div className="grid max-w-xl gap-4 rounded-[2rem] border border-black/5 bg-white/80 p-4 shadow-[0_26px_80px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="flex items-center justify-between rounded-[1.5rem] bg-[#f8f1ed] px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Files</p>
                <p className="mt-1 text-sm text-slate-500">Uploaded photo will appear below.</p>
              </div>
              <div className="hidden h-10 w-10 rounded-full bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)] sm:block" />
            </div>

            <div className="flex min-h-40 items-center justify-center rounded-[1.5rem] border border-dashed border-slate-200 bg-white px-6 py-8 text-center text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              {uploadedImage ? (
                <img src={uploadedImage} alt="Uploaded outfit preview" className="h-full max-h-56 w-full rounded-[1.25rem] object-cover" />
              ) : (
                <span className="text-lg italic tracking-wide text-slate-300">No uploaded files</span>
              )}
            </div>

            {analysisResult && (
              <div className="grid gap-3 rounded-[1.5rem] bg-slate-950 p-5 text-white shadow-[0_16px_50px_rgba(15,23,42,0.22)]">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Result</p>
                  <h3 className="mt-2 text-2xl font-bold">{analysisResult.weather_suitability}</h3>
                </div>
                <p className="text-sm text-slate-300">{analysisResult.message}</p>
                <div className="grid gap-1 text-sm text-slate-200">
                  <p>
                    <span className="font-semibold text-white">Detected category:</span> {analysisResult.detected_category}
                  </p>
                  <p>
                    <span className="font-semibold text-white">Confidence:</span> {analysisResult.confidence_score}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="relative flex min-h-[34rem] items-center justify-center lg:min-h-[42rem]">
          <div className="absolute left-4 top-10 h-72 w-72 rounded-[2.5rem] border border-black/5 bg-white/80 shadow-[0_30px_80px_rgba(15,23,42,0.14)] backdrop-blur sm:left-10 sm:top-0 sm:h-80 sm:w-80">
            <div className="absolute left-8 top-8 h-44 w-28 rounded-[2.25rem] bg-gradient-to-b from-[#e8d6c8] to-[#d6b9a7] shadow-[12px_18px_30px_rgba(15,23,42,0.14)]" />
            <div className="absolute right-10 top-14 h-40 w-24 rounded-[2rem] bg-gradient-to-b from-[#f5efe5] to-[#e4d6c4] shadow-[10px_18px_30px_rgba(15,23,42,0.1)]" />
            <div className="absolute bottom-8 right-10 h-40 w-24 rotate-[18deg] rounded-[2rem] bg-gradient-to-b from-[#a3c0d7] to-[#7ea1be] shadow-[10px_18px_30px_rgba(15,23,42,0.12)]" />
            <div className="absolute bottom-4 left-10 h-16 w-24 rounded-[1.25rem] border border-black/5 bg-[#f4ecd9] shadow-[0_12px_28px_rgba(15,23,42,0.1)]" />
          </div>

          <div className="absolute right-4 top-12 h-72 w-72 rounded-[2.5rem] border border-black/5 bg-white/82 shadow-[0_30px_80px_rgba(15,23,42,0.14)] backdrop-blur sm:right-8 sm:h-80 sm:w-80">
            <div className="absolute left-8 top-8 h-48 w-32 rounded-[2rem] bg-[linear-gradient(135deg,#0f172a_0%,#334155_48%,#94a3b8_48%,#cbd5e1_100%)] shadow-[12px_18px_28px_rgba(15,23,42,0.14)] opacity-95" />
            <div className="absolute right-12 top-16 h-44 w-22 rounded-[1.8rem] bg-gradient-to-b from-[#e5e7eb] via-[#9ca3af] to-[#6b7280] shadow-[10px_18px_30px_rgba(15,23,42,0.12)]" />
            <div className="absolute bottom-8 left-10 h-42 w-28 rotate-[14deg] rounded-[2rem] bg-gradient-to-b from-[#1f2937] to-[#0f172a] shadow-[10px_18px_30px_rgba(15,23,42,0.14)]" />
          </div>

          <div className="relative z-10 max-w-md rounded-[2.5rem] border border-white/80 bg-white/80 p-8 text-center shadow-[0_30px_100px_rgba(15,23,42,0.16)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Mood board</p>
            <h2 className="mt-4 text-3xl font-black uppercase tracking-[-0.04em] text-slate-950">
              Styled like a lookbook, not a form.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              The upload flow stays simple, but the composition feels more curated and fashion-forward.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}