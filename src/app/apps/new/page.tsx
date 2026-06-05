"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { validateConfig } from "@/engine/validator";
import type { AppConfig, ValidationResult, FieldConfig, FieldType } from "@/types/config";

const STARTERS = [
  {
    label: "Product Inventory",
    mark: "PI",
    color: "#ffd32a",
    config: { entity: "Product", fields: [{ name: "title", type: "string", required: true }, { name: "price", type: "number" }, { name: "category", type: "enum", options: ["Electronics", "Clothing", "Food"] }, { name: "inStock", type: "boolean" }], ui: { layout: "table" } },
  },
  {
    label: "Task Manager",
    mark: "TM",
    color: "#7c6ef5",
    config: { entity: "Task", fields: [{ name: "title", type: "string", required: true }, { name: "status", type: "enum", options: ["Todo", "In Progress", "Done"] }, { name: "dueDate", type: "date" }, { name: "priority", type: "enum", options: ["Low", "Medium", "High"] }], ui: { layout: "table" } },
  },
  {
    label: "Contact Book",
    mark: "CB",
    color: "#ff4d9e",
    config: { entity: "Contact", fields: [{ name: "name", type: "string", required: true }, { name: "email", type: "string" }, { name: "phone", type: "string" }, { name: "company", type: "string" }], ui: { layout: "table" } },
  },
];

const DEFAULT_CONFIG: AppConfig = {
  entity: "Employee",
  fields: [
    { name: "fullName", type: "string", required: true },
    { name: "email", type: "string", required: false },
    { name: "active", type: "boolean", required: false },
  ],
  ui: { layout: "table" },
};

const TYPE_COLORS: Record<string, string> = {
  string: "badge-cyan",
  number: "badge-amber",
  boolean: "badge-green",
  enum: "badge-purple",
  date: "badge-red",
};

const TYPE_ICONS: Record<string, string> = {
  string: "Aa",
  number: "12",
  boolean: "◎",
  enum: "≡",
  date: "📅",
};

function NewAppPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const [name, setName] = useState("My New App");
  const [description, setDescription] = useState("");
  const [configText, setConfigText] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState("");

  // Animation and streaming states
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationStep, setAnimationStep] = useState(4); // 0: centered, 1: sliding up, 2: split-glass reveal, 3: streaming, 4: complete

  // Persistent valid state for preview
  const [previewFields, setPreviewFields] = useState<FieldConfig[]>(DEFAULT_CONFIG.fields);
  const [previewEntity, setPreviewEntity] = useState(DEFAULT_CONFIG.entity);

  useEffect(() => {
    const prefill = searchParams?.get("prefill");
    const starterName = searchParams?.get("starter");
    const qName = searchParams?.get("name");
    const qDesc = searchParams?.get("desc");
    const animate = searchParams?.get("animate");

    if (qName) setName(decodeURIComponent(qName));
    if (qDesc) setDescription(decodeURIComponent(qDesc));

    const finalConfig = prefill 
      ? JSON.parse(decodeURIComponent(prefill))
      : starterName 
        ? STARTERS.find((s) => s.label === starterName)?.config || DEFAULT_CONFIG
        : DEFAULT_CONFIG;

    const targetText = JSON.stringify(finalConfig, null, 2);

    if (animate === "true") {
      setIsAnimating(true);
      setAnimationStep(0);
      setConfigText("");

      // Step 1: Slide prompt box up
      const t1 = setTimeout(() => {
        setAnimationStep(1);
      }, 300);

      // Step 2: Split reveal
      const t2 = setTimeout(() => {
        setAnimationStep(2);
      }, 1000);

      // Step 3: Stream code
      const t3 = setTimeout(() => {
        setAnimationStep(3);
        let index = 0;
        const interval = setInterval(() => {
          const charsToAdd = Math.min(10, targetText.length - index);
          const chunk = targetText.substring(0, index + charsToAdd);
          setConfigText(chunk);
          index += charsToAdd;

          if (index >= targetText.length) {
            clearInterval(interval);
            setAnimationStep(4);
            setIsAnimating(false);
          }
        }, 20);
      }, 1400);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    } else {
      setConfigText(targetText);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!configText) return;
    setJsonError(null);
    try {
      const parsed = JSON.parse(configText);
      const res = validateConfig(parsed);
      setValidation(res);
      if (res.valid) {
        setPreviewFields(res.config.fields);
        setPreviewEntity(res.config.entity);
      }
    } catch {
      setJsonError("Invalid JSON syntax — check commas, braces, and quotes");
      setValidation({ valid: false, config: { entity: previewEntity, fields: previewFields, ui: { layout: "table" } }, warnings: [], errors: [{ message: "Parsing Error: Invalid JSON structure." }] });
    }
  }, [configText]);

  const handleDeploy = async () => {
    setDeployError("");
    if (!name.trim()) { setDeployError("App name is required"); return; }
    if (!validation?.valid || jsonError) { setDeployError("Cannot deploy a broken configuration. Fix JSON errors first."); return; }
    setDeploying(true);
    try {
      const res = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, config: validation.config }),
      });
      const data = await res.json();
      if (data.success) { router.push(`/apps/${data.data.app.id}`); }
      else { setDeployError(data.error || "Failed to create application"); }
    } catch (e: any) {
      setDeployError(e.message || "An unexpected error occurred");
    } finally { setDeploying(false); }
  };

  const initials = session?.user?.name?.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "AF";
  const isValidStatus = !jsonError && validation?.valid;
  const hasWarnings = !jsonError && validation?.valid && (validation?.warnings?.length ?? 0) > 0;
  const hasErrors = !!jsonError || (validation && !validation.valid);

  // If we are in the initial entry phase, show full peachy mesh gradient and center box
  if (animationStep < 2) {
    return (
      <div className="forge-canvas flex flex-col items-center justify-center p-6">
        <div className={`glass-prompt-container p-8 max-w-[640px] w-full text-center transition-all duration-700 ${animationStep === 1 ? "-translate-y-[20vh] opacity-30 scale-95" : ""}`}>
          <img src="/icon.png" className="w-12 h-12 object-contain rounded-2xl mx-auto mb-6 shadow-lg shadow-[#7c6ef5]/20 animate-bounce" alt="AppForge" />
          <h2 className="font-serif text-3xl font-normal italic mb-3 text-slate-800">Forging your application...</h2>
          <p className="text-xs text-slate-400 font-semibold mb-6">AppForge is compiling your config schema</p>
          <div className="text-sm font-semibold text-slate-650 bg-white/40 p-4 rounded-xl border border-white/50 text-left italic">
            &ldquo;{searchParams?.get("desc") || "Generating database model"}&rdquo;
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-canvas)", display: "flex", flexDirection: "column" }} className="animate-fade-in">
      
      {/* ─── TOP NAV ─────────────────────────────────────────────────────────────── */}
      <header className="top-nav">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <img src="/icon.png" style={{ width: 30, height: 30, objectFit: "contain", borderRadius: 8 }} alt="AppForge" />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 13 }}>
            <Link href="/dashboard" style={{ color: "var(--text-muted)", textDecoration: "none", fontWeight: 600, fontSize: 13 }}>Dashboard</Link>
            <span>/</span>
            <span style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 13 }}>Forge Workspace</span>
          </div>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Quick starters */}
          <div style={{ display: "flex", gap: 6 }}>
            {STARTERS.map((s) => (
              <button
                key={s.label}
                onClick={() => { setConfigText(JSON.stringify(s.config, null, 2)); setName(s.label); setDescription(`${s.label} database schema.`); }}
                title={`Load ${s.label} template`}
                style={{ width: 28, height: 28, borderRadius: 7, background: s.color + "22", border: `1px solid ${s.color}44`, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 900, color: "#000", cursor: "pointer", transition: "all 0.18s" }}
              >
                {s.mark}
              </button>
            ))}
          </div>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--yellow)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 900, color: "#000" }}>
            {initials}
          </div>
        </div>
      </header>

      {/* ─── WORKSPACE METADATA STRIP ────────────────────────────────────────────── */}
      <div style={{ padding: "20px 28px 18px", background: "rgba(255,255,255,0.7)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="App name..."
            style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5, border: "none", outline: "none", background: "transparent", color: "var(--text-primary)", width: "100%" }}
            disabled={isAnimating}
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description..."
            style={{ fontSize: 12, fontWeight: 500, border: "none", outline: "none", background: "transparent", color: "var(--text-muted)", width: "100%", marginTop: 2 }}
            disabled={isAnimating}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
            borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: hasErrors ? "rgba(239,68,68,0.08)" : hasWarnings ? "rgba(251,191,36,0.1)" : isValidStatus ? "rgba(16,185,129,0.08)" : "rgba(148,163,184,0.1)",
            border: `1px solid ${hasErrors ? "rgba(239,68,68,0.2)" : hasWarnings ? "rgba(251,191,36,0.25)" : isValidStatus ? "rgba(16,185,129,0.2)" : "rgba(148,163,184,0.2)"}`,
            color: hasErrors ? "#dc2626" : hasWarnings ? "#d97706" : isValidStatus ? "#059669" : "#64748b",
          }}>
            <span>{isAnimating ? "⚡" : hasErrors ? "✗" : hasWarnings ? "⚠" : isValidStatus ? "✓" : "○"}</span>
            <span>{isAnimating ? "Streaming Code..." : hasErrors ? "JSON Error" : hasWarnings ? "Has Warnings" : isValidStatus ? "Valid Schema" : "Parsing..."}</span>
          </div>

          {deployError && (
            <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 600, maxWidth: 200 }}>{deployError}</span>
          )}

          <button
            onClick={handleDeploy}
            disabled={deploying || !validation?.valid || !!jsonError || isAnimating}
            className="frixion-btn"
            style={{ padding: "10px 22px", fontSize: 13, fontWeight: 700, borderRadius: 12 }}
          >
            {deploying && (
              <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", display: "inline-block" }} className="animate-spin" />
            )}
            {deploying ? "Forging..." : "⚡ Forge & Deploy App"}
          </button>
        </div>
      </div>

      {/* ─── SPLIT-PANE CANVAS ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 0 }} className="animate-fade-in">

        {/* LEFT PANE — The Forge (Code Editor) */}
        <div className="warm-gradient-bg" style={{ display: "flex", flexDirection: "column", padding: 20, gap: 0, borderRight: "1px solid rgba(226,178,142,0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#d88a5c" }} />
              <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, fontWeight: 700, color: "#7b4c2d", textTransform: "uppercase", letterSpacing: "0.07em" }}>config.json</span>
            </div>
            {isAnimating && (
              <span className="text-[10px] font-bold text-[#b86b3f] animate-pulse">Auto compiling...</span>
            )}
          </div>

          <div className="editor-glass-card" style={{ flex: 1, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
            <textarea
              className="frixion-textarea"
              style={{ flex: 1, minHeight: 320, resize: "none", background: "rgba(255,255,255,0.75)" }}
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              placeholder='{\n  "entity": "MyEntity",\n  "fields": [\n    { "name": "title", "type": "string", "required": true }\n  ]\n}'
              spellCheck={false}
              disabled={isAnimating}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 140, overflowY: "auto" }}>
              {jsonError && (
                <div style={{ borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.07)", padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "#b91c1c" }}>
                  ✗ {jsonError}
                </div>
              )}
              {validation?.errors.map((err, i) => (
                <div key={i} style={{ borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.07)", padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "#b91c1c" }}>
                  ✗ Error: {err.message}
                </div>
              ))}
              {validation?.warnings.map((warn, i) => (
                <div key={i} style={{ borderRadius: 8, border: "1px solid rgba(251,191,36,0.25)", background: "rgba(251,191,36,0.07)", padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "#92400e" }}>
                  ⚠ Warning: {warn.message} {warn.sanitizedValue !== undefined ? `(→ ${String(warn.sanitizedValue)})` : ""}
                </div>
              ))}
              {!jsonError && validation?.errors.length === 0 && validation?.warnings.length === 0 && validation?.valid && (
                <div style={{ borderRadius: 8, border: "1px solid rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.06)", padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "#059669", textAlign: "center" }}>
                  ✦ Config is clean & valid
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANE — Live Runtime Preview */}
        <div style={{ background: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h3 className="font-serif" style={{ fontSize: 18, fontWeight: 400, fontStyle: "italic", color: "var(--text-primary)", lineHeight: 1 }}>Live Compiled UI</h3>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginTop: 3 }}>Real-Time Component Preview</p>
            </div>
            {previewEntity && (
              <span className="badge badge-purple" style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10 }}>
                entity: {previewEntity}
              </span>
            )}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            {previewFields.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: 28, marginBottom: 12, color: "#cbd5e1" }}>◈</div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>No fields defined yet.</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>Add fields in the JSON editor to see interactive components appear here.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {previewFields.map((field) => {
                  const isUnknown = !["string", "number", "boolean", "enum", "date"].includes(field.type);
                  
                  if (isUnknown) {
                    return (
                      <div key={field.name} className="border border-amber-250 bg-amber-50/50 p-4 rounded-xl flex flex-col gap-1.5 animate-fade-in">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 13, fontWeight: 750, color: "var(--text-primary)" }}>{field.name}</span>
                          <span className="badge badge-amber text-[9px]">{field.type}</span>
                        </div>
                        <p className="text-[11px] font-semibold text-amber-700 m-0">
                          ⚠️ Oops, unknown data type &quot;{field.type}&quot;. FallbackField registry caught this gracefully.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div key={field.name} style={{ borderRadius: 12, border: "1px solid var(--border)", padding: "14px 16px", background: "#fafbff", transition: "all 0.2s" }} className="animate-fade-in">
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 24, height: 24, borderRadius: 6, background: "var(--bg-hover)", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 900, color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                            {TYPE_ICONS[field.type] || "?"}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                            {field.name}
                            {field.required && <span style={{ color: "var(--red)", marginLeft: 2 }}>*</span>}
                          </span>
                        </div>
                        <span className={`badge ${TYPE_COLORS[field.type] || "badge-purple"}`}>{field.type}</span>
                      </div>

                      {field.type === "boolean" ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 44, height: 24, borderRadius: 12, background: "#e2e8f0", position: "relative", cursor: "pointer" }}>
                            <div style={{ position: "absolute", top: 2, left: 2, width: 20, height: 20, borderRadius: "50%", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Yes / No Toggle</span>
                        </div>
                      ) : field.type === "enum" && field.options ? (
                        <select className="select" disabled style={{ fontSize: 12 }}>
                          <option value="">Select {field.name}...</option>
                          {field.options.map((opt) => (<option key={opt}>{opt}</option>))}
                        </select>
                      ) : field.type === "date" ? (
                        <div style={{ position: "relative" }}>
                          <input type="date" className="input" disabled style={{ fontSize: 12, background: "#fafbff", cursor: "default" }} />
                        </div>
                      ) : field.type === "number" ? (
                        <input type="number" className="input" placeholder={`Enter ${field.name}...`} disabled style={{ fontSize: 12, background: "#fafbff" }} />
                      ) : (
                        <input type="text" className="input" placeholder={`Enter ${field.name}...`} disabled style={{ fontSize: 12, background: "#fafbff" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Compiled table preview */}
            {previewFields.length > 0 && (
              <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
                <span className="field-label" style={{ marginBottom: 10 }}>COMPILED DATA GRID VIEW</span>
                <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {previewFields.slice(0, 4).map((f) => (
                          <th key={f.name} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", fontSize: 10, borderBottom: "1px solid var(--border)" }}>
                            {f.name}
                          </th>
                        ))}
                        <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", fontSize: 10, borderBottom: "1px solid var(--border)" }}>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {previewFields.slice(0, 4).map((f) => {
                          const isUnknown = !["string", "number", "boolean", "enum", "date"].includes(f.type);
                          return (
                            <td key={f.name} style={{ padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>
                              {isUnknown ? (
                                <span className="text-amber-600 font-bold italic">fallback</span>
                              ) : f.type === "boolean" ? (
                                <span className="badge badge-green" style={{ fontSize: 9 }}>Yes</span>
                              ) : f.type === "enum" ? (
                                <span className="badge badge-purple" style={{ fontSize: 9 }}>{f.options?.[0] || "value"}</span>
                              ) : f.type === "date" ? "2026-06-05"
                                : f.type === "number" ? "42"
                                : "Sample data"}
                            </td>
                          );
                        })}
                        <td style={{ padding: "10px 12px", color: "var(--text-muted)", fontSize: 10, fontWeight: 500 }}>just now</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewAppPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-canvas)" }}>
        <div style={{ width: 32, height: 32, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%" }} className="animate-spin" />
      </div>
    }>
      <NewAppPageContent />
    </Suspense>
  );
}
