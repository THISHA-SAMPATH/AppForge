"use client";

interface GitHubExportViewProps {
  githubToken: string;
  setGithubToken: (v: string) => void;
  githubRepoName: string;
  setGithubRepoName: (v: string) => void;
  githubPrivate: boolean;
  setGithubPrivate: (v: boolean) => void;
  handleGitHubExport: () => Promise<void>;
  exporting: boolean;
  exportedUrl: string;
  exportLogs: string[];
}

export function GitHubExportView({
  githubToken,
  setGithubToken,
  githubRepoName,
  setGithubRepoName,
  githubPrivate,
  setGithubPrivate,
  handleGitHubExport,
  exporting,
  exportedUrl,
  exportLogs,
}: GitHubExportViewProps) {
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-normal italic text-slate-800">GitHub Exporter</h1>
        <p className="text-xs font-medium text-slate-400 mt-1">Export runtime database and code directly to a standalone Next.js repo</p>
      </div>

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
            <p className="text-[10px] font-medium text-slate-400 mt-1 leading-relaxed">
              Generate a PAT on GitHub (classic or fine-grained) with `repo` scopes. The token is sent only for this export request and is not stored.
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
                  className="w-11 h-6 rounded-full transition-colors relative cursor-pointer outline-none border-none"
                  style={{
                    background: githubPrivate ? "var(--accent)" : "rgba(0,0,0,0.12)",
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
                <span className="text-xs font-bold text-slate-650">
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
              <a href={exportedUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 hover:underline font-mono text-decoration-none">
                {exportedUrl}
              </a>
              <a
                href={`https://vercel.com/new/clone?repository-url=${encodeURIComponent(exportedUrl)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-2 text-xs font-bold text-white shadow hover:opacity-90 text-decoration-none"
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
          <div className="text-[10px] font-semibold text-slate-450 mt-2 bg-white border p-2.5 rounded-lg leading-relaxed">
            <strong>Generated stack:</strong> Next.js app files, schema JSON, seed data, local CRUD runtime, responsive data grid, and deploy-ready project config.
          </div>
        </div>
      </div>
    </div>
  );
}
