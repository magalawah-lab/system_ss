"use client";

import React, { useState, useRef, useEffect } from "react";

export type ContextMenuItem = { label: string; action: () => void; danger?: boolean; icon?: React.ReactNode };

export default function ContextMenu({ items, label = "Actions" }: { items: ContextMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<HTMLButtonElement[]>([]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  useEffect(() => {
    if (!open) return;
    // focus the first item for keyboard users
    requestAnimationFrame(() => {
      itemRefs.current[0]?.focus();
    });
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    const { key, shiftKey } = e;
    const focused = document.activeElement as HTMLElement | null;
    const idx = itemRefs.current.findIndex((el) => el === focused);
    if (key === "Escape") {
      setOpen(false);
      (rootRef.current?.querySelector("button.icon-btn") as HTMLButtonElement | null)?.focus();
    } else if (key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min((idx < 0 ? 0 : idx) + 1, itemRefs.current.length - 1);
      itemRefs.current[next]?.focus();
    } else if (key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max((idx < 0 ? 0 : idx) - 1, 0);
      itemRefs.current[prev]?.focus();
    } else if (key === 'Tab') {
      e.preventDefault();
      if (shiftKey) {
        const prev = idx <= 0 ? itemRefs.current.length - 1 : idx - 1;
        itemRefs.current[prev]?.focus();
      } else {
        const next = idx >= itemRefs.current.length - 1 ? 0 : idx + 1;
        itemRefs.current[next]?.focus();
      }
    }
  }

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-block" }}>
      <button className="icon-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((s) => !s)} title={label}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="5" cy="12" r="2" fill="currentColor" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <circle cx="19" cy="12" r="2" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div className="context-menu" role="menu" onKeyDown={onKeyDown} style={{ position: "absolute", right: 0, marginTop: 6, zIndex: 40 }}>
          {items.map((it, i) => (
            <button
              key={i}
              ref={(el) => { if (el) itemRefs.current[i] = el; }}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.action();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOpen(false);
                }
              }}
              className={it.danger ? "danger" : ""}
              style={{ display: "flex", gap: 10, alignItems: 'center', width: "100%", textAlign: "left", padding: "0.56rem 0.9rem", background: "#fff", border: "none", cursor: "pointer" }}
            >
              <span style={{ width: 18, display: 'inline-flex', alignItems: 'center' }}>{it.icon ?? null}</span>
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      )}

      <style jsx>{`
        .context-menu { box-shadow: 0 6px 18px rgba(2,6,23,0.12); border-radius:6px; border:1px solid #eef2ff; background:#fff; min-width:160px; animation: pop 120ms ease-out }
        @keyframes pop { from { opacity:0; transform: translateY(-6px) scale(.98) } to { opacity:1; transform: translateY(0) scale(1) } }
        .context-menu button:hover { background:#f8fafc }
        .icon-btn { background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.06); padding: 0.25rem; border-radius: 6px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer }
        .danger { color: #b91c1c }
        @media (prefers-reduced-motion: reduce) { .context-menu { animation: none } }
      `}</style>
    </div>
  );
}
