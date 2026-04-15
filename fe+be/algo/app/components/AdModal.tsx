"use client";

import { useEffect, useRef, useState } from "react";

const AD_DURATION = 5;

interface AdModalProps {
  onComplete: () => void;
  onClose: () => void;
}

export function AdModal({ onComplete, onClose }: AdModalProps) {
  const [countdown, setCountdown] = useState(AD_DURATION);
  const [adCreativeUrl, setAdCreativeUrl] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetch("/api/campaign")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.adCreativeUrl) setAdCreativeUrl(d.adCreativeUrl); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((p) => {
        if (p <= 1) { if (timerRef.current) clearInterval(timerRef.current); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (adCreativeUrl && videoRef.current) videoRef.current.play().catch(() => {});
  }, [adCreativeUrl]);

  const pct = ((AD_DURATION - countdown) / AD_DURATION) * 100;
  const isVideo = adCreativeUrl?.match(/\.(mp4|webm|mov)/i);
  const isImage = adCreativeUrl?.match(/\.(png|jpg|jpeg|gif)/i);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-xl border border-zinc-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4">
          <span className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">Ad</span>
          <button onClick={onClose} className="text-zinc-300 hover:text-zinc-500 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-4 py-3">
          {isVideo && adCreativeUrl ? (
            <video ref={videoRef} src={adCreativeUrl} muted playsInline loop className="w-full rounded bg-zinc-100 max-h-48 object-contain" />
          ) : isImage && adCreativeUrl ? (
            <img src={adCreativeUrl} alt="Ad" className="w-full rounded max-h-48 object-cover" />
          ) : (
            <div className="rounded bg-zinc-50 border border-zinc-100 p-6 text-center">
              <p className="text-sm font-medium text-zinc-900 mb-1">Algorand DeFi</p>
              <p className="text-xs text-zinc-400">Fast, secure, carbon-negative blockchain.</p>
            </div>
          )}
        </div>

        <div className="px-4 pb-4">
          <div className="w-full bg-zinc-100 rounded-full h-1 mb-3">
            <div className="bg-zinc-900 h-1 rounded-full transition-all duration-1000 ease-linear" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-zinc-400">{countdown > 0 ? "Watching..." : "Complete"}</span>
            <span className="text-[11px] font-mono text-zinc-400">{countdown}s</span>
          </div>
          <button
            onClick={onComplete}
            disabled={countdown > 0}
            className="w-full py-2.5 rounded-md text-sm font-medium transition bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-300 disabled:cursor-not-allowed"
          >
            {countdown > 0 ? `Wait ${countdown}s` : "Claim Free Gas"}
          </button>
        </div>
      </div>
    </div>
  );
}
