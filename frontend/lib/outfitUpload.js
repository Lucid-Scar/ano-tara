export async function readOutfitResponse(response) {
  const messages = {
    413: "This image is too large to upload. Try a smaller crop.",
    422: "The image could not be processed. Choose a valid JPEG or PNG.",
    400: "The image could not be read. Try another photograph.",
    500: "Garment detection failed. Please try again.",
    502: "Garment detection is temporarily unavailable. Please retry shortly.",
    503: "Garment detection is not ready yet. Please retry shortly.",
    504: "Garment detection took too long. Please retry shortly.",
  };
  if (!response.ok) throw new Error(messages[response.status] || "Garment detection is unavailable. Please try again.");
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("The detection service returned an unexpected response. Please retry shortly.");
  let data;
  try { data = await response.json(); } catch { throw new Error("The detection service returned an unreadable response. Please retry."); }
  if (data?.status === "error") throw new Error("No clothing detected. Please ensure the clothing is clearly visible.");
  if (data?.status !== "success" || !Array.isArray(data.items)) throw new Error("The detection service returned an incomplete result. Please retry.");
  return data;
}


export function uploadOutfitImage(dataUrl, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/backend/predict-outfit");
    request.timeout = 90000;
    request.setRequestHeader("Content-Type", "application/json");
    request.upload.onload = () => onProgress("Analyzing garment\u2026");
    request.onerror = () => reject(new Error("Cannot reach garment detection. Check your connection and retry."));
    request.ontimeout = () => reject(new Error("Garment detection took too long. Please retry shortly."));
    request.onload = () => resolve(new Response(request.responseText, { status: request.status, headers: { "content-type": request.getResponseHeader("content-type") || "" } }));
    onProgress("Uploading image\u2026");
    request.send(JSON.stringify({ image_base64: dataUrl }));
  });
}
