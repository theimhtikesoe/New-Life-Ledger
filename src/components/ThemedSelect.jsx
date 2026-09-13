"use client";
import { useEffect, useMemo, useRef, useState } from "react";

export default function ThemedSelect({ value = "", onChange, children, className = "", disabled = false, id, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const options = useMemo(() => {
    const list = Array.isArray(children) ? children : [children];
    return list
      .filter(Boolean)
      .map((child) => ({
        value: String(child.props?.value ?? child.props?.children ?? ""),
        label: child.props?.children ?? "",
        disabled: Boolean(child.props?.disabled),
        className: child.props?.className || "",
      }));
  }, [children]);
  const selected = options.find((option) => option.value === String(value)) || options[0] || { value: "", label: "" };

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const selectOption = (option) => {
    if (disabled || option.disabled) return;
    onChange?.({ target: { value: option.value } });
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`relative flex w-full items-center justify-between gap-3 text-left transition-all focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        <span className="min-w-0 flex-1 truncate">{selected.label}</span>
        <span className={`shrink-0 text-xs text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      {open && !disabled ? (
        <div role="listbox" aria-labelledby={id} className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-[120] max-h-64 overflow-y-auto rounded-xl border border-cyan-200 bg-white/95 p-1.5 shadow-[0_18px_45px_rgba(15,23,42,0.22)] backdrop-blur-xl">
          {options.map((option) => (
            <button
              key={`${option.value}-${String(option.label)}`}
              type="button"
              role="option"
              aria-selected={option.value === String(value)}
              disabled={option.disabled}
              onClick={() => selectOption(option)}
              className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors ${option.value === String(value) ? "bg-cyan-100 text-cyan-950" : "text-slate-700 hover:bg-cyan-50 hover:text-cyan-950"} ${option.className} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
