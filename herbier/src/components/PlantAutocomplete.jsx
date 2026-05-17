import { useEffect, useRef, useState } from "react";
import { searchLocal, searchGBIF, mergeResults } from "../lib/plantSearch.js";

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(255,253,245,0.9)",
  border: "1px solid #c8b89a",
  borderRadius: 3,
  padding: "7px 10px",
  fontSize: 14,
  color: "#3a2e1e",
  fontFamily: "'Courier Prime', monospace",
  outline: "none",
};

export default function PlantAutocomplete({
  value,
  field, // "n" or "l"
  onChange,
  onSelect,
  placeholder,
}) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const wrapRef = useRef();
  const abortRef = useRef();

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const q = value || "";
    if (q.trim().length < 2) {
      setResults([]);
      setRemoteLoading(false);
      return;
    }
    const local = searchLocal(q, 8);
    setResults(local);
    setHighlight(-1);

    if (local.length >= 5) {
      setRemoteLoading(false);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRemoteLoading(true);
    const t = setTimeout(async () => {
      const remote = await searchGBIF(q, { signal: ctrl.signal, limit: 6 });
      if (ctrl.signal.aborted) return;
      setResults((current) => mergeResults(current, remote, 10));
      setRemoteLoading(false);
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  const choose = (item) => {
    onSelect(item);
    setOpen(false);
    setHighlight(-1);
  };

  const onKeyDown = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(results.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(-1, h - 1));
    } else if (e.key === "Enter") {
      if (highlight >= 0) {
        e.preventDefault();
        choose(results[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={inputStyle}
        autoComplete="off"
        spellCheck={false}
      />
      {open && (results.length > 0 || remoteLoading) && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            background: "#faf6ee",
            border: "1px solid #c8b89a",
            borderRadius: 3,
            boxShadow: "0 6px 20px rgba(58,46,30,0.18)",
            zIndex: 50,
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {results.map((r, i) => (
            <button
              key={`${r.l}-${i}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                choose(r);
              }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                background: highlight === i ? "#e8dcc8" : "transparent",
                border: "none",
                borderBottom: "1px solid rgba(200,184,154,0.4)",
                cursor: "pointer",
                fontFamily: "'Courier Prime', monospace",
                color: "#3a2e1e",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: "bold" }}>
                {field === "l" ? r.l : r.n || <em style={{ color: "#9a8a74" }}>(sans nom commun)</em>}
              </div>
              <div style={{ fontSize: 11, color: "#7a6a54", fontStyle: "italic" }}>
                {field === "l" ? r.n || "—" : r.l}
                {r.f && <span style={{ marginLeft: 8, fontStyle: "normal", color: "#9a8a74" }}>· {r.f}</span>}
                {r.source === "gbif" && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontStyle: "normal",
                      fontSize: 9,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      color: "#8a7a5a",
                    }}
                  >
                    GBIF
                  </span>
                )}
              </div>
            </button>
          ))}
          {remoteLoading && (
            <div
              style={{
                padding: "8px 10px",
                fontSize: 11,
                color: "#9a8a74",
                fontStyle: "italic",
              }}
            >
              Recherche en ligne…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
