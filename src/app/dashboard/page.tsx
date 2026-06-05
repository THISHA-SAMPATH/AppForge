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
    accent: "#ffd32a",
    config: JSON.stringify(
      {
        entity: "Product",
        fields: [
          { name: "title", type: "string", required: true },
          { name: "price", type: "number" },
          {
            name: "category",
            type: "enum",
            options: ["Electronics", "Clothing", "Food"],
          },
          { name: "inStock", type: "boolean" },
        ],
        ui: { layout: "table" },
      },
      null,
      2,
    ),
  },
  {
    label: "Task Manager",
    mark: "TM",
    accent: "#1f7aff",
    config: JSON.stringify(
      {
        entity: "Task",
        fields: [
          { name: "title", type: "string", required: true },
          {
            name: "status",
            type: "enum",
            options: ["Todo", "In Progress", "Done"],
          },
          { name: "dueDate", type: "date" },
          {
            name: "priority",
            type: "enum",
            options: ["Low", "Medium", "High"],
          },
        ],
        ui: { layout: "table" },
      },
      null,
      2,
    ),
  },
  {
    label: "Contact Book",
    mark: "CB",
    accent: "#ff2f92",
    config: JSON.stringify(
      {
        entity: "Contact",
        fields: [
          { name: "name", type: "string", required: true },
          { name: "email", type: "string" },
          { name: "phone", type: "string" },
          { name: "company", type: "string" },
        ],
        ui: { layout: "table" },
      },
      null,
      2,
    ),
  },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"apps" | "playground" | "csv">("apps");
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", config: "" });
  const [error, setError] = useState("");

  // Config Playground State
  const [playgroundInput, setPlaygroundInput] = useState<string>(
    JSON.stringify(
      {
        entity: "Product Item",
        fields: [
          { name: "name", type: "string", required: true },
          { name: "price", type: "float", required: false }, // float will fall back to string
          { name: "name", type: "string" }, // duplicate field name will be renamed
        ],
      },
      null,
      2,
    ),
  );
  const [playgroundResult, setPlaygroundResult] = useState<ValidationResult | null>(null);

  // CSV Import State
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
        .then((d) => {
          if (!cancelled && d.success) setApps(d.data);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Live validator effect for Config Playground
  useEffect(() => {
    if (activeTab !== "playground") return;
    try {
      const parsed = JSON.parse(playgroundInput);
      const res = validateConfig(parsed);
      setPlaygroundResult(res);
    } catch {
      setPlaygroundResult({
        valid: false,
        config: { entity: "Item", fields: [], ui: { layout: "table" } },
        warnings: [],
        errors: [{ message: "Parsing Error: Input is not a valid JSON structure." }],
      });
    }
  }, [playgroundInput, activeTab]);

  const handleCreate = async () => {
    setError("");
    if (!form.name.trim()) {
      setError("App name is required");
      return;
    }

    let config;
    try {
      config = form.config
        ? JSON.parse(form.config)
        : { entity: form.name, fields: [], ui: { layout: "table" } };
    } catch {
      setError("Invalid JSON - check your syntax");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          config,
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/apps/${data.data.app.id}`);
      } else {
        setError(data.error || "Failed to create");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this app and all its data?")) return;
    await fetch(`/api/apps/${id}`, { method: "DELETE" });
    setApps((prev) => prev.filter((app) => app.id !== id));
  };

  // CSV Processing Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCsv(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processCsv(e.target.files[0]);
    }
  };

  const processCsv = (file: File) => {
    setCsvFile(file);
    const appName = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[-_]/g, " ")
      .trim();
    setCsvAppName(appName.charAt(0).toUpperCase() + appName.slice(1));

    let entityName = appName.replace(/[^a-zA-Z0-9]/g, "").replace(/s$/, "");
    if (!entityName) entityName = "Record";
    entityName = entityName.charAt(0).toUpperCase() + entityName.slice(1);
    setCsvEntityName(entityName);

    Papa.parse(file, {
      header: false,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length > 0) {
          const headers = (results.data[0] as string[]).map((h) => String(h || ""));
          const rows = results.data.slice(1) as any[][];

          setCsvHeaders(headers);
          setCsvRows(rows);

          // Infer types
          const fields: FieldConfig[] = headers.map((header, colIndex) => {
            const cleanName = header.trim().replace(/[^a-zA-Z0-9_]/g, "_");
            const values = rows.map((r) => r[colIndex]).filter((v) => v !== undefined && v !== null && v !== "");

            let type: "string" | "number" | "boolean" | "enum" | "date" = "string";
            let options: string[] = [];

            if (values.length > 0) {
              const isBool = values.every((v) => {
                const lower = String(v).toLowerCase().trim();
                return lower === "true" || lower === "false" || lower === "yes" || lower === "no" || lower === "1" || lower === "0";
              });
              const isNum = values.every((v) => !isNaN(Number(v)));
              const isDate = values.every((v) => {
                const d = Date.parse(String(v));
                return !isNaN(d) && (String(v).includes("-") || String(v).includes("/"));
              });
              const uniqueVals = Array.from(new Set(values.map((v) => String(v).trim())));
              const isEnum = uniqueVals.length > 0 && uniqueVals.length <= 5 && uniqueVals.length < values.length * 0.4;

              if (isBool) type = "boolean";
              else if (isNum) type = "number";
              else if (isDate) type = "date";
              else if (isEnum) {
                type = "enum";
                options = uniqueVals;
              }
            }

            return { name: cleanName, type, required: false, options: type === "enum" ? options : undefined };
          });

          setCsvFields(fields);
        }
      },
    });
  };

  // Re-generate preview config when CSV Fields change
  useEffect(() => {
    if (!csvEntityName) return;
    const config: AppConfig = {
      entity: csvEntityName,
      fields: csvFields,
      ui: { layout: "table" },
    };
    setCsvPreviewConfig(JSON.stringify(config, null, 2));
  }, [csvFields, csvEntityName]);

  const updateCsvField = (index: number, key: keyof FieldConfig, value: any) => {
    setCsvFields((prev) => {
      const copy = [...prev];
      const field = { ...copy[index], [key]: value } as FieldConfig;
      if (key === "type") {
        if (value === "enum") {
          field.options = ["Yes", "No", "Maybe"];
        } else {
          delete field.options;
        }
      }
      copy[index] = field;
      return copy;
    });
  };

  const handleCsvImport = async () => {
    if (!csvAppName || !csvEntityName || !csvPreviewConfig) return;
    setImportingCsv(true);
    try {
      const parsedConfig = JSON.parse(csvPreviewConfig);
      // 1. Create App
      const resApp = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: csvAppName,
          description: `Uploaded from CSV: ${csvFile?.name || ""}`,
          config: parsedConfig,
        }),
      });
      const dataApp = await resApp.json();
      if (!dataApp.success) {
        alert(dataApp.error || "Failed to create app from CSV config");
        setImportingCsv(false);
        return;
      }

      const appId = dataApp.data.app.id;
      const entity = dataApp.data.app.config.entity;

      // 2. Prepare and format CSV row data for bulk insert
      const formattedRecords = csvRows.map((row) => {
        const item: Record<string, any> = {};
        csvFields.forEach((field, colIndex) => {
          let val = row[colIndex];
          if (val === undefined || val === null) val = "";
          
          if (field.type === "number") {
            const num = Number(val);
            item[field.name] = isNaN(num) ? 0 : num;
          } else if (field.type === "boolean") {
            const strVal = String(val).toLowerCase().trim();
            item[field.name] = strVal === "true" || strVal === "yes" || strVal === "1";
          } else {
            item[field.name] = String(val);
          }
        });
        return item;
      });

      // 3. Post to bulk records
      const resRecords = await fetch(`/api/apps/${appId}/${entity}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formattedRecords),
      });
      const dataRecords = await resRecords.json();
      if (!dataRecords.success) {
        alert(dataRecords.error || "App created, but failed to insert records");
      }

      router.push(`/apps/${appId}`);
    } catch (e) {
      console.error(e);
      alert("An unexpected error occurred during CSV parsing or import");
    } finally {
      setImportingCsv(false);
    }
  };

  const resetCsv = () => {
    setCsvFile(null);
    setCsvHeaders([]);
    setCsvRows([]);
    setCsvFields([]);
    setCsvPreviewConfig("");
  };

  const totalRecords = apps.reduce((sum, app) => sum + app._count.records, 0);
  const fieldTypes = [
    ...new Set(apps.flatMap((app) => app.config.fields.map((f) => f.type))),
  ].length;
  const initials =
    session?.user?.name
      ?.split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "AF";

  return (
    <main className="min-h-screen bg-[#d9dde3] p-3 text-[#07090f] sm:p-5">
      <section className="relative min-h-[calc(100vh-24px)] overflow-hidden rounded-[22px] border-[10px] border-white bg-[#fbfbfc] shadow-[0_18px_55px_rgba(15,23,42,0.12)] sm:min-h-[calc(100vh-40px)] sm:border-[14px]">
        <div className="absolute inset-4 rounded-[18px] border border-[#e7e9ee]" />

        {/* Global Navigation Header */}
        <header className="relative z-40 mx-auto mt-6 flex h-14 items-center justify-between gap-2 rounded-2xl px-4 spark-nav max-w-7xl">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-black text-xs font-black text-white">
              AF
            </span>
            <span className="font-black tracking-tight text-sm sm:text-base">AppForge</span>
          </Link>
          <nav className="flex items-center gap-4 text-xs font-bold text-[#555d70] sm:gap-7">
            <Link href="/playground" className="spark-nav-tab py-1 cursor-pointer">
              🧪 Playground
            </Link>
            <Link href="/import" className="spark-nav-tab py-1 cursor-pointer">
              📊 Import CSV
            </Link>
            <button
              onClick={() => {
                setForm({ name: "", description: "", config: "" });
                setShowModal(true);
              }}
              className="btn-primary py-1.5 px-3 text-xs font-bold gap-1 cursor-pointer"
            >
              <span>+</span> New App
            </button>
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs font-semibold text-[#555d70] sm:inline">
              {session?.user?.name || "Builder"}
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#ffd32a] text-xs font-black">
              {initials}
            </span>
            <button
              onClick={() => signOut({ redirectTo: "/login" })}
              className="btn-ghost hidden px-3 py-1.5 text-xs sm:inline-flex"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Dynamic Section Contents */}
        <div className="relative z-20 mx-auto max-w-7xl px-4 py-8 sm:px-6">
          {activeTab === "apps" && (
            <div className="space-y-10 animate-fade-in">
              {/* Hero Banner */}
              <section className="relative overflow-hidden py-4">
                <div className="absolute right-4 top-0 hidden h-56 w-56 rounded-full soft-orbit opacity-75 lg:block" />
                <div className="max-w-2xl">
                  <p className="mb-4 w-fit rounded-full border border-[#e4e7ee] bg-white px-4 py-1.5 text-[11px] font-black text-[#555d70] shadow-sm">
                    METADATA APP ENGINE
                  </p>
                  <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-black leading-[0.95] tracking-tight text-[#07090f]">
                    Sparkline app
                    <br />
                    <span className="highlight-mark px-2">workspace</span>
                  </h1>
                  <p className="mt-5 max-w-lg text-sm font-medium leading-6 text-[#5f6677]">
                    Model your database using configuration blobs. Instantly spin up records, 
                    form interfaces, and schema editors with version histories.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <button
                      onClick={() => {
                        setForm({ name: "", description: "", config: "" });
                        setShowModal(true);
                      }}
                      className="btn-primary gap-2 px-5 py-2.5 text-xs font-bold"
                    >
                      <span>+</span> New Custom App
                    </button>
                    <button
                      onClick={() => {
                        const starter = STARTERS[0];
                        setForm({
                          name: starter.label,
                          description: "Inventory app generated from JSON config",
                          config: starter.config,
                        });
                        setShowModal(true);
                      }}
                      className="btn-ghost px-5 py-2.5 text-xs font-bold"
                    >
                      Use starter
                    </button>
                  </div>
                </div>
              </section>

              {/* Statistics Grid */}
              <section className="grid gap-4 md:grid-cols-3">
                {[
                  { label: "Total Apps", value: apps.length, tone: "#ffd32a" },
                  { label: "Total Records", value: totalRecords, tone: "#1f7aff" },
                  { label: "Field Types", value: fieldTypes, tone: "#ff2f92" },
                ].map((stat) => (
                  <div key={stat.label} className="card p-5 bg-white">
                    <div
                      className="mb-4 h-1.5 w-12 rounded-full"
                      style={{ background: stat.tone }}
                    />
                    <div className="text-3xl font-black tracking-tight">{stat.value}</div>
                    <div className="mt-0.5 text-xs font-bold text-[#6d7484] uppercase tracking-wider">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </section>

              {/* Apps List */}
              <section>
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black tracking-tight">Your apps</h2>
                    <p className="text-xs font-medium text-[#6d7484]">
                      {apps.length} active application{apps.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {loading ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="card p-6 bg-white">
                        <div className="skeleton mb-4 h-5 w-1/2" />
                        <div className="skeleton mb-8 h-4 w-3/4" />
                        <div className="skeleton h-4 w-1/3" />
                      </div>
                    ))}
                  </div>
                ) : apps.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#d7dce5] bg-white p-12 text-center shadow-sm">
                    <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-[#ffd32a] text-sm font-black">
                      AF
                    </div>
                    <h3 className="text-lg font-black">No apps created</h3>
                    <p className="mx-auto mt-2 max-w-xs text-xs font-medium leading-relaxed text-[#6d7484]">
                      Spin up a new App using templates or reverse-engineer a CSV template.
                    </p>
                    <button
                      onClick={() => setShowModal(true)}
                      className="btn-primary mt-6 text-xs"
                    >
                      Create first app
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {apps.map((app, index) => (
                      <Link key={app.id} href={`/apps/${app.id}`}>
                        <article
                          className="card group min-h-52 cursor-pointer p-5 bg-white flex flex-col justify-between"
                          style={{ animationDelay: `${index * 0.05}s` }}
                        >
                          <div>
                            <div className="mb-4 flex items-start justify-between gap-2">
                              <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#f0f4f8] text-xs font-black text-black border border-slate-200">
                                {app.config.entity.slice(0, 2).toUpperCase()}
                              </span>
                              <button
                                onClick={(e) => handleDelete(app.id, e)}
                                className="rounded-lg bg-red-50 border border-red-100 px-2 py-1 text-[10px] font-black text-[#e44949] opacity-0 hover:bg-red-100 transition group-hover:opacity-100"
                              >
                                Delete
                              </button>
                            </div>
                            <h3 className="text-base font-black tracking-tight text-[#07090f] transition-colors group-hover:text-[#1f7aff]">
                              {app.name}
                            </h3>
                            {app.description && (
                              <p className="mt-1 line-clamp-2 text-xs font-medium text-[#6d7484]">
                                {app.description}
                              </p>
                            )}
                          </div>

                          <div className="mt-4 pt-4 border-t border-[#edf0f4]">
                            <div className="mb-3 flex flex-wrap gap-1">
                              {app.config.fields.slice(0, 3).map((field) => (
                                <span
                                  key={field.name}
                                  className={`badge ${TYPE_COLORS[field.type] || "badge-purple"}`}
                                >
                                  {field.name}
                                </span>
                              ))}
                              {app.config.fields.length > 3 && (
                                <span className="badge badge-purple">
                                  +{app.config.fields.length - 3}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-bold text-[#8a91a3]">
                              <span>{app._count.records} records</span>
                              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                                {app.config.entity}
                              </span>
                            </div>
                          </div>
                        </article>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === "playground" && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-black tracking-tight">Config Validator Playground</h2>
                <p className="text-xs font-medium text-[#6d7484] mt-0.5">
                  Test raw or malformed config objects. The validation engine normalizes structures, sanitizes duplicate names, and infers default configurations in real time.
                </p>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                  <span className="field-label">JSON SCHEMA INPUT</span>
                  <textarea
                    className="code-area h-96 w-full font-mono text-xs p-4 bg-white"
                    value={playgroundInput}
                    onChange={(e) => setPlaygroundInput(e.target.value)}
                    placeholder="Enter configuration JSON..."
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="field-label">VALIDATOR REPORT</span>
                    {playgroundResult && (
                      <span
                        className={`badge ${
                          playgroundResult.valid
                            ? playgroundResult.warnings.length > 0
                              ? "badge-amber"
                              : "badge-green"
                            : "badge-red"
                        }`}
                      >
                        {playgroundResult.valid
                          ? playgroundResult.warnings.length > 0
                            ? "✓ VALID (WITH WARNINGS)"
                            : "✓ PERFECTLY VALID"
                          : "✗ INVALID STRUCTURE"}
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                    {playgroundResult?.errors.map((err, i) => (
                      <div key={i} className="rounded-lg border border-red-200 bg-red-50/50 p-3 text-xs font-semibold text-[#b52d2d] flex flex-col gap-1">
                        <span className="font-bold uppercase text-[9px] tracking-wider text-red-600">Error</span>
                        <span>{err.message}</span>
                      </div>
                    ))}

                    {playgroundResult?.warnings.map((warn, i) => (
                      <div key={i} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs font-semibold text-[#8f6900] flex flex-col gap-1">
                        <span className="font-bold uppercase text-[9px] tracking-wider text-amber-600">Warning {warn.field ? `(${warn.field})` : ""}</span>
                        <span>{warn.message}</span>
                        {warn.originalValue !== undefined && (
                          <div className="mt-1 font-mono text-[10px] text-slate-500">
                            Original: <span className="line-through bg-amber-100/50 px-1 rounded">{String(warn.originalValue)}</span> &rarr; Sanitized: <span className="bg-green-100/50 px-1 rounded font-bold text-green-700">{String(warn.sanitizedValue)}</span>
                          </div>
                        )}
                      </div>
                    ))}

                    {playgroundResult &&
                      playgroundResult.errors.length === 0 &&
                      playgroundResult.warnings.length === 0 && (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-xs font-medium text-slate-500">
                          No errors or warnings. Ready to run cleanly.
                        </div>
                      )}
                  </div>

                  <div className="space-y-2">
                    <span className="field-label">SANITIZED CONFIG PREVIEW</span>
                    <pre className="json-output h-64 overflow-auto text-left text-xs text-[#a5b4fc] border border-slate-800">
                      {playgroundResult ? JSON.stringify(playgroundResult.config, null, 2) : ""}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "csv" && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-black tracking-tight">CSV Reverse Engineering</h2>
                <p className="text-xs font-medium text-[#6d7484] mt-0.5">
                  Upload any raw CSV spreadsheet. AppForge will analyze header names, infer data types (numbers, dates, booleans, and low-cardinality enums), compile the JSON configuration, and bulk insert all rows.
                </p>
              </div>

              {!csvFile ? (
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`file-dropzone rounded-xl bg-white p-14 text-center cursor-pointer flex flex-col items-center justify-center ${
                    dragActive ? "drag-active" : ""
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".csv"
                    className="hidden"
                  />
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 border text-xl mb-4 font-bold text-slate-500">
                    &uarr;
                  </div>
                  <h3 className="text-sm font-black text-slate-800">Drag and drop your spreadsheet</h3>
                  <p className="text-xs font-medium text-slate-400 mt-1">
                    Supports `.csv` files up to 10MB. We parse structure client-side.
                  </p>
                  <button className="btn-ghost mt-6 text-xs py-2 px-4 font-bold">
                    Select File
                  </button>
                </div>
              ) : (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-green-50 border border-green-200 text-green-600 font-bold text-xs">
                        CSV
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-800">{csvFile.name}</h4>
                        <p className="text-xs font-medium text-slate-400">
                          Parsed {(csvFile.size / 1024).toFixed(1)} KB &bull; {csvRows.length} rows detected
                        </p>
                      </div>
                    </div>
                    <button onClick={resetCsv} className="btn-ghost text-xs py-1.5 px-3">
                      Clear & Upload New
                    </button>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div>
                          <label className="field-label">App Name</label>
                          <input
                            type="text"
                            className="input"
                            value={csvAppName}
                            onChange={(e) => setCsvAppName(e.target.value)}
                            placeholder="e.g. Sales Report"
                          />
                        </div>
                        <div>
                          <label className="field-label">Database Entity Name</label>
                          <input
                            type="text"
                            className="input"
                            value={csvEntityName}
                            onChange={(e) => setCsvEntityName(e.target.value)}
                            placeholder="e.g. Order"
                          />
                        </div>
                      </div>

                      <div className="card bg-white p-4 overflow-hidden border border-slate-200">
                        <span className="field-label mb-3">COLUMN MAPPING & SCHEMAS</span>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-slate-100 text-slate-400 font-black">
                                <th className="py-2">CSV Column</th>
                                <th className="py-2">Field Key Name</th>
                                <th className="py-2">Inferred Type</th>
                                <th className="py-2 text-center">Required</th>
                                <th className="py-2">Properties / Options</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {csvFields.map((field, index) => (
                                <tr key={index}>
                                  <td className="py-3 font-semibold text-slate-500">{csvHeaders[index]}</td>
                                  <td className="py-3">
                                    <input
                                      type="text"
                                      value={field.name}
                                      onChange={(e) => updateCsvField(index, "name", e.target.value)}
                                      className="input py-1 px-2 max-w-36 text-xs"
                                    />
                                  </td>
                                  <td className="py-3">
                                    <select
                                      value={field.type}
                                      onChange={(e) => updateCsvField(index, "type", e.target.value)}
                                      className="select py-1 px-2 max-w-32 text-xs"
                                    >
                                      <option value="string">String</option>
                                      <option value="number">Number</option>
                                      <option value="boolean">Boolean</option>
                                      <option value="enum">Enum</option>
                                      <option value="date">Date</option>
                                    </select>
                                  </td>
                                  <td className="py-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={field.required}
                                      onChange={(e) => updateCsvField(index, "required", e.target.checked)}
                                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                  </td>
                                  <td className="py-3">
                                    {field.type === "enum" ? (
                                      <input
                                        type="text"
                                        placeholder="Option1, Option2"
                                        value={field.options?.join(", ") || ""}
                                        onChange={(e) =>
                                          updateCsvField(
                                            index,
                                            "options",
                                            e.target.value.split(",").map((o) => o.trim()),
                                          )
                                        }
                                        className="input py-1 px-2 text-[10px]"
                                      />
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-mono">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <span className="field-label">COMPILED CONFIG PREVIEW</span>
                      <pre className="json-output h-[380px] overflow-auto text-[11px] text-slate-300 border border-slate-800">
                        {csvPreviewConfig}
                      </pre>

                      <button
                        onClick={handleCsvImport}
                        disabled={importingCsv || !csvAppName || !csvEntityName}
                        className="btn-primary glow-btn-primary w-full py-3 text-xs font-bold gap-2"
                      >
                        {importingCsv && (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        )}
                        {importingCsv
                          ? "Compiling & Bulk Inserting..."
                          : `Create Workspace & Insert ${csvRows.length} Rows`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* App Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-2xl animate-fade-up overflow-hidden bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#edf0f4] p-6 bg-slate-50">
              <div>
                <h2 className="text-xl font-black tracking-tight">Create new app</h2>
                <p className="text-xs font-medium text-[#6d7484]">
                  Choose a starter template or write a custom configuration object.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="btn-ghost h-8 w-8 p-0 grid place-items-center font-black rounded-full"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[60vh] space-y-5 overflow-y-auto p-6">
              <div>
                <label className="field-label mb-2">Starter templates</label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {STARTERS.map((starter) => (
                    <button
                      key={starter.label}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          name: starter.label,
                          config: starter.config,
                        }))
                      }
                      className="rounded-xl border p-4 text-left transition hover:-translate-y-0.5"
                      style={{
                        background:
                          form.config === starter.config ? "rgba(31, 122, 255, 0.05)" : "#fff",
                        borderColor:
                          form.config === starter.config
                            ? starter.accent
                            : "var(--border)",
                      }}
                    >
                      <span
                        className="mb-3 grid h-9 w-9 place-items-center rounded-lg text-[10px] font-black text-white"
                        style={{ background: starter.accent }}
                      >
                        {starter.mark}
                      </span>
                      <span className="text-xs font-black">
                        {starter.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="divider" />

              <div>
                <label className="field-label">App name *</label>
                <input
                  className="input"
                  placeholder="e.g. Employee Directory"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="field-label">Description</label>
                <input
                  className="input"
                  placeholder="App summary or metadata..."
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="field-label">JSON Config (Normalized schema)</label>
                <textarea
                  className="code-area h-56 font-mono text-xs"
                  placeholder={
                    '{\n  "entity": "Employee",\n  "fields": [\n    { "name": "fullName", "type": "string", "required": true }\n  ]\n}'
                  }
                  value={form.config}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, config: e.target.value }))
                  }
                />
              </div>
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-bold text-[#b52d2d]">
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-[#edf0f4] p-5 bg-slate-50">
              <button onClick={() => setShowModal(false)} className="btn-ghost text-xs">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="btn-primary glow-btn-primary gap-2 text-xs font-bold"
              >
                {creating && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
                {creating ? "Creating app workspace..." : "Create App"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
