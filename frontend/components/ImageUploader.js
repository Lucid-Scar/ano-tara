"use client";

export default function ImageUploader({ onSelect, className = "", label = "UPLOAD" }) {
  const handleChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onSelect?.(reader.result, file.name);
      }
    };

    reader.readAsDataURL(file);
  };

  return (
    <label className={`inline-flex cursor-pointer items-center justify-center gap-4 rounded-full bg-[#f2c9c8] px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-900 shadow-[0_18px_26px_rgba(15,23,42,0.12)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#efbcbc] ${className}`.trim()}>
      <span>{label}</span>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-lg leading-none shadow-sm">
        ↑
      </span>
      <input type="file" accept="image/*" onChange={handleChange} className="hidden" />
    </label>
  );
}
