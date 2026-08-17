"use client";

import { CldUploadWidget } from "next-cloudinary";

export default function ImageUploader({ onUpload }) {
  return (
    <CldUploadWidget
      onUpload={(result) => {
        const url = result?.info?.secure_url;
        if (url) {
          console.log("Uploaded Image URL:", url);
          onUpload?.(url);
        }
      }}
    >
      {({ open }) => (
        <button
          type="button"
          onClick={() => open()}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Upload Outfit Photo
        </button>
      )}
    </CldUploadWidget>
  );
}
