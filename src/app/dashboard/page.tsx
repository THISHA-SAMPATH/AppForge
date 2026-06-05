"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Papa from "papaparse";
import { validateConfig } from "@/engine/validator";
import type { AppConfig, ValidationResult, FieldConfig, FieldType } from "@/types/config";

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

const TYPE_COLORS: Record<string, string> = {
  string: "badge-cyan",
  number: "badge-amber",
  boolean: "badge-green",
  enum: "badge-purple",
  date: "badge-red",
};

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

// ─── NAV ICONS ─────────────────────────────────────────────────────────────────
function IconApps() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}
function IconCode() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
function IconUpload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"apps" | "playground" | "csv">("apps");
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [forging, setForging] = useState(false);
  const [error, setError] = useState("");

  // Playground state
  const [playgroundInput, setPlaygroundInput] = useState<string>(
    JSON.stringify({ entity: "Product Item", fields: [{ name: "name", type: "string", required: true }, { name: "price", type: "float", required: false }, { name: "name", type: "string" }] }, null, 2)
  );
  const [playgroundResult, setPlaygroundResult] = useState<ValidationResult | null>(null);

  // CSV state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<any[][]>([]);
  const [csvAppName, setCsvAppName] = useState("");
  const [csvEntityName, setCsvEntityName] = useState("");
  const [csvFields, setCsvFields] = useState<FieldConfig[]>([]);
  const [csvPreviewConfig, setCsvPreviewConfig] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void fetch("/api/apps")
        .then((r) => r.json())
        .then((d) => { if (!cancelled && d.success) setApps(d.data); })
        .finally(() => { if (!cancelled) setLoading(false); });
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (activeTab !== "playground") return;
    try {
      const parsed = JSON.parse(playgroundInput);
      setPlaygroundResult(validateConfig(parsed));
    } catch {
      setPlaygroundResult({ valid: false, config: { entity: "Item", fields: [], ui: { layout: "table" } }, warnings: [], errors: [{ message: "Parsing Error: Input is not valid JSON." }] });
    }
  }, [playgroundInput, activeTab]);

  const handleForgeAssistant = (promptText = assistantPrompt) => {
    if (!promptText.trim()) return;
    setForging(true);
    setError("");
    try {
      const config = parseDescriptionToConfig(promptText);
      const encoded = encodeURIComponent(JSON.stringify(config));
      const appName = config.entity + " App";
      router.push(`/apps/new?prefill=${encoded}&name=${encodeURIComponent(appName)}&desc=${encodeURIComponent(promptText)}`);
    } catch (e: any) {
      setError(e.message || "Could not parse query.");
      setForging(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this app and all its data?")) return;
    await fetch(`/api/apps/${id}`, { method: "DELETE" });
    setApps((prev) => prev.filter((app) => app.id !== id));
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files?.[0]) processCsv(e.dataTransfer.files[0]);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processCsv(e.target.files[0]);
  };
  const processCsv = (file: File) => {
    setCsvFile(file);
    const appName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
    setCsvAppName(appName.charAt(0).toUpperCase() + appName.slice(1));
    let entityName = appName.replace(/[^a-zA-Z0-9]/g, "").replace(/s$/, "");
    if (!entityName) entityName = "Record";
    setCsvEntityName(entityName.charAt(0).toUpperCase() + entityName.slice(1));
    Papa.parse(file, {
      header: false, dynamicTyping: true, skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length > 0) {
          const headers = (results.data[0] as string[]).map((h) => String(h || ""));
          const rows = results.data.slice(1) as any[][];
          setCsvHeaders(headers); setCsvRows(rows);
          const fields: FieldConfig[] = headers.map((header, colIndex) => {
            const cleanName = header.trim().replace(/[^a-zA-Z0-9_]/g, "_");
            const values = rows.map((r) => r[colIndex]).filter((v) => v !== undefined && v !== null && v !== "");
            let type: "string" | "number" | "boolean" | "enum" | "date" = "string";
            let options: string[] = [];
            if (values.length > 0) {
              const isBool = values.every((v) => ["true","false","yes","no","1","0"].includes(String(v).toLowerCase().trim()));
              const isNum = values.every((v) => !isNaN(Number(v)));
              const isDate = values.every((v) => { const d = Date.parse(String(v)); return !isNaN(d) && (String(v).includes("-") || String(v).includes("/")); });
              const uniqueVals = Array.from(new Set(values.map((v) => String(v).trim())));
              const isEnum = uniqueVals.length > 0 && uniqueVals.length <= 5 && uniqueVals.length < values.length * 0.4;
              if (isBool) type = "boolean";
              else if (isNum) type = "number";
              else if (isDate) type = "date";
              else if (isEnum) { type = "enum"; options = uniqueVals; }
            }
            return { name: cleanName, type, required: false, options: type === "enum" ? options : undefined };
          });
          setCsvFields(fields);
        }
      },
    });
  };
  useEffect(() => {
    if (!csvEntityName) return;
    setCsvPreviewConfig(JSON.stringify({ entity: csvEntityName, fields: csvFields, ui: { layout: "table" } }, null, 2));
  }, [csvFields, csvEntityName]);
  const updateCsvField = (index: number, key: keyof FieldConfig, value: any) => {
    setCsvFields((prev) => {
      const copy = [...prev];
      const field = { ...copy[index], [key]: value } as FieldConfig;
      if (key === "type") field.options = value === "enum" ? ["Yes", "No", "Maybe"] : undefined;
      copy[index] = field;
      return copy;
    });
  };
  const handleCsvImport = async () => {
    if (!csvAppName || !csvEntityName || !csvPreviewConfig) return;
    setImportingCsv(true);
    try {
      const parsedConfig = JSON.parse(csvPreviewConfig);
      const resApp = await fetch("/api/apps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: csvAppName, description: `Uploaded from CSV: ${csvFile?.name || ""}`, config: parsedConfig }) });
      const dataApp = await resApp.json();
      if (!dataApp.success) { alert(dataApp.error || "Failed to create app"); setImportingCsv(false); return; }
      const appId = dataApp.data.app.id;
      const entity = dataApp.data.app.config.entity;
      const formattedRecords = csvRows.map((row) => {
        const item: Record<string, any> = {};
        csvFields.forEach((field, colIndex) => {
          let val = row[colIndex];
          if (val === undefined || val === null) val = "";
          if (field.type === "number") { const num = Number(val); item[field.name] = isNaN(num) ? 0 : num; }
          else if (field.type === "boolean") { const s = String(val).toLowerCase().trim(); item[field.name] = s === "true" || s === "yes" || s === "1"; }
          else item[field.name] = String(val);
        });
        return item;
      });
      const resRecords = await fetch(`/api/apps/${appId}/${entity}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formattedRecords) });
      const dataRecords = await resRecords.json();
      if (!dataRecords.success) alert(dataRecords.error || "App created, but failed to insert records");
      router.push(`/apps/${appId}`);
    } catch (e) { console.error(e); alert("An unexpected error occurred"); }
    finally { setImportingCsv(false); }
  };
  const resetCsv = () => { setCsvFile(null); setCsvHeaders([]); setCsvRows([]); setCsvFields([]); setCsvPreviewConfig(""); };

  const totalRecords = apps.reduce((sum, app) => sum + app._count.records, 0);
  const fieldTypes = [...new Set(apps.flatMap((app) => app.config.fields.map((f) => f.type)))].length;
  const initials = session?.user?.name?.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "AF";

  return (
    <div className="sidebar-shell">
      {/* ─── DARK SIDEBAR ─────────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">AF</div>
          <span className="sidebar-logo-text">AppForge</span>
        </div>

        {/* Navigation */}
        <div className="sidebar-section">
          <p className="sidebar-section-label">Workspace</p>
          <button
            onClick={() => setActiveTab("apps")}
            className={`sidebar-link ${activeTab === "apps" ? "active" : ""}`}
          >
            <span className="sidebar-link-icon"><IconApps /></span>
            My Apps
          </button>
          <button
            onClick={() => setActiveTab("playground")}
            className={`sidebar-link ${activeTab === "playground" ? "active" : ""}`}
          >
            <span className="sidebar-link-icon"><IconCode /></span>
            Config Playground
          </button>
          <button
            onClick={() => setActiveTab("csv")}
            className={`sidebar-link ${activeTab === "csv" ? "active" : ""}`}
          >
            <span className="sidebar-link-icon"><IconUpload /></span>
            Import CSV
          </button>
        </div>

        <div className="sidebar-section" style={{ marginTop: 12 }}>
          <p className="sidebar-section-label">Quick Start</p>
          {STARTERS.map((s) => (
            <button
              key={s.label}
              onClick={() => router.push(`/apps/new?starter=${encodeURIComponent(s.label)}`)}
              className="sidebar-link"
              title={s.desc}
            >
              <span
                style={{ width: 18, height: 18, borderRadius: 5, background: s.color, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 900, color: "#000", flexShrink: 0 }}
              >
                {s.mark}
              </span>
              <span style={{ fontSize: 12 }}>{s.label}</span>
            </button>
          ))}
        </div>

        {/* User / Signout */}
        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div className="sidebar-user-name">{session?.user?.name || "Builder"}</div>
              <div className="sidebar-user-email">{session?.user?.email || ""}</div>
            </div>
          </div>
          <button
            onClick={() => signOut({ redirectTo: "/login" })}
            className="sidebar-link"
            style={{ marginTop: 4, color: "rgba(255,255,255,0.5)" }}
          >
            <span className="sidebar-link-icon"><IconLogout /></span>
            Sign out
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─────────────────────────────────────────────────────────── */}
      <div className="main-content">

        {/* ─── APPS TAB ──────────────────────────────────────────────────────────── */}
        {activeTab === "apps" && (
          <div className="animate-fade-in">
            {/* Page header */}
            <div className="page-header">
              <div>
                <h1 className="font-serif text-2xl font-normal italic text-slate-800 leading-tight">
                  Your App Inventory
                </h1>
                <p className="text-xs font-medium text-slate-400 mt-0.5">
                  Metadata-driven database runtimes
                </p>
              </div>
              <Link
                href="/apps/new"
                className="btn-primary glow-btn-primary gap-2 text-xs px-4 py-2"
              >
                <IconPlus />
                New App
              </Link>
            </div>

            <div className="page-content">
              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
                {[
                  { label: "Total Apps", value: apps.length, color: "#7c6ef5" },
                  { label: "Total Records", value: totalRecords, color: "#22c984" },
                  { label: "Field Types Used", value: fieldTypes, color: "#ff4d9e" },
                ].map((stat) => (
                  <div key={stat.label} className="stat-card">
                    <div className="stat-dot" style={{ background: stat.color }} />
                    <div className="stat-value">{stat.value}</div>
                    <div className="stat-label">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* AI Assistant quick-forge row */}
              {apps.length > 0 && (
                <div className="assistant-card" style={{ marginBottom: 28 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #7c6ef5, #5544d4)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2L2 7l10 5 10-5-10-5Z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-serif text-xl font-normal text-slate-800 italic">AI App Assistant</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Describe your app in plain English and we'll generate the schema automatically.</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <input
                        type="text"
                        className="assistant-input"
                        style={{ flex: 1, borderRadius: 12, padding: "11px 16px" }}
                        placeholder="e.g. Student catalog with name, age (number), and enrolled (boolean)..."
                        value={assistantPrompt}
                        onChange={(e) => setAssistantPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleForgeAssistant()}
                      />
                      <button
                        onClick={() => handleForgeAssistant()}
                        disabled={forging || !assistantPrompt.trim()}
                        className="btn-primary glow-btn-primary px-5 text-xs font-bold"
                      >
                        {forging ? "..." : "Forge →"}
                      </button>
                    </div>
                    {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
                  </div>
                </div>
              )}

              {/* Apps grid */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <h2 className="font-serif text-xl font-normal text-slate-700 italic">Active runtimes</h2>
                  </div>
                  <span className="badge badge-purple">{apps.length} apps</span>
                </div>

                {loading ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                    {[1,2,3].map((i) => (
                      <div key={i} style={{ borderRadius: 16, padding: 20, background: "#fff", border: "1px solid #e6e8ee" }}>
                        <div className="skeleton" style={{ height: 36, width: 36, borderRadius: 10, marginBottom: 14 }} />
                        <div className="skeleton" style={{ height: 18, width: "60%", marginBottom: 8 }} />
                        <div className="skeleton" style={{ height: 13, width: "80%" }} />
                      </div>
                    ))}
                  </div>
                ) : apps.length === 0 ? (
                  <div className="assistant-card" style={{ textAlign: "center", padding: "48px 32px" }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #7c6ef5, #5544d4)", display: "grid", placeItems: "center", margin: "0 auto 16px", boxShadow: "0 8px 24px rgba(124,110,245,0.3)" }}>
                      <span style={{ fontSize: 22, color: "white" }}>✦</span>
                    </div>
                    <h3 className="font-serif text-2xl font-normal italic text-slate-800">Forge Your First App</h3>
                    <p className="text-sm font-medium text-slate-400 mt-2" style={{ maxWidth: 380, margin: "8px auto 24px" }}>
                      Describe the application you want in plain English, or paste a JSON configuration schema to begin instantly.
                    </p>
                    <textarea
                      rows={3}
                      className="assistant-input"
                      style={{ textAlign: "left", resize: "vertical", marginBottom: 12, fontSize: 13 }}
                      placeholder="e.g. A task tracker with title, priority (enum: Low, Medium, High), dueDate, and completed (boolean)"
                      value={assistantPrompt}
                      onChange={(e) => setAssistantPrompt(e.target.value)}
                    />
                    {error && <p className="text-xs font-semibold text-red-500" style={{ marginBottom: 12 }}>{error}</p>}
                    <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                      <button
                        onClick={() => handleForgeAssistant()}
                        disabled={forging || !assistantPrompt.trim()}
                        className="btn-primary glow-btn-primary px-6 py-2.5 text-xs font-bold gap-2"
                      >
                        {forging && <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", display: "inline-block" }} className="animate-spin" />}
                        Forge App Workspace →
                      </button>
                      <Link href="/apps/new" className="btn-ghost px-6 py-2.5 text-xs font-bold">
                        Open Blank Canvas
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                    {apps.map((app, index) => (
                      <Link key={app.id} href={`/apps/${app.id}`} className="app-card" style={{ animationDelay: `${index * 0.05}s` }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                          <div className="app-card-icon">
                            {app.config.entity.slice(0, 2).toUpperCase()}
                          </div>
                          <button
                            onClick={(e) => handleDelete(app.id, e)}
                            style={{ padding: "3px 8px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#dc2626", fontSize: 10, fontWeight: 700, opacity: 0, transition: "opacity 0.2s" }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                          >
                            Delete
                          </button>
                        </div>
                        <div>
                          <h3 style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3, color: "var(--text-primary)" }}>{app.name}</h3>
                          {app.description && (
                            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {app.description}
                            </p>
                          )}
                        </div>
                        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                            {app.config.fields.slice(0, 3).map((field) => (
                              <span key={field.name} className={`badge ${TYPE_COLORS[field.type] || "badge-purple"}`}>
                                {field.name}
                              </span>
                            ))}
                            {app.config.fields.length > 3 && (
                              <span className="badge badge-purple">+{app.config.fields.length - 3}</span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>{app._count.records} records</span>
                            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, background: "#f1f3f7", padding: "2px 7px", borderRadius: 5, fontWeight: 700, color: "var(--text-secondary)" }}>
                              {app.config.entity}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── PLAYGROUND TAB ─────────────────────────────────────────────────────── */}
        {activeTab === "playground" && (
          <div className="animate-fade-in">
            <div className="page-header">
              <div>
                <h1 className="font-serif text-2xl font-normal italic text-slate-800">Config Validator Playground</h1>
                <p className="text-xs font-medium text-slate-400 mt-0.5">Test and sanitize broken config objects in real time</p>
              </div>
            </div>
            <div className="page-content">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
                <div>
                  <span className="field-label">JSON SCHEMA INPUT</span>
                  <textarea
                    className="code-area"
                    style={{ height: 440, marginTop: 6 }}
                    value={playgroundInput}
                    onChange={(e) => setPlaygroundInput(e.target.value)}
                    placeholder="Enter configuration JSON..."
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span className="field-label">VALIDATOR REPORT</span>
                    {playgroundResult && (
                      <span className={`badge ${playgroundResult.valid ? (playgroundResult.warnings.length > 0 ? "badge-amber" : "badge-green") : "badge-red"}`}>
                        {playgroundResult.valid
                          ? playgroundResult.warnings.length > 0 ? "✓ VALID (WARNINGS)" : "✓ PERFECTLY VALID"
                          : "✗ INVALID STRUCTURE"}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 200, overflowY: "auto" }}>
                    {playgroundResult?.errors.map((err, i) => (
                      <div key={i} style={{ borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", padding: "10px 14px" }}>
                        <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#dc2626", display: "block", marginBottom: 4 }}>Error</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#b91c1c" }}>{err.message}</span>
                      </div>
                    ))}
                    {playgroundResult?.warnings.map((warn, i) => (
                      <div key={i} style={{ borderRadius: 10, border: "1px solid rgba(251,191,36,0.25)", background: "rgba(251,191,36,0.07)", padding: "10px 14px" }}>
                        <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#d97706", display: "block", marginBottom: 4 }}>Warning {warn.field ? `(${warn.field})` : ""}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#92400e" }}>{warn.message}</span>
                        {warn.originalValue !== undefined && (
                          <div style={{ marginTop: 6, fontFamily: "var(--font-mono), monospace", fontSize: 10, color: "#6b7280" }}>
                            <span style={{ textDecoration: "line-through", background: "rgba(251,191,36,0.15)", padding: "0 4px", borderRadius: 3 }}>{String(warn.originalValue)}</span>
                            {" → "}
                            <span style={{ fontWeight: 700, color: "#059669", background: "rgba(16,185,129,0.1)", padding: "0 4px", borderRadius: 3 }}>{String(warn.sanitizedValue)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {playgroundResult?.errors.length === 0 && playgroundResult?.warnings.length === 0 && (
                      <div style={{ padding: "16px", borderRadius: 10, border: "1px solid rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.06)", textAlign: "center" }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#059669" }}>✓ Config is clean & valid — no issues found.</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="field-label" style={{ marginBottom: 6 }}>SANITIZED CONFIG OUTPUT</span>
                    <pre className="json-output" style={{ height: 240, fontSize: 11, color: "#a5b4fc", marginTop: 6 }}>
                      {playgroundResult ? JSON.stringify(playgroundResult.config, null, 2) : ""}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── CSV TAB ──────────────────────────────────────────────────────────── */}
        {activeTab === "csv" && (
          <div className="animate-fade-in">
            <div className="page-header">
              <div>
                <h1 className="font-serif text-2xl font-normal italic text-slate-800">CSV Reverse Engineering</h1>
                <p className="text-xs font-medium text-slate-400 mt-0.5">Upload a spreadsheet — auto-infer types and bulk insert all rows</p>
              </div>
            </div>
            <div className="page-content">
              {!csvFile ? (
                <div
                  onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`file-dropzone ${dragActive ? "drag-active" : ""}`}
                  style={{ borderRadius: 16, padding: "64px 32px", textAlign: "center", cursor: "pointer", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
                >
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
                  <div style={{ width: 56, height: 56, borderRadius: 14, background: "#f1f3f8", border: "1px solid var(--border)", display: "grid", placeItems: "center", marginBottom: 16, fontSize: 22 }}>
                    ↑
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>Drag and drop your spreadsheet</h3>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>Supports .csv files up to 10MB. We parse structure client-side.</p>
                  <button className="btn-ghost text-xs py-2 px-5 font-bold">Select File</button>
                </div>
              ) : (
                <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, color: "#059669" }}>CSV</div>
                      <div>
                        <h4 style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{csvFile.name}</h4>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{(csvFile.size / 1024).toFixed(1)} KB • {csvRows.length} rows detected</p>
                      </div>
                    </div>
                    <button onClick={resetCsv} className="btn-ghost text-xs py-1.5 px-3">Clear & Upload New</button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: "#fff", padding: 16, borderRadius: 12, border: "1px solid var(--border)" }}>
                        <div>
                          <label className="field-label">App Name</label>
                          <input type="text" className="input" value={csvAppName} onChange={(e) => setCsvAppName(e.target.value)} placeholder="Sales Report" />
                        </div>
                        <div>
                          <label className="field-label">Entity Name</label>
                          <input type="text" className="input" value={csvEntityName} onChange={(e) => setCsvEntityName(e.target.value)} placeholder="Order" />
                        </div>
                      </div>

                      <div className="card" style={{ padding: 16, background: "#fff" }}>
                        <span className="field-label" style={{ marginBottom: 12 }}>COLUMN MAPPING & SCHEMAS</span>
                        <div style={{ overflowX: "auto" }}>
                          <table className="data-table" style={{ fontSize: 12 }}>
                            <thead>
                              <tr>
                                <th>CSV Column</th>
                                <th>Field Key</th>
                                <th>Inferred Type</th>
                                <th>Required</th>
                                <th>Enum Options</th>
                              </tr>
                            </thead>
                            <tbody>
                              {csvFields.map((field, index) => (
                                <tr key={index}>
                                  <td style={{ color: "var(--text-muted)", fontWeight: 600 }}>{csvHeaders[index]}</td>
                                  <td>
                                    <input type="text" value={field.name} onChange={(e) => updateCsvField(index, "name", e.target.value)} className="input" style={{ padding: "6px 10px", fontSize: 11, maxWidth: 130 }} />
                                  </td>
                                  <td>
                                    <select value={field.type} onChange={(e) => updateCsvField(index, "type", e.target.value)} className="select" style={{ padding: "6px 10px", fontSize: 11, maxWidth: 110 }}>
                                      <option value="string">String</option>
                                      <option value="number">Number</option>
                                      <option value="boolean">Boolean</option>
                                      <option value="enum">Enum</option>
                                      <option value="date">Date</option>
                                    </select>
                                  </td>
                                  <td style={{ textAlign: "center" }}>
                                    <input type="checkbox" checked={field.required} onChange={(e) => updateCsvField(index, "required", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--accent)" }} />
                                  </td>
                                  <td>
                                    {field.type === "enum" ? (
                                      <input type="text" placeholder="Option1, Option2" value={field.options?.join(", ") || ""} onChange={(e) => updateCsvField(index, "options", e.target.value.split(",").map((o) => o.trim()))} className="input" style={{ padding: "6px 10px", fontSize: 10 }} />
                                    ) : (
                                      <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <span className="field-label">COMPILED CONFIG PREVIEW</span>
                      <pre className="json-output" style={{ height: 360, fontSize: 11, color: "#94a3b8", overflowY: "auto" }}>{csvPreviewConfig}</pre>
                      <button onClick={handleCsvImport} disabled={importingCsv || !csvAppName || !csvEntityName} className="btn-primary glow-btn-primary py-3 text-xs font-bold gap-2">
                        {importingCsv && <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", display: "inline-block" }} className="animate-spin" />}
                        {importingCsv ? "Compiling & Inserting..." : `Create & Insert ${csvRows.length} Rows`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
