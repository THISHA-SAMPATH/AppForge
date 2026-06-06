"use client";

import { signIn } from "next-auth/react";
import type { CSSProperties } from "react";
import { useState } from "react";
import { MessageSquare, Zap, LayoutDashboard, Smartphone, ShieldCheck, CheckCircle } from "lucide-react";

// Vectors representing Sparkline's dynamic color icons
const cardIcons = [
  {
    label: "Integration",
    delay: "0s",
    className: "left-[4%] top-[22%] w-32 h-32 md:w-36 md:h-36",
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
    className: "left-[9%] top-[55%] w-32 h-32 md:w-36 md:h-36",
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
    className: "left-1/2 -translate-x-1/2 bottom-[0.5%] w-32 h-32 md:w-36 md:h-36",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ff2f92" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12c4-8 4 8 8 0s4-8 8 0" />
      </svg>
    ),
  },
  {
    label: "Workspaces",
    delay: "1.05s",
    className: "right-[9%] top-[55%] w-32 h-32 md:w-36 md:h-36",
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
    className: "right-[4%] top-[22%] w-32 h-32 md:w-36 md:h-36",
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
    <main className="forge-canvas min-h-screen overflow-y-auto overflow-x-hidden p-3 text-[#07090f] sm:p-5">
      <section className="relative min-h-[calc(100vh-24px)] overflow-hidden rounded-[22px] border-[10px] border-white/60 bg-white/75 backdrop-blur-md grid-bg shadow-[0_18px_55px_rgba(15,23,42,0.08)] sm:min-h-[calc(100vh-40px)] sm:border-[14px]">
        <div className="absolute inset-4 rounded-[18px] border border-white/40" />

        {/* Navigation pill header */}
        <header
          className="relative z-20 mx-auto mt-4 flex h-12 items-center justify-between gap-2 rounded-2xl px-2 spark-nav sm:px-3"
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
        <div className="relative z-10 mx-auto mt-5 max-w-4xl px-4 text-center sm:mt-8 sm:px-5">
          <p className="mx-auto mb-6 w-fit rounded-full border border-[#e4e7ee] bg-white px-4 py-2 text-xs font-bold text-[#555d70] shadow-sm">
            Build database apps from config, not boilerplate
          </p>
          <h1 className="mx-auto max-w-4xl text-[clamp(2.8rem,7vw,5.5rem)] font-black leading-[1.15] tracking-tight text-[#07090f]">
            Your future. Your data. <br className="hidden sm:inline" />
            <span className="highlight-mark px-4">Your AI.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-relaxed text-[#5f6677] sm:text-base">
            Take full control with the new data intelligence platform 
            where you can manage all your data with ease.
          </p>

          {/* Social connections */}
          <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
            </button>
          </div>
          <button
            onClick={() => document.getElementById("features-section")?.scrollIntoView({ behavior: "smooth" })}
            className="mt-6 px-6 py-2 rounded-full border border-[#e8825a]/40 bg-[#faf8f5] text-[#e8825a] text-xs font-semibold hover:bg-[#e8825a]/10 active:scale-95 transition-all duration-200 cursor-pointer"
          >
            See How It Works ↓
          </button>
        </div>

        {/* Orbiting 3D Isometric Cards */}
        <div className="pointer-events-none absolute inset-0 hidden md:block">
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

      <section id="features-section" className="w-full px-6 py-24 bg-[#faf8f5] mt-5 rounded-[22px]">
        {/* Part A — How It Works */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-black tracking-tight text-[#07090f] sm:text-4xl">
            How It Works
          </h2>
          <p className="mt-2 text-sm font-semibold text-[#e8825a]">
            From idea to running app in seconds.
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4 max-w-6xl mx-auto mb-28">
          {/* Step 1 */}
          <div className="flex-1 flex flex-col items-center text-center p-6 bg-white rounded-2xl shadow-sm border-t-4 border-[#e8825a] w-full relative">
            <span className="absolute -top-3.5 left-6 bg-[#e8825a] text-white text-[10px] font-black w-7 h-7 rounded-full flex items-center justify-center shadow-sm">1</span>
            <MessageSquare className="w-8 h-8 text-[#e8825a] mb-4" />
            <h3 className="text-sm font-bold text-slate-800 mb-2">Describe Your App</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">Type your idea in plain English — &quot;I need an inventory system with name, price, category&quot;</p>
          </div>
          
          <div className="hidden md:block text-slate-300 text-2xl font-bold select-none">&rarr;</div>
          
          {/* Step 2 */}
          <div className="flex-1 flex flex-col items-center text-center p-6 bg-white rounded-2xl shadow-sm border-t-4 border-[#e8825a] w-full relative">
            <span className="absolute -top-3.5 left-6 bg-[#e8825a] text-white text-[10px] font-black w-7 h-7 rounded-full flex items-center justify-center shadow-sm">2</span>
            <Zap className="w-8 h-8 text-[#e8825a] mb-4" />
            <h3 className="text-sm font-bold text-slate-800 mb-2">AppForge Compiles It</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">The config validator engine normalizes your schema, infers types, and generates the full runtime</p>
          </div>
          
          <div className="hidden md:block text-slate-300 text-2xl font-bold select-none">&rarr;</div>
          
          {/* Step 3 */}
          <div className="flex-1 flex flex-col items-center text-center p-6 bg-white rounded-2xl shadow-sm border-t-4 border-[#e8825a] w-full relative">
            <span className="absolute -top-3.5 left-6 bg-[#e8825a] text-white text-[10px] font-black w-7 h-7 rounded-full flex items-center justify-center shadow-sm">3</span>
            <LayoutDashboard className="w-8 h-8 text-[#e8825a] mb-4" />
            <h3 className="text-sm font-bold text-slate-800 mb-2">Run Your App</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">A live CRUD interface renders from your config — table view, dynamic forms, search, filters</p>
          </div>
          
          <div className="hidden md:block text-slate-300 text-2xl font-bold select-none">&rarr;</div>
          
          {/* Step 4 */}
          <div className="flex-1 flex flex-col items-center text-center p-6 bg-white rounded-2xl shadow-sm border-t-4 border-[#e8825a] w-full relative">
            <span className="absolute -top-3.5 left-6 bg-[#e8825a] text-white text-[10px] font-black w-7 h-7 rounded-full flex items-center justify-center shadow-sm">4</span>
            <Smartphone className="w-8 h-8 text-[#e8825a] mb-4" />
            <h3 className="text-sm font-bold text-slate-800 mb-2">Deploy to Phone</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">Export as PWA or push a deployable Next.js repo to GitHub in one click</p>
          </div>
        </div>

        {/* Part B — Advantages Grid */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-black tracking-tight text-[#07090f] sm:text-4xl">
            Why AppForge
          </h2>
          <p className="mt-2 text-sm font-semibold text-[#e8825a]">
            Built for engineers who move fast.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Advantage 1 */}
          <div className="bg-white/60 backdrop-blur-sm border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 mb-1">No Boilerplate</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">Define your schema once. AppForge derives the database, API, and UI — zero hardcoded routes</p>
            </div>
          </div>
          
          {/* Advantage 2 */}
          <div className="bg-white/60 backdrop-blur-sm border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 mb-1">PWA Support</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">Every runtime is deployable as a Progressive Web App — install it on any device from the browser</p>
            </div>
          </div>
          
          {/* Advantage 3 */}
          <div className="bg-white/60 backdrop-blur-sm border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-orange-50 text-[#e8825a] shrink-0">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 mb-1">Real-time Validation</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">The config validator runs on every change — unknown types fall back gracefully, the app never crashes</p>
            </div>
          </div>
          
          {/* Advantage 4 */}
          <div className="bg-white/60 backdrop-blur-sm border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-slate-50 text-slate-650 shrink-0">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                <path d="M9 18c-4.51 2-5-2-7-2" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 mb-1">Instant GitHub Export</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">Push a deployable Next.js repo with your actual schema and seed data to GitHub in one click</p>
            </div>
          </div>
        </div>

        {/* Part C — Back to Top */}
        <div className="text-center mt-20">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="mt-16 text-xs text-slate-400 hover:text-[#e8825a] transition-colors cursor-pointer bg-transparent border-none"
          >
            ↑ Back to top
          </button>
        </div>
      </section>
    </main>
  );
}
