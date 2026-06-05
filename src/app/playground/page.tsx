'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { validateConfig } from '@/engine/validator'
import type { ValidationResult } from '@/types/config'

const BROKEN_EXAMPLES = [
  {
    label: 'Missing fields array',
    icon: '①',
    description: 'No fields defined',
    config: `{
  "entity": "Product"
}`
  },
  {
    label: 'Unknown field type',
    icon: '②',
    description: 'Type "wizard" does not exist',
    config: `{
  "entity": "Order",
  "fields": [
    { "name": "status", "type": "wizard" },
    { "name": "amount", "type": "number" }
  ]
}`
  },
  {
    label: 'Completely empty',
    icon: '③',
    description: 'Empty object',
    config: `{}`
  },
  {
    label: 'Null values everywhere',
    icon: '④',
    description: 'Nulls instead of values',
    config: `{
  "entity": null,
  "fields": null
}`
  },
  {
    label: 'Special chars in names',
    icon: '⑤',
    description: 'Invalid entity and field names',
    config: `{
  "entity": "!!!My@@App###",
  "fields": [
    { "name": "price $$$", "type": "number" },
    { "name": "", "type": "string" }
  ]
}`
  },
  {
    label: 'Duplicate field names',
    icon: '⑥',
    description: 'Same field name twice',
    config: `{
  "entity": "Item",
  "fields": [
    { "name": "title", "type": "string" },
    { "name": "title", "type": "number" },
    { "name": "title", "type": "boolean" }
  ]
}`
  },
  {
    label: 'Enum with no options',
    icon: '⑦',
    description: 'Enum field missing options array',
    config: `{
  "entity": "Task",
  "fields": [
    { "name": "status", "type": "enum" },
    { "name": "priority", "type": "enum", "options": [] }
  ]
}`
  },
  {
    label: 'Not even JSON',
    icon: '⑧',
    description: 'Completely invalid input',
    config: `this is not json at all !!!`
  },
]

export default function PlaygroundPage() {
  const [input, setInput] = useState(BROKEN_EXAMPLES[0].config)
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [parseError, setParseError] = useState('')
  const [activeExample, setActiveExample] = useState(0)

  const runValidation = useCallback((raw: string) => {
    setParseError('')
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = raw
      setParseError('Input is not valid JSON — validator will handle it gracefully')
    }
    setResult(validateConfig(parsed))
  }, [])

  // Auto-run validation on mount for default example
  useEffect(() => {
    runValidation(BROKEN_EXAMPLES[0].config)
  }, [runValidation])

  const selectExample = (index: number) => {
    setActiveExample(index)
    setInput(BROKEN_EXAMPLES[index].config)
    let parsed: unknown
    try { parsed = JSON.parse(BROKEN_EXAMPLES[index].config) } catch { parsed = BROKEN_EXAMPLES[index].config }
    setResult(validateConfig(parsed))
    setParseError('')
  }

  return (
    <div className="forge-canvas p-3 text-[#07090f] sm:p-5">
      <section className="relative min-h-[calc(100vh-24px)] overflow-hidden rounded-[22px] border-[10px] border-white/60 bg-white/70 backdrop-blur-md shadow-[0_18px_55px_rgba(15,23,42,0.08)] sm:min-h-[calc(100vh-40px)] sm:border-[14px]">
        <div className="absolute inset-4 rounded-[18px] border border-white/40" />

        {/* Header */}
        <header className="relative z-40 mx-auto mt-6 flex h-14 items-center justify-between gap-2 rounded-2xl px-4 spark-nav max-w-7xl">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2 text-xs text-[#555d70] hover:text-black font-bold">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-black text-[10px] font-black text-white">
                &larr;
              </span>
              <span className="hidden sm:inline">Back</span>
            </Link>
            <span style={{ color: 'var(--border-bright)' }}>/</span>
            <span className="font-black tracking-tight text-sm sm:text-base">Playground</span>
            <span className="badge badge-amber text-[9px]">Unique feature</span>
          </div>
        </header>

        <main className="relative z-20 mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="mb-8 animate-fade-up">
            <h1 className="text-3xl font-black tracking-tight">Broken Config Playground</h1>
            <p className="text-xs font-medium text-[#6d7484] mt-0.5">
              AppForge never crashes on bad input. Paste any broken JSON below and see exactly how the validator handles it — what it sanitizes, defaults, and rejects.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Examples sidebar */}
            <div className="md:col-span-1 space-y-3">
              <h3 className="field-label tracking-widest">Broken examples</h3>
              <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
                {BROKEN_EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => selectExample(i)}
                    className="w-full text-left p-3 rounded-xl transition-all border bg-white cursor-pointer hover:border-slate-350"
                    style={{
                      background: activeExample === i ? 'rgba(31, 122, 255, 0.05)' : 'white',
                      borderColor: activeExample === i ? 'var(--accent)' : 'var(--border)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-black text-slate-400">{ex.icon}</span>
                      <span className="text-xs font-black" style={{ color: activeExample === i ? 'var(--accent-bright)' : 'var(--text-primary)' }}>{ex.label}</span>
                    </div>
                    <div className="text-[10px] pl-6 font-semibold text-[#8a91a3]">{ex.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Editor */}
            <div className="md:col-span-2 space-y-3">
              <h3 className="field-label tracking-widest">Input config JSON</h3>
              <textarea
                className="code-area w-full font-mono text-xs p-4 bg-white"
                rows={18}
                value={input}
                onChange={e => { setInput(e.target.value) }}
                placeholder="Paste any JSON config here..."
              />
              {parseError && (
                <div className="p-3 rounded-xl text-xs font-bold bg-amber-50 border border-amber-200 text-[#a18105]">
                  ⚠ {parseError}
                </div>
              )}
              <button onClick={() => runValidation(input)} className="btn-primary glow-btn-primary w-full py-2.5 text-xs font-bold justify-center">
                ▶ Run Validator
              </button>
            </div>

            {/* Result */}
            <div className="md:col-span-1 space-y-3">
              <h3 className="field-label tracking-widest">Validator output</h3>
              {!result ? (
                <div className="card p-6 text-center bg-white border">
                  <p className="text-xs font-semibold text-slate-400">Click an example or run the validator</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Status */}
                  <div className="card p-4 bg-white border shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`badge ${result.valid ? 'badge-green' : 'badge-amber'}`}>
                        {result.valid ? '✓ Valid' : '⚠ Sanitized'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Never crashed</span>
                    </div>
                    <div className="text-xs space-y-1 font-semibold text-slate-600">
                      <div className="flex justify-between border-b py-1 border-slate-100">
                        <span>Entity</span>
                        <span className="font-mono text-[var(--cyan)]">{result.config.entity}</span>
                      </div>
                      <div className="flex justify-between border-b py-1 border-slate-100">
                        <span>Fields</span>
                        <span className="text-slate-800 font-bold">{result.config.fields.length}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span>Layout</span>
                        <span className="text-slate-800 font-bold">{result.config.ui?.layout}</span>
                      </div>
                    </div>
                  </div>

                  {/* Sanitized fields */}
                  {result.config.fields.length > 0 && (
                    <div className="card p-4 bg-white border shadow-sm">
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Sanitized fields</div>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                        {result.config.fields.map(f => (
                          <div key={f.name} className="flex items-center justify-between text-xs border-b border-slate-50 pb-1 last:border-b-0">
                            <span className="font-mono text-slate-700">{f.name}</span>
                            <span className={`badge text-[9px] ${f.type === 'string' ? 'badge-cyan' : f.type === 'number' ? 'badge-amber' : f.type === 'enum' ? 'badge-purple' : f.type === 'boolean' ? 'badge-green' : 'badge-red'}`}>{f.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {result.warnings.length > 0 && (
                    <div className="card p-4 bg-white border border-amber-250 shadow-sm">
                      <div className="text-[10px] font-bold text-[var(--amber)] uppercase mb-2">⚠ {result.warnings.length} warning{result.warnings.length > 1 ? 's' : ''}</div>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {result.warnings.map((w, i) => (
                          <div key={i} className="text-[11px] p-2.5 rounded-lg bg-amber-50/50 border border-amber-100 font-semibold text-[#8f6900]">
                            <div>{w.message}</div>
                            {w.originalValue !== undefined && (
                              <div className="mt-1 flex gap-1 items-center font-mono text-[9px]">
                                <span className="line-through text-red-500">{JSON.stringify(w.originalValue)}</span>
                                <span className="text-slate-400">&rarr;</span>
                                <span className="text-green-600 font-black">{JSON.stringify(w.sanitizedValue)}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Errors */}
                  {result.errors.length > 0 && (
                    <div className="card p-4 bg-white border border-red-250 shadow-sm">
                      <div className="text-[10px] font-bold text-[var(--red)] uppercase mb-2">✕ {result.errors.length} error{result.errors.length > 1 ? 's' : ''}</div>
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                        {result.errors.map((e, i) => (
                          <div key={i} className="text-[11px] p-2.5 rounded-lg bg-red-50/50 border border-red-100 font-semibold text-[var(--red)]">
                            {e.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </section>
    </div>
  )
}
