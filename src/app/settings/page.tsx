"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import type { AppConfig } from "@/types/config";

interface AppSummary {
  id: string;
  name: string;
  description: string | null;
  config: AppConfig;
  createdAt: string;
  updatedAt: string;
  _count: { records: number };
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/apps")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) {
          setApps(data.data);
        } else {
          setError(data.error || "Could not load workspace settings.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load workspace settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const records = apps.reduce((sum, app) => sum + app._count.records, 0);
    const fields = apps.reduce((sum, app) => sum + app.config.fields.length, 0);
    const latest = apps[0]?.updatedAt ? new Date(apps[0].updatedAt).toLocaleDateString() : "No apps yet";
    return { records, fields, latest };
  }, [apps]);

  const initials =
    session?.user?.name
      ?.split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "AF";

  return (
    <div className="forge-canvas min-h-screen p-5 text-slate-900">
      <header className="forge-topnav">
        <Link href="/dashboard" className="flex items-center gap-2 text-decoration-none">
          <img src="/logo.png" className="h-8 w-8 rounded-lg object-contain" alt="AppForge" />
          <span className="text-sm font-extrabold tracking-tight text-slate-800">AppForge</span>
        </Link>

        <div className="hidden items-center gap-6 sm:flex">
          <Link href="/dashboard" className="text-xs font-bold text-slate-650 text-decoration-none hover:text-indigo-600">
            Dashboard
          </Link>
          <Link href="/playground" className="text-xs font-bold text-slate-650 text-decoration-none hover:text-indigo-600">
            Playground
          </Link>
          <Link href="/import" className="text-xs font-bold text-slate-650 text-decoration-none hover:text-indigo-600">
            Import CSV
          </Link>
        </div>

        <div className="grid h-8 w-8 place-items-center rounded-full bg-amber-400 text-xs font-extrabold text-slate-900">
          {initials}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl pt-28">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-serif text-4xl font-normal italic tracking-tight text-slate-800">Settings</h1>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Manage your AppForge account, workspace health, and runtime shortcuts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/apps/new" className="frixion-btn px-4 py-2 text-xs text-decoration-none">
              New App
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="frixion-btn-secondary px-4 py-2 text-xs"
            >
              Sign Out
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs font-bold text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-5 lg:grid-cols-[1fr_1.35fr]">
          <div className="space-y-5">
            <div className="card bg-white p-5">
              <span className="field-label">Account</span>
              <div className="flex items-center gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-sm font-black text-white">
                  {initials}
                </div>
                <div className="min-w-0">
                  <h2 className="m-0 truncate text-base font-black text-slate-850">
                    {session?.user?.name || "Builder"}
                  </h2>
                  <p className="m-0 mt-1 truncate text-xs font-semibold text-slate-500">
                    {session?.user?.email || "Signed in workspace"}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="stat-card">
                <div className="stat-dot bg-indigo-500" />
                <div className="stat-value">{apps.length}</div>
                <div className="stat-label">Apps</div>
              </div>
              <div className="stat-card">
                <div className="stat-dot bg-emerald-500" />
                <div className="stat-value">{stats.records}</div>
                <div className="stat-label">Records</div>
              </div>
              <div className="stat-card">
                <div className="stat-dot bg-cyan-500" />
                <div className="stat-value">{stats.fields}</div>
                <div className="stat-label">Fields</div>
              </div>
              <div className="stat-card">
                <div className="stat-dot bg-amber-500" />
                <div className="text-sm font-black leading-tight text-slate-800">{stats.latest}</div>
                <div className="stat-label">Last Update</div>
              </div>
            </div>

            <div className="card bg-white p-5">
              <span className="field-label">Quick Actions</span>
              <div className="grid gap-2">
                <Link href="/playground" className="btn-ghost justify-start text-xs text-decoration-none">
                  Open Config Playground
                </Link>
                <Link href="/import" className="btn-ghost justify-start text-xs text-decoration-none">
                  Import CSV
                </Link>
                <Link href="/dashboard" className="btn-ghost justify-start text-xs text-decoration-none">
                  Return to Dashboard
                </Link>
              </div>
            </div>
          </div>

          <div className="card bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <span className="field-label">Runtime Apps</span>
                <h2 className="m-0 text-lg font-black text-slate-850">Workspace inventory</h2>
              </div>
              <span className="badge badge-purple">{loading ? "Loading" : `${apps.length} total`}</span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="skeleton h-20" />
                ))}
              </div>
            ) : apps.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
                <h3 className="text-base font-black text-slate-800">No apps forged yet</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Create your first runtime from a prompt, JSON config, or CSV file.
                </p>
                <Link href="/apps/new" className="frixion-btn mt-5 px-5 py-2 text-xs text-decoration-none">
                  Create App
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {apps.map((app) => (
                  <div
                    key={app.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-indigo-200 hover:bg-indigo-50/20"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h3 className="m-0 truncate text-sm font-black text-slate-850">{app.name}</h3>
                          <span className="badge badge-cyan">{app.config.entity}</span>
                        </div>
                        <p className="m-0 line-clamp-2 text-xs font-semibold leading-relaxed text-slate-500">
                          {app.description || `${app.config.fields.length} fields configured for this runtime.`}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Link href={`/apps/${app.id}`} className="btn-primary px-3 py-2 text-xs text-decoration-none">
                          Open
                        </Link>
                        <Link href={`/apps/${app.id}?view=config`} className="btn-ghost px-3 py-2 text-xs text-decoration-none">
                          Schema
                        </Link>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 text-[10px] font-bold text-slate-400">
                      <span>{app._count.records} records</span>
                      <span>{app.config.fields.length} fields</span>
                      <span>Updated {new Date(app.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
