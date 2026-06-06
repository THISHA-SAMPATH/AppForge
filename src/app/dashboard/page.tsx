"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AppConfig, FieldConfig, FieldType } from "@/types/config";

interface App {
  id: string;
  name: string;
  description: string | null;
  config: {
    entity: string;
    fields: Array<{ name: string; type: string; required?: boolean; options?: string[] }>;
    ui?: { layout: string };
  };
  createdAt: string;
  updatedAt: string;
  _count: { records: number };
}

interface Toast {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

const STARTERS = [
  {
    label: "Product Inventory",
    mark: "PI",
    color: "#ffd32a",
    desc: "Track products, prices & stock",
    config: { entity: "Product", fields: [{ name: "title", type: "string", required: true }, { name: "price", type: "number" }, { name: "category", type: "enum", options: ["Electronics", "Clothing", "Food"] }, { name: "inStock", type: "boolean" }], ui: { layout: "table" } },
  },
  {
    label: "Task Manager",
    mark: "TM",
    color: "#7c6ef5",
    desc: "Manage tasks with priorities",
    config: { entity: "Task", fields: [{ name: "title", type: "string", required: true }, { name: "status", type: "enum", options: ["Todo", "In Progress", "Done"] }, { name: "dueDate", type: "date" }, { name: "priority", type: "enum", options: ["Low", "Medium", "High"] }], ui: { layout: "table" } },
  },
  {
    label: "Contact Book",
    mark: "CB",
    color: "#ff4d9e",
    desc: "Store contacts & companies",
    config: { entity: "Contact", fields: [{ name: "name", type: "string", required: true }, { name: "email", type: "string" }, { name: "phone", type: "string" }, { name: "company", type: "string" }], ui: { layout: "table" } },
  },
];

function parseDescriptionToConfig(desc: string): AppConfig {
  const clean = desc.trim();
  if (clean.startsWith("{") && clean.endsWith("}")) {
    try { return JSON.parse(clean); } catch { /* fallthrough */ }
  }
  let entity = "Record";
  const entityMatch = clean.match(/(?:build|create|make|track|manage|for)\s+(?:an?\s+)?([a-zA-Z0-9_-]+)/i);
  if (entityMatch?.[1]) {
    const raw = entityMatch[1];
    entity = raw.charAt(0).toUpperCase() + raw.slice(1).replace(/s$/, "");
  } else {
    const words = clean.split(/\s+/).filter((w) => w.length > 2);
    if (words.length > 0) entity = words[0].charAt(0).toUpperCase() + words[0].slice(1).replace(/[^a-zA-Z0-9]/g, "");
  }
  if (!entity || entity.length < 2) entity = "AppItem";

  const fields: FieldConfig[] = [];
  const seenNames = new Set<string>();
  const checkAndAddField = (name: string, type: FieldType, opts?: string[]) => {
    const cleanName = name.replace(/[^a-zA-Z0-9_]/g, "");
    if (!cleanName || seenNames.has(cleanName)) return;
    seenNames.add(cleanName);
    fields.push({ name: cleanName, type, required: false, options: opts });
  };

  if (clean.includes("name") || clean.includes("title")) checkAndAddField(clean.includes("title") ? "title" : "name", "string");
  const typeMap: Array<{ keys: string[]; name: string; type: FieldType; options?: string[] }> = [
    { keys: ["email"], name: "email", type: "string" },
    { keys: ["phone", "tel"], name: "phone", type: "string" },
    { keys: ["price", "cost", "amount", "salary"], name: "price", type: "number" },
    { keys: ["age", "count", "quantity", "rating"], name: "quantity", type: "number" },
    { keys: ["date", "due", "deadline", "birthday"], name: "date", type: "date" },
    { keys: ["status", "state"], name: "status", type: "enum", options: ["Todo", "In Progress", "Completed"] },
    { keys: ["category", "type", "tag", "genre"], name: "category", type: "enum", options: ["General", "Premium", "Archive"] },
    { keys: ["active", "enabled", "done", "complete"], name: "active", type: "boolean" },
  ];
  typeMap.forEach((item) => { if (item.keys.some((k) => clean.includes(k))) checkAndAddField(item.name, item.type, item.options); });
  if (fields.length === 0) {
    fields.push({ name: "name", type: "string", required: true });
    fields.push({ name: "description", type: "string" });
    fields.push({ name: "status", type: "enum", options: ["Active", "Inactive"] });
  }
  return { entity, fields, ui: { layout: "table" } };
}

const getAppTheme = (name: string, entity: string) => {
  const n = name.toLowerCase();
  const e = entity.toLowerCase();
  if (n.includes("task") || e.includes("task") || n.includes("todo") || e.includes("todo")) {
    return {
      bg: "bg-[#fff7ed] text-[#ea580c] border-[#ffedd5]",
      iconBg: "bg-[#ffedd5] text-[#d97706]",
      color: "#d97706",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    };
  }
  if (n.includes("contact") || e.includes("contact") || n.includes("customer") || e.includes("customer") || n.includes("user") || e.includes("user")) {
    return {
      bg: "bg-[#fdf2f8] text-[#db2777] border-[#fce7f3]",
      iconBg: "bg-[#fce7f3] text-[#db2777]",
      color: "#db2777",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    };
  }
  return {
    bg: "bg-[#faf5ff] text-[#7c6ef5] border-[#f3e8ff]",
    iconBg: "bg-[#f3e8ff] text-[#7c6ef5]",
    color: "#7c6ef5",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    )
  };
};

const getRelativeTime = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Updated just now";
    if (diffMins < 60) return `Updated ${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `Updated ${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `Updated ${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return `Updated on ${date.toLocaleDateString()}`;
  } catch {
    return "Updated recently";
  }
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [forging, setForging] = useState(false);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Command palette state
  const [showCmdPalette, setShowCmdPalette] = useState(false);
  const [cmdSearch, setCmdSearch] = useState("");
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [cloningAppId, setCloningAppId] = useState<string | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const inferredConfig = assistantPrompt.trim() ? parseDescriptionToConfig(assistantPrompt) : null;
  const promptChars = assistantPrompt.length;
  const promptLimit = 500;

  const notify = useCallback((type: Toast["type"], message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev.slice(-2), { id, type, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

  const loadApps = useCallback(async (cancelled?: () => boolean) => {
    try {
      const r = await fetch("/api/apps");
      const d = await r.json();
      if (cancelled?.()) return;
      if (d.success) setApps(d.data);
      else notify("error", d.error || "Could not load recent runtimes.");
    } catch {
      if (!cancelled?.()) notify("error", "Could not load recent runtimes.");
    } finally {
      if (!cancelled?.()) setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void loadApps(() => cancelled);
    });

    // Click outside handler for profile menu
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    // Global keydown listener for Ctrl+K
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowCmdPalette((prev) => !prev);
      }
      if (e.key === "Escape") {
        setShowCmdPalette(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelled = true;
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [loadApps]);

  const handleForgeAssistant = (promptText = assistantPrompt) => {
    if (!promptText.trim()) return;
    setForging(true);
    setError("");
    try {
      const config = parseDescriptionToConfig(promptText);
      const encoded = encodeURIComponent(JSON.stringify(config));
      const appName = config.entity + " App";
      notify("info", `Forging ${appName} with ${config.fields.length} inferred fields...`);
      window.setTimeout(() => {
        router.push(`/apps/new?prefill=${encoded}&name=${encodeURIComponent(appName)}&desc=${encodeURIComponent(promptText)}&animate=true`);
      }, 520);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not parse query.";
      setError(message);
      notify("error", message);
      setForging(false);
    }
  };

  const handleCloneApp = async (app: App) => {
    setCloningAppId(app.id);
    try {
      const response = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${app.name} Copy`,
          description: app.description,
          config: app.config,
        }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Could not duplicate runtime.");
      }
      const clonedApp: App = {
        ...data.data.app,
        _count: { records: 0 },
      };
      setApps((current) => [clonedApp, ...current]);
      notify("success", `Duplicated ${app.name}.`);
    } catch (e: unknown) {
      notify("error", e instanceof Error ? e.message : "Could not duplicate runtime.");
    } finally {
      setCloningAppId(null);
    }
  };

  const filteredCmdApps = apps.filter((app) =>
    app.name.toLowerCase().includes(cmdSearch.toLowerCase())
  );

  const initials = session?.user?.name?.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "AF";

  return (
    <div className="forge-canvas flex flex-col justify-between p-6 relative overflow-hidden">
      
      {/* ─── BACKGROUND ABSTRACT WAVES (HORIZONTAL FLOW) ───────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <svg className="absolute w-full h-full min-w-[1400px] opacity-75" viewBox="0 0 1440 800" fill="none" preserveAspectRatio="none">
          {/* Glowing Wave Ribbon 1 (Warm Peach/Orange) */}
          <path d="M -100 360 C 250 480, 450 200, 750 380 C 1050 560, 1250 280, 1600 400" fill="none" stroke="url(#flow-gradient-orange)" strokeWidth="90" strokeLinecap="round" opacity="0.45" filter="url(#glow-blur)" />
          {/* Glowing Wave Ribbon 2 (Soft Purple/Lavender) */}
          <path d="M -100 430 C 200 280, 400 540, 800 320 C 1150 100, 1300 440, 1600 320" fill="none" stroke="url(#flow-gradient-purple)" strokeWidth="110" strokeLinecap="round" opacity="0.35" filter="url(#glow-blur)" />
          {/* Glowing Wave Ribbon 3 (Warm Golden Sunset) */}
          <path d="M -100 280 C 320 520, 520 180, 920 440 C 1220 580, 1350 280, 1600 220" fill="none" stroke="url(#flow-gradient-gold)" strokeWidth="60" strokeLinecap="round" opacity="0.25" filter="url(#glow-blur)" />
          
          <defs>
            {/* Gaussian Blur Filter for premium light leak / ribbon glow effect */}
            <filter id="glow-blur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="35" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            
            <linearGradient id="flow-gradient-orange" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fff2e5" />
              <stop offset="35%" stopColor="#f58046" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#e26e38" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#fedfc9" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="flow-gradient-purple" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#eedeff" />
              <stop offset="40%" stopColor="#c084fc" stopOpacity="0.8" />
              <stop offset="75%" stopColor="#a78bfa" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#ebd8ff" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="flow-gradient-gold" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#faf0e0" />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#fffdfa" stopOpacity="0.2" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* ─── FLOATING TOP NAV ────────────────────────────────────────────────────── */}
      <header className="forge-topnav border-none shadow-[0_8px_30px_rgba(0,0,0,0.015)] bg-white/45 z-40">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 text-decoration-none">
            <img src="/logo.png" className="w-6 h-6 object-contain rounded-md" alt="AppForge" />
            <span className="font-extrabold tracking-tight text-sm text-slate-850">AppForge</span>
          </Link>
        </div>

        {/* Center links */}
        <div className="hidden sm:flex items-center gap-7">
          <Link href="/playground" className="text-xs font-bold text-slate-600 hover:text-[#7c6ef5] transition text-decoration-none">
            Playground
          </Link>
          <Link href="/import" className="text-xs font-bold text-slate-600 hover:text-[#7c6ef5] transition text-decoration-none">
            Import CSV
          </Link>
          <button 
            onClick={() => setShowCmdPalette(true)}
            className="text-xs font-semibold text-slate-400 bg-white/30 hover:bg-white/70 px-3.5 py-1.5 rounded-full transition border border-slate-200/40 cursor-pointer flex items-center gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
          >
            <span>Search</span>
            <span className="text-[10px] text-slate-350 font-mono scale-90">Ctrl + K</span>
          </button>
        </div>

        {/* User initials / Signout */}
        <div className="relative font-sans" ref={profileMenuRef}>
          <button
            onClick={() => setShowProfileDropdown((prev) => !prev)}
            className="w-8 h-8 rounded-full bg-[#f5a100] font-black text-xs text-white border-none cursor-pointer flex items-center justify-center hover:scale-105 transition shadow-sm"
          >
            {initials}
          </button>

          {showProfileDropdown && (
            <div className="dropdown-glass-menu border border-slate-200/80 shadow-[0_20px_40px_rgba(15,23,42,0.08)] bg-white/90" style={{ right: 0, left: "auto" }}>
              <div className="p-3 border-b border-slate-100 bg-white/30">
                <p className="text-xs font-black text-slate-800 m-0">{session?.user?.name || "Builder"}</p>
                <p className="text-[10px] text-slate-500 m-0 mt-0.5">{session?.user?.email || ""}</p>
              </div>
              <div className="p-1.5 flex flex-col">
                <Link href="/playground" className="text-xs font-bold text-slate-700 hover:bg-slate-50 p-2.5 rounded-xl text-decoration-none transition">
                  Config Playground
                </Link>
                <Link href="/import" className="text-xs font-bold text-slate-700 hover:bg-slate-50 p-2.5 rounded-xl text-decoration-none transition">
                  Import CSV File
                </Link>
                <Link href="/settings" className="text-xs font-bold text-slate-700 hover:bg-slate-50 p-2.5 rounded-xl text-decoration-none transition">
                  Settings
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="text-xs font-bold text-red-600 hover:bg-red-50 p-2.5 rounded-xl text-left transition border-none bg-transparent cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ─── CENTRAL HERO & INPUT ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-[1400px] mx-auto mt-24 animate-fade-up relative z-10">
        
        <div className="relative w-full max-w-[1360px] mx-auto flex flex-col items-center justify-center py-6 min-h-[480px]">
          
          <h1 className="font-serif text-[clamp(2.8rem,6.5vw,4.5rem)] font-normal italic text-slate-900 text-center tracking-tight leading-[1.15] mb-2.5 z-20">
            What are we <span className="text-[#7c6ef5] font-serif font-normal italic">building</span> today?
          </h1>
          <p className="text-xs md:text-sm font-semibold text-slate-400 text-center max-w-md mx-auto mb-10 z-20">
            Describe your idea in natural language and AppForge will build the full application for you.
          </p>

          {/* ─ FLOATING DECORATOR CARDS (Cleaned & Positioned Outwards) ─────────── */}
          {/* Database Card */}
          <div className="absolute left-[3%] top-[4%] lg:left-[5%] lg:top-[8%] hidden xl:flex flex-col w-[150px] p-4 bg-white/50 border border-white/70 rounded-2xl glass-floating-card float-anim-1 z-15 text-[10px] select-none">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-500 text-xs">📁</span>
              <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wide">Database</span>
            </div>
            <div className="space-y-1.5 text-slate-400 font-bold pl-1 font-mono text-[9px] mt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                <span>id: string</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                <span>name: string</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                <span>price: number</span>
              </div>
            </div>
          </div>

          {/* UI Elements Card */}
          <div className="absolute right-[3%] top-[6%] lg:right-[5%] lg:top-[10%] hidden xl:flex flex-col w-[150px] p-4 bg-white/50 border border-white/70 rounded-2xl glass-floating-card float-anim-2 z-15 text-[10px] select-none">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-indigo-500 text-xs">㗊</span>
              <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wide">UI elements</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100/30 rounded-xl mt-1">
              <div className="h-5.5 rounded-lg bg-white border border-slate-100 flex items-center justify-center font-bold text-[8.5px] text-slate-450 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">Box</div>
              <div className="h-5.5 rounded-lg bg-white border border-slate-100 flex items-center justify-center font-bold text-[8.5px] text-slate-450 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">List</div>
              <div className="h-5.5 rounded-lg bg-white border border-slate-100 flex items-center justify-center font-bold text-[8.5px] text-slate-450 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">Card</div>
              <div className="h-5.5 rounded-lg bg-white border border-slate-100 flex items-center justify-center font-bold text-[8.5px] text-slate-450 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">Grid</div>
            </div>
          </div>

          {/* API Endpoints Card */}
          <div className="absolute left-[4%] bottom-[8%] lg:left-[6%] lg:bottom-[12%] hidden xl:flex flex-col w-[150px] p-4 bg-white/50 border border-white/70 rounded-2xl glass-floating-card float-anim-3 z-15 text-[10px] select-none">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-emerald-500 font-mono font-black text-xs">&lt;/&gt;</span>
              <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wide">Endpoints</span>
            </div>
            <div className="space-y-1.5 font-mono text-[8.5px] font-bold text-slate-500 mt-1.5">
              <div className="bg-white/60 px-2 py-1.5 rounded-xl border border-slate-200/40 truncate shadow-[0_1px_2px_rgba(0,0,0,0.01)]">GET /api/apps</div>
              <div className="bg-white/60 px-2 py-1.5 rounded-xl border border-slate-200/40 truncate shadow-[0_1px_2px_rgba(0,0,0,0.01)]">POST /api/records</div>
            </div>
          </div>

          {/* Analytics Card */}
          <div className="absolute right-[4%] bottom-[6%] lg:right-[6%] lg:bottom-[10%] hidden xl:flex flex-col w-[150px] p-4 bg-white/50 border border-white/70 rounded-2xl glass-floating-card float-anim-4 z-15 text-[10px] select-none">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-indigo-500 text-xs">📊</span>
              <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wide">Analytics</span>
            </div>
            <div className="flex items-end justify-center gap-1.5 h-11 bg-slate-100/30 rounded-xl p-2 mt-1.5">
              <div className="w-2.5 h-4 bg-indigo-400/70 rounded-sm" />
              <div className="w-2.5 h-6 bg-indigo-500 rounded-sm" />
              <div className="w-2.5 h-8 bg-indigo-600 rounded-sm" />
              <div className="w-2.5 h-5 bg-purple-400/80 rounded-sm" />
              <div className="w-2.5 h-7 bg-purple-500 rounded-sm" />
            </div>
          </div>

          {/* Connection Lines SVGs (Dotted & Translucent) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none hidden xl:block z-0" viewBox="0 0 1360 480" preserveAspectRatio="none">
            {/* Database to Prompt Box */}
            <path d="M 170 95 C 270 95, 260 215, 370 215" className="path-connection" fill="none" strokeWidth="1.2" />
            {/* UI elements to Prompt Box */}
            <path d="M 1190 105 C 1090 105, 1100 215, 990 215" className="path-connection-alt" fill="none" strokeWidth="1.2" />
            {/* Endpoints to Prompt Box */}
            <path d="M 180 365 C 280 365, 270 265, 370 265" className="path-connection-alt" fill="none" strokeWidth="1.2" />
            {/* Analytics to Prompt Box */}
            <path d="M 1180 355 C 1080 355, 1090 265, 990 265" className="path-connection" fill="none" strokeWidth="1.2" />
          </svg>

          {/* Central Glassmorphic input box */}
          <div className="relative z-20 w-full max-w-[660px] bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-[0_30px_60px_rgba(124,110,245,0.05),_0_1px_3px_rgba(0,0,0,0.02)] p-6 flex flex-col gap-4 transition-all duration-300 focus-within:shadow-[0_32px_64px_rgba(124,110,245,0.12),_0_0_0_4px_rgba(124,110,245,0.08)] focus-within:border-indigo-400/60">
            <textarea
              rows={3}
              className="w-full bg-transparent border-none outline-none resize-none text-sm leading-relaxed text-slate-800 placeholder-slate-400 font-sans font-medium"
              placeholder="e.g., I need an inventory system for my bakery with item name, price (number), category (enum), and current stock levels..."
              value={assistantPrompt}
              onChange={(e) => setAssistantPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleForgeAssistant();
                }
              }}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3.5">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {inferredConfig ? (
                  <>
                    <span className="badge badge-purple text-[9px] font-bold">Entity: {inferredConfig.entity}</span>
                    {inferredConfig.fields.slice(0, 3).map((field) => (
                      <span
                        key={field.name}
                        className={`badge text-[9px] font-bold ${field.type === "string" ? "badge-cyan" : field.type === "number" ? "badge-amber" : field.type === "enum" ? "badge-purple" : field.type === "boolean" ? "badge-green" : "badge-red"}`}
                      >
                        {field.name}:{field.type}
                      </span>
                    ))}
                    {inferredConfig.fields.length > 3 && (
                      <span className="text-[10px] font-bold text-slate-400">+{inferredConfig.fields.length - 3} more</span>
                    )}
                  </>
                ) : (
                  <span className="text-[10.5px] font-semibold text-slate-400/80">Type a workflow and AppForge will infer entity + field types live.</span>
                )}
              </div>
              <span className={`text-[10px] font-bold ${promptChars > promptLimit ? "text-red-500" : "text-slate-400"}`}>
                {promptChars}/{promptLimit}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3.5">
              <span className="text-[10.5px] text-slate-400 font-semibold flex items-center gap-1.5">
                {forging ? (
                  <>
                    <span className="inline-flex w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                    <span>Forging app runtime...</span>
                  </>
                ) : (
                  <span>Press Enter to Forge</span>
                )}
              </span>
              <button
                onClick={() => handleForgeAssistant()}
                disabled={forging || !assistantPrompt.trim()}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-650 hover:from-indigo-600 hover:to-purple-750 shadow-md shadow-indigo-200/30 hover:shadow-lg hover:shadow-indigo-300/50 active:scale-95 transition-all cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none"
              >
                {forging ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Forging...
                  </span>
                ) : (
                  "Forge App →"
                )}
              </button>
            </div>
          </div>

        </div>

        {error && (
          <p className="text-xs font-semibold text-red-500 mt-2">{error}</p>
        )}

        {/* Starter shortcuts */}
        <div className="relative z-20 flex flex-wrap items-center justify-center gap-3 mt-4">
          <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest mr-1.5">Starters:</span>
          {STARTERS.map((s) => (
            <button
              key={s.label}
              onClick={() => {
                notify("success", `Loaded ${s.label} starter.`);
                router.push(`/apps/new?starter=${encodeURIComponent(s.label)}`);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-650 bg-white/60 hover:bg-white hover:text-indigo-600 hover:border-indigo-300 border border-slate-200/50 hover:translate-y-[-1px] transition-all cursor-pointer flex items-center gap-2 shadow-[0_2px_4px_rgba(0,0,0,0.01)]"
            >
              <span className="starred-bullet" style={{ background: s.color }} />
              {s.label}
            </button>
          ))}
        </div>
      </main>

      {/* ─── BOTTOM RECENT FORGES CAROUSEL REDESIGNED ────────────────────────────── */}
      <footer className="max-w-[1200px] w-full mx-auto mt-20 mb-8 relative z-10">
        {loading ? (
          <div className="flex gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-1 h-24 rounded-2xl bg-white/40 border border-white/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="animate-fade-in space-y-4">
            <div className="flex items-center justify-between px-1 mb-4">
              <h3 className="font-serif text-[1.8rem] italic font-normal text-slate-800 m-0">Recent Runtimes</h3>
              <span className="bg-[#eff0fe] text-[#7c6ef5] border border-[#e0e2fe] px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase">
                {apps.length || 3} active
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full">
              {/* Render existing user apps */}
              {apps.slice(0, 3).map((app) => {
                const theme = getAppTheme(app.name, app.config.entity);
                const isError = app.name.toLowerCase().includes("error") || app.name.toLowerCase().includes("fail") || app.description?.toLowerCase().includes("error");
                return (
                  <div key={app.id} className="p-5 flex flex-col justify-between gap-4 bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-2xl shadow-[0_4px_20px_rgba(15,23,42,0.015)] hover:shadow-[0_16px_36px_rgba(124,110,245,0.08)] hover:border-indigo-200/60 hover:translate-y-[-3px] transition-all duration-300 group">
                    <Link href={`/apps/${app.id}`} className="flex items-start justify-between gap-3 text-decoration-none">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-11 h-11 rounded-xl ${theme.iconBg} flex items-center justify-center shrink-0`}>
                          {theme.icon}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-sm text-slate-850 m-0 line-clamp-1 leading-tight group-hover:text-indigo-600 transition-colors">
                            {app.name}
                          </h4>
                          <p className="text-[10px] font-semibold text-slate-400 mt-1 mb-0.5">
                            {app._count.records} {app._count.records === 1 ? "record" : "records"} · {getRelativeTime(app.updatedAt)}
                          </p>
                          {isError ? (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                              <span className="text-[9px] font-extrabold text-red-650 uppercase tracking-wider">Error</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider">Running</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-slate-350 group-hover:text-indigo-650 group-hover:translate-x-0.5 transition-all text-lg pl-2 font-bold select-none">&rarr;</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleCloneApp(app)}
                      disabled={cloningAppId === app.id}
                      className="w-full rounded-xl border border-slate-200/80 bg-white/80 hover:bg-white hover:border-indigo-200 hover:text-indigo-600 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 transition-all active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 disabled:scale-100"
                    >
                      {cloningAppId === app.id ? "Cloning..." : "Clone this runtime"}
                    </button>
                  </div>
                );
              })}
              
              {/* Render placeholders if user doesn't have 3 apps yet */}
              {apps.length < 3 && [
                { id: "mock-1", name: "Inventory Manager", entity: "Product", updatedLabel: "Updated 2 mins ago", status: "running" },
                { id: "mock-2", name: "Task Tracker", entity: "Task", updatedLabel: "Updated 1 hour ago", status: "running" },
                { id: "mock-3", name: "Contact Book", entity: "Contact", updatedLabel: "Updated 3 hours ago", status: "error" }
              ].slice(apps.length).map((mock) => {
                const theme = getAppTheme(mock.name, mock.entity);
                const isError = mock.status === "error";
                return (
                  <button
                    key={mock.id}
                    onClick={() => {
                      notify("info", `Opening starter app workspace for ${mock.name}...`);
                      router.push(`/apps/new?starter=${encodeURIComponent(mock.name)}`);
                    }}
                    className="p-5 flex items-center justify-between text-decoration-none border border-slate-200/50 bg-white/70 backdrop-blur-md rounded-2xl w-full cursor-pointer shadow-[0_4px_20px_rgba(15,23,42,0.015)] hover:shadow-[0_16px_36px_rgba(124,110,245,0.08)] hover:border-indigo-200/60 hover:translate-y-[-3px] transition-all duration-300 text-left group"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-11 h-11 rounded-xl ${theme.iconBg} flex items-center justify-center shrink-0`}>
                        {theme.icon}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-sm text-slate-850 m-0 line-clamp-1 leading-tight group-hover:text-indigo-600 transition-colors">
                          {mock.name}
                        </h4>
                        <p className="text-[10px] font-semibold text-slate-400 mt-1 mb-0.5">
                          {mock.updatedLabel}
                        </p>
                        {isError ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-[9px] font-extrabold text-red-500 uppercase tracking-wider">Error</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider">Running</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-slate-350 group-hover:text-indigo-650 group-hover:translate-x-0.5 transition-all text-lg pl-2 font-bold select-none">&rarr;</span>
                  </button>
                );
              }) }

              {/* Start from scratch dashed card */}
              <Link href="/apps/new" className="p-5 flex items-center gap-4 text-decoration-none border border-dashed border-slate-300/80 bg-[#fcfcfa]/60 backdrop-blur-md rounded-2xl shadow-[0_4px_20px_rgba(15,23,42,0.015)] hover:shadow-[0_16px_36px_rgba(124,110,245,0.06)] hover:border-indigo-400 hover:bg-white/85 hover:translate-y-[-3px] transition-all duration-300 group">
                <div className="w-11 h-11 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-200 transition shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <span className="text-lg font-black leading-none">+</span>
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-850 group-hover:text-indigo-600 transition-colors m-0 leading-tight">New App</h4>
                  <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Start from scratch</p>
                </div>
              </Link>
            </div>
          </div>
        )}
      </footer>

      {/* ─── CTRL+K COMMAND PALETTE OVERLAY ─────────────────────────────────────── */}
      {showCmdPalette && (
        <div className="cmd-palette-backdrop animate-fade-in" onClick={() => setShowCmdPalette(false)}>
          <div className="cmd-palette-content" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              placeholder="Search runtimes by name..."
              className="cmd-input font-semibold"
              autoFocus
              value={cmdSearch}
              onChange={(e) => setCmdSearch(e.target.value)}
            />
            <div className="p-2 max-h-[320px] overflow-y-auto">
              <div className="text-[10px] font-bold text-slate-400 uppercase px-3 py-1.5">Applications</div>
              {filteredCmdApps.map((app) => (
                <button
                  key={app.id}
                  onClick={() => {
                    router.push(`/apps/${app.id}`);
                    setShowCmdPalette(false);
                  }}
                  className="cmd-item rounded-lg"
                >
                  <div className="flex flex-col">
                    <span className="font-extrabold text-sm text-slate-800">{app.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5">Entity: {app.config.entity}</span>
                  </div>
                  <span className="badge badge-purple text-[9px]">{app._count.records} records</span>
                </button>
              ))}

              {filteredCmdApps.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400 font-bold">
                  No matching apps found.
                </div>
              )}

              <div className="border-t border-slate-100 mt-2 pt-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase px-3 py-1.5">Quick Actions</div>
                <button
                  onClick={() => {
                    router.push("/apps/new");
                    setShowCmdPalette(false);
                  }}
                  className="cmd-item rounded-lg text-xs font-bold text-slate-700"
                >
                  Create new app workspace
                </button>
                <button
                  onClick={() => {
                    router.push("/playground");
                    setShowCmdPalette(false);
                  }}
                  className="cmd-item rounded-lg text-xs font-bold text-slate-700"
                >
                  Open Config Playground
                </button>
                <button
                  onClick={() => {
                    router.push("/import");
                    setShowCmdPalette(false);
                  }}
                  className="cmd-item rounded-lg text-xs font-bold text-slate-700"
                >
                  Import spreadsheet (CSV)
                </button>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
              <span>Tip: Press ESC to close</span>
              <span>AppForge Command Center</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── TOAST NOTIFICATIONS ───────────────────────────────────────────────── */}
      <div className="fixed bottom-5 right-5 z-[120] flex w-[min(360px,calc(100vw-40px))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-2xl border bg-white/85 px-4 py-3 text-xs font-bold shadow-lg backdrop-blur ${
              toast.type === "success"
                ? "border-green-200 text-green-700"
                : toast.type === "error"
                  ? "border-red-200 text-red-700"
                  : "border-indigo-200 text-indigo-700"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

    </div>
  );
}
