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

  // Fetch campaign ad creative from API (Supabase storage or local upload)
  useEffect(() => {
    fetch("/api/campaign")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.adCreativeUrl) {
          setAdCreativeUrl(data.adCreativeUrl);
        }
      })
      .catch(() => {});
  }, []);

  // Start countdown
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Auto-play video when URL loads
  useEffect(() => {
    if (adCreativeUrl && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [adCreativeUrl]);

  const progress = ((AD_DURATION - countdown) / AD_DURATION) * 100;
  const isVideo = adCreativeUrl?.match(/\.(mp4|webm|mov)/i);
  const isImage = adCreativeUrl?.match(/\.(png|jpg|jpeg|gif)/i);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.1em]">
            Sponsored Ad
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-gray-400">
              {countdown > 0 ? `00:${countdown.toString().padStart(2, "0")}` : "Done"}
            </span>
            <button
              onClick={onClose}
              className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Ad Creative */}
        <div className="px-5 py-4">
          {isVideo && adCreativeUrl ? (
            <video
              ref={videoRef}
              src={adCreativeUrl}
              muted
              playsInline
              loop
              className="w-full rounded-xl bg-black max-h-64 object-contain"
            />
          ) : isImage && adCreativeUrl ? (
            <img
              src={adCreativeUrl}
              alt="Sponsored ad"
              className="w-full rounded-xl max-h-64 object-cover"
            />
          ) : (
            /* Fallback gradient ad */
            <div className="rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-500 p-7 text-white text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent)]" />
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-xl font-bold mb-1.5">Algorand DeFi</p>
                <p className="text-sm opacity-80 leading-relaxed max-w-[240px] mx-auto">
                  Fast, secure, carbon-negative blockchain for the next generation of finance.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Progress + CTA */}
        <div className="px-5 pb-5">
          <div className="w-full bg-gray-100 rounded-full h-1 mb-4">
            <div
              className="bg-gradient-to-r from-violet-600 to-indigo-500 h-1 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <button
            onClick={onComplete}
            disabled={countdown > 0}
            className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold transition disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed hover:bg-gray-800 active:scale-[0.98]"
          >
            {countdown > 0 ? `Wait ${countdown}s` : "Claim Free Gas"}
          </button>
        </div>
      </div>
    </div>
  );
}
