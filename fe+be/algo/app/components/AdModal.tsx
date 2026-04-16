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
    fetch("/api/campaign").then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.adCreativeUrl) setAdCreativeUrl(d.adCreativeUrl); }).catch(() => {});
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((p) => { if (p <= 1) { if (timerRef.current) clearInterval(timerRef.current); return 0; } return p - 1; });
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#141414] border border-white/10 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4">
          <span className="text-[11px] text-white/30 font-medium uppercase tracking-wider">Sponsored</span>
          <button onClick={onClose} className="text-white/20 hover:text-white/50 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-4 py-3">
          {isVideo && adCreativeUrl ? (
            <video ref={videoRef} src={adCreativeUrl} muted playsInline loop className="w-full rounded-lg bg-black max-h-48 object-contain" />
          ) : isImage && adCreativeUrl ? (
            <img src={adCreativeUrl} alt="Ad" className="w-full rounded-lg max-h-48 object-cover" />
          ) : (
            <div className="rounded-lg bg-white/5 border border-white/5 p-8 text-center">
              <p className="text-white/80 font-medium mb-1">Algorand DeFi</p>
              <p className="text-[13px] text-white/30">Fast, secure, carbon-negative blockchain.</p>
            </div>
          )}
        </div>

        <div className="px-4 pb-4">
          <div className="w-full bg-white/5 rounded-full h-0.5 mb-3">
            <div className="bg-white h-0.5 rounded-full transition-all duration-1000 ease-linear" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-white/30">{countdown > 0 ? "Watching..." : "Complete"}</span>
            <span className="text-[11px] font-mono text-white/30">{countdown}s</span>
          </div>
          <button
            onClick={onComplete}
            disabled={countdown > 0}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition border border-white/20 text-white hover:bg-white/5 disabled:border-white/5 disabled:text-white/20 disabled:cursor-not-allowed"
          >
            {countdown > 0 ? `Wait ${countdown}s` : "Claim Free Gas"}
          </button>
        </div>
      </div>
    </div>
  );
}
