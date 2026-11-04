"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock3 } from "lucide-react";
import { clampActivityTime, formatTimeOption } from "../app/tripUtils";

const getDraftTime = (value) => {
  const [hourValue, minuteValue] = clampActivityTime(value).split(":").map(Number);
  return {
    hour: hourValue % 12 || 12,
    minute: minuteValue,
    period: hourValue < 12 ? "AM" : "PM",
  };
};

const toMinutes = (value) => {
  const match = String(value || "").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (minute > 59) return null;
  if (match[3]) {
    if (hour < 1 || hour > 12) return null;
    if (match[3].toLowerCase() === "pm" && hour !== 12) hour += 12;
    if (match[3].toLowerCase() === "am" && hour === 12) hour = 0;
  }
  return hour * 60 + minute;
};

export default function ActivityTimePicker({ value, onChange, className = "", minTime, maxTime }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => getDraftTime(value));
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const dialogRef = useRef(null);
  const hours = draft.period === "AM" ? [6, 7, 8, 9, 10, 11] : [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutes = draft.period === "PM" && draft.hour === 11 ? [0] : [0, 15, 30, 45];
  const minMinutes = toMinutes(minTime);
  const maxMinutes = toMinutes(maxTime);
  const isAllowed = (hour, minute, period) => {
    const hour24 = period === "AM" ? hour % 12 : (hour % 12) + 12;
    const total = hour24 * 60 + minute;
    return (minMinutes == null || total >= minMinutes) && (maxMinutes == null || total <= maxMinutes);
  };
  const availableHours = hours.filter((hour) => minutes.some((minute) => isAllowed(hour, minute, draft.period)));
  const availableMinutes = minutes.filter((minute) => isAllowed(draft.hour, minute, draft.period));

  useEffect(() => {
    if (!open) return undefined;
    const updatePosition = () => {
      const bounds = buttonRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const panelWidth = 224;
      const panelHeight = Math.min(170, window.innerHeight - 16);
      const left = Math.min(Math.max(8, bounds.left), window.innerWidth - panelWidth - 8);
      const below = bounds.bottom + 8;
      const top = below + panelHeight <= window.innerHeight ? below : Math.max(8, bounds.top - panelHeight - 8);
      setPosition({ top, left });
    };
    updatePosition();
    const closeOnOutsideClick = (event) => {
      if (!buttonRef.current?.contains(event.target) && !dialogRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  const openPicker = () => {
    setDraft(getDraftTime(value));
    setOpen(true);
  };

  const changePeriod = (period) => {
    setDraft((current) => ({
      ...current,
      hour: period === "AM" && current.hour === 12 ? 6 : current.hour,
      minute: period === "PM" && current.hour === 11 ? 0 : current.minute,
      period,
    }));
  };

  const applyTime = () => {
    const hour24 = draft.period === "AM" ? draft.hour % 12 : (draft.hour % 12) + 12;
    if (!isAllowed(draft.hour, draft.minute, draft.period)) return;
    onChange(`${String(hour24).padStart(2, "0")}:${String(draft.minute).padStart(2, "0")}`);
    setOpen(false);
  };

  return (
    <div className={`relative min-w-0 ${className}`}>
      <button
      ref={buttonRef}
        type="button"
        aria-label={`Activity time: ${formatTimeOption(clampActivityTime(value))}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPicker}
        className="flex h-10 w-full min-w-0 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-left text-sm font-semibold text-slate-800 hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
      >
        <Clock3 aria-hidden="true" size={16} className="shrink-0 text-slate-500" />
        <span className="truncate">{formatTimeOption(clampActivityTime(value))}</span>
      </button>
      {open && typeof document !== "undefined" ? createPortal(
        <div ref={dialogRef} role="dialog" aria-label="Select activity time" style={{ top: position.top, left: position.left }} className="fixed z-[100] w-56 rounded-md border border-slate-200 bg-white p-3 shadow-[0_12px_28px_rgba(15,23,42,0.18)]">
          <p className="mb-3 text-xs font-bold text-slate-800">Select Time</p>
          <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
            <select aria-label="Hour" value={draft.hour} onChange={(event) => {
              const hour = Number(event.target.value);
              setDraft((current) => ({ ...current, hour, minute: current.period === "PM" && hour === 11 ? 0 : current.minute }));
            }} className="h-9 min-w-0 rounded border border-slate-200 bg-slate-50 px-2 text-sm font-semibold text-slate-800">
              {availableHours.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
            </select>
            <select aria-label="Minute" value={draft.minute} onChange={(event) => setDraft((current) => ({ ...current, minute: Number(event.target.value) }))} className="h-9 min-w-0 rounded border border-slate-200 bg-slate-50 px-2 text-sm font-semibold text-slate-800">
              {availableMinutes.map((minute) => <option key={minute} value={minute}>{String(minute).padStart(2, "0")}</option>)}
            </select>
            <div className="flex rounded border border-slate-200 p-0.5 text-[10px] font-bold">
              {["AM", "PM"].map((period) => (
                <button key={period} type="button" aria-pressed={draft.period === period} onClick={() => changePeriod(period)} className={`rounded px-1.5 py-1 ${draft.period === period ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`}>
                  {period}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={() => setOpen(false)} className="rounded px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
            <button type="button" onClick={applyTime} className="rounded bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700">Apply</button>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}