"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Octokit } from "@octokit/rest";
import type { AppConfig, FieldConfig } from "@/types/config";

interface AppData {
  id: string;
  name: string;
  description: string | null;
  config: AppConfig;
  createdAt: string;
  updatedAt: string;
  versions: Array<{ id: string; version: number; config: any; createdAt: string }>;
  _count: { records: number };
}

interface AppRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

const TYPE_COLORS: Record<string, string> = {
  string: "badge-cyan",
  number: "badge-amber",
  boolean: "badge-green",
  enum: "badge-purple",
  date: "badge-red",
};

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldConfig;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (field.type === "boolean")
    return (
      <div className="flex items-center gap-3 cursor-pointer py-1">
        <button
          type="button"
          onClick={() => onChange(!value)}
          className="w-11 h-6 rounded-full transition-colors relative cursor-pointer outline-none"
          style={{
            background: value ? "var(--accent)" : "var(--border-bright)",
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
        <span className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
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
              className={`badge ${TYPE_COLORS[f.type]}`}
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
  const appId = params?.appId as string;
  const { data: session } = useSession();
  const [app, setApp] = useState<AppData | null>(null);
  const [records, setRecords] = useState<AppRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"table" | "new" | "edit" | "config" | "github">("table");
  const [editing, setEditing] = useState<AppRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [configText, setConfigText] = useState("");
  const [configErr, setConfigErr] = useState("");
  const [updating, setUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Version Comparison Modal state
  const [selectedHistoryVersion, setSelectedHistoryVersion] = useState<any | null>(null);

  // GitHub Export State
  const [githubToken, setGithubToken] = useState("");
  const [githubRepoName, setGithubRepoName] = useState("");
  const [githubPrivate, setGithubPrivate] = useState(false);
  const [exportLogs, setExportLogs] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportedUrl, setExportedUrl] = useState("");

  const loadApp = useCallback(async () => {
    const r = await fetch(`/api/apps/${appId}`);
    const d = await r.json();
    if (d.success) {
      setApp(d.data);
      setConfigText(JSON.stringify(d.data.config, null, 2));
      // Prefill repo name if blank
      if (!githubRepoName) {
        setGithubRepoName(`appforge-${d.data.config.entity.toLowerCase()}-runtime`);
      }
    }
  }, [appId, githubRepoName]);

  const loadRecords = useCallback(
    async (cfg: AppConfig) => {
      const r = await fetch(`/api/apps/${appId}/${cfg.entity}`);
      const d = await r.json();
      if (d.success) setRecords(d.data);
    },
    [appId],
  );

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      void loadApp().finally(() => {
        if (!cancelled) setLoading(false);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [loadApp]);

  useEffect(() => {
    if (!app) return;

    queueMicrotask(() => {
      void loadRecords(app.config);
    });
  }, [app, loadRecords]);

  const handleSave = async (formData: { [k: string]: unknown }) => {
    if (!app) return;
    setSaving(true);
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
        await loadRecords(app.config);
        setView("table");
        setEditing(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!app || !confirm("Delete this record?")) return;
    await fetch(`/api/apps/${appId}/${app.config.entity}/${id}`, {
      method: "DELETE",
    });
    setRecords((p) => p.filter((r) => r.id !== id));
  };

  const handleConfigSave = async (textToSave = configText) => {
    setConfigErr("");
    let parsed;
    try {
      parsed = JSON.parse(textToSave);
    } catch {
      setConfigErr("Invalid JSON syntax - check commas and braces");
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
      } else setConfigErr(d.error || "Failed to update configuration");
    } finally {
      setUpdating(false);
    }
  };

  const handleVersionRestore = async (versionConfig: any) => {
    if (!confirm("Are you sure you want to restore this configuration version? All current fields will be overwritten.")) return;
    setSelectedHistoryVersion(null);
    const textStr = JSON.stringify(versionConfig, null, 2);
    setConfigText(textStr);
    await handleConfigSave(textStr);
  };

  // GitHub Export Logic
  const handleGitHubExport = async () => {
    if (!githubToken.trim()) {
      alert("GitHub Personal Access Token is required.");
      return;
    }
    if (!githubRepoName.trim()) {
      alert("Repository name is required.");
      return;
    }

    setExporting(true);
    setExportLogs(["Initializing connection...", "Authenticated successfully!"]);
    setExportedUrl("");

    try {
      const octokit = new Octokit({ auth: githubToken.trim() });
      
      // 1. Get current username
      const userRes = await octokit.users.getAuthenticated();
      const owner = userRes.data.login;
      addLog(`Authenticated as GitHub user: @${owner}`);

      // 2. Create Repository
      addLog(`Checking if repository "${owner}/${githubRepoName}" already exists...`);
      let repoExists = false;
      try {
        await octokit.repos.get({ owner, repo: githubRepoName });
        repoExists = true;
        addLog(`Repository already exists. We will push updates directly.`);
      } catch {
        addLog(`Creating new GitHub repository: "${githubRepoName}"...`);
        await octokit.repos.createForAuthenticatedUser({
          name: githubRepoName,
          private: githubPrivate,
          description: `Statically generated database runtime for AppForge - ${app?.name || ""}`,
        });
        repoExists = true;
        addLog(`Repository created successfully!`);
      }

      // Generate files
      addLog("Generating Next.js application codebase files...");
      const filesMap = generateNextJsAppCode(app!.name, app!.config, records);

      // 3. Push files to main branch
      addLog("Compiling commit structure...");
      
      // Get reference to branch head (default main)
      let sha: string | undefined;
      try {
        const refRes = await octokit.git.getRef({ owner, repo: githubRepoName, ref: "heads/main" });
        sha = refRes.data.object.sha;
      } catch {
        // Empty repo, needs initial files
      }

      const filePaths = Object.keys(filesMap);
      
      if (!sha) {
        // If repository is brand new and empty, create files individually
        for (const filePath of filePaths) {
          addLog(`Creating file: ${filePath}`);
          await octokit.repos.createOrUpdateFileContents({
            owner,
            repo: githubRepoName,
            path: filePath,
            message: `Init: Add ${filePath} template`,
            content: btoa(unescape(encodeURIComponent(filesMap[filePath as keyof typeof filesMap]))),
          });
        }
      } else {
        // If repo exists, commit via git tree/commit flows
        addLog("Creating Git Blobs...");
        const blobs = await Promise.all(
          filePaths.map(async (p) => {
            const blobRes = await octokit.git.createBlob({
              owner,
              repo: githubRepoName,
              content: btoa(unescape(encodeURIComponent(filesMap[p as keyof typeof filesMap]))),
              encoding: "base64",
            });
            return { path: p, sha: blobRes.data.sha, mode: "100644" as const, type: "blob" as const };
          })
        );

        addLog("Creating Git Tree...");
        const treeRes = await octokit.git.createTree({
          owner,
          repo: githubRepoName,
          tree: blobs,
          base_tree: sha,
        });

        addLog("Creating Git Commit...");
        const commitRes = await octokit.git.createCommit({
          owner,
          repo: githubRepoName,
          message: "AppForge compilation: Sync schema and data seed",
          tree: treeRes.data.sha,
          parents: [sha],
        });

        addLog("Updating Branch Reference...");
        await octokit.git.updateRef({
          owner,
          repo: githubRepoName,
          ref: "heads/main",
          sha: commitRes.data.sha,
        });
      }

      addLog("Export complete!");
      const url = `https://github.com/${owner}/${githubRepoName}`;
      setExportedUrl(url);
      addLog(`Your repository is live at: ${url}`);
    } catch (e: any) {
      console.error(e);
      addLog(`Error exporting: ${e.message || String(e)}`);
    } finally {
      setExporting(false);
    }
  };

  const addLog = (msg: string) => {
    setExportLogs((p) => [...p, msg]);
  };

  // Static files generation engine for NextJS
  const generateNextJsAppCode = (appName: string, config: AppConfig, records: any[]) => {
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
            <h1 className="text-2xl font-extrabold tracking-tight">${appName}</h1>
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
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-extrabold text-lg">{editing ? "Edit Record" : "Add New Record"}</h3>
                <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
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
                          className={"w-11 h-6 rounded-full relative transition-colors duration-200 " + (formData[field.name] ? "bg-indigo-600" : "bg-slate-200")}
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
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-bold border border-slate-200 rounded-xl hover:bg-slate-50 transition">Cancel</button>
                  <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition">Save Record</button>
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
                          <button onClick={() => startEdit(r)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition">Edit</button>
                          <button onClick={() => handleDelete(r.id)} className="text-xs font-bold text-rose-600 hover:text-rose-800 transition">Delete</button>
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
}
`;

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

  const filteredRecords = records.filter((rec) => {
    if (!searchQuery) return true;
    return app?.config.fields.some((f) => {
      const val = rec[f.name];
      return val && String(val).toLowerCase().includes(searchQuery.toLowerCase());
    });
  });

  if (loading)
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-canvas)" }}>
        <div style={{ width: 32, height: 32, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%" }} className="animate-spin" />
      </div>
    );

  if (!app)
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-canvas)" }}>
        <div style={{ textAlign: "center", background: "#fff", padding: 32, borderRadius: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          <p style={{ marginBottom: 16, fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>App workspace not found</p>
          <Link href="/dashboard" className="btn-primary text-xs font-bold px-4 py-2">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );

  return (
    <div className="sidebar-shell">
      {/* ─── DARK SIDEBAR ─────────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">AF</div>
          <span className="sidebar-logo-text">AppForge</span>
        </div>

        {/* Back to dashboard */}
        <div className="sidebar-section" style={{ paddingTop: 8, paddingBottom: 4 }}>
          <Link href="/dashboard" className="sidebar-link">
            <svg className="sidebar-link-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        {/* App info */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-dark)", borderBottom: "1px solid var(--border-dark)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-sidebar-muted)", marginBottom: 6 }}>Current App</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.9)", letterSpacing: -0.2, lineHeight: 1.2 }}>{app.name}</div>
          <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center" }}>
            <span className="badge badge-purple" style={{ fontSize: 10 }}>{app.config.entity}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-sidebar-muted)" }}>{records.length} records</span>
          </div>
        </div>

        {/* View Navigation */}
        <div className="sidebar-section" style={{ marginTop: 4 }}>
          <p className="sidebar-section-label">Views</p>
          <button
            onClick={() => setView("table")}
            className={`sidebar-link ${(view === "table" || view === "new" || view === "edit") ? "active" : ""}`}
          >
            <svg className="sidebar-link-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" />
            </svg>
            Records Table
          </button>
          <button
            onClick={() => setView("config")}
            className={`sidebar-link ${view === "config" ? "active" : ""}`}
          >
            <svg className="sidebar-link-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
            </svg>
            Schema Config
          </button>
          <button
            onClick={() => setView("github")}
            className={`sidebar-link ${view === "github" ? "active" : ""}`}
          >
            <svg className="sidebar-link-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
            GitHub Export
          </button>
        </div>

        {/* Add record shortcut */}
        <div style={{ padding: "8px 12px" }}>
          <button
            onClick={() => { setView("new"); setEditing(null); }}
            className="btn-primary glow-btn-primary"
            style={{ width: "100%", fontSize: 12, padding: "9px 12px", borderRadius: 10, justifyContent: "center" }}
          >
            + Add Record
          </button>
        </div>

        {/* Field type summary */}
        {app.config.fields.length > 0 && (
          <div style={{ padding: "12px 20px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-sidebar-muted)", marginBottom: 8 }}>Schema Fields</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {app.config.fields.map((f) => (
                <div key={f.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.65)", fontFamily: "var(--font-mono), monospace" }}>{f.name}</span>
                  <span className={`badge ${TYPE_COLORS[f.type]}`} style={{ fontSize: 9 }}>{f.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* ─── MAIN CONTENT ─────────────────────────────────────────────────────────── */}
      <div className="main-content">
          {view === "table" && (
            <div className="animate-fade-in">
              <div className="page-header">
                <div>
                  <h1 className="font-serif text-2xl font-normal italic text-slate-800">Active records</h1>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">Live CRUD rows matched against schema types</p>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder="Search in fields..."
                    className="input"
                    style={{ maxWidth: 220, padding: "8px 14px", fontSize: 12 }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="btn-ghost text-xs py-1.5 px-2.5">Clear</button>
                  )}
                </div>
              </div>
              <div className="page-content">

              {records.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
                  <div className="text-3xl mb-3 font-mono text-slate-300">◈</div>
                  <h3 className="text-base font-black text-slate-700">No records saved</h3>
                  <p className="text-xs font-semibold text-slate-400 mt-1 max-w-xs mx-auto">
                    Start by inserting your first record using the layout builder fields.
                  </p>
                  <button onClick={() => setView("new")} className="btn-primary glow-btn-primary mt-6 text-xs py-2 px-4 font-bold">
                    + Insert Record
                  </button>
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
                                <span className="font-extrabold text-slate-600">{f.name}</span>
                                <span className={`badge ${TYPE_COLORS[f.type]}`}>
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
                              {new Date(record.createdAt as string).toLocaleDateString()}
                            </td>
                            <td>
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => {
                                    setEditing(record);
                                    setView("edit");
                                  }}
                                  className="text-[11px] font-bold px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(record.id)}
                                  className="text-[11px] font-bold px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-[#e44949] transition"
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
            </div>
          )}

          {(view === "new" || view === "edit") && (
            <div className="animate-fade-in">
              <div className="page-header">
                <div>
                  <h1 className="font-serif text-2xl font-normal italic text-slate-800">
                    {view === "edit" ? `Edit ${app.config.entity}` : `Add new ${app.config.entity}`}
                  </h1>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">Fields are auto-compiled from schema configurations.</p>
                </div>
              </div>
              <div className="page-content" style={{ maxWidth: 560 }}>
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
            <div className="animate-fade-in">
              <div className="page-header">
                <div>
                  <h1 className="font-serif text-2xl font-normal italic text-slate-800">Schema Config Editor</h1>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">Edits automatically save version histories</p>
                </div>
                <div>
                  <button
                    onClick={() => handleConfigSave()}
                    disabled={updating}
                    className="frixion-btn px-6 py-2.5 text-xs font-bold gap-2"
                  >
                    {updating && (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                    {updating ? "Saving schema..." : "⚡ Save Config & Compile"}
                  </button>
                </div>
              </div>
              <div className="page-content">

              {/* Split-Pane Glass Canvas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Left Pane: The Forge Code Editor */}
                <div className="warm-gradient-bg rounded-[20px] p-6 shadow-[0_12px_40px_rgba(226,178,142,0.12)] border border-[#e8d2c0] flex flex-col min-h-[450px]">
                  <div className="editor-glass-card rounded-2xl p-5 flex-1 flex flex-col space-y-4">
                    <div className="flex items-center justify-between border-b border-white/40 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#d88a5c]" />
                        <span className="font-mono text-xs font-bold text-[#7b4c2d] uppercase tracking-wider">config.json</span>
                      </div>
                      
                      {configErr ? (
                        <span className="badge badge-red text-[10px]">✗ ERROR</span>
                      ) : (
                        <span className="badge badge-green text-[10px]">✓ COMPILED</span>
                      )}
                    </div>

                    <textarea
                      className="frixion-textarea flex-1 p-4 font-mono text-xs w-full bg-white/70 backdrop-blur min-h-[280px]"
                      value={configText}
                      onChange={(e) => setConfigText(e.target.value)}
                    />
                    
                    {configErr && (
                      <div className="text-[11px] text-[#b52d2d] font-semibold bg-red-50/70 p-2.5 rounded-lg border border-red-150">
                        <strong>Error:</strong> {configErr}
                      </div>
                    )}
                    
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setView("table")}
                        className="frixion-btn-secondary text-xs px-4 py-2"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Pane: Live Compilations & Versions */}
                <div className="space-y-6 flex flex-col">
                  {/* Fields list */}
                  <div className="card bg-white p-5 border border-slate-200 shadow-sm">
                    <span className="field-label mb-3">COMPILED SCHEMAS</span>
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {app.config.fields.map((f) => (
                        <div
                          key={f.name}
                          className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center justify-between hover:bg-slate-100 transition"
                        >
                          <span className="text-xs font-bold text-slate-700">{f.name}</span>
                          <div className="flex gap-1 items-center">
                            {f.required && (
                              <span className="badge badge-red text-[9px] py-0 px-1">req</span>
                            )}
                            <span className={`badge ${TYPE_COLORS[f.type]}`}>
                              {f.type}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Versions history list */}
                  <div className="card bg-white p-5 border border-slate-200 shadow-sm flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <span className="field-label">VERSION HISTORY LOGS</span>
                      <span className="badge badge-purple">{app.versions.length} versions</span>
                    </div>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                      {app.versions.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => setSelectedHistoryVersion(v)}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl border bg-slate-50 hover:bg-slate-100 transition cursor-pointer text-left"
                        >
                          <span className="text-xs font-black text-slate-800">
                            Version #{v.version}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {new Date(v.createdAt).toLocaleDateString()}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
              </div>
            </div>
          )}

          {view === "github" && (
            <div className="animate-fade-in">
              <div className="page-header">
                <div>
                  <h1 className="font-serif text-2xl font-normal italic text-slate-800">GitHub Exporter</h1>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">Export your schema & records as a standalone Next.js repo</p>
                </div>
              </div>
              <div className="page-content">

              <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 card p-6 bg-white border border-slate-200 shadow-sm space-y-4">
                  <div>
                    <label className="field-label">GitHub Personal Access Token (PAT) *</label>
                    <input
                      type="password"
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxx"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      className="input font-mono text-xs"
                    />
                    <p className="text-[10px] font-medium text-slate-400 mt-1">
                      Create a PAT on GitHub under Developer Settings with `repo` scopes. We run this request completely inside your browser (zero tokens are sent to our servers).
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="field-label">Target Repo Name *</label>
                      <input
                        type="text"
                        placeholder="my-entity-database-app"
                        value={githubRepoName}
                        onChange={(e) => setGithubRepoName(e.target.value)}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="field-label">Privacy level</label>
                      <div className="flex items-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setGithubPrivate(!githubPrivate)}
                          className="w-11 h-6 rounded-full transition-colors relative cursor-pointer outline-none"
                          style={{
                            background: githubPrivate ? "var(--accent)" : "var(--border-bright)",
                          }}
                        >
                          <div
                            className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                            style={{
                              left: "2px",
                              transform: githubPrivate ? "translateX(20px)" : "translateX(0)",
                            }}
                          />
                        </button>
                        <span className="text-xs font-bold text-slate-600">
                          {githubPrivate ? "Private Repository" : "Public Repository"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleGitHubExport}
                    disabled={exporting || !githubToken}
                    className="btn-primary glow-btn-primary py-3 px-5 text-xs font-bold w-full gap-2 mt-2"
                  >
                    {exporting && (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    )}
                    {exporting ? "Building & Pushing App Code..." : "Export App Workspace Code to GitHub"}
                  </button>

                  {exportedUrl && (
                    <div className="p-4 rounded-xl border border-green-200 bg-green-50/50 flex flex-col gap-2">
                      <div className="text-xs font-black text-green-700">✓ Export successful! Your Next.js app repo is active:</div>
                      <a href={exportedUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 hover:underline font-mono">
                        {exportedUrl}
                      </a>
                      <a
                        href={`https://vercel.com/new/clone?repository-url=${encodeURIComponent(exportedUrl)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-2 text-xs font-bold text-white shadow hover:opacity-90"
                      >
                        Deploy to Vercel in 1-Click
                      </a>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 border p-4 rounded-xl flex flex-col justify-between">
                  <div>
                    <span className="field-label mb-2">EXPORT CONSOLE LOGS</span>
                    <pre className="bg-slate-900 text-[10px] text-green-400 font-mono p-3 rounded-lg h-72 overflow-y-auto space-y-1">
                      {exportLogs.map((log, i) => (
                        <div key={i} className="whitespace-pre-wrap">{`> ${log}`}</div>
                      ))}
                      {exportLogs.length === 0 && (
                        <div className="text-slate-500 italic">Logs will display here during build export.</div>
                      )}
                    </pre>
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400 mt-2 bg-white border p-2.5 rounded-lg leading-relaxed">
                    <strong>Generated structures include:</strong> `page.tsx`, `package.json`, tailwind config, seed data list, and local storage state sync code.
                  </div>
                </div>
              </div>
              </div>
            </div>
          )}
        </div>

      {/* Version Comparison Modal — fixed overlay inside sidebar-shell */}
      {selectedHistoryVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm font-sans">
          <div className="card w-full max-w-3xl animate-fade-up overflow-hidden bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#edf0f4] p-6 bg-slate-50">
              <div>
                <h1 className="font-serif text-2xl font-normal tracking-tight text-[#07090f] italic">Compare Config Version #{selectedHistoryVersion.version}</h1>
                <p className="text-xs font-medium text-[#6d7484]">
                  Compare schema definition saved on {new Date(selectedHistoryVersion.createdAt).toLocaleString()}.
                </p>
              </div>
              <button
                onClick={() => setSelectedHistoryVersion(null)}
                className="btn-ghost h-8 w-8 p-0 grid place-items-center font-black rounded-full"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 overflow-y-auto max-h-[60vh]">
              <div>
                <span className="field-label mb-2">CURRENT SCHEMAS CONFIG</span>
                <pre className="json-output h-80 text-[11px] overflow-auto text-slate-300 bg-slate-900 p-3 rounded-lg border border-slate-800">
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
      </div>
  );
}
