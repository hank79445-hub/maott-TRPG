import { beforeAll, it, expect } from 'vitest'
import Excel from 'exceljs'
import { buildExample } from '../scripts/example-entry'
import { exportNpcConfig } from '../src/core/npc-config'
import { writeNpcXlsx, parseNpcXlsx } from '../src/persistence/npc-config-xlsx'
import type { NpcConfigDocument } from '../src/persistence/npc-config-schema'
let config: NpcConfigDocument
beforeAll(async () => {
  const f = await buildExample(),
    a = f.world.adventures[0]!
  config = exportNpcConfig(
    f.world,
    a,
    a.ai!.npcs.map((n) => n.id),
  )
})
it('round-trips all four original sample names through actual ExcelJS ZIP readers', async () => {
  const bytes = await writeNpcXlsx(config, true),
    parsed = await parseNpcXlsx(bytes)
  expect(parsed.npcs.map((n) => n.name)).toEqual(config.npcs.map((n) => n.name))
  expect(parsed.npcs).toHaveLength(4)
})
it('refuses to describe lossy Excel as a complete rich configuration export', async () => {
  await expect(writeNpcXlsx(config)).rejects.toThrow()
  const parsed = await parseNpcXlsx(await writeNpcXlsx(config, true))
  expect(parsed.characters).toEqual([])
})
it('rejects malformed spreadsheet input', async () => {
  await expect(parseNpcXlsx(new TextEncoder().encode('not an xlsx archive'))).rejects.toThrow()
})
it('loads the written workbook with the upgraded unzipper dependency', async () => {
  const wb = new Excel.Workbook()
  await wb.xlsx.load(Buffer.from(await writeNpcXlsx(config, true)) as any)
  expect(wb.worksheets.length).toBeGreaterThan(0)
  expect(wb.worksheets.some((w) => w.rowCount >= 5)).toBe(true)
})
