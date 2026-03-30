"use client";
import { useState, useEffect } from "react";

const QUALITY_OPTIONS = [
  { value: "best",       label: "Best",       desc: "Highest available" },
  { value: "1080p",      label: "1080p",      desc: "Full HD" },
  { value: "720p",       label: "720p",       desc: "HD" },
  { value: "480p",       label: "480p",       desc: "Standard" },
  { value: "360p",       label: "360p",       desc: "Low" },
  { value: "audio_only", label: "Audio",      desc: "MP3 only" },
];

type Status =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; message: string }
  | { type: "error";   message: string };

export default function HomePage() {
  const [theme, setTheme]     = useState<"light" | "dark">("dark");
  const [url, setUrl]         = useState("");
  const [quality, setQuality] = useState("720p");
  const [status, setStatus]   = useState<Status>({ type: "idle" });

  useEffect(() => {
    
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const handleDownload = async () => {
    if (!url.trim()) {
      setStatus({ type: "error", message: "Please enter a YouTube URL." });
      return;
    }

    setStatus({ type: "loading" });

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, quality }), 
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus({ type: "error", message: data.error ?? "Download failed." });
      } else {
        setStatus({ type: "success", message: data.message ?? "Download started successfully!" });
        setUrl("");
      }
    } catch {
      setStatus({ type: "error", message: "Could not reach the server. Is the backend running?" });
    }
  };

  return (
    <div className="page-wrapper">
      <nav className="navbar">
        <div className="navbar-brand">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" fill="var(--accent)" stroke="none"/>
          </svg>
          YT<span className="dot">.</span>Loader
        </div>
        <div className="navbar-actions">
          <button
            className="btn btn-icon"
            onClick={() => setTheme(t => t === "light" ? "dark" : "light")}
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
        </div>
      </nav>

      <main className="hero">
        <p className="hero-eyebrow">Free & Open Source</p>
        <h1 className="hero-title">
          Download videos,<br /><em>your way.</em>
        </h1>
        <p className="hero-subtitle">
          Paste any YouTube link, pick your quality, and save it to your Downloads folder.
        </p>

        <div className="card">
          <p className="card-label">YouTube URL</p>
          <div className="input-group">
            <input
              className="url-input"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={e => { setUrl(e.target.value); setStatus({ type: "idle" }); }}
              onKeyDown={e => e.key === "Enter" && handleDownload()}
            />
          </div>

          <p className="card-label">Quality</p>
          <div className="quality-grid" style={{ marginTop: 8 }}>
            {QUALITY_OPTIONS.map(opt => (
              <div className="quality-option" key={opt.value}>
                <input
                  type="radio"
                  id={`q-${opt.value}`}
                  name="quality"
                  value={opt.value}
                  checked={quality === opt.value}
                  onChange={() => setQuality(opt.value)}
                />
                <label htmlFor={`q-${opt.value}`}>
                  <span className="q-badge">{opt.label}</span>
                  <span className="q-desc">{opt.desc}</span>
                </label>
              </div>
            ))}
          </div>

          <div className="divider" />

          {status.type !== "idle" && (
            <div className={`status-banner ${status.type}`}>
              {status.type === "loading" && <span className="spinner" />}
              {status.type === "success" && <span>✅</span>}
              {status.type === "error"   && <span>❌</span>}
              <span>
                {status.type === "loading"
                  ? "Downloading… this may take a moment."
                  : status.message}
              </span>
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "14px 20px", fontSize: "0.95rem", borderRadius: 10 }}
            onClick={handleDownload}
            disabled={status.type === "loading"}
          >
            {status.type === "loading" ? "Downloading…" : "Download Video"}
          </button>
        </div>
      </main>

      <footer className="footer">
        Powered by <strong>yt-dlp</strong> · Built with Next.js
      </footer>
    </div>
  );
}