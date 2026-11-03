import { Unzip, UnzipInflate, strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { clone } from '../core/engine'
import { newNpcProfile } from '../core/ai'
import { customNpc } from '../core/combat-rules'
import { parseNpcConfig } from '../core/npc-config'
import { CONFIG_FILE_BYTES, type NpcConfigDocument } from './npc-config-schema'
import type { Workbook, Worksheet, CellValue } from 'exceljs'

type Column = [string, string, string?]
export const NPC_COLUMNS: Column[] = [
  ['id', 'NPC编号'],
  ['name', '名称'],
  ['npcType', '类型', 'ordinary,important'],
  ['sceneId', '场景编号'],
  ['position.x', 'X'],
  ['position.y', 'Y'],
  ['description', '公开描述'],
  ['personality', '性格'],
  ['goals', '目标'],
  ['strategy', 'SKILL'],
  ['knowledge', '已知信息'],
  ['privateNote', 'GM备注'],
  ['fallbackReply', '固定回复'],
  ['fixedReplies', '顺序固定台词JSON'],
  ['fixedReplyMode', '讲完后', 'end,loop'],
  ['fixedReplyEnd', '兜底台词'],
  ['importanceRole', '重要NPC定位', 'resident,companion'],
  ['consumables', '自身消耗品JSON'],
  ['side', '阵营', 'party,enemy,neutral'],
  ['attitude', '态度', 'friendly,indifferent,hostile'],
  ['hidden', '隐藏', '是,否'],
  ['controller', '控制方式', 'gm,model'],
  ['enabled', '源配置启用', '是,否'],
  ['allowed', '允许提议类型'],
  ['tacticalInput', '模型战术补强', '是,否'],
  ['autoDialogue', '自动回复配置', '是,否'],
  ['followParty', '跟随配置', '是,否'],
  ['activity.enabled', '主动行为配置', '是,否'],
  ['activity.allowDuringCombat', '战斗中主动行为', '是,否'],
  ['turnMode', '回合模式', 'manual,automatic,plan,step'],
  ['combatPolicy.strategy', '固定策略', 'nearest,guard,protect,ranged,retreat'],
  ['combatPolicy.guardRadius', '守卫半径'],
  ['combatPolicy.retreatPercent', '撤退百分比'],
  ['combatPolicy.planOnTurn', '回合开始启动', '是,否'],
  ['combatPolicy.protectCharacterId', '保护对象编号'],
  ['combatPolicy.attackIds', '可用攻击编号'],
  ['activity.characterIds', '交谈对象编号'],
  ['activity.events', '主动事件'],
  ['activity.range', '交谈距离'],
  ['activity.cooldownSeconds', '冷却秒数'],
  ['activity.maxPerScene', '每场景次数'],
  ['body.ac', 'AC'],
  ['body.maxHp', '最大HP'],
  ['body.hp', '当前HP'],
  ['body.temporaryHp', '临时HP'],
  ['body.speed', '速度'],
  ['body.initiativeBonus', '先攻'],
  ['body.size', '体型', 'tiny,small,medium,large,huge,gargantuan'],
  ['body.creatureType', '生物类型', 'humanoid,beast,monstrosity,fey,fiend,undead,giant,other'],
  ...['str', 'dex', 'con', 'int', 'wis', 'cha'].map(
    (k) => ['body.scores.' + k, k.toUpperCase()] as Column,
  ),
  ...['str', 'dex', 'con', 'int', 'wis', 'cha'].map(
    (k) => ['body.saves.' + k, k.toUpperCase() + '豁免'] as Column,
  ),
  ['body.conditions', '状态编号'],
  ['body.dead', '已死亡', '是,否'],
  ['body.multiattack', '多重攻击编号'],
  ['body.packTactics', '群体战术', '是,否'],
  ['body.resistances', '抗性类型'],
  ['body.immunities', '免疫类型'],
  ['body.vulnerabilities', '易伤类型'],
  ['body.conditionImmunities', '状态免疫'],
]
export const ATTACK_COLUMNS: Column[] = [
  ['npc', 'NPC编号'],
  ['id', '攻击编号'],
  ['name', '攻击名称'],
  ['kind', '类别', 'weapon,thrown,spell'],
  ['bonus', '命中加值'],
  ['damage', '伤害公式'],
  ['damageType', '伤害类型'],
  ['reach', '触及'],
  ['range', '射程'],
  ['longRange', '长射程'],
  ['effectNote', '效果备注'],
  ['manualOnly', '仅GM', '是,否'],
  ...Array.from(
    { length: 3 },
    (_, i) =>
      [
        [`extraDamage.${i}.formula`, `额外${i + 1}公式`],
        [`extraDamage.${i}.type`, `额外${i + 1}类型`],
      ] as Column[],
  ).flat(),
]
const DIALOGUE_COLUMNS: Column[] = [
  ['npc', 'NPC编号'],
  ['id', '台词编号'],
  ['when', '条件', 'default,initial,repeat,success,failure,friendly,hostile'],
  ['text', '正文'],
]
const SECRET_COLUMNS: Column[] = [
  ['npc', 'NPC编号'],
  ['id', '秘密编号'],
  ['text', '正文'],
]
const tables = [
  ['NPC', NPC_COLUMNS],
  ['攻击', ATTACK_COLUMNS],
  ['固定台词', DIALOGUE_COLUMNS],
  ['秘密', SECRET_COLUMNS],
] as const
const arrays = new Set([
  'allowed',
  'combatPolicy.attackIds',
  'activity.characterIds',
  'activity.events',
  'body.conditions',
  'body.multiattack',
  'body.resistances',
  'body.immunities',
  'body.vulnerabilities',
  'body.conditionImmunities',
])
const bools = new Set([
  'hidden',
  'enabled',
  'tacticalInput',
  'autoDialogue',
  'followParty',
  'activity.enabled',
  'activity.allowDuringCombat',
  'combatPolicy.planOnTurn',
  'body.dead',
  'body.packTactics',
  'manualOnly',
])
const numbers = new Set([
  'position.x',
  'position.y',
  'combatPolicy.guardRadius',
  'combatPolicy.retreatPercent',
  'activity.range',
  'activity.cooldownSeconds',
  'activity.maxPerScene',
  'body.ac',
  'body.maxHp',
  'body.hp',
  'body.temporaryHp',
  'body.speed',
  'body.initiativeBonus',
  'bonus',
  'reach',
  'range',
  'longRange',
  ...NPC_COLUMNS.filter(([k]) => k.startsWith('body.scores.') || k.startsWith('body.saves.')).map(
    ([k]) => k,
  ),
])
function get(obj: unknown, path: string): unknown {
  return path.split('.').reduce((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj)
}
function set(obj: Record<string, any>, path: string, value: unknown) {
  const parts = path.split('.')
  let o = obj
  for (const k of parts.slice(0, -1))
    o = o[k] ??= /^\d+$/.test(parts[parts.indexOf(k) + 1] ?? '') ? [] : {}
  o[parts.at(-1)!] = value
}
function value(cell: CellValue, where: string): string | number | boolean {
  if (cell === null || cell === undefined) return ''
  if (['string', 'number', 'boolean'].includes(typeof cell))
    return cell as string | number | boolean
  if (typeof cell === 'object' && 'richText' in cell)
    return cell.richText.map((r) => r.text).join('')
  throw Error(where + '：不接受公式、链接、日期或嵌入对象；请填写固定值')
}
function read(sheet: Worksheet, cols: Column[]) {
  const headers = sheet.getRow(1).values as CellValue[],
    indices = new Map<string, number>()
  for (let i = 1; i < headers.length; i++) {
    const h = String(value(headers[i] ?? null, sheet.name + '第1行'))
    if (!h) continue
    const key = cols.find((c) => c[1] === h)?.[0]
    if (!key || indices.has(key)) throw Error(sheet.name + '：未知或重复列 ' + h)
    indices.set(key, i)
  }
  for (const [k, label] of cols.slice(0, 2))
    if (!indices.has(k)) throw Error(sheet.name + '：缺少列 ' + label)
  if (sheet.rowCount > 1001 || sheet.columnCount > 80)
    throw Error(sheet.name + '：行列数量超过限制')
  const result: { value: Record<string, any>; row: number }[] = []
  sheet.eachRow((row, num) => {
    if (num === 1) return
    const obj: Record<string, any> = {}
    for (const [key, index] of indices) {
      const label = cols.find((c) => c[0] === key)![1],
        v = value(row.getCell(index).value, `${sheet.name}第${num}行「${label}」`)
      if (v === '') continue
      let parsed: unknown = v
      if (['fixedReplies', 'consumables'].includes(key)) {
        try {
          parsed = JSON.parse(String(v))
        } catch {
          throw Error(`${sheet.name}第${num}行「${label}」：请填写合法JSON数组`)
        }
      } else if (arrays.has(key))
        parsed = String(v)
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean)
      else if (bools.has(key)) {
        if (![true, false, 0, 1, '是', '否', 'true', 'false'].includes(v))
          throw Error(`${sheet.name}第${num}行「${label}」：请填写是／否`)
        parsed = [true, 1, '是', 'true'].includes(v)
      } else if (numbers.has(key)) {
        parsed = Number(v)
        if (!Number.isFinite(parsed) || !Number.isInteger(parsed))
          throw Error(`${sheet.name}第${num}行「${label}」：请填写整数`)
      }
      set(obj, key, parsed)
    }
    if (Object.keys(obj).length) result.push({ value: obj, row: num })
  })
  return result
}
function inspectZip(data: Uint8Array) {
  if (data.length > CONFIG_FILE_BYTES) throw Error('Excel文件超过16MiB')
  let count = 0,
    total = 0,
    failure: Error | undefined
  const unzip = new Unzip((file) => {
    if (++count > 100 || /vba|externalLink|embeddings|media\//i.test(file.name)) {
      failure = Error('Excel包含不支持的宏、链接或嵌入资源')
      return
    }
    if (file.originalSize !== undefined && file.originalSize > 32 * 1024 * 1024) {
      failure = Error('Excel解压大小超限')
      return
    }
    const chunks: Uint8Array[] = []
    file.ondata = (err, chunk, final) => {
      if (err) {
        failure = err
        file.terminate()
        return
      }
      total += chunk.length
      if (total > 32 * 1024 * 1024) {
        failure = Error('Excel解压大小超过32MiB')
        file.terminate()
        return
      }
      chunks.push(chunk)
      if (final && /\.xml$|\.rels$/.test(file.name)) {
        const length = chunks.reduce((n, c) => n + c.length, 0),
          bytes = new Uint8Array(length)
        let at = 0
        for (const c of chunks) {
          bytes.set(c, at)
          at += c.length
        }
        const text = strFromU8(bytes)
        if (
          /<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*['"]External['"]|<(?:[\w.-]+:)?f(?:\s|>)/i.test(text)
        )
          failure = Error('Excel包含公式、外部链接或不支持的XML声明')
        if (
          /^xl\/worksheets\//.test(file.name) &&
          ((text.match(/<(?:[\w.-]+:)?row(?:\s|>)/g)?.length ?? 0) > 1001 ||
            (text.match(/<(?:[\w.-]+:)?c(?:\s|>)/g)?.length ?? 0) > 80080)
        )
          failure = Error('Excel工作表行列数量超限')
      }
    }
    file.start()
  })
  unzip.register(UnzipInflate)
  for (let at = 0; at < data.length; at += 1024) {
    if (failure) throw failure
    unzip.push(data.subarray(at, at + 1024), at + 1024 >= data.length)
  }
  if (failure) throw failure
  if (!count) throw Error('不是有效XLSX文件')
}
export async function parseNpcXlsx(data: Uint8Array): Promise<NpcConfigDocument> {
  inspectZip(data)
  // ExcelJS expects unprefixed SpreadsheetML. Normalize only a declared,
  // standard main namespace after bounded ZIP inspection; never change values.
  const entries = unzipSync(data)
  let changed = false
  for (const [path, bytes] of Object.entries(entries))
    if (path.endsWith('.xml') || path.endsWith('.rels')) {
      let xml = strFromU8(bytes)
      const uri = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
      const declarations = [
        ...xml.matchAll(
          /xmlns:([\w.-]+)=["']http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main["']/g,
        ),
      ]
      for (const [declaration, prefix] of declarations) {
        const escaped = prefix!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const bindings = [
          ...xml.matchAll(new RegExp('xmlns:' + escaped + '=["\']([^"\']+)["\']', 'g')),
        ]
        if (bindings.some((m) => m[1] !== uri))
          throw Error('Excel不支持重定义SpreadsheetML命名空间')
        const defaults = [...xml.matchAll(/xmlns=["']([^"']+)["']/g)]
        if (defaults.some((m) => m[1] !== uri)) throw Error('Excel不支持混合的默认XML命名空间')
        xml = xml
          .replaceAll(declaration, defaults.length ? '' : 'xmlns="' + uri + '"')
          .replace(new RegExp('(<\\/?)' + escaped + ':', 'g'), '$1')
        changed = true
      }
      // Equivalent relative table links avoid ExcelJS's absolute-target lookup bug.
      if (/^xl\/worksheets\/_rels\//.test(path)) {
        const normalized = xml.replace(
          /Target="\/xl\/tables\/([A-Za-z0-9_.-]+\.xml)"/g,
          'Target="../tables/$1"',
        )
        if (normalized !== xml) {
          xml = normalized
          changed = true
          entries[path] = strToU8(xml)
        }
      }
      if (declarations.length) entries[path] = strToU8(xml)
    }
  const Excel = (await import('exceljs')).default,
    wb = new Excel.Workbook()
  try {
    await wb.xlsx.load((changed ? zipSync(entries, { level: 1 }) : data) as any)
  } catch {
    throw Error('Excel工作簿无法读取，请检查文件完整性并使用版本1模板')
  }
  if (
    wb.worksheets.length !== 5 ||
    tables.some(([name]) => !wb.getWorksheet(name)) ||
    !wb.getWorksheet('填写说明')
  )
    throw Error('工作表必须为NPC、攻击、固定台词、秘密、填写说明')
  const info = wb.getWorksheet('填写说明')!
  if (info.getCell('A1').value !== 'trpg-npc-config' || Number(info.getCell('B1').value) !== 1)
    throw Error('Excel模板版本不支持，请下载版本1模板')
  const scenes = new Map<string, string>(),
    subjects = new Set<string>(),
    labels = new Map<string, string>()
  info.eachRow((row, i) => {
    if (i === 1) return
    const key = String(value(row.getCell(1).value, '填写说明第' + i + '行')),
      name = String(value(row.getCell(2).value, '填写说明第' + i + '行'))
    if (key.startsWith('场景编号：') || key.startsWith('对象编号：')) labels.set(key, name)
  })
  const npcs = read(wb.getWorksheet('NPC')!, NPC_COLUMNS).map(({ value: v, row }) => {
    if (!v.id || !v.name || !v.sceneId) throw Error(`NPC第${row}行：编号、名称和场景编号必填`)
    const p = newNpcProfile(v.sceneId, v.npcType ?? 'ordinary'),
      body = v.body
        ? {
            ...customNpc(),
            ...v.body,
            name: v.name,
            scores: { ...customNpc().scores, ...v.body.scores },
            saves: { ...customNpc().saves, ...v.body.saves },
            attacks: [],
            effects: undefined,
          }
        : null
    const {
      actorId,
      revision,
      turnHold,
      memory,
      revealedIds,
      urgingCooldowns,
      behaviorState,
      preauthorization,
      ...base
    } = p
    const result = {
      ...base,
      ...v,
      portrait: null,
      body,
      combatPolicy: { ...p.combatPolicy, ...v.combatPolicy },
      activity: { ...p.activity, ...v.activity },
      preauthorization: {
        trade: false,
        revealIds: [],
        maxQuantity: 1,
        maxDiscountGP: 0,
        maxValueGP: 0,
      },
    }
    if (body) {
      delete body.effects
      if (v.body.hp === undefined) body.hp = body.maxHp
      if (!body.multiattack?.length) delete body.multiattack
    }
    scenes.set(v.sceneId, labels.get('场景编号：' + v.sceneId) ?? v.sceneId)
    if (result.combatPolicy.protectCharacterId) subjects.add(result.combatPolicy.protectCharacterId)
    for (const key of result.activity.characterIds) subjects.add(key)
    return { result, row }
  })
  for (const [name, cols] of tables.slice(1))
    for (const { value: v, row } of read(wb.getWorksheet(name)!, cols)) {
      const target = npcs.find((n) => n.result.id === v.npc)
      if (!target) throw Error(`${name}第${row}行：NPC编号不存在 ${v.npc}`)
      const { npc, ...entry } = v
      if (name === '攻击') {
        if (!target.result.body) throw Error(`攻击第${row}行：NPC没有简明数据卡`)
        const a: Record<string, any> = {
          id: entry.id,
          name: entry.name,
          kind: 'weapon',
          bonus: 0,
          damage: '1',
          damageType: 'bludgeoning',
          reach: 5,
          range: 0,
          longRange: 0,
          ...entry,
        }
        if (a.extraDamage) {
          for (const e of a.extraDamage)
            if (e && (!e.formula || !e.type))
              throw Error(`攻击第${row}行：额外伤害需要同时填写公式与类型`)
          a.extraDamage = a.extraDamage.filter(Boolean)
        }
        target.result.body.attacks.push(a as any)
      } else if (name === '固定台词') target.result.dialogue.push(entry as any)
      else target.result.secrets.push(entry as any)
    }
  try {
    return parseNpcConfig({
      format: 'trpg-npc-config',
      version: 1,
      scenes: [...scenes].map(([id, name]) => ({ id, name })),
      subjects: [...subjects].map((id) => ({ id, name: labels.get('对象编号：' + id) ?? id })),
      npcs: npcs.map((n) => n.result),
      characters: [],
      packs: [],
      dependencies: [],
    })
  } catch (e) {
    const error = e as { issues?: { path: (string | number)[]; message: string }[] }
    if (error.issues)
      throw Error(
        error.issues
          .map((i) => {
            const row = typeof i.path[1] === 'number' ? npcs[i.path[1]]?.row : undefined
            return `NPC${row ? '第' + row + '行' : ''} ${i.path.slice(2).join('.')}：${i.message}`
          })
          .join('\n'),
      )
    throw e
  }
}
export async function writeNpcXlsx(input: NpcConfigDocument, partial = false): Promise<Uint8Array> {
  const d = clone(input)
  if (
    !partial &&
    (d.characters.length ||
      d.packs.length ||
      d.npcs.some(
        (n) =>
          n.portrait ||
          n.abilities.length ||
          n.stock.length ||
          n.coins ||
          (n.dialogueReview &&
            (n.dialogueReview.mode !== 'inherit' || n.dialogueReview.categories.length > 0)) ||
          n.publicDialogue ||
          n.publicKnowledge?.length ||
          n.body?.abilities?.length ||
          n.body?.resources?.length ||
          n.body?.spellcasting ||
          n.body?.concentration ||
          n.body?.magicResistance ||
          n.body?.authorityAura ||
          n.body?.shape ||
          n.combatPolicy.monsterAbilityIds?.length ||
          n.body?.templateMetadata ||
          n.body?.multiattackChoice ||
          n.body?.nimbleEscape ||
          n.body?.bloodiedFury ||
          n.body?.undeadFortitude ||
          n.body?.multiattack ||
          n.body?.packTactics ||
          n.body?.attacks.some(
            (a) =>
              a.proneMaxSize || a.advantageWhileGrappling || a.extraDamage?.some((d) => d.when),
          ),
      ))
  )
    throw Error(
      'Excel无法保存完整职业卡、能力、头像、扩展规则、交易库存／金币、对话分类策略／公开知识或NPC结构化规则／模板元数据，请改用JSON；或明确选择仅支持字段',
    )
  if (partial) {
    d.characters = []
    d.packs = []
    for (const n of d.npcs) {
      if (n.characterId) n.combatPolicy.attackIds = []
      n.characterId = null
      n.abilities = []
      n.portrait = null
      n.stock = []
      n.coins = 0
      delete n.dialogueReview
      delete n.publicDialogue
      delete n.publicKnowledge
      if (n.body) {
        delete n.body.abilities
        delete n.body.resources
        delete n.body.spellcasting
        delete n.body.concentration
        delete n.body.magicResistance
        delete n.body.authorityAura
        delete n.body.shape
        delete n.combatPolicy.monsterAbilityIds
        delete n.combatPolicy.healPercent
        delete n.body.templateMetadata
        delete n.body.multiattackChoice
        delete n.body.multiattack
        delete n.body.packTactics
        delete n.body.nimbleEscape
        delete n.body.bloodiedFury
        delete n.body.undeadFortitude
        for (const a of n.body.attacks) {
          delete a.proneMaxSize
          delete a.proneRequiresCharge
          delete a.advantageWhileGrappling
          a.extraDamage = a.extraDamage?.filter((d) => !d.when)
        }
        n.body.source = (
          n.body.source + '；Excel仅支持字段，结构化规则和条件伤害省略，GM须核对完整原文'
        ).slice(0, 2000)
      }
    }
  }
  const Excel = (await import('exceljs')).default,
    wb = new Excel.Workbook()
  wb.creator = '旅团'
  wb.created = new Date(2026, 9, 12)
  const info = wb.addWorksheet('填写说明')
  info.addRow(['trpg-npc-config', 1])
  info.addRow([
    '填写方法',
    '一行一个实例；编号只在文件内使用。数组以 | 分隔；布尔填是／否；数值单位为尺。',
  ])
  info.addRow([
    '支持范围',
    partial
      ? '仅支持字段，不含完整角色卡、能力、头像、扩展规则、交易库存／金币、对话分类策略／公开知识或NPC结构化规则／模板元数据；完整人物请用JSON。'
      : '普通NPC简明卡及重要NPC文字／简明卡；完整职业卡使用JSON。',
  ])
  info.addRow(['导入行为', '预览后确认；默认停用；不复制旧记忆、授权和战斗；同名不覆盖。'])
  info.addRow([
    '数据来源',
    [...new Set(d.npcs.map((n) => n.body?.source).filter(Boolean))].join('；').slice(0, 30000) ||
      '用户配置；请由GM核对规则来源。',
  ])
  for (const [sheet, cols] of tables) {
    const ws = wb.addWorksheet(sheet)
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }]
    ws.addRow(cols.map((c) => c[1]))
    const rows: Record<string, any>[] = []
    for (const n of d.npcs) {
      if (sheet === 'NPC') rows.push(n)
      else if (sheet === '攻击')
        rows.push(...(n.body?.attacks ?? []).map((a) => ({ ...a, npc: n.id })))
      else if (sheet === '固定台词') rows.push(...n.dialogue.map((t) => ({ ...t, npc: n.id })))
      else rows.push(...n.secrets.map((s) => ({ ...s, npc: n.id })))
    }
    for (const row of rows)
      ws.addRow(
        cols.map(([key]) => {
          const v = get(row, key)
          if (['fixedReplies', 'consumables'].includes(key)) return v ? JSON.stringify(v) : ''
          return Array.isArray(v)
            ? v.join('|')
            : typeof v === 'boolean'
              ? v
                ? '是'
                : '否'
              : (v ?? '')
        }),
      )
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, ws.rowCount), column: cols.length },
    }
    cols.forEach(([key, label, options], i) => {
      ws.getColumn(i + 1).width = [
        '公开描述',
        '性格',
        '目标',
        'SKILL',
        '已知信息',
        'GM备注',
        '正文',
        '固定回复',
        '效果备注',
      ].includes(label)
        ? 36
        : 16
      if (options)
        for (let row = 2; row <= 21; row++)
          ws.getCell(row, i + 1).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"' + options + '"'],
          }
      info.addRow([
        sheet + '.' + label,
        key,
        options ?? (numbers.has(key) ? '整数' : arrays.has(key) ? '编号以 | 分隔' : '固定文本'),
      ])
    })
    styleSheet(ws)
  }
  for (const s of d.scenes) info.addRow(['场景编号：' + s.id, s.name])
  for (const s of d.subjects) info.addRow(['对象编号：' + s.id, s.name])
  info.columns = [{ width: 27 }, { width: 44 }, { width: 70 }]
  info.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }]
  styleSheet(info)
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer)
}
function styleSheet(ws: Worksheet) {
  if (ws.views[0]) ws.views[0].showGridLines = false
  if (ws.name !== '填写说明')
    for (let row = 2; row <= 21; row++)
      for (let col = 1; col <= ws.columnCount; col++) {
        const cell = ws.getCell(row, col)
        cell.font = { name: 'Microsoft YaHei', size: 11 }
        cell.alignment = { vertical: 'middle', wrapText: true }
      }
  ws.eachRow((row) => {
    let lines = 1
    row.eachCell((cell, col) => {
      cell.alignment = { vertical: 'middle', wrapText: true }
      cell.font = { name: 'Microsoft YaHei', size: 11 }
      lines = Math.max(
        lines,
        String(cell.value ?? '')
          .split('\n')
          .reduce(
            (sum, s) =>
              sum +
              Math.max(1, Math.ceil(s.length / Math.max(6, (ws.getColumn(col).width ?? 16) / 1.6))),
            0,
          ),
      )
      if (row.number === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF315363' } }
        cell.font = { name: 'Microsoft YaHei', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      }
    })
    row.height = Math.min(300, Math.max(30, lines * 19 + 8))
  })
}
