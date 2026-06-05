"use client";

import type { AppConfig } from "@/types/config";
import type { AppData, ConfigVersion, WorkspaceView } from "../types";

interface HistoryViewProps {
  app: AppData;
  setView: (v: WorkspaceView) => void;
  setSelectedHistoryVersion: (v: ConfigVersion) => void;
}

export function HistoryView({
  app,
  setView,
  setSelectedHistoryVersion,
}: HistoryViewProps) {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-normal italic text-slate-800">Config history</h1>
          <p className="text-xs font-medium text-slate-400 mt-1">Previous schema configs with saved timestamps</p>
        </div>
        <button onClick={() => setView("config")} className="btn-ghost text-xs font-bold">
          Open Config Editor
        </button>
      </div>

      {app.versions.length === 0 ? (
        <div className="text-center py-16 bg-white/70 backdrop-blur border border-slate-200 rounded-2xl">
          <h3 className="text-base font-extrabold text-slate-700">No config versions yet</h3>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            Save a schema change and the previous config will appear here with its timestamp.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {app.versions.map((version) => (
            <button
              key={version.id}
              onClick={() => setSelectedHistoryVersion(version)}
              className="card w-full bg-white p-5 text-left border border-slate-200 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/20"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-purple">Version #{version.version}</span>
                    <span className="text-[11px] font-bold text-slate-400">
                      {new Date(version.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-3 text-sm font-black text-slate-800">
                    {(version.config as AppConfig).entity || "Untitled entity"}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-400">
                    {((version.config as AppConfig).fields || []).length} fields captured in this config
                  </div>
                </div>
                <pre className="json-output max-h-36 w-full overflow-auto text-[10px] md:max-w-xl">
                  {JSON.stringify(version.config, null, 2)}
                </pre>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
