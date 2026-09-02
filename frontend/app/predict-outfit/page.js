"use client";

import { useState } from "react";
import Link from "next/link";
import ImageUploader from "../../components/ImageUploader";

export default function OotdPage() {
  const [uploadedImage, setUploadedImage] = useState("");
  const [fileName, setFileName] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleImageSelect = async (imageDataUrl, selectedFileName) => {
    setUploadedImage(imageDataUrl);
    setFileName(selectedFileName || "");
    setAnalysisResult(null);
    setErrorMessage("");
    setIsAnalyzing(true);

    try {
      const response = await fetch("http://localhost:8000/predict-outfit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image_base64: imageDataUrl }),
      });

      const data = await response.json();
      if (!response.ok || data?.status === "error") {
        throw new Error(data?.message || "Prediction failed");
      }

      setAnalysisResult(data);
    } catch (error) {
      setErrorMessage(error?.message || "Failed to analyze outfit.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <main className="min-h-screen bg-white px-3 pb-10 pt-3 sm:px-6 sm:pt-6">
      <section className="mx-auto max-w-6xl overflow-hidden rounded-[0.35rem] bg-white shadow-[0_20px_55px_rgba(15,23,42,0.12)]">
        <div
          className="flex h-20 items-center justify-between px-4 sm:px-6"
          style={{
            backgroundImage:
              "linear-gradient(rgba(66,91,109,0.65), rgba(66,91,109,0.65)), url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1800&q=80')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <p className="rounded-full bg-white/90 px-3 py-1 text-base font-black italic text-slate-900">ano tara?</p>
          <div className="flex items-center gap-6">
            <Link href="/" className="text-sm font-semibold text-white hover:underline">
              Home
            </Link>
            <span className="text-3xl text-slate-900" aria-hidden="true">
              o
            </span>
          </div>
        </div>

        <div className="grid gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[1.15fr_0.85fr_0.85fr] lg:items-start">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 sm:text-6xl">Ano Tara? OOTD</h1>
            <p className="mt-4 max-w-xl text-xl leading-relaxed text-slate-900 sm:text-5xl sm:leading-snug">
              outfit Picker || Upload your outfit and we&apos;ll match for you
            </p>

            <div className="mt-7 flex items-center gap-3">
              <ImageUploader onSelect={handleImageSelect} label="UPLOAD" className="px-10 py-4 text-2xl sm:text-4xl" />
              {fileName ? <span className="text-sm text-slate-500">{fileName}</span> : null}
            </div>

            <div className="mt-8 max-w-xl rounded-[1.2rem] bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.18)] sm:p-8">
              <p className="text-3xl text-slate-800 sm:text-5xl">Files</p>
              <div className="mt-5 flex min-h-56 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 p-4">
                {uploadedImage ? (
                  <img src={uploadedImage} alt="Uploaded clothing preview" className="h-full max-h-64 w-full rounded-xl object-contain" />
                ) : (
                  <p className="text-center text-2xl italic text-slate-300 sm:text-4xl">No uploaded files</p>
                )}
              </div>

              {isAnalyzing ? <p className="mt-4 text-sm font-medium text-sky-700">Analyzing outfit...</p> : null}

              {errorMessage ? (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
              ) : null}

              {analysisResult ? (
                <div className="mt-4 rounded-xl bg-slate-900 p-4 text-white">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Prediction</p>
                  <p className="mt-2 text-xl font-bold">{analysisResult.weather_suitability || "No weather label"}</p>
                  <p className="mt-2 text-sm text-slate-200">{analysisResult.message || "Prediction completed."}</p>
                  <p className="mt-2 text-sm text-slate-300">
                    Detected category: {analysisResult.detected_category || "Unknown"}
                  </p>
                  <p className="text-sm text-slate-300">Confidence: {analysisResult.confidence_score || "N/A"}</p>
                </div>
              ) : null}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/destinations" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Open destinations
              </Link>
              <Link
                href="/specific-destinations"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Open specific destinations
              </Link>
            </div>
          </div>

          <div className="hidden lg:block">
            <img
              src="https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=900&q=80"
              alt="Clothing look 1"
              className="h-[470px] w-full rounded-2xl object-cover shadow-[0_16px_34px_rgba(15,23,42,0.24)]"
            />
          </div>

          <div className="hidden lg:block">
            <img
              src="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80"
              alt="Clothing look 2"
              className="h-[470px] w-full rounded-2xl object-cover shadow-[0_16px_34px_rgba(15,23,42,0.24)]"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
