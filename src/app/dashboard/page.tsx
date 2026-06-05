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

  useEffect(() => {
    let cancelled = false;
    fetch("/api/apps")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.success) setApps(d.data);
        else notify("error", d.error || "Could not load recent runtimes.");
      })
      .catch(() => {
        if (!cancelled) notify("error", "Could not load recent runtimes.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });

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
  }, [notify]);

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

  const filteredCmdApps = apps.filter((app) =>
    app.name.toLowerCase().includes(cmdSearch.toLowerCase()) ||
    app.config.entity.toLowerCase().includes(cmdSearch.toLowerCase())
  );

  const initials = session?.user?.name?.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "AF";

  return (
    <div className="forge-canvas flex flex-col justify-between p-6">
      
      {/* ─── FLOATING TOP NAV ────────────────────────────────────────────────────── */}
      <header className="forge-topnav">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 text-decoration-none">
            <img src="/logo.png" className="w-8 h-8 object-contain rounded-lg" alt="AppForge" />
            <span className="font-extrabold tracking-tight text-sm text-slate-800">AppForge</span>
          </Link>
        </div>

        {/* Center links */}
        <div className="hidden sm:flex items-center gap-6">
          <Link href="/playground" className="text-xs font-bold text-slate-650 hover:text-indigo-600 transition text-decoration-none">
            Playground
          </Link>
          <Link href="/import" className="text-xs font-bold text-slate-650 hover:text-indigo-600 transition text-decoration-none">
            Import CSV
          </Link>
          <Link href="/settings" className="text-xs font-bold text-slate-650 hover:text-indigo-600 transition text-decoration-none">
            Settings
          </Link>
          <button 
            onClick={() => setShowCmdPalette(true)}
            className="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 rounded-lg transition border-none cursor-pointer flex items-center gap-1.5"
          >
            <span>Search</span>
            <kbd className="bg-white px-1 py-0.5 rounded text-[9px] border border-slate-200 font-mono">Ctrl+K</kbd>
          </button>
        </div>

        {/* User initials / Signout */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setShowProfileDropdown((prev) => !prev)}
            className="w-8 h-8 rounded-full bg-amber-400 font-extrabold text-xs text-slate-900 border-none cursor-pointer flex items-center justify-center hover:scale-105 transition"
          >
            {initials}
          </button>

          {showProfileDropdown && (
            <div className="dropdown-glass-menu" style={{ right: 0, left: "auto" }}>
              <div className="p-3 border-b border-slate-100 bg-white/20">
                <p className="text-xs font-black text-slate-800 m-0">{session?.user?.name || "Builder"}</p>
                <p className="text-[10px] text-slate-500 m-0 mt-0.5">{session?.user?.email || ""}</p>
              </div>
              <div className="p-1.5 flex flex-col">
                <Link href="/playground" className="text-xs font-bold text-slate-700 hover:bg-slate-100 p-2 rounded-lg text-decoration-none transition">
                  Config Playground
                </Link>
                <Link href="/import" className="text-xs font-bold text-slate-700 hover:bg-slate-100 p-2 rounded-lg text-decoration-none transition">
                  Import CSV File
                </Link>
                <Link href="/settings" className="text-xs font-bold text-slate-700 hover:bg-slate-100 p-2 rounded-lg text-decoration-none transition">
                  Settings
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="text-xs font-bold text-red-650 hover:bg-red-50 p-2 rounded-lg text-left transition border-none bg-transparent cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ─── CENTRAL HERO & INPUT ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-[680px] w-full mx-auto mt-24 animate-fade-up">
        
        <h1 className="font-serif text-5xl md:text-6xl font-normal italic text-slate-800 text-center tracking-tight leading-tight mb-8">
          What are we building today?
        </h1>

        {/* Glassmorphic input box */}
        <div className="glass-prompt-container p-4 flex flex-col gap-3 w-full">
          <textarea
            rows={3}
            className="w-full bg-transparent border-none outline-none resize-none text-[15px] leading-relaxed text-slate-850 placeholder-slate-400 font-sans"
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
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/50 pt-3">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {inferredConfig ? (
                <>
                  <span className="badge badge-purple text-[9px]">Entity: {inferredConfig.entity}</span>
                  {inferredConfig.fields.slice(0, 4).map((field) => (
                    <span
                      key={field.name}
                      className={`badge text-[9px] ${field.type === "string" ? "badge-cyan" : field.type === "number" ? "badge-amber" : field.type === "enum" ? "badge-purple" : field.type === "boolean" ? "badge-green" : "badge-red"}`}
                    >
                      {field.name}:{field.type}
                    </span>
                  ))}
                  {inferredConfig.fields.length > 4 && (
                    <span className="text-[10px] font-bold text-slate-400">+{inferredConfig.fields.length - 4} more</span>
                  )}
                </>
              ) : (
                <span className="text-[10px] font-semibold text-slate-400">Type a workflow and AppForge will infer entity + field types live.</span>
              )}
            </div>
            <span className={`text-[10px] font-black ${promptChars > promptLimit ? "text-red-500" : "text-slate-400"}`}>
              {promptChars}/{promptLimit}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200/50 pt-3">
            <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
              <span>{forging ? "Forging your app..." : "Press Enter to Forge"}</span>
            </span>
            <button
              onClick={() => handleForgeAssistant()}
              disabled={forging || !assistantPrompt.trim()}
              className="frixion-btn px-5 py-2 text-xs font-bold"
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

        {error && (
          <p className="text-xs font-semibold text-red-500 mt-3">{error}</p>
        )}

        {/* Starter shortcuts */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Starters:</span>
          {STARTERS.map((s) => (
            <button
              key={s.label}
              onClick={() => {
                notify("success", `Loaded ${s.label} starter.`);
                router.push(`/apps/new?starter=${encodeURIComponent(s.label)}`);
              }}
              className="glass-pill px-3 py-1.5 rounded-full text-xs font-semibold text-slate-700 hover:text-indigo-600 transition border-none cursor-pointer flex items-center gap-1.5"
            >
              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: s.color }} />
              {s.label}
            </button>
          ))}
        </div>
      </main>

      {/* ─── BOTTOM RECENT FORGES CAROUSEL ───────────────────────────────────────── */}
      <footer className="max-w-[900px] w-full mx-auto mt-12 mb-6">
        {loading ? (
          <div className="flex gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 h-36 rounded-2xl bg-white/40 border border-white/50 animate-pulse" />
            ))}
          </div>
        ) : apps.length > 0 ? (
          <div className="animate-fade-in space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-serif text-xl italic font-normal text-slate-800">Recent Runtimes</h3>
              <span className="badge badge-purple text-[10px]">{apps.length} active</span>
            </div>
            
            <div className="carousel-container">
              {apps.map((app) => (
                <Link key={app.id} href={`/apps/${app.id}`} className="carousel-card">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="badge badge-purple text-[9px] font-mono px-2 py-0.5">{app.config.entity}</span>
                      <span className="text-[10px] font-bold text-slate-400">{app._count.records} records</span>
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-800 leading-tight m-0 line-clamp-1">
                      {app.name}
                    </h4>
                    {app.description && (
                      <p className="text-[11px] text-slate-500 leading-normal mt-1 mb-0 line-clamp-2">
                        {app.description}
                      </p>
                    )}
                  </div>
                  <div className="border-t border-slate-100/50 pt-2 flex items-center justify-between text-[10px] text-slate-400 font-bold">
                    <span>View Runtime &rarr;</span>
                    <span>{new Date(app.updatedAt).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400 text-xs font-semibold bg-white/20 border border-white/40 rounded-2xl">
            No applications forged yet. Describe your system above to start.
          </div>
        )}
      </footer>

      {/* ─── CTRL+K COMMAND PALETTE OVERLAY ─────────────────────────────────────── */}
      {showCmdPalette && (
        <div className="cmd-palette-backdrop animate-fade-in" onClick={() => setShowCmdPalette(false)}>
          <div className="cmd-palette-content" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              placeholder="Search apps by name or entity..."
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
