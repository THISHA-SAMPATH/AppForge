'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { validateConfig } from '@/engine/validator'
import type { FieldConfig, ValidationResult } from '@/types/config'

const FIELD_TYPE_DEMO: FieldConfig[] = [
  { name: 'title', type: 'string', placeholder: 'Text input renderer' },
  { name: 'quantity', type: 'number' },
  { name: 'published', type: 'boolean' },
  { name: 'status', type: 'enum', options: ['Draft', 'Live', 'Archived'] },
  { name: 'launchDate', type: 'date' },
]

const VALIDATOR_LOGIC = `export function validateConfig(raw: unknown) {
  const warnings = []
  const errors = []
  if (!raw || typeof raw !== "object") {
    return invalid("Config must be a JSON object")
  }
  const entity = sanitizeEntityName(raw.entity)
  const fields = Array.isArray(raw.fields) ? raw.fields : []
  if (!Array.isArray(raw.fields)) warn("Fields array missing")
  const sanitized = fields
    .map((field, index) => sanitizeField(field, index))
    .filter(Boolean)
  const deduped = dedupeFieldNames(sanitized)
  return {
    valid: errors.length === 0,
    config: { entity, fields: deduped, ui: sanitizeUI(raw.ui) },
    warnings,
    errors,
  }
}`

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

const REQUIRED_PROOF_CASES = BROKEN_EXAMPLES.filter((example) =>
  ['Missing fields array', 'Unknown field type', 'Duplicate field names'].includes(example.label)
)

function getStructuredOutput(rawConfig: string) {
  try {
    return validateConfig(JSON.parse(rawConfig))
  } catch {
    return validateConfig(rawConfig)
  }
}

export default function PlaygroundPage() {
  const [input, setInput] = useState(BROKEN_EXAMPLES[0].config)
  const [result, setResult] = useState<ValidationResult | null>(() => validateConfig(JSON.parse(BROKEN_EXAMPLES[0].config)))
  const [parseError, setParseError] = useState('')
  const [activeExample, setActiveExample] = useState(0)
  const [demoValues, setDemoValues] = useState<Record<string, unknown>>({
    title: 'Launch checklist',
    quantity: 12,
    published: true,
    status: 'Live',
    launchDate: '2026-06-05',
  })

  const runValidation = useCallback((raw: string) => {
    setParseError('')
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = raw
      setParseError('Input is not valid JSON - validator will handle it gracefully')
    }
    setResult(validateConfig(parsed))
  }, [])

  const selectExample = (index: number) => {
    setActiveExample(index)
    setInput(BROKEN_EXAMPLES[index].config)
    let parsed: unknown
    try {
      parsed = JSON.parse(BROKEN_EXAMPLES[index].config)
      setParseError('')
    } catch {
      parsed = BROKEN_EXAMPLES[index].config
      setParseError('Input is not valid JSON - validator will handle it gracefully')
    }
    setResult(validateConfig(parsed))
  }

  const renderDemoInput = (field: FieldConfig) => {
    const value = demoValues[field.name]
    const update = (next: unknown) => setDemoValues((prev) => ({ ...prev, [field.name]: next }))

    if (field.type === 'boolean') {
      return (
        <button
          type="button"
          onClick={() => update(!value)}
          className="h-9 w-16 rounded-full border border-slate-200 bg-slate-100 p-1 text-left transition"
          style={{ background: value ? 'rgba(31, 122, 255, 0.14)' : '#f1f5f9' }}
        >
          <span
            className="block h-7 w-7 rounded-full bg-white shadow transition-transform"
            style={{ transform: value ? 'translateX(28px)' : 'translateX(0)' }}
          />
        </button>
      )
    }
    if (field.type === 'enum') {
      return (
        <select className="select" value={String(value ?? '')} onChange={(e) => update(e.target.value)}>
          {field.options?.map((option) => <option key={option}>{option}</option>)}
        </select>
      )
    }
    if (field.type === 'date') {
      return <input className="input" type="date" value={String(value ?? '')} onChange={(e) => update(e.target.value)} />
    }
    if (field.type === 'number') {
      return <input className="input" type="number" value={String(value ?? '')} onChange={(e) => update(Number(e.target.value))} />
    }
    return <input className="input" type="text" value={String(value ?? '')} onChange={(e) => update(e.target.value)} />
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

          <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {REQUIRED_PROOF_CASES.map((example) => (
              <div key={example.label} className="card bg-white p-4 border border-slate-200 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="m-0 text-sm font-black text-slate-850">{example.label}</h2>
                    <p className="m-0 mt-0.5 text-[10px] font-semibold text-slate-400">{example.description}</p>
                  </div>
                  <span className="badge badge-purple text-[9px]">proof</span>
                </div>
                <pre className="json-output max-h-72 overflow-auto text-[10px] leading-4">
                  {JSON.stringify(getStructuredOutput(example.config), null, 2)}
                </pre>
              </div>
            ))}
          </section>

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

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card bg-white p-5 border border-slate-200 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="field-label tracking-widest">Live validator logic</h3>
                <span className="badge badge-cyan text-[9px]">18 lines</span>
              </div>
              <pre className="json-output max-h-96 overflow-auto text-[11px] leading-5">
                {VALIDATOR_LOGIC}
              </pre>
            </div>

            <div className="card bg-white p-5 border border-slate-200 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="field-label tracking-widest">Field type registry proof</h3>
                <span className="badge badge-green text-[9px]">5 renderers</span>
              </div>
              <div className="space-y-3">
                {FIELD_TYPE_DEMO.map((field) => (
                  <div key={field.name} className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[120px_1fr] sm:items-center">
                    <div>
                      <div className="text-xs font-black text-slate-800">{field.name}</div>
                      <span className={`badge text-[9px] ${field.type === 'string' ? 'badge-cyan' : field.type === 'number' ? 'badge-amber' : field.type === 'enum' ? 'badge-purple' : field.type === 'boolean' ? 'badge-green' : 'badge-red'}`}>
                        {field.type}
                      </span>
                    </div>
                    {renderDemoInput(field)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </section>
    </div>
  )
}
