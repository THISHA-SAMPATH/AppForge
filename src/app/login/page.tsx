"use client";

import { signIn } from "next-auth/react";
import type { CSSProperties } from "react";
import { useState } from "react";

const tiles = [
  {
    label: "JSON",
    mark: "{}",
    className: "left-[5%] bottom-[24%] w-36 h-24 md:w-44 md:h-28",
    color: "text-[#ff2f92]",
    delay: "0s",
    tilt: "-8deg",
  },
  {
    label: "Schema",
    mark: "|||",
    className: "left-[24%] bottom-[12%] w-40 h-24 md:w-52 md:h-28",
    color: "text-[#ffd32a]",
    delay: "0.35s",
    tilt: "5deg",
  },
  {
    label: "Builder",
    mark: "AF",
    className: "left-1/2 -translate-x-1/2 bottom-[5%] w-36 h-24 md:w-44 md:h-28",
    color: "text-[#ff2f92]",
    delay: "0.7s",
    tilt: "-3deg",
  },
  {
    label: "Records",
    mark: "M",
    className: "right-[18%] bottom-[18%] w-40 h-24 md:w-52 md:h-28",
    color: "text-[#1f7aff]",
    delay: "1.05s",
    tilt: "8deg",
  },
  {
    label: "Deploy",
    mark: "DB",
    className: "right-[5%] bottom-[30%] w-36 h-24 md:w-44 md:h-28",
    color: "text-[#ffd32a]",
    delay: "1.4s",
    tilt: "-5deg",
  },
];

export default function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSignIn = async (provider: "google" | "github") => {
    setLoading(provider);
    await signIn(provider, { redirectTo: "/dashboard" });
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#d9dde3] p-3 text-[#07090f] sm:p-5">
      <section className="relative min-h-[calc(100vh-24px)] overflow-hidden rounded-[22px] border-[10px] border-white bg-[#fbfbfc] shadow-[0_18px_55px_rgba(15,23,42,0.12)] sm:min-h-[calc(100vh-40px)] sm:border-[14px]">
        <div className="absolute inset-4 rounded-[18px] border border-[#e7e9ee]" />

        <header
          className="relative z-20 mx-auto mt-8 flex h-12 items-center justify-between gap-2 rounded-2xl px-2 spark-nav sm:px-3"
          style={{ width: "calc(100% - 20px)", maxWidth: 720 }}
        >
          <div className="flex items-center gap-2 font-black">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-black text-xs text-white">
              AF
            </span>
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
            className="rounded-xl bg-black px-4 py-2 text-xs font-bold text-white shadow-[0_10px_22px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 disabled:opacity-60 sm:px-5"
          >
            <span className="sm:hidden">
              {loading === "github" ? "..." : "Try"}
            </span>
            <span className="hidden sm:inline">
              {loading === "github" ? "Opening..." : "Try AppForge"}
            </span>
          </button>
        </header>

        <div className="relative z-10 mx-auto mt-16 max-w-4xl px-4 text-center sm:mt-20 sm:px-5">
          <p className="mx-auto mb-5 w-fit rounded-full border border-[#e4e7ee] bg-white px-4 py-2 text-xs font-bold text-[#555d70] shadow-sm">
            Build database apps from config, not boilerplate
          </p>
          <h1 className="mx-auto max-w-4xl text-[clamp(3rem,8vw,6.4rem)] font-black leading-[0.92] tracking-normal">
            Your data.
            <br />
            Your app.
            <br />
            <span className="highlight-mark">Your AI.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-sm font-medium leading-6 text-[#5f6677] sm:text-base">
            Turn a JSON schema into a working workspace with records, forms, and
            generated app views in minutes.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={() => handleSignIn("google")}
              disabled={!!loading}
              className="btn-primary min-w-48 gap-2 px-6 py-3"
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-xs font-black text-[#1f7aff]">
                G
              </span>
              {loading === "google" ? "Signing in..." : "Continue with Google"}
            </button>
            <button
              onClick={() => handleSignIn("github")}
              disabled={!!loading}
              className="btn-ghost min-w-48 gap-2 px-6 py-3"
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-black text-xs font-black text-white">
                GH
              </span>
              {loading === "github" ? "Signing in..." : "Continue with GitHub"}
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[45%] md:block">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className={`floating-tile absolute grid place-items-center rounded-[8px] ${tile.className}`}
              style={
                {
                  animationDelay: tile.delay,
                  "--tilt": tile.tilt,
                } as CSSProperties
              }
            >
              <div className="grid place-items-center gap-2">
                <div
                  className={`grid h-12 w-12 place-items-center rounded-[8px] bg-white text-lg font-black shadow-[0_12px_25px_rgba(15,23,42,0.12)] ${tile.color}`}
                >
                  {tile.mark}
                </div>
                <span className="text-xs font-bold text-[#8a91a3]">
                  {tile.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
