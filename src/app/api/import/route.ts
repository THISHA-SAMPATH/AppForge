import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateConfig } from '@/engine/validator'
import type { ApiResponse } from '@/types/config'
import { Prisma } from '@prisma/client'

// Infer field type from a column's sample values
function inferType(values: string[]): { type: string; options?: string[] } {
  const nonEmpty = values.filter(v => v.trim() !== '')
  if (nonEmpty.length === 0) return { type: 'string' }

  // Check boolean
  const boolVals = new Set(['true','false','yes','no','1','0'])
  if (nonEmpty.every(v => boolVals.has(v.toLowerCase()))) return { type: 'boolean' }

  // Check number
  if (nonEmpty.every(v => !isNaN(Number(v)) && v.trim() !== '')) return { type: 'number' }

  // Check date
  if (nonEmpty.every(v => !isNaN(Date.parse(v)))) return { type: 'date' }

  // Check enum — if unique values <= 8 and total rows > unique*2
  const unique = [...new Set(nonEmpty.map(v => v.trim()))]
  if (unique.length <= 8 && nonEmpty.length >= unique.length * 2) {
    return { type: 'enum', options: unique }
  }

  return { type: 'string' }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, headers, rows, appId } = body

    // headers: string[]
    // rows: string[][] (each row is array of values)
    // appId: optional — if provided, import into existing app

    if (!headers || !rows || !Array.isArray(headers) || !Array.isArray(rows)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid CSV data' },
        { status: 400 }
      )
    }

    // Build column samples for type inference
    const columnSamples: Record<string, string[]> = {}
    headers.forEach((h: string, i: number) => {
      columnSamples[h] = rows.slice(0, 50).map((r: string[]) => r[i] ?? '')
    })

    // Infer types
    const fields = headers.map((h: string) => {
      const { type, options } = inferType(columnSamples[h])
      return { name: h.trim().replace(/[^a-zA-Z0-9_]/g, '_'), type, ...(options ? { options } : {}) }
    })

    const rawConfig = {
      entity: name || 'ImportedData',
      fields,
      ui: { layout: 'table' }
    }

    const validation = validateConfig(rawConfig)

    // If appId provided, just return the inferred config for preview
    if (appId === 'preview') {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: { config: validation.config, warnings: validation.warnings, rowCount: rows.length }
      })
    }

    // Create the app
    const app = await prisma.app.create({
      data: {
        name: name || 'Imported App',
        description: `Imported from CSV — ${rows.length} records`,
        config: validation.config as unknown as Prisma.InputJsonValue,
        userId: session.user.id,
      }
    })

    // Save version
    await prisma.appVersion.create({
      data: { appId: app.id, version: 1, config: validation.config as unknown as Prisma.InputJsonValue }
    })

    // Bulk insert records
    const entity = validation.config.entity
    const recordsToInsert = rows.map((row: string[]) => {
      const data: Record<string, Prisma.InputJsonValue> = {}
      validation.config.fields.forEach((field, i) => {
        const raw = row[i] ?? ''
        if (field.type === 'number') data[field.name] = (isNaN(Number(raw)) ? null : Number(raw)) as Prisma.InputJsonValue
        else if (field.type === 'boolean') data[field.name] = ['true','yes','1'].includes(raw.toLowerCase()) as Prisma.InputJsonValue
        else data[field.name] = raw as Prisma.InputJsonValue
      })
      return { appId: app.id, entity, data: data as Prisma.InputJsonObject }
    })

    // Insert in batches of 100
    for (let i = 0; i < recordsToInsert.length; i += 100) {
      await prisma.appRecord.createMany({ data: recordsToInsert.slice(i, i + 100) })
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        app,
        rowsImported: recordsToInsert.length,
        config: validation.config,
        warnings: validation.warnings
      }
    }, { status: 201 })

  } catch (error) {
    console.error('CSV import error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Import failed' },
      { status: 500 }
    )
  }
}
