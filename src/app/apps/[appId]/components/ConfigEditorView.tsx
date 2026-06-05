"use client";

import type { AppConfig } from "@/types/config";
import type { AppData, ConfigVersion, WorkspaceView } from "../types";

const TYPE_COLORS: Record<string, string> = {
  string: "badge-cyan",
  number: "badge-amber",
  boolean: "badge-green",
  enum: "badge-purple",
  date: "badge-red",
};

interface ConfigEditorViewProps {
  app: AppData;
  configText: string;
  setConfigText: (v: string) => void;
  configErr: string;
  updating: boolean;
  handleConfigSave: () => Promise<void>;
  setView: (v: WorkspaceView) => void;
  setSelectedHistoryVersion: (v: ConfigVersion) => void;
}

export function ConfigEditorView({
  app,
  configText,
  setConfigText,
  configErr,
  updating,
  handleConfigSave,
  setView,
  setSelectedHistoryVersion,
}: ConfigEditorViewProps) {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-normal italic text-slate-800">Schema Config Editor</h1>
          <p className="text-xs font-medium text-slate-400 mt-1">Updates save configuration version history automatically</p>
        </div>
        <button
          onClick={() => handleConfigSave()}
          disabled={updating}
          className="frixion-btn px-6 py-2.5 text-xs font-bold gap-2"
        >
          {updating && (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          {updating ? "Saving..." : "⚡ Save Config & Compile"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Pane: Editor */}
        <div className="warm-gradient-bg rounded-[20px] p-6 border border-[#e8d2c0] flex flex-col min-h-[450px]">
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

        {/* Right Pane: Info & Versions */}
        <div className="space-y-6 flex flex-col">
          <div className="card bg-white p-5 border border-slate-200 shadow-sm">
            <span className="field-label mb-3">COMPILED SCHEMAS</span>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {app.config.fields.map((f) => {
                const isUnknown = !["string", "number", "boolean", "enum", "date"].includes(f.type);
                return (
                  <div
                    key={f.name}
                    className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center justify-between hover:bg-slate-100 transition"
                  >
                    <span className="text-xs font-bold text-slate-700">{f.name}</span>
                    <div className="flex gap-1 items-center">
                      {f.required && (
                        <span className="badge badge-red text-[9px] py-0 px-1">req</span>
                      )}
                      <span className={`badge ${TYPE_COLORS[f.type] || "badge-purple"}`}>
                        {isUnknown ? `⚠️ ${f.type}` : f.type}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

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
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border bg-slate-50 hover:bg-slate-100 transition cursor-pointer text-left border-solid border-slate-200"
                >
                  <span className="text-xs font-black text-slate-800">
                    Version #{v.version}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-450">
                    {new Date(v.createdAt).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
