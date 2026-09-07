"use client";

import React, { useState } from "react";

type Props = {
  target: "class" | "stream" | "subject" | "level";
  items: string[];
  onConfirm: (index: number) => void;
  onCancel: () => void;
};

export default function DeleteModal({ target, items, onConfirm, onCancel }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(items.length ? 0 : null);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-title">
      <div className="modal">
        <h3 id="delete-title">Delete {target}</h3>

        {target === "level" && (
          <p style={{ color: "#b91c1c", fontWeight: 600 }}>
            Warning: deleting a level will remove all classes and associated data for that level.
          </p>
        )}

        <div role="listbox" aria-labelledby="delete-title" tabIndex={0} style={{ maxHeight: 240, overflowY: "auto" }}>
          <ul>
            {items.map((name, idx) => (
              <li key={name} style={{ padding: 6 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="radio"
                    name="delete-item"
                    checked={selectedIndex === idx}
                    onChange={() => setSelectedIndex(idx)}
                  />
                  <span>{target === "level" ? (name === "O" ? "O'Level" : "A'Level") : name}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="modal-actions">
          <button
            className="primary"
            onClick={() => {
              if (selectedIndex === null) return;
              onConfirm(selectedIndex);
            }}
            disabled={selectedIndex === null}
          >
            Delete
          </button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>

      <style jsx>{`
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; }
        .modal { background:#fff; padding:1rem; border-radius:8px; width:360px; max-width: calc(100% - 32px); box-shadow: 0 10px 30px rgba(2,6,23,0.2) }
        .modal-actions { display:flex; gap:0.5rem; justify-content:flex-end; margin-top: 8px }
        .primary[disabled] { opacity: 0.5; pointer-events: none }
      `}</style>
    </div>
  );
}
