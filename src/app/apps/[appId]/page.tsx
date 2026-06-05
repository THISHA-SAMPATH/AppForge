"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import type { AppConfig, FieldConfig } from "@/types/config";

import { ConfigEditorView } from "./components/ConfigEditorView";
import { HistoryView } from "./components/HistoryView";
import { GitHubExportView } from "./components/GitHubExportView";

export interface ConfigVersion {
  id: string;
  version: number;
  config: AppConfig;
  createdAt: string;
}

export interface AppData {
  id: string;
  name: string;
  description: string | null;
  config: AppConfig;
  createdAt: string;
  updatedAt: string;
  versions: ConfigVersion[];
  _count: { records: number };
}

interface AppRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

interface Toast {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

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

export type WorkspaceView = "table" | "new" | "edit" | "config" | "history" | "github";

type FieldDiff = {
  key: string;
  label: string;
  status: "added" | "removed" | "changed" | "unchanged";
  before?: FieldConfig;
  after?: FieldConfig;
  changes: string[];
};

function fieldSignature(field: FieldConfig | undefined) {
  if (!field) return "";
  return JSON.stringify({
    type: field.type,
    required: Boolean(field.required),
    options: field.options || [],
    defaultValue: field.defaultValue ?? null,
    placeholder: field.placeholder || "",
  });
}

function describeFieldChanges(before: FieldConfig, after: FieldConfig) {
  const changes: string[] = [];
  if (before.type !== after.type) changes.push(`type: ${before.type} -> ${after.type}`);
  if (Boolean(before.required) !== Boolean(after.required)) {
    changes.push(`required: ${Boolean(before.required)} -> ${Boolean(after.required)}`);
  }
  if (JSON.stringify(before.options || []) !== JSON.stringify(after.options || [])) {
    changes.push("enum options changed");
  }
  if (JSON.stringify(before.defaultValue ?? null) !== JSON.stringify(after.defaultValue ?? null)) {
    changes.push("default value changed");
  }
  if ((before.placeholder || "") !== (after.placeholder || "")) {
    changes.push("placeholder changed");
  }
  return changes;
}

function diffConfigs(before: AppConfig, after: AppConfig): FieldDiff[] {
  const beforeFields = new Map(before.fields.map((field) => [field.name, field]));
  const afterFields = new Map(after.fields.map((field) => [field.name, field]));
  const names = Array.from(new Set([...beforeFields.keys(), ...afterFields.keys()])).sort();

  const entityChanges: FieldDiff[] =
    before.entity !== after.entity
      ? [{
          key: "__entity",
          label: "Entity name",
          status: "changed",
          changes: [`entity: ${before.entity} -> ${after.entity}`],
        }]
      : [];

  return [
    ...entityChanges,
    ...names.map((name) => {
      const previous = beforeFields.get(name);
      const current = afterFields.get(name);
      if (!previous && current) {
        return { key: name, label: name, status: "added" as const, after: current, changes: [`added ${current.type} field`] };
      }
      if (previous && !current) {
        return { key: name, label: name, status: "removed" as const, before: previous, changes: [`removed ${previous.type} field`] };
      }
      if (previous && current && fieldSignature(previous) !== fieldSignature(current)) {
        return {
          key: name,
          label: name,
          status: "changed" as const,
          before: previous,
          after: current,
          changes: describeFieldChanges(previous, current),
        };
      }
      return {
        key: name,
        label: name,
        status: "unchanged" as const,
        before: previous,
        after: current,
        changes: ["no field-level changes"],
      };
    }),
  ];
}

function diffBadgeClass(status: FieldDiff["status"]) {
  if (status === "added") return "badge-green";
  if (status === "removed") return "badge-red";
  if (status === "changed") return "badge-amber";
  return "badge-cyan";
}

function ConfigDiffPanel({ before, after }: { before: AppConfig; after: AppConfig }) {
  const diffs = diffConfigs(before, after);
  const activeDiffs = diffs.filter((diff) => diff.status !== "unchanged");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(["added", "removed", "changed", "unchanged"] as const).map((status) => (
          <div key={status} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-lg font-black text-slate-800">
              {diffs.filter((diff) => diff.status === status).length}
            </div>
            <div className="text-[10px] font-black uppercase text-slate-400">{status}</div>
          </div>
        ))}
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {(activeDiffs.length ? activeDiffs : diffs.slice(0, 8)).map((diff) => (
          <div key={diff.key} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-slate-800">{diff.label}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {diff.changes.map((change) => (
                    <span key={change} className="text-[11px] font-semibold text-slate-500">
                      {change}
                    </span>
                  ))}
                </div>
              </div>
              <span className={`badge ${diffBadgeClass(diff.status)}`}>{diff.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getWorkspaceView(rawView: string | null | undefined): WorkspaceView {
  if (rawView === "config" || rawView === "history" || rawView === "github" || rawView === "table") {
    return rawView;
  }

  return "table";
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldConfig;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const isUnknown = !["string", "number", "boolean", "enum", "date"].includes(field.type);

  if (isUnknown) {
    return (
      <div className="border border-amber-250 bg-amber-50/50 p-3.5 rounded-xl flex flex-col gap-1">
        <span className="text-xs text-amber-700 font-bold">
          Fallback Field: Raw string editor for type &quot;{field.type}&quot;
        </span>
        <input
          type="text"
          className="input"
          placeholder={`Enter raw data...`}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (field.type === "boolean")
    return (
      <div className="flex items-center gap-3 cursor-pointer py-1">
        <button
          type="button"
          onClick={() => onChange(!value)}
          className="w-11 h-6 rounded-full transition-colors relative cursor-pointer outline-none border-none"
          style={{
            background: value ? "var(--accent)" : "rgba(0,0,0,0.12)",
          }}
        >
          <div
            className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
            style={{
              left: "2px",
              transform: value ? "translateX(20px)" : "translateX(0)",
            }}
          />
        </button>
        <span className="text-sm font-bold text-slate-700">
          {value ? "Yes" : "No"}
        </span>
      </div>
    );
  if (field.type === "enum" && field.options)
    return (
      <select
        className="select"
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select {field.name}...</option>
        {field.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  if (field.type === "date")
    return (
      <input
        type="date"
        className="input"
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  if (field.type === "number")
    return (
      <input
        type="number"
        className="input"
        placeholder={`Enter ${field.name}...`}
        value={value !== undefined && value !== null ? String(value) : ""}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val === "" ? "" : Number(val));
        }}
      />
    );
  return (
    <input
      type="text"
      className="input"
      placeholder={field.placeholder || `Enter ${field.name}...`}
      value={String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function RecordForm({
  config,
  initial,
  onSave,
  onCancel,
  saving,
}: {
  config: AppConfig;
  initial?: AppRecord;
  onSave: (d: { [k: string]: unknown }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [data, setData] = useState<{ [k: string]: unknown }>(() => {
    const d: { [k: string]: unknown } = {};
    config.fields.forEach((f) => {
      d[f.name] =
        initial?.[f.name] ??
        f.defaultValue ??
        (f.type === "boolean" ? false : "");
    });
    return d;
  });
  const [err, setErr] = useState("");

  const submit = () => {
    setErr("");
    for (const f of config.fields) {
      if (f.required && (data[f.name] === undefined || data[f.name] === null || data[f.name] === "")) {
        setErr(`"${f.name}" is required`);
        return;
      }
    }
    onSave(data);
  };

  return (
    <div className="space-y-5">
      {config.fields.map((f) => (
        <div key={f.name} className="space-y-1">
          <label className="field-label flex items-center justify-between">
            <span>
              {f.name}{" "}
              {f.required && <span className="text-[var(--red)]">*</span>}
            </span>
            <span
              className={`badge ${TYPE_COLORS[f.type] || "badge-purple"}`}
              style={{ textTransform: "none", letterSpacing: 0 }}
            >
              {f.type}
            </span>
          </label>
          <FieldInput
            field={f}
            value={data[f.name]}
            onChange={(v) => setData((p) => ({ ...p, [f.name]: v }))}
          />
        </div>
      ))}
      {err && (
        <div className="p-3 rounded-lg text-xs font-bold bg-red-50 border border-red-150 text-[var(--red)]">
          {err}
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="btn-ghost text-xs">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="btn-primary glow-btn-primary gap-2 text-xs font-bold"
        >
          {saving && (
            <div className="w-4 h-4 border-2 border-white/35 border-t-white rounded-full animate-spin" />
          )}
          {saving ? "Saving..." : "Save Record"}
        </button>
      </div>
    </div>
  );
}

export default function AppPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const appId = params?.appId as string;
  const { data: session } = useSession();
  const [app, setApp] = useState<AppData | null>(null);
  const [records, setRecords] = useState<AppRecord[]>([]);
  const [allApps, setAllApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState("");
  const [view, setView] = useState<WorkspaceView>(() => getWorkspaceView(searchParams?.get("view")));
  const [editing, setEditing] = useState<AppRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [configText, setConfigText] = useState("");
  const [configErr, setConfigErr] = useState("");
  const [updating, setUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // UI state
  const [showSwitcherDropdown, setShowSwitcherDropdown] = useState(false);
  const [showPwaModal, setShowPwaModal] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  // Version Comparison Modal state
  const [selectedHistoryVersion, setSelectedHistoryVersion] = useState<ConfigVersion | null>(null);

  // GitHub Export State
  const [githubToken, setGithubToken] = useState("");
  const [githubRepoName, setGithubRepoName] = useState("");
  const [githubPrivate, setGithubPrivate] = useState(false);
  const [exportLogs, setExportLogs] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportedUrl, setExportedUrl] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((type: Toast["type"], message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev.slice(-2), { id, type, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

  const loadApp = useCallback(async () => {
    const r = await fetch(`/api/apps/${appId}`);
    const d = await r.json();
    if (d.success) {
      setApp(d.data);
      setConfigText(JSON.stringify(d.data.config, null, 2));
      if (!githubRepoName) {
        setGithubRepoName(`appforge-${d.data.config.entity.toLowerCase()}-runtime`);
      }
    }
  }, [appId, githubRepoName]);

  const loadRecords = useCallback(
    async (cfg: AppConfig) => {
      setRecordsLoading(true);
      setRecordsError("");
      try {
        const r = await fetch(`/api/apps/${appId}/${cfg.entity}`);
        const d = await r.json();
        if (d.success) {
          setRecords(d.data);
        } else {
          setRecordsError(d.error || "Could not load records");
        }
      } catch {
        setRecordsError("Could not load records. Check your connection and try again.");
      } finally {
        setRecordsLoading(false);
      }
    },
    [appId],
  );

  const loadAllApps = useCallback(async () => {
    const r = await fetch("/api/apps");
    const d = await r.json();
    if (d.success) setAllApps(d.data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void loadApp().finally(() => {
        if (!cancelled) setLoading(false);
      });
      void loadAllApps();
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setShowSwitcherDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      cancelled = true;
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [loadApp, loadAllApps]);

  useEffect(() => {
    if (!app) return;
    queueMicrotask(() => {
      void loadRecords(app.config);
    });

    // Dynamic Manifest injection for PWA
    let link = document.querySelector("link[rel='manifest']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.href = `/api/apps/${appId}/manifest`;

    return () => {
      if (link) link.href = "";
    };
  }, [app, loadRecords, appId]);

  const handleSave = async (formData: { [k: string]: unknown }) => {
    if (!app) return;
    const now = new Date().toISOString();
    const previousRecords = records;
    const tempId = `temp_${Date.now()}`;
    const optimisticRecord: AppRecord = editing
      ? { ...editing, ...formData, updatedAt: now }
      : { id: tempId, ...formData, createdAt: now, updatedAt: now };

    setSaving(true);
    setView("table");
    setEditing(null);
    setRecords((current) =>
      editing
        ? current.map((record) => (record.id === editing.id ? optimisticRecord : record))
        : [optimisticRecord, ...current],
    );

    try {
      const url = editing
        ? `/api/apps/${appId}/${app.config.entity}/${editing.id}`
        : `/api/apps/${appId}/${app.config.entity}`;
      const r = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const d = await r.json();
      if (d.success) {
        if (!editing && d.data?.id) {
          setRecords((current) =>
            current.map((record) =>
              record.id === tempId
                ? { ...record, ...d.data, updatedAt: d.data.updatedAt || record.updatedAt }
                : record,
            ),
          );
        }
        notify("success", editing ? "Record updated." : "Record created.");
      } else {
        setRecords(previousRecords);
        notify("error", d.error || "Could not save record.");
      }
    } catch {
      setRecords(previousRecords);
      notify("error", "Could not save record. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!app || !confirm("Delete this record?")) return;
    try {
      const r = await fetch(`/api/apps/${appId}/${app.config.entity}/${id}`, {
        method: "DELETE",
      });
      const d = await r.json();
      if (d.success) {
        setRecords((p) => p.filter((r) => r.id !== id));
        notify("success", "Record deleted.");
      } else {
        notify("error", d.error || "Could not delete record.");
      }
    } catch {
      notify("error", "Could not delete record. Check your connection and try again.");
    }
  };

  const handleConfigSave = async (textToSave = configText) => {
    setConfigErr("");
    let parsed;
    try {
      parsed = JSON.parse(textToSave);
    } catch {
      setConfigErr("Invalid JSON syntax - check commas and braces");
      notify("error", "Invalid JSON syntax.");
      return;
    }
    setUpdating(true);
    try {
      const r = await fetch(`/api/apps/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: parsed }),
      });
      const d = await r.json();
      if (d.success) {
        await loadApp();
        setView("table");
        notify("success", "Config saved and runtime recompiled.");
      } else {
        const message = d.error || "Failed to update configuration";
        setConfigErr(message);
        notify("error", message);
      }
    } catch {
      const message = "Failed to update configuration. Check your connection and try again.";
      setConfigErr(message);
      notify("error", message);
    } finally {
      setUpdating(false);
    }
  };

  const handleVersionRestore = async (versionConfig: AppConfig) => {
    if (!confirm("Are you sure you want to restore this configuration version? All current fields will be overwritten.")) return;
    setSelectedHistoryVersion(null);
    const textStr = JSON.stringify(versionConfig, null, 2);
    setConfigText(textStr);
    await handleConfigSave(textStr);
  };

  // GitHub Export Logic
  const handleGitHubExport = async () => {
    if (!app) return;
    if (!githubToken.trim()) {
      notify("error", "GitHub Personal Access Token is required.");
      return;
    }
    if (!githubRepoName.trim()) {
      notify("error", "Repository name is required.");
      return;
    }

    setExporting(true);
    setExportLogs([
      "Preparing schema and seed data...",
      "Generating standalone Next.js app on the server...",
      "Connecting to GitHub...",
    ]);
    setExportedUrl("");

    try {
      const response = await fetch("/api/export/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId,
          token: githubToken.trim(),
          repoName: githubRepoName.trim(),
          private: githubPrivate,
        }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "GitHub export failed");
      }

      addLog(`Repository ${data.data.repoCreated ? "created" : "updated"}: ${data.data.repoName}`);
      addLog(`Generated ${data.data.filesCreated} deployable app files.`);
      addLog(`Committed ${String(data.data.commitSha).slice(0, 7)} to main.`);
      addLog("Export complete.");
      setExportedUrl(data.data.repoUrl);
      notify("success", "GitHub repo generated.");
    } catch (e: unknown) {
      console.error(e);
      addLog(`Error exporting: ${e instanceof Error ? e.message : String(e)}`);
      notify("error", e instanceof Error ? e.message : "GitHub export failed.");
    } finally {
      setExporting(false);
    }
  };

  const addLog = (msg: string) => {
    setExportLogs((p) => [...p, msg]);
  };

  const generateNextJsAppCode = (appName: string, config: AppConfig, records: AppRecord[]) => {
    const schemaJson = JSON.stringify(config, null, 2);
    const seedJson = JSON.stringify(records, null, 2);

    const packageJson = `{
  "name": "${appName.toLowerCase().replace(/[^a-z0-9]/g, "-")}",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.2.3",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  }
}`;

    const readmeMd = `# ${appName}

This application was generated dynamically from AppForge using a metadata-driven config schema.

## Features
- Fully compiled React components mapped to your data fields
- Client-side database runtime storing records inside browser \`localStorage\` for instant local testing and static hosting
- Responsive, modern Tailwind CSS layout

## Getting Started
1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`
2. Run development server:
   \`\`\`bash
   npm run dev
   \`\`\`
3. Open http://localhost:3000 to view your application!

## Deployment
You can deploy this repository directly to Vercel in one click. Since it uses browser-based local storage, it does not require database configuration to run!
`;

    const pageCode = `"use client";

import React, { useState, useEffect } from "react";

const schema = ${schemaJson};
const seedData = ${seedJson};

export default function Home() {
  const [records, setRecords] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    const local = localStorage.getItem("appforge_records_" + schema.entity);
    if (local) {
      setRecords(JSON.parse(local));
    } else {
      setRecords(seedData);
      localStorage.setItem("appforge_records_" + schema.entity, JSON.stringify(seedData));
    }
    setLoaded(true);
  }, []);

  const saveToLocalStorage = (newRecords: any[]) => {
    setRecords(newRecords);
    localStorage.setItem("appforge_records_" + schema.entity, JSON.stringify(newRecords));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      const updated = records.map(r => r.id === editing.id ? { ...r, ...formData, updatedAt: new Date().toISOString() } : r);
      saveToLocalStorage(updated);
    } else {
      const newRecord = {
        id: "rec_" + Math.random().toString(36).substr(2, 9),
        ...formData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      saveToLocalStorage([newRecord, ...records]);
    }
    setShowForm(false);
    setEditing(null);
    setFormData({});
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    const filtered = records.filter(r => r.id !== id);
    saveToLocalStorage(filtered);
  };

  const startEdit = (record: any) => {
    setEditing(record);
    setFormData(record);
    setShowForm(true);
  };

  const startNew = () => {
    setEditing(null);
    const initialData: any = {};
    schema.fields.forEach((f: any) => {
      initialData[f.name] = f.defaultValue !== undefined ? f.defaultValue : (f.type === "boolean" ? false : "");
    });
    setFormData(initialData);
    setShowForm(true);
  };

  const filtered = records.filter(r => {
    return schema.fields.some((f: any) => {
      const val = r[f.name];
      return val && String(val).toLowerCase().includes(search.toLowerCase());
    });
  });

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{schema.entity} Directory</h1>
            <p className="text-sm text-slate-500 font-medium mt-0.5">Manage records for entity <strong>{schema.entity}</strong></p>
          </div>
          <button 
            onClick={startNew}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl text-sm transition"
          >
            + Add Record
          </button>
        </header>

        <div className="flex gap-4 items-center">
          <input
            type="text"
            placeholder="Search records..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{filtered.length} of {records.length} records</div>
        </div>

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-extrabold text-lg">{editing ? "Edit Record" : "Add New Record"}</h3>
                <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 font-bold border-none bg-transparent cursor-pointer">✕</button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {schema.fields.map((field: any) => (
                  <div key={field.name} className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {field.name} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    {field.type === "boolean" ? (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, [field.name]: !formData[field.name] })}
                          className={"w-11 h-6 rounded-full relative transition-colors duration-200 border-none cursor-pointer " + (formData[field.name] ? "bg-indigo-600" : "bg-slate-200")}
                        >
                          <div className={"w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 transition-transform duration-200 " + (formData[field.name] ? "translate-x-5" : "")} />
                        </button>
                        <span className="text-sm text-slate-600 font-medium">{formData[field.name] ? "Yes" : "No"}</span>
                      </div>
                    ) : field.type === "enum" ? (
                      <select
                        value={formData[field.name] || ""}
                        onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                        required={field.required}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      >
                        <option value="">Select option...</option>
                        {field.options?.map((opt: string) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === "date" ? (
                      <input
                        type="date"
                        value={formData[field.name] || ""}
                        onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                        required={field.required}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      />
                    ) : field.type === "number" ? (
                      <input
                        type="number"
                        value={formData[field.name] !== undefined ? formData[field.name] : ""}
                        onChange={(e) => setFormData({ ...formData, [field.name]: Number(e.target.value) })}
                        required={field.required}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      />
                    ) : (
                      <input
                        type="text"
                        value={formData[field.name] || ""}
                        onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                        required={field.required}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      />
                    )}
                  </div>
                ))}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-bold border border-slate-200 rounded-xl hover:bg-slate-50 transition border-solid bg-transparent cursor-pointer">Cancel</button>
                  <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition border-none cursor-pointer">Save Record</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-20 text-center">
              <div className="text-slate-300 text-4xl mb-4 font-mono">◈</div>
              <h3 className="font-extrabold text-lg text-slate-800">No records found</h3>
              <p className="text-sm text-slate-500 max-w-xs mx-auto mt-1">Try resetting search query or add a new record to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-400 font-extrabold text-xs uppercase tracking-wider">
                    {schema.fields.map((f: any) => (
                      <th key={f.name} className="px-6 py-4">{f.name}</th>
                    ))}
                    <th className="px-6 py-4">Created</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition duration-150">
                      {schema.fields.map((f: any) => (
                        <td key={f.name} className="px-6 py-4 font-medium text-slate-700">
                          {f.type === "boolean" ? (
                            <span className={"inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold " + (r[f.name] ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100")}>
                              {r[f.name] ? "Yes" : "No"}
                            </span>
                          ) : f.type === "enum" ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-100">
                              {String(r[f.name] || "")}
                            </span>
                          ) : f.type === "date" && r[f.name] ? (
                            <span>{new Date(r[f.name]).toLocaleDateString()}</span>
                          ) : (
                            <span>{String(r[f.name] !== undefined ? r[f.name] : "")}</span>
                          )}
                        </td>
                      ))}
                      <td className="px-6 py-4 text-xs font-semibold text-slate-400">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2.5">
                          <button onClick={() => startEdit(r)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition border-none bg-transparent cursor-pointer">Edit</button>
                          <button onClick={() => handleDelete(r.id)} className="text-xs font-bold text-rose-600 hover:text-rose-800 transition border-none bg-transparent cursor-pointer">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}`;

    return {
      "package.json": packageJson,
      "README.md": readmeMd,
      "src/app/page.tsx": pageCode,
      "tailwind.config.js": `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`,
      "postcss.config.js": `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`,
      "src/app/layout.tsx": `import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "${appName}",
  description: "Compiled statically from AppForge",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className + " bg-slate-50 min-h-screen"}>{children}</body>
    </html>
  );
}`,
      "src/app/globals.css": `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: rgb(248 250 252);
}`
    };
  };

  const renderCell = (value: unknown, type: string) => {
    if (value === null || value === undefined || value === "")
      return <span style={{ color: "var(--text-muted)" }}>—</span>;
    if (!["string", "number", "boolean", "enum", "date"].includes(type))
      return <span className="text-amber-600 font-bold italic">Fallback: {String(value)}</span>;
    if (type === "boolean")
      return (
        <span className={`badge ${value ? "badge-green" : "badge-red"}`}>
          {value ? "Yes" : "No"}
        </span>
      );
    if (type === "enum")
      return <span className="badge badge-purple">{String(value)}</span>;
    if (type === "date")
      return <span>{new Date(String(value)).toLocaleDateString()}</span>;
    return <span>{String(value)}</span>;
  };

  void generateNextJsAppCode;

  const filteredRecords = records.filter((rec) => {
    if (!searchQuery) return true;
    return app?.config.fields.some((f) => {
      const val = rec[f.name];
      return val && String(val).toLowerCase().includes(searchQuery.toLowerCase());
    });
  });

  const appUrl = typeof window !== "undefined" ? window.location.origin + "/apps/" + appId : "";

  if (loading)
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-canvas)" }} className="flex justify-center items-center">
        <div style={{ width: 32, height: 32, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%" }} className="animate-spin" />
      </div>
    );

  if (!app)
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-canvas)" }}>
        <div style={{ textAlign: "center", background: "#fff", padding: 32, borderRadius: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          <p style={{ marginBottom: 16, fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>App workspace not found</p>
          <Link href="/dashboard" className="btn-primary text-xs font-bold px-4 py-2 text-decoration-none">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-canvas)", display: "flex", flexDirection: "column" }}>
      
      {/* ─── BREADCRUMB SWITCHER HEAD FLOATING NAV ─────────────────────────────── */}
      <header className="forge-topnav">
        <div className="flex items-center gap-2" ref={switcherRef}>
          <Link href="/dashboard" className="text-decoration-none font-extrabold text-sm text-[#7c6ef5] flex items-center gap-2">
            <img src="/logo.png" className="w-6 h-6 object-contain rounded-md" alt="AppForge" />
            <span>AppForge</span>
          </Link>
          <span className="text-slate-300 font-semibold text-xs">/</span>
          
          <div className="relative">
            <button
              onClick={() => setShowSwitcherDropdown((prev) => !prev)}
              className="text-xs font-extrabold text-slate-800 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1.5 rounded-lg border-none cursor-pointer flex items-center gap-1.5"
            >
              <span>📦 {app.name}</span>
              <span className="text-[10px] text-slate-400">▼</span>
            </button>

            {showSwitcherDropdown && (
              <div className="dropdown-glass-menu" style={{ left: 0, width: 220 }}>
                <div className="p-2 border-b border-slate-100 bg-white/20">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Switch Runtime</span>
                </div>
                <div className="p-1 flex flex-col max-h-[200px] overflow-y-auto">
                  {allApps.map((a) => (
                    <Link
                      key={a.id}
                      href={`/apps/${a.id}`}
                      onClick={() => setShowSwitcherDropdown(false)}
                      className={`text-xs font-bold text-slate-700 hover:bg-slate-100 p-2 rounded-lg text-decoration-none transition ${a.id === appId ? "bg-slate-50 text-[#7c6ef5]" : ""}`}
                    >
                      {a.name}
                    </Link>
                  ))}
                  {allApps.length <= 1 && (
                    <span className="text-[11px] p-2 text-slate-400 italic">No other apps forged yet</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center Floating Tab Bar Selector */}
        <div className="tab-bar-pill">
          <button
            onClick={() => setView("table")}
            className={`tab-bar-item ${(view === "table" || view === "new" || view === "edit") ? "active" : ""}`}
          >
            Records
          </button>
          <button
            onClick={() => setView("config")}
            className={`tab-bar-item ${view === "config" ? "active" : ""}`}
          >
            Schema Config
          </button>
          <button
            onClick={() => setView("history")}
            className={`tab-bar-item ${view === "history" ? "active" : ""}`}
          >
            History
          </button>
          <button
            onClick={() => setView("github")}
            className={`tab-bar-item ${view === "github" ? "active" : ""}`}
          >
            GitHub Export
          </button>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPwaModal(true)}
            className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border-none cursor-pointer transition flex items-center gap-1"
          >
            <span>📱 Deploy to Phone</span>
          </button>
          <Link href="/dashboard" className="text-xs font-bold text-slate-650 hover:text-slate-800 transition text-decoration-none">
            Dashboard
          </Link>
        </div>
      </header>

      {/* ─── APP RUNTIME BODY CONTAINER ─────────────────────────────────────────── */}
      <main style={{ paddingTop: 90, paddingLeft: 24, paddingRight: 24, paddingBottom: 40, maxWidth: 1200, width: "100%", margin: "0 auto" }}>
        
        {view === "table" && (
          <div className="animate-fade-in space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-serif text-3xl font-normal italic text-slate-800 tracking-tight">Active records</h1>
                <p className="text-xs font-medium text-slate-400 mt-1">Live CRUD rows parsed against schema validators</p>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Search records..."
                  className="input"
                  style={{ maxWidth: 220, padding: "8px 14px", fontSize: 12 }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button
                  onClick={() => { setView("new"); setEditing(null); }}
                  className="btn-primary glow-btn-primary text-xs py-2 px-4 font-bold"
                >
                  + Add Record
                </button>
              </div>
            </div>

            {recordsLoading ? (
              <div className="card overflow-hidden bg-white border border-slate-200 shadow-sm">
                <div className="border-b border-slate-100 p-4">
                  <div className="skeleton h-4 w-40" />
                </div>
                <div className="space-y-3 p-4">
                  {[0, 1, 2, 3].map((row) => (
                    <div key={row} className="grid grid-cols-4 gap-3">
                      <div className="skeleton h-9" />
                      <div className="skeleton h-9" />
                      <div className="skeleton h-9" />
                      <div className="skeleton h-9" />
                    </div>
                  ))}
                </div>
              </div>
            ) : recordsError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50/70 p-8 text-center">
                <h3 className="text-base font-extrabold text-red-700">Records failed to load</h3>
                <p className="mx-auto mt-1 max-w-sm text-xs font-semibold text-red-500">{recordsError}</p>
                <button onClick={() => loadRecords(app.config)} className="btn-primary glow-btn-primary mt-5 text-xs py-2 px-4 font-bold">
                  Retry
                </button>
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-20 bg-white/70 backdrop-blur border border-slate-200 rounded-2xl">
                <div className="text-3xl mb-3 font-mono text-slate-300">◈</div>
                <h3 className="text-base font-extrabold text-slate-700">No records yet. Add one.</h3>
                <p className="text-xs font-semibold text-slate-400 mt-1 max-w-xs mx-auto">
                  Your runtime is ready. Add the first row with the dynamic form generated from this config.
                </p>
                <button onClick={() => setView("new")} className="btn-primary glow-btn-primary mt-6 text-xs py-2.5 px-5 font-bold">
                  + Add Record
                </button>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-16 bg-white/70 backdrop-blur border border-slate-200 rounded-2xl">
                <h3 className="text-base font-extrabold text-slate-700">No matching records</h3>
                <p className="text-xs font-semibold text-slate-400 mt-1">Clear the search to return to all rows.</p>
              </div>
            ) : (
              <div className="card overflow-hidden bg-white border border-slate-200 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {app.config.fields.map((f) => (
                          <th key={f.name}>
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-slate-650">{f.name}</span>
                              <span className={`badge ${TYPE_COLORS[f.type] || "badge-purple"}`}>
                                {f.type}
                              </span>
                            </div>
                          </th>
                        ))}
                        <th>Created</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((record) => (
                        <tr key={record.id}>
                          {app.config.fields.map((f) => (
                            <td key={f.name} className="font-semibold text-slate-700">
                              {renderCell(record[f.name], f.type)}
                            </td>
                          ))}
                          <td className="text-xs font-semibold text-slate-400">
                            {new Date(record.createdAt).toLocaleDateString()}
                          </td>
                          <td>
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => {
                                  setEditing(record);
                                  setView("edit");
                                }}
                                className="text-[11px] font-bold px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 transition border-none cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(record.id)}
                                className="text-[11px] font-bold px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-[#e44949] transition border-none cursor-pointer"
                              >
                                Del
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {(view === "new" || view === "edit") && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h1 className="font-serif text-3xl font-normal italic text-slate-800">
                {view === "edit" ? `Edit ${app.config.entity}` : `Add new ${app.config.entity}`}
              </h1>
              <p className="text-xs font-medium text-slate-400 mt-1">Fields are autocompiled from configurations.</p>
            </div>
            <div style={{ maxWidth: 560 }}>
              <div className="card p-6 bg-white border border-slate-200 shadow-sm">
                <RecordForm
                  config={app.config}
                  initial={editing || undefined}
                  onSave={handleSave}
                  onCancel={() => {
                    setView("table");
                    setEditing(null);
                  }}
                  saving={saving}
                />
              </div>
            </div>
          </div>
        )}

        {view === "config" && (
          <ConfigEditorView
            app={app}
            configText={configText}
            setConfigText={setConfigText}
            configErr={configErr}
            updating={updating}
            handleConfigSave={handleConfigSave}
            setView={setView}
            setSelectedHistoryVersion={setSelectedHistoryVersion}
          />
        )}

        {view === "history" && (
          <HistoryView
            app={app}
            setView={setView}
            setSelectedHistoryVersion={setSelectedHistoryVersion}
          />
        )}

        {view === "github" && (
          <GitHubExportView
            githubToken={githubToken}
            setGithubToken={setGithubToken}
            githubRepoName={githubRepoName}
            setGithubRepoName={setGithubRepoName}
            githubPrivate={githubPrivate}
            setGithubPrivate={setGithubPrivate}
            handleGitHubExport={handleGitHubExport}
            exporting={exporting}
            exportedUrl={exportedUrl}
            exportLogs={exportLogs}
          />
        )}
      </main>

      {/* ─── PWA "DEPLOY TO PHONE" INSTALL QR OVERLAY MODAL ────────────────────── */}
      {showPwaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-md animate-fade-up overflow-hidden bg-white shadow-2xl p-6 relative">
            <button
              onClick={() => setShowPwaModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 font-bold border-none bg-transparent cursor-pointer text-sm"
            >
              ✕
            </button>
            <div className="text-center">
              <span className="badge badge-purple px-3 py-1 mb-2">Installable Mobile App</span>
              <h3 className="font-serif text-2xl italic font-normal text-slate-800 m-0">Add to Phone Home Screen</h3>
              <p className="text-xs text-slate-400 mt-1 mb-6">Scan code below with your phone camera to download this custom AppForge runtime</p>
              
              <div className="w-[180px] h-[180px] bg-slate-50 border border-slate-200 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-inner">
                {/* QR code generator using public API */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(appUrl)}`}
                  alt="AppForge PWA Deployment Code"
                  width={160}
                  height={160}
                  className="rounded-lg shadow-sm"
                />
              </div>

              <div className="text-left bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-100">
                <p className="text-[11px] font-black text-slate-700 m-0">How to install:</p>
                <ol className="text-[11px] text-slate-500 font-semibold m-0 pl-4 space-y-1">
                  <li>Scan the QR code to open the app page on your phone browser.</li>
                  <li>In Safari (iOS), tap the <strong>Share</strong> button and choose <strong>Add to Home Screen</strong>.</li>
                  <li>In Chrome (Android), tap the menu icon (3 dots) and select <strong>Add to Home Screen</strong> or <strong>Install App</strong>.</li>
                </ol>
              </div>

              <button
                onClick={() => setShowPwaModal(false)}
                className="btn-ghost text-xs w-full py-2.5 rounded-xl font-bold mt-4"
              >
                Close Portal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version Comparison Modal */}
      {selectedHistoryVersion && app && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm font-sans">
          <div className="card w-full max-w-5xl animate-fade-up overflow-hidden bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#edf0f4] p-6 bg-slate-50">
              <div>
                <h1 className="font-serif text-2xl font-normal tracking-tight text-[#07090f] italic">Compare Config Version #{selectedHistoryVersion.version}</h1>
                <p className="text-xs font-medium text-[#6d7484] mt-0.5">
                  Compare schema definition saved on {new Date(selectedHistoryVersion.createdAt).toLocaleString()}.
                </p>
              </div>
              <button
                onClick={() => setSelectedHistoryVersion(null)}
                className="btn-ghost h-8 w-8 p-0 grid place-items-center font-black rounded-full border-none bg-transparent cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 p-6 overflow-y-auto max-h-[68vh] lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <span className="field-label mb-2">FIELD-LEVEL DIFF</span>
                <ConfigDiffPanel before={selectedHistoryVersion.config} after={app.config} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <span className="field-label mb-2">CURRENT SCHEMAS CONFIG</span>
                <pre className="json-output h-80 text-[11px] overflow-auto text-slate-350 bg-slate-900 p-3 rounded-lg border border-slate-800">
                  {configText}
                </pre>
              </div>
              <div>
                <span className="field-label mb-2">HISTORY VERSION #{selectedHistoryVersion.version} CONFIG</span>
                <pre className="json-output h-80 text-[11px] overflow-auto text-slate-350 bg-slate-950 p-3 rounded-lg border border-slate-900">
                  {JSON.stringify(selectedHistoryVersion.config, null, 2)}
                </pre>
              </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#edf0f4] p-5 bg-slate-50">
              <button onClick={() => setSelectedHistoryVersion(null)} className="btn-ghost text-xs">
                Cancel
              </button>
              <button
                onClick={() => handleVersionRestore(selectedHistoryVersion.config)}
                className="btn-primary glow-btn-primary px-5 py-2 text-xs font-bold gap-1"
              >
                Restore Version #{selectedHistoryVersion.version} Config
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-5 right-5 z-[120] flex w-[min(360px,calc(100vw-40px))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-2xl border bg-white/90 px-4 py-3 text-xs font-bold shadow-lg backdrop-blur ${
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
