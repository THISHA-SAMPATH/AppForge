"use client";

import { signIn } from "next-auth/react";
import type { CSSProperties } from "react";
import { useState } from "react";

// Vectors representing Sparkline's dynamic color icons
const cardIcons = [
  {
    label: "Integration",
    delay: "0s",
    className: "left-[6%] bottom-[20%] w-32 h-32 md:w-40 md:h-40",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ff2f92" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="3" />
        <circle cx="5" cy="19" r="3" />
        <circle cx="19" cy="19" r="3" />
        <line x1="12" y1="8" x2="6.5" y2="16.5" />
        <line x1="12" y1="8" x2="17.5" y2="16.5" />
        <line x1="8" y1="19" x2="16" y2="19" />
      </svg>
    ),
  },
  {
    label: "Analytics",
    delay: "0.35s",
    className: "left-[26%] bottom-[10%] w-32 h-32 md:w-40 md:h-40",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ffd32a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    label: "Automation",
    delay: "0.7s",
    className: "left-1/2 -translate-x-1/2 bottom-[5%] w-32 h-32 md:w-40 md:h-40",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ff2f92" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12c4-8 4 8 8 0s4-8 8 0" />
      </svg>
    ),
  },
  {
    label: "Workspaces",
    delay: "1.05s",
    className: "right-[26%] bottom-[10%] w-32 h-32 md:w-40 md:h-40",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1f7aff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m7 4 10 8-10 8" />
        <path d="M12 4l5 8-5 8" />
      </svg>
    ),
  },
  {
    label: "Database",
    delay: "1.4s",
    className: "right-[6%] bottom-[20%] w-32 h-32 md:w-40 md:h-40",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ffd32a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5Z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
];

export default function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSignIn = async (provider: "google" | "github") => {
    setLoading(provider);
    await signIn(provider, { redirectTo: "/dashboard" });
  };

  return (
    <main className="forge-canvas overflow-x-hidden p-3 text-[#07090f] sm:p-5">
      <section className="relative min-h-[calc(100vh-24px)] overflow-hidden rounded-[22px] border-[10px] border-white/60 bg-white/75 backdrop-blur-md grid-bg shadow-[0_18px_55px_rgba(15,23,42,0.08)] sm:min-h-[calc(100vh-40px)] sm:border-[14px]">
        <div className="absolute inset-4 rounded-[18px] border border-white/40" />

        {/* Navigation pill header */}
        <header
          className="relative z-20 mx-auto mt-8 flex h-12 items-center justify-between gap-2 rounded-2xl px-2 spark-nav sm:px-3"
          style={{ width: "calc(100% - 20px)", maxWidth: 720 }}
        >
          <div className="flex items-center gap-2 font-black">
            <img src="/logo.png" className="w-8 h-8 object-contain rounded-lg" alt="AppForge" />
            <span>AppForge</span>
          </div>
          <nav className="hidden items-center gap-7 text-xs font-semibold text-[#232633] md:flex">
            <span>Platform</span>
            <span>Product</span>
            <span>Templates</span>
            <span>Data</span>
          </nav>
          <button
            onClick={() => handleSignIn("github")}
            disabled={!!loading}
            className="rounded-xl bg-black px-4 py-2 text-xs font-bold text-white shadow-[0_10px_22px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 disabled:opacity-60 sm:px-5 cursor-pointer"
          >
            <span className="sm:hidden font-extrabold">
              {loading === "github" ? "..." : "Try"}
            </span>
            <span className="hidden sm:inline font-extrabold">
              {loading === "github" ? "Opening..." : "Try AppForge"}
            </span>
          </button>
        </header>

        {/* Hero title block */}
        <div className="relative z-10 mx-auto mt-16 max-w-4xl px-4 text-center sm:mt-24 sm:px-5">
          <p className="mx-auto mb-6 w-fit rounded-full border border-[#e4e7ee] bg-white px-4 py-2 text-xs font-bold text-[#555d70] shadow-sm">
            Build database apps from config, not boilerplate
          </p>
          <h1 className="mx-auto max-w-4xl text-[clamp(2.8rem,7vw,5.5rem)] font-black leading-[0.95] tracking-tight text-[#07090f]">
            Your future. Your data. <br className="hidden sm:inline" />
            <span className="highlight-mark px-4">Your AI.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-sm font-medium leading-relaxed text-[#5f6677] sm:text-base">
            Take full control with the new data intelligence platform 
            where you can manage all your data with ease.
          </p>

          {/* Social connections */}
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={() => handleSignIn("google")}
              disabled={!!loading}
              className="btn-primary glow-btn-primary min-w-48 gap-2 px-6 py-3 text-xs font-bold cursor-pointer"
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[10px] font-black text-[#1f7aff]">
                G
              </span>
              {loading === "google" ? "Signing in..." : "Continue with Google"}
            </button>
            <button
              onClick={() => handleSignIn("github")}
              disabled={!!loading}
              className="btn-ghost min-w-48 gap-2 px-6 py-3 text-xs font-bold cursor-pointer"
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-black text-[10px] font-black text-white">
                GH
              </span>
              {loading === "github" ? "Signing in..." : "Continue with GitHub"}
            </button>
          </div>
        </div>

        {/* Orbiting 3D Isometric Cards */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[45%] md:block">
          {cardIcons.map((card) => (
            <div
              key={card.label}
              className={`isometric-tile absolute ${card.className}`}
              style={
                {
                  "--delay": card.delay,
                } as CSSProperties
              }
            >
              <div className="flex flex-col items-center gap-3">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white shadow-[0_12px_28px_rgba(15,23,42,0.1)] border border-slate-100">
                  {card.icon}
                </div>
                <span className="text-xs font-bold text-[#8a91a3] uppercase tracking-wider">
                  {card.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
