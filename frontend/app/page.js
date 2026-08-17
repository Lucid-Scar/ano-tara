"use client";
import { useState } from "react";
import ImageUploader from "../components/ImageUploader";

export default function Home() {
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // This function runs automatically after a successful Cloudinary upload
  const analyzeOutfit = async (url) => {
    setUploadedUrl(url);
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      // Sending the POST request to your FastAPI backend
      const response = await fetch("http://localhost:8000/predict-outfit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image_url: url }),
      });

      // Catching the Chef's response
      const data = await response.json();
      setAnalysisResult(data);
    } catch (error) {
      console.error("Failed to connect to backend:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-md p-8 flex flex-col items-center text-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Ano Tara?</h1>
        <p className="text-sm text-slate-500 mb-6">
          Visual Outfit Analyzer & Travel Advisory
        </p>

        {/* Pass the function into the uploader */}
        <ImageUploader onUploadSuccess={analyzeOutfit} />

        {isAnalyzing && (
          <p className="mt-4 text-sm text-blue-600 font-medium animate-pulse">
            Analyzing outfit with AI...
          </p>
        )}

        {/* Display the FastAPI response */}
        {analysisResult && (
          <div className="w-full mt-4 p-4 bg-slate-50 rounded-lg text-left border border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 mb-2">Analysis Complete</h3>
            <p className="text-xs text-slate-600"><strong>Category:</strong> {analysisResult.detected_category}</p>
            <p className="text-xs text-slate-600"><strong>Confidence:</strong> {analysisResult.confidence_score}</p>
            <p className="text-xs text-slate-600 mt-2 italic">"{analysisResult.message}"</p>
          </div>
        )}
      </div>
    </main>
  );
}