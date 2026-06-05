'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Papa from 'papaparse'
import type { AppConfig } from '@/types/config'

type Step = 'upload' | 'preview' | 'importing' | 'done'

const TYPE_COLORS: Record<string, string> = {
  string: 'badge-cyan', number: 'badge-amber',
  boolean: 'badge-green', enum: 'badge-purple', date: 'badge-red',
}

export default function ImportPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('upload')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [appName, setAppName] = useState('')
  const [inferredConfig, setInferredConfig] = useState<AppConfig | null>(null)
  const [warnings, setWarnings] = useState<Array<{ message: string }>>([])
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) { setError('Please upload a .csv file'); return }
    setFileName(file.name)
    setAppName(file.name.replace('.csv', '').replace(/[_-]/g, ' '))
    setError('')

    Papa.parse(file, {
      complete: async (results) => {
        const data = results.data as string[][]
        if (data.length < 2) { setError('CSV must have at least 2 rows'); return }

        const hdrs = data[0].map(h => String(h).trim())
        const dataRows = data.slice(1).filter(r => r.some(v => v !== ''))

        setHeaders(hdrs)
        setRows(dataRows)

        // Get inferred config from API
        const res = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name.replace('.csv',''), headers: hdrs, rows: dataRows, appId: 'preview' })
        })
        const d = await res.json()
        if (d.success) {
          setInferredConfig(d.data.config)
          setWarnings(d.data.warnings || [])
          setStep('preview')
        }
      },
      error: () => setError('Failed to parse CSV')
    })
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleImport = async () => {
    if (!inferredConfig) return
    setImporting(true)
    setStep('importing')
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: appName, headers, rows })
      })
      const d = await res.json()
      if (d.success) {
        setStep('done')
        setTimeout(() => router.push(`/apps/${d.data.app.id}`), 1500)
      } else {
        setError(d.error || 'Import failed')
        setStep('preview')
      }
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="forge-canvas p-3 text-[#07090f] sm:p-5">
      <section className="relative min-h-[calc(100vh-24px)] overflow-hidden rounded-[22px] border-[10px] border-white/60 bg-white/70 backdrop-blur-md shadow-[0_18px_55px_rgba(15,23,42,0.08)] sm:min-h-[calc(100vh-40px)] sm:border-[14px]">
        <div className="absolute inset-4 rounded-[18px] border border-white/40" />

        {/* Header */}
        <header className="relative z-40 mx-auto mt-6 flex h-14 items-center justify-between gap-2 rounded-2xl px-4 spark-nav max-w-7xl">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2 text-xs text-[#555d70] hover:text-black font-bold">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-black text-[10px] font-black text-white">
                &larr;
              </span>
              <span className="hidden sm:inline">Back</span>
            </Link>
            <span style={{ color: 'var(--border-bright)' }}>/</span>
            <span className="font-black tracking-tight text-sm sm:text-base">CSV Import</span>
          </div>
        </header>

        <main className="relative z-20 mx-auto max-w-4xl px-4 py-10 sm:px-6">
          {/* Upload step */}
          {step === 'upload' && (
            <div className="animate-fade-up space-y-8">
              <div>
                <h1 className="text-3xl font-black tracking-tight">Import from CSV</h1>
                <p className="text-xs font-medium text-[#6d7484] mt-0.5">
                  Upload a CSV file — AppForge automatically infers field types and generates your app config.
                </p>
              </div>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                className="relative rounded-2xl border-2 border-dashed transition-all duration-200 p-16 text-center cursor-pointer bg-white"
                style={{ borderColor: dragging ? 'var(--accent)' : 'var(--border-bright)' }}
                onClick={() => document.getElementById('csv-input')?.click()}
              >
                <input id="csv-input" type="file" accept=".csv" className="hidden" onChange={handleFileInput} />
                <div className="text-5xl mb-4">{dragging ? '📂' : '📄'}</div>
                <h3 className="text-base font-black text-slate-800">{dragging ? 'Drop it here' : 'Drop your CSV file here'}</h3>
                <p className="text-xs font-semibold text-slate-400 mt-1 mb-6">or click to browse files</p>
                <span className="btn-primary glow-btn-primary py-2.5 px-5 text-xs font-bold">Choose CSV file</span>
              </div>

              {error && (
                <div className="p-3 rounded-xl text-xs font-bold bg-red-50 border border-red-200 text-[var(--red)]">
                  {error}
                </div>
              )}

              {/* How it works */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { icon: '📊', title: 'Upload CSV', desc: 'Any CSV with headers in the first row' },
                  { icon: '🧠', title: 'Auto-detect types', desc: 'AppForge infers string, number, enum, boolean, date' },
                  { icon: '⚡', title: 'App generated', desc: 'Full CRUD app created with all your data imported' },
                ].map(s => (
                  <div key={s.title} className="card p-5 bg-white border border-slate-200">
                    <div className="text-2xl mb-2">{s.icon}</div>
                    <div className="font-black text-sm mb-1 text-slate-850">{s.title}</div>
                    <div className="text-xs font-semibold text-slate-500 leading-relaxed">{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview step */}
          {step === 'preview' && inferredConfig && (
            <div className="animate-fade-up space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4 border-slate-200">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="badge badge-green">✓ {rows.length} rows detected</span>
                    <span className="badge badge-cyan">{headers.length} columns</span>
                    <span className="text-xs font-mono text-slate-400">{fileName}</span>
                  </div>
                  <h1 className="text-2xl font-black tracking-tight">Review inferred config</h1>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">
                    AppForge analysed your CSV and inferred these field types. Review before importing.
                  </p>
                </div>
                <button onClick={() => setStep('upload')} className="btn-ghost text-xs font-bold py-1.5 px-3">
                  ← Upload Different
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left — config */}
                <div className="space-y-4">
                  <div>
                    <label className="field-label">App name</label>
                    <input className="input" value={appName} onChange={e => setAppName(e.target.value)} />
                  </div>

                  <div>
                    <h3 className="field-label mb-2">Inferred fields</h3>
                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                      {inferredConfig.fields.map(f => (
                        <div key={f.name} className="card p-4 bg-white flex items-center justify-between border border-slate-200 shadow-sm">
                          <div>
                            <span className="font-black text-sm text-slate-800">{f.name}</span>
                            {f.options && (
                              <div className="flex gap-1 mt-1.5 flex-wrap">
                                {f.options.slice(0,3).map(o => (
                                  <span key={o} className="badge badge-purple text-[10px]">{o}</span>
                                ))}
                                {f.options.length > 3 && (
                                  <span className="badge badge-purple text-[10px]">+{f.options.length-3}</span>
                                )}
                              </div>
                            )}
                          </div>
                          <span className={`badge ${TYPE_COLORS[f.type] || 'badge-cyan'}`}>{f.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {warnings.length > 0 && (
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50">
                      <div className="text-xs font-black mb-2 text-[var(--amber)]">⚠ {warnings.length} sanitization warning{warnings.length > 1 ? 's' : ''}</div>
                      {warnings.slice(0,3).map((w, i) => (
                        <div key={i} className="text-xs font-semibold text-slate-600 mt-1">&bull; {w.message}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right — data preview */}
                <div className="space-y-3">
                  <h3 className="field-label">Data preview (first 5 rows)</h3>
                  <div className="card overflow-hidden bg-white border border-slate-200">
                    <div className="overflow-x-auto max-h-[420px]">
                      <table className="data-table text-xs">
                        <thead>
                          <tr>{headers.map(h => <th key={h} className="text-slate-500 font-black">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {rows.slice(0,5).map((row, i) => (
                            <tr key={i}>{row.map((cell, j) => <td key={j} className="font-semibold text-slate-700">{cell || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {rows.length > 5 && (
                    <p className="text-xs font-semibold text-slate-400 text-center">
                      +{rows.length - 5} more rows will be imported
                    </p>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl text-xs font-bold bg-red-50 border border-red-200 text-[var(--red)]">
                  {error}
                </div>
              )}

              <div className="flex gap-3 border-t border-[#edf0f4] pt-5">
                <button onClick={() => setStep('upload')} className="btn-ghost text-xs">Cancel</button>
                <button onClick={handleImport} disabled={importing} className="btn-primary glow-btn-primary gap-2 text-xs font-bold py-2.5 px-5">
                  {importing && (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  ⚡ Import {rows.length} rows and create app
                </button>
              </div>
            </div>
          )}

          {/* Importing */}
          {step === 'importing' && (
            <div className="text-center py-32 animate-fade-in card bg-white border border-slate-200 shadow-sm mt-8">
              <div className="w-16 h-16 border-2 rounded-full animate-spin mx-auto mb-6" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
              <h2 className="text-xl font-black text-slate-800 mb-2">Importing your data...</h2>
              <p className="text-xs font-medium text-slate-500">Creating app, inferring schema, bulk inserting {rows.length} records</p>
            </div>
          )}

          {/* Done */}
          {step === 'done' && (
            <div className="text-center py-32 animate-fade-in card bg-white border border-slate-200 shadow-sm mt-8">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-xl font-black text-slate-800 mb-2">Import complete!</h2>
              <p className="text-xs font-medium text-slate-500">Redirecting to your new app...</p>
            </div>
          )}
        </main>
      </section>
    </div>
  )
}
