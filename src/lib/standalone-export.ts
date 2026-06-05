import type { AppConfig } from "@/types/config";

type ExportRecord = Record<string, unknown>;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "appforge-app";
}

function escapeJsonForScript(value: unknown) {
  return JSON.stringify(value, null, 2).replace(/</g, "\\u003c");
}

export function getStandaloneRepoName(appName: string) {
  return `appforge-${slugify(appName)}`;
}

export function generateStandaloneNextApp(appName: string, config: AppConfig, records: ExportRecord[]) {
  const packageName = slugify(appName);
  const schemaJson = JSON.stringify(config, null, 2);
  const seedJson = JSON.stringify(records, null, 2);
  const entity = config.entity || "Item";

  const packageJson = {
    name: packageName,
    version: "0.1.0",
    private: true,
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "next lint",
    },
    dependencies: {
      next: "16.2.7",
      react: "19.2.4",
      "react-dom": "19.2.4",
    },
    devDependencies: {
      "@types/node": "^20",
      "@types/react": "^19",
      "@types/react-dom": "^19",
      typescript: "^5",
    },
  };

  const pageTsx = `"use client";

import { useMemo, useState } from "react";
import schema from "../data/schema.json";
import seedData from "../data/seed.json";

type Field = {
  name: string;
  type: "string" | "number" | "boolean" | "enum" | "date";
  required?: boolean;
  options?: string[];
  defaultValue?: unknown;
};

type RecordData = {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};

const storageKey = "appforge:${packageName}:records";

function initialRecords(): RecordData[] {
  if (typeof window === "undefined") return seedData as RecordData[];
  const saved = window.localStorage.getItem(storageKey);
  if (saved) return JSON.parse(saved) as RecordData[];
  window.localStorage.setItem(storageKey, JSON.stringify(seedData));
  return seedData as RecordData[];
}

function defaultValue(field: Field) {
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.type === "boolean") return false;
  return "";
}

function renderValue(value: unknown, type: Field["type"]) {
  if (type === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

export default function Home() {
  const fields = schema.fields as Field[];
  const [records, setRecords] = useState<RecordData[]>(initialRecords);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<RecordData | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return records;
    return records.filter((record) =>
      fields.some((field) => String(record[field.name] ?? "").toLowerCase().includes(needle)),
    );
  }, [fields, query, records]);

  function persist(nextRecords: RecordData[]) {
    setRecords(nextRecords);
    window.localStorage.setItem(storageKey, JSON.stringify(nextRecords));
  }

  function startNew() {
    const nextForm: Record<string, unknown> = {};
    fields.forEach((field) => {
      nextForm[field.name] = defaultValue(field);
    });
    setForm(nextForm);
    setEditing({ id: "", createdAt: "", updatedAt: "", ...nextForm });
  }

  function startEdit(record: RecordData) {
    setForm(record);
    setEditing(record);
  }

  function saveRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const now = new Date().toISOString();
    if (editing?.id) {
      persist(records.map((record) => (record.id === editing.id ? { ...record, ...form, updatedAt: now } : record)));
    } else {
      persist([{ id: crypto.randomUUID(), ...form, createdAt: now, updatedAt: now }, ...records]);
    }
    setEditing(null);
    setForm({});
  }

  function deleteRecord(id: string) {
    persist(records.filter((record) => record.id !== id));
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-5 py-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Generated AppForge runtime</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">${appName.replace(/"/g, '\\"')}</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">${entity} CRUD app pre-seeded with ${records.length} records.</p>
          </div>
          <button onClick={startNew} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700">
            Add ${entity}
          </button>
        </header>

        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search records..."
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 md:max-w-sm"
          />
          <div className="text-xs font-bold uppercase text-slate-400">{filtered.length} of {records.length} records</div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {fields.map((field) => <th key={field.name} className="whitespace-nowrap px-4 py-3 font-black">{field.name}</th>)}
                  <th className="px-4 py-3 font-black">Updated</th>
                  <th className="px-4 py-3 text-right font-black">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((record) => (
                  <tr key={record.id} className="transition hover:bg-slate-50">
                    {fields.map((field) => <td key={field.name} className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">{renderValue(record[field.name], field.type)}</td>)}
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-400">{new Date(record.updatedAt || record.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => startEdit(record)} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-200">Edit</button>
                        <button onClick={() => deleteRecord(record.id)} className="rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-600 transition hover:bg-red-100">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="px-6 py-16 text-center">
              <h2 className="text-base font-black text-slate-700">No records found</h2>
              <p className="mt-1 text-sm font-semibold text-slate-400">Clear search or add a record.</p>
            </div>
          )}
        </section>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <form onSubmit={saveRecord} className="w-full max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-black">{editing.id ? "Edit" : "Add"} {schema.entity}</h2>
              <button type="button" onClick={() => setEditing(null)} className="rounded-md px-2 py-1 text-sm font-black text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">x</button>
            </div>
            <div className="grid max-h-[70vh] gap-4 overflow-y-auto p-5">
              {fields.map((field) => (
                <label key={field.name} className="grid gap-1.5">
                  <span className="text-xs font-black uppercase text-slate-500">{field.name}{field.required ? " *" : ""}</span>
                  {field.type === "boolean" ? (
                    <input type="checkbox" checked={Boolean(form[field.name])} onChange={(event) => setForm({ ...form, [field.name]: event.target.checked })} className="h-5 w-5" />
                  ) : field.type === "enum" ? (
                    <select required={field.required} value={String(form[field.name] ?? "")} onChange={(event) => setForm({ ...form, [field.name]: event.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-indigo-400">
                      <option value="">Select...</option>
                      {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : (
                    <input required={field.required} type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={String(form[field.name] ?? "")} onChange={(event) => setForm({ ...form, [field.name]: field.type === "number" ? Number(event.target.value) : event.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-indigo-400" />
                  )}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50">Cancel</button>
              <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700">Save</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
`;

  return {
    "README.md": `# ${appName}

Generated by AppForge as a standalone Next.js app.

## What is included

- A real Next.js 16 app, not a copy of the AppForge source
- Schema stored in \`data/schema.json\`
- Seed records stored in \`data/seed.json\`
- A generated CRUD UI that persists edits to browser localStorage

## Run locally

\`\`\`bash
npm install
npm run dev
\`\`\`

Open http://localhost:3000.
`,
    "package.json": JSON.stringify(packageJson, null, 2),
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2017",
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "react-jsx",
          incremental: true,
          plugins: [{ name: "next" }],
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
        exclude: ["node_modules"],
      },
      null,
      2,
    ),
    "next.config.ts": `import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
`,
    ".gitignore": "node_modules\n.next\nout\n.env*.local\n.DS_Store\n",
    "app/layout.tsx": `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: ${JSON.stringify(appName)},
  description: "Generated AppForge application",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
    "app/page.tsx": pageTsx,
    "app/globals.css": `@import "tailwindcss";

* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; }
body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
button, input, select { font: inherit; }
button { border: 0; cursor: pointer; }
`,
    "data/schema.json": schemaJson,
    "data/seed.json": seedJson,
    "appforge.generated.json": escapeJsonForScript({ appName, generatedAt: new Date().toISOString(), config, recordCount: records.length }),
  };
}
