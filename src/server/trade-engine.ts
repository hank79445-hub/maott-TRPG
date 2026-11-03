import {itemSpellBusy} from '../core/item-spells'
import {systemMessage} from '../shared/localization/system-messages'
import { createHash, randomUUID } from 'node:crypto'
import type { Room, RoomMember, RoomCommand, RoomView } from '../online/protocol'
import type { InventoryItem, Character } from '../core/types'
import type { NpcProfile } from '../core/ai-types'
import {
  defaultMerchant,
  tradeCommandSchema,
  type TradeBasket,
  type TradeSession,
  type TradeView,
} from '../persistence/trade-schema'
import { adventure, RoomError } from './room-engine'
import { catalogue, clone } from '../core/engine'
import { srd } from '../content/srd'
import { distance } from '../core/map'
import { sightLine } from '../core/map-spatial'
import { pointInteractor } from '../core/point-interactor'
import { rollDie, validateInventory } from '../core/runtime'
import { appendBroadcast } from '../core/broadcast'
import { inventoryName } from '../core/special-weapons'
import { assertExplorationReady, explorationMember, explorationSpend } from '../core/exploration'
import { assertM1InventoryChange } from '../core/m1-utility'
import { assertSupplyInventoryChange } from '../core/scene-supplies'
import { fogEntityAllowed } from './fog'
import { npcSocialContext } from './npc-social-context'
import { practicalEnabled } from './practical-review-state'
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex')
const branch = (room: Room) => adventure(room).broadcastLog?.branchId ?? 'legacy'
export function copper(gp: number) {
  const cp = Math.round(gp * 100)
  if (!Number.isSafeInteger(cp) || cp < 0 || cp > 100000000 || Math.abs(gp * 100 - cp) > 1e-6)
    throw new RoomError('金额无效，须非负且最多两位GP小数')
  return cp
}
const sum = (values: number[]) => {
  const n = values.reduce((a, b) => a + b, 0)
  if (!Number.isSafeInteger(n) || n > 100000000) throw new RoomError('交易总额超过上限')
  return n
}
export const stockId = (n: NpcProfile, index: number) =>
  n.stock[index]!.id ?? 'stock-' + hash([n.id, index, n.stock[index]!.itemId]).slice(0, 24)
function normalizeStock(n: NpcProfile) {
  n.stock.forEach((s, i) => (s.id ??= stockId(n, i)))
}
function parties(room: Room, characterId: string, npcId: string, member?: RoomMember) {
  const a = adventure(room),
    c = room.world.characters.find((c) => c.id === characterId),
    n = a.ai?.npcs.find((n) => n.id === npcId),
    s = a.scenes.find((s) => s.id === n?.sceneId),
    cat = catalogue([srd, ...room.world.packs])
  if (
    !c ||
    !n?.enabled ||
    n.hidden ||
    (n.initiallyAbsent && !n.appeared) ||
    !s ||
    a.activeSceneId !== s.id ||
    n.characterId === c.id
  )
    throw new RoomError('交易双方不在可交易场景')
  if (member && member.role !== 'gm' && (!member.characterIds.includes(c.id) || member.revoked))
    throw new RoomError('不能操作他人交易', 403)
  const p = s.tokens.find((t) => t.characterId === c.id && !t.hidden),
    q = s.tokens.find(
      (t) =>
        (t.npcId === n.id || (!!n.characterId && t.characterId === n.characterId)) && !t.hidden,
    )
  if (
    !p ||
    !q ||
    distance(s, p, q) > 5 ||
    (p.spatial?.layer ?? 'material') !== (q.spatial?.layer ?? 'material') ||
    p.spatial?.anchorId !== q.spatial?.anchorId ||
    Math.abs((p.spatial?.height ?? 0) - (q.spatial?.height ?? 0)) > s.grid.feet ||
    !sightLine(s, p, q, 'blocksTargeting').clear
  )
    throw new RoomError('交易须同场景、5尺内且交付路线可通行')
  if (member && member.role !== 'gm' && s.fog?.enabled && !fogEntityAllowed(room, member, s.id, q))
    throw new RoomError('交易对象当前不可感知', 403)
  if (
    room.world.encounters.some(
      (e) =>
        e.phase === 'active' &&
        (e.id === s.encounterId ||
          e.actors.some(
            (t) =>
              t.characterId === c.id ||
              t.id === n.actorId ||
              (!!n.characterId && t.characterId === n.characterId),
          )),
    )
  )
    throw new RoomError('交易双方或本场景正在战斗')
  pointInteractor(room.world, a, s, c.id, undefined, cat, rollDie)
  pointInteractor(room.world, a, s, '', n.id, cat, rollDie)
  const policy = n.merchantPolicy ?? defaultMerchant()
  const attitude = npcSocialContext(room, n, c.id).attitude
  if (!policy.enabled || attitude === 'hostile') throw new RoomError('NPC当前不愿交易')
  const seller = n.characterId
    ? room.world.characters.find((v) => v.id === n.characterId)
    : undefined
  if (n.characterId && !seller) throw new RoomError('NPC实际钱包不存在')
  return { a, c, n, s, p, q, cat, policy, seller, attitude }
}
export function tradeItemReason(
  room: Room,
  c: Character,
  row: InventoryItem,
  blocked: readonly string[] = [],
) {
  if(itemSpellBusy(c,row))return '物品用于连续施法中，请先取消原施法'
  if (row.equipped) return '请先卸下装备'
  if (c.inventory.some((i) => i.containerId === row.instanceId)) return '请先清空容器'
  if (row.containerId) return '请先从容器取出'
  if (blocked.includes(row.itemId) || /剧情|关键|quest/i.test(row.source))
    return '关键或禁止交易物品'
  if (row.consumable || row.spellEnchantments?.length) return '临时或附带持续法术物品须GM另行处理'
  if (
    room.world.characters.some((v) =>
      v.runtime?.effects?.some((e) => e.weapon?.instanceId === row.instanceId),
    ) ||
    room.world.adventures.some(
      (a) =>
        a.sceneEffects?.regions.some(
          (e) =>
            e.status === 'active' &&
            e.anchor.kind === 'inventory' &&
            e.anchor.id === row.instanceId,
        ) || a.sceneEffects?.supplies?.containers.some((v) => v.instanceId === row.instanceId),
    )
  )
    return '物品仍有关联效果，须先处理'
  try {
    assertM1InventoryChange(room.world, c.id, {
      type: 'item-remove',
      instanceId: row.instanceId,
      quantity: 1,
      consume: false,
      note: '交易',
    })
    assertSupplyInventoryChange(room.world, c.id, {
      type: 'item-remove',
      instanceId: row.instanceId,
      quantity: 1,
      consume: false,
      note: '交易',
    })
  } catch (e) {
    return e instanceof Error ? e.message : '物品不能转移'
  }
  return ''
}
function quote(
  room: Room,
  t: TradeSession,
  basket: TradeBasket,
  prices: Record<string, number> = {},
) {
  const { c, n, s, p, q, cat, policy, seller, attitude } = parties(room, t.characterId, t.npcId),
    unique = (ids: string[]) => {
      if (new Set(ids).size !== ids.length) throw new RoomError('同一物品不能重复加入交易')
    }
  validateInventory(c, cat)
  unique(basket.take.map((r) => r.stockId))
  unique(basket.give.map((r) => r.instanceId))
  normalizeStock(n)
  const take = basket.take.map((r) => {
    const stock = n.stock.find((v) => v.id === r.stockId)
    if (stock && policy.blockedItems.includes(stock.itemId))
      throw new RoomError('该物品被GM设为禁止交易')
    if (!stock || stock.quantity < r.quantity) throw new RoomError('商店库存不足或引用已变化')
    const item = cat.items.find((i) => i.id === stock.itemId)
    if (!item) throw new RoomError('物品缺少共享规则定义')
    if (
      stock.inventoryState &&
      tradeItemReason(room, { ...c, inventory: [] }, stock.inventoryState, policy.blockedItems)
    )
      throw new RoomError('商店特殊物品仍受转移限制')
    const value = prices[r.stockId] ?? copper(stock.priceGP)
    return {
      id: r.stockId,
      itemId: stock.itemId,
      name: stock.inventoryState ? inventoryName(stock.inventoryState, item.name) : item.name,
      quantity: r.quantity,
      referenceCP: copper(item.cost),
      valueCP: value,
      reason: value === 0 && !policy.zeroPrice ? '零价须GM明确批准' : '',
    }
  })
  const give = basket.give.map((r) => {
    const row = c.inventory.find((i) => i.instanceId === r.instanceId)
    if (!row || row.quantity < r.quantity) throw new RoomError('玩家物品不足或已变化')
    const reason = tradeItemReason(room, c, row, policy.blockedItems)
    if (reason) throw new RoomError(reason)
    if (!policy.buy || (policy.buyItems.length && !policy.buyItems.includes(row.itemId)))
      throw new RoomError('NPC不收购该物品')
    const item = cat.items.find((i) => i.id === row.itemId)
    if (!item) throw new RoomError('须先由GM登记共享物品定义')
    const reference = copper(item.cost),
      value =
        prices[r.instanceId] ?? (reference > 0 ? Math.floor(reference * policy.buyRate) : null)
    return {
      id: r.instanceId,
      itemId: row.itemId,
      name: inventoryName(row, item.name),
      quantity: r.quantity,
      referenceCP: reference || null,
      valueCP: value,
      reason: value === null ? '缺少可靠价格，待GM定价' : '',
    }
  })
  if (!take.length && !give.length && !basket.playerPayCP && !basket.npcPayCP)
    throw new RoomError('交换清单为空')
  const ask = take.some((r) => r.valueCP === null)
      ? null
      : sum(take.map((r) => r.valueCP! * r.quantity)),
    bid = give.some((r) => r.valueCP === null)
      ? null
      : sum(give.map((r) => r.valueCP! * r.quantity))
  if (copper(c.coins) < basket.playerPayCP || copper(seller?.coins ?? n.coins) < basket.npcPayCP)
    throw new RoomError('交易一方资金不足，请调整金币或清单')
  const fingerprint = hash({
    characterId: c.id,
    npcId: n.id,
    sceneId: s.id,
    positions: [p.x, p.y, q.x, q.y, p.spatial, q.spatial],
    characterState: [c.runtime?.hp, c.runtime?.conditions, c.runtime?.effects],
    npcState: [n.body?.hp, n.body?.dead, n.body?.effects, seller?.runtime, n.attitude],
    policy,
    attitude,
    npcCoins: seller?.coins ?? n.coins,
    playerCoins: c.coins,
    stock: take.map((r) => n.stock.find((v) => v.id === r.id)),
    items: give.map((r) => c.inventory.find((i) => i.instanceId === r.id)),
    basket,
  })
  return {
    take,
    give,
    askCP: ask,
    bidCP: bid,
    gapCP:
      ask === null || bid === null
        ? null
        : sum([ask, basket.npcPayCP]) - sum([bid, basket.playerPayCP]),
    fingerprint,
  }
}
function current(room: Room, id: string, member: RoomMember) {
  const t = adventure(room).trades?.sessions.find((t) => t.id === id)
  if (!t || (member.role !== 'gm' && t.sessionId !== member.id))
    throw new RoomError('交易不存在或无权查看', 403)
  return t
}
function unchanged(room: Room, t: TradeSession) {
  const prices = Object.fromEntries(
      [...t.take, ...t.give].filter((r) => r.valueCP !== null).map((r) => [r.id, r.valueCP!]),
    ),
    fresh = quote(room, t, t.basket, prices)
  if (fresh.fingerprint !== t.fingerprint)
    throw new RoomError('相关库存、金币、位置或交易条件已变化，请刷新报价')
  return fresh
}
function automatic(room: Room, t: TradeSession) {
  const { n, c, policy } = parties(room, t.characterId, t.npcId),
    p = n.preauthorization
  if(practicalEnabled(room,'trade')&&policy.practical?.enabled){
    const scope=policy.practical
    return (!t.basket.take.length||policy.autoPurchase)&&(!t.basket.give.length||scope.buyback&&policy.buy)&&(!(t.basket.take.length&&t.basket.give.length)||scope.barter)&&t.gapCP===0&&t.askCP!==null&&t.bidCP!==null&&p.trade&&p.remaining>0&&(!p.expiresAt||Date.parse(p.expiresAt)>Date.now())&&(scope.scope==='all'||p.characterIds.includes(c.id))&&sum([...t.basket.take,...t.basket.give].map(r=>r.quantity))<=p.maxQuantity&&Math.max(t.askCP,t.bidCP)<=copper(p.maxValueGP)&&!t.take.some(r=>r.reason)&&!t.give.some(r=>r.reason)
  }
  return (
    policy.autoPurchase &&
    !t.basket.give.length &&
    !t.basket.npcPayCP &&
    t.gapCP === 0 &&
    t.askCP !== null &&
    p.trade &&
    p.remaining > 0 &&
    (!p.expiresAt || Date.parse(p.expiresAt) > Date.now()) &&
    (!p.characterIds.length || p.characterIds.includes(c.id)) &&
    sum(t.basket.take.map((r) => r.quantity)) <= p.maxQuantity &&
    t.askCP <= copper(p.maxValueGP) &&
    !t.take.some((r) => r.reason || n.stock.find((s) => s.id === r.id)?.inventoryState)
  )
}
function policyBargain(room:Room,t:TradeSession,success:boolean){
 const {n,policy,cat}=parties(room,t.characterId,t.npcId),cfg=room.gmReview!.settings.practical!,prices:Record<string,number>={}
 for(const row of t.take){const stock=n.stock.find(s=>s.id===row.id)!;const base=copper(stock.priceGP);prices[row.id]=success?Math.max(0,base-Math.min(Math.floor(base*cfg.sellDiscountPercent/100),copper(n.preauthorization.maxDiscountGP))):base}
 for(const row of t.give){const item=cat.items.find(i=>i.id===row.itemId)!;const base=Math.floor(copper(item.cost)*policy.buyRate),selling=n.stock.filter(s=>s.itemId===row.itemId).map(s=>copper(s.priceGP)),ceiling=selling.length?Math.min(...selling):copper(item.cost);prices[row.id]=success?Math.min(ceiling,base+Math.floor(base*cfg.buyIncreasePercent/100)):base}
 const valued=quote(room,t,{...t.basket,playerPayCP:0,npcPayCP:0},prices),difference=(valued.askCP??0)-(valued.bidCP??0),basket={...t.basket,playerPayCP:Math.max(0,difference),npcPayCP:Math.max(0,-difference)}
 const final=quote(room,t,basket,prices)
 if(!automatic(room,{...t,...final,basket}))throw new RoomError('议价超出商店范围、次数、数量或价值授权')
 return {prices,basket}
}
export function refreshTrades(room: Room) {
  for (const t of adventure(room).trades?.sessions ?? []) {
    if (['committed', 'canceled', 'stale'].includes(t.status)) continue
    try {
      if (
        t.branchId !== branch(room) ||
        !room.members.some(
          (m) =>
            m.id === t.sessionId &&
            !m.revoked &&
            (m.role === 'gm' || m.characterIds.includes(t.characterId)),
        )
      )
        throw Error()
      if (t.status !== 'draft') unchanged(room, t)
    } catch {
      t.status = 'stale'
      t.playerAccepted = false
      t.npcAccepted = false
      t.reason = '相关条件或分支已变化，需重新报价'
    }
  }
}
export function executeTrade(room: Room, member: RoomMember, command: RoomCommand) {
  if (command.kind !== 'trade') return false
  const op = tradeCommandSchema.parse(command).command,
    a = adventure(room)
  if (op.operation === 'configure') {
    if (member.role !== 'gm') throw new RoomError('商店设置需要GM', 403)
    const n = a.ai?.npcs.find((n) => n.id === op.npcId)
    if (!n) throw new RoomError('NPC不存在')
    n.merchantPolicy = op.policy
    n.revision++
    return true
  }
  if (op.branchId !== branch(room)) throw new RoomError('交易分支已变化，请重新连接', 409)
  if (op.operation === 'open') {
    parties(room, op.characterId, op.npcId, member)
    const state = (a.trades ??= { sessions: [] }),
      old = state.sessions.find(
        (t) =>
          t.characterId === op.characterId &&
          !['committed', 'canceled', 'stale'].includes(t.status),
      )
    if (old) {
      if (old.sessionId !== member.id || old.npcId !== op.npcId)
        throw new RoomError('角色已有交易，请先明确取消')
      return true
    }
    state.sessions = state.sessions.filter(
      (t, i) =>
        !['committed', 'canceled', 'stale'].includes(t.status) || i > state.sessions.length - 150,
    )
    if (state.sessions.length >= 300) throw new RoomError('交易列表已满')
    const n = a.ai!.npcs.find((n) => n.id === op.npcId)!
    normalizeStock(n)
    state.sessions.push({
      id: randomUUID(),
      branchId: op.branchId,
      sessionId: member.id,
      characterId: op.characterId,
      npcId: op.npcId,
      sceneId: n.sceneId,
      version: 1,
      status: 'draft',
      basket: { take: [], give: [], playerPayCP: 0, npcPayCP: 0, note: '' },
      fingerprint: '',
      take: [],
      give: [],
      askCP: 0,
      bidCP: 0,
      gapCP: 0,
      playerAccepted: false,
      npcAccepted: false,
      reason: '选择物品并提交报价；尚未成交',
      at: new Date().toISOString(),
    })
    return true
  }
  const t = current(room, op.tradeId, member)
  if (t.branchId !== op.branchId) throw new RoomError('旧分支交易不能重放')
  if (op.operation === 'commit' && t.status === 'committed') return true
  if (op.version !== t.version) throw new RoomError('报价版本已变化', 409)
  if (['committed', 'canceled'].includes(t.status)) throw new RoomError('交易已结束')
  if (member.revoked || (member.role !== 'gm' && !member.characterIds.includes(t.characterId)))
    throw new RoomError('角色权限已变化', 403)
  if (op.operation === 'cancel') {
    t.status = 'canceled'
    t.reason = '明确取消；未进行交割'
    return true
  }
  parties(room, t.characterId, t.npcId, member)
  if (op.operation === 'quote') {
    if (member.role !== 'gm' && member.id !== t.sessionId) throw new RoomError('只能修改本人报价')
    const calculated = quote(room, t, op.basket)
    Object.assign(t, calculated, {
      basket: op.basket,
      version: t.version + 1,
      status: 'quoted',
      playerAccepted: false,
      npcAccepted: false,
      reason: '报价已保存，尚未交付',
      authorization: undefined,
    })
    return true
  }
  if (op.operation === 'reset-negotiation') {
    if (member.role !== 'gm') throw new RoomError('只有GM可重置议价尝试')
    for (const prior of a.trades?.sessions ?? [])
      if (
        prior.npcId === t.npcId &&
        prior.characterId === t.characterId &&
        prior.branchId === t.branchId &&
        prior.negotiation
      )
        prior.negotiation.resetAt = new Date().toISOString()
    appendBroadcast(a, randomUUID(), {message:systemMessage('gm.negotiation-reset'),
      category: 'interaction',
      type: 'trade.negotiation-reset',
      title: 'GM重置议价资格',
      text: op.reason,
      sceneId: t.sceneId,
      audience: { kind: 'gm', characterIds: [] },
      facts: { tradeId: t.id, adjudicated: true },
    })
    t.reason = 'GM已明确重置议价：' + op.reason
    return true
  }
  if (op.operation === 'request') {
    unchanged(room, t)
    if (t.status !== 'quoted') throw new RoomError('请先保存报价')
    t.playerAccepted = true
    if (!t.npcAccepted && automatic(room, t)) t.authorization = 'policy'
    t.npcAccepted = t.npcAccepted || automatic(room, t)
    t.status = t.npcAccepted ? 'ready' : 'awaitingGM'
    t.reason = t.npcAccepted ? '具体报价已获准，待玩家最终成交' : '等待GM核对这份确定报价'
    return true
  }
  if (op.operation === 'negotiate') {
    unchanged(room, t)
    if (
      (a.trades?.sessions ?? []).some(
        (s) =>
          s.npcId === t.npcId &&
          s.characterId === t.characterId &&
          s.branchId === t.branchId &&
          s.negotiation?.status === 'resolved' &&
          !s.negotiation.resetAt && (s.negotiation.untilHours===undefined||s.negotiation.untilHours>(room.world.characters.find(c=>c.id===t.characterId)?.runtime?.hours??0)),
      )
    )
      throw new RoomError('该议价检定已有结果；需GM明确重置，不能反复刷骰')
    if (t.negotiation && !t.negotiation.resetAt) throw new RoomError('已有议价申请，请GM处理')
    if (!['quoted', 'awaitingGM'].includes(t.status)) throw new RoomError('请先保存报价再申请议价')
    t.negotiation = { skill: op.skill, goal: op.goal, version: t.version, status: 'requested' }
    t.status = 'awaitingGM'
    t.playerAccepted = true
    t.reason = '议价检定申请等待GM裁定'
    return true
  }
  if (op.operation === 'roll') {
    if (member.role !== 'gm') throw new RoomError('检定裁定需要GM', 403)
    unchanged(room, t)
    if (
      !t.negotiation ||
      t.negotiation.status !== 'requested' ||
      t.negotiation.version !== t.version
    )
      throw new RoomError('议价申请需复核，不能重复掷骰')
    const { s, p, cat,policy,n,c } = parties(room, t.characterId, t.npcId),
      budget = explorationMember(a, p.id)
    if(op.policyPricing&&(!practicalEnabled(room,'trade')||!policy.practical?.enabled||!policy.practical.negotiation||policy.practical.dc!==op.dc||policy.practical.cost!==op.cost))throw new RoomError('商店议价授权已经变化')
    const policyFailure=op.policyPricing?policyBargain(room,t,false):undefined
    let policySuccess=policyFailure
    if(op.policyPricing){try{policySuccess=policyBargain(room,t,true)}catch{policySuccess=policyFailure}}
    if (a.exploration?.status === 'active' && !budget) throw new RoomError('角色未加入探索回合')
    if (budget && op.cost !== 'free') {
      assertExplorationReady(room.world, a, budget, cat)
      explorationSpend(budget, op.cost)
      a.exploration!.acted = true
    }
    const result = pointInteractor(room.world, a, s, t.characterId, undefined, cat, rollDie).check({
      kind: 'skill',
      id: t.negotiation.skill,
      dc: op.dc,
    })
    t.negotiation = { ...t.negotiation, ...result, dc: op.dc, status: 'resolved' }
    let prices:Record<string,number>|undefined
    if(op.policyPricing){
      const prepared=result.success?policySuccess!:policyFailure!
      prices=prepared.prices;t.basket=prepared.basket
      t.negotiation.untilHours=(c.runtime?.hours??0)+24;t.negotiation.policyPrices=prices
    }else t.basket.playerPayCP = result.success ? op.successPayCP : op.failurePayCP
    Object.assign(t, quote(room, t, t.basket,prices), {
      version: t.version + 1,
      status: 'ready',
      playerAccepted: true,
      npcAccepted: true,
      reason: 'GM裁定的议价结果已生成，待玩家确认最终价格',
      authorization: op.policyPricing?'policy':'gm',
    })
    return true
  }
  if (op.operation === 'review') {
    if (member.role !== 'gm') throw new RoomError('交易审核需要GM', 403)
    if (t.status !== 'awaitingGM') throw new RoomError('本报价不在待审状态')
    unchanged(room, t)
    if (op.decision === 'reject') {
      t.status = 'canceled'
      t.reason = op.reason
      return true
    }
    if (op.decision === 'counter') {
      const basket = {
        ...t.basket,
        playerPayCP: op.playerPayCP ?? t.basket.playerPayCP,
        npcPayCP: op.npcPayCP ?? t.basket.npcPayCP,
      }
      Object.assign(t, quote(room, t, basket, op.prices), {
        basket,
        version: t.version + 1,
        status: 'quoted',
        playerAccepted: false,
        npcAccepted: true,
        reason: 'GM还价：' + op.reason,
        authorization: 'gm',
      })
      return true
    }
    const calculated = quote(room, t, t.basket, op.prices)
    if (
      calculated.take.some((r) => r.valueCP === null) ||
      calculated.give.some((r) => r.valueCP === null)
    )
      throw new RoomError('请先为缺价物品明确填写价格')
    Object.assign(t, calculated, {
      status: 'ready',
      npcAccepted: true,
      playerAccepted: true,
      reason: 'GM批准具体报价：' + op.reason,
      authorization: 'gm',
    })
    return true
  }
  if (op.operation === 'commit') {
    if (t.status !== 'ready' || !t.playerAccepted || !t.npcAccepted)
      throw new RoomError('报价尚未获准')
    unchanged(room, t)
    if (t.authorization === 'policy' && !automatic(room, t))
      throw new RoomError('交易预授权已变化，须交GM复核')
    const world = clone(room.world),
      next = { ...room, world },
      saved = adventure(next).trades!.sessions.find((v) => v.id === t.id)!,
      { c, n, seller, cat } = parties(next, t.characterId, t.npcId),
      pay = saved.basket.playerPayCP,
      receive = saved.basket.npcPayCP,
      pc = copper(c.coins),
      nc = copper(seller?.coins ?? n.coins)
    if (pc < pay || nc < receive) throw new RoomError('交易一方资金不足')
    if (saved.take.some((r) => r.valueCP === null) || saved.give.some((r) => r.valueCP === null))
      throw new RoomError('交易价格未明确')
    for (const row of saved.basket.take) {
      const stock = n.stock.find((v) => v.id === row.stockId)!
      let item: InventoryItem = stock.inventoryState
        ? clone(stock.inventoryState)
        : {
            instanceId: randomUUID(),
            itemId: stock.itemId,
            quantity: row.quantity,
            source: '向' + n.name + '购买',
            equipped: false,
            note: '',
          }
      item = {
        ...item,
        instanceId:
          stock.inventoryState && row.quantity === stock.quantity
            ? stock.inventoryState.instanceId
            : randomUUID(),
        quantity: row.quantity,
        equipped: false,
        containerId: null,
        equipmentSlot: null,
        grip: null,
      }
      c.inventory.push(item)
      stock.quantity -= row.quantity
      if (stock.inventoryState) {
        if (stock.quantity) stock.inventoryState.quantity = stock.quantity
        else delete stock.inventoryState
      }
    }
    n.stock = n.stock.filter((s) => s.quantity > 0)
    for (const row of saved.basket.give) {
      const item = c.inventory.find((v) => v.instanceId === row.instanceId)!
      if (n.stock.length >= 100) throw new RoomError('商店库存栏已满，未进行交割')
      const value = saved.give.find((v) => v.id === row.instanceId)!.valueCP!
      n.stock.push({
        id: randomUUID(),
        itemId: item.itemId,
        quantity: row.quantity,
        priceGP: value / 100,
        inventoryState: {
          ...clone(item),
          instanceId: row.quantity === item.quantity ? item.instanceId : randomUUID(),
          quantity: row.quantity,
          equipped: false,
          containerId: null,
          equipmentSlot: null,
          grip: null,
        },
      })
      item.quantity -= row.quantity
    }
    c.inventory = c.inventory.filter((i) => i.quantity > 0)
    c.coins = sum([pc - pay, receive]) / 100
    if (seller) {
      seller.coins = sum([nc - receive, pay]) / 100
      seller.revision++
      seller.updatedAt = new Date().toISOString()
      seller.journal?.forEach((e) => (e.before = null))
    } else n.coins = sum([nc - receive, pay]) / 100
    if (saved.authorization === 'policy') n.preauthorization.remaining--
    c.revision++
    c.updatedAt = new Date().toISOString()
    c.journal?.forEach((e) => (e.before = null))
    validateInventory(c, cat)
    saved.status = 'committed'
    saved.reason = '已一次性交割；重复请求不会再次扣款'
    const event = appendBroadcast(adventure(next), saved.id, {
    message: systemMessage('trade.committed',{actor:c.build.name,npc:n.name}),
      category: 'interaction',
      type: 'trade.committed',
      title: '交易成交',
      text: c.build.name + '与' + n.name + '完成交易，物品与金币已交割。',
      sceneId: saved.sceneId,
      audience: { kind: 'personal', characterIds: [c.id] },
      facts: { characterId: c.id, npcId: n.id, tradeId: saved.id, adjudicated: true },
    })
    n.memory.push({
      id: randomUUID(),
      at: new Date().toISOString(),
      branchId: branch(next),
      characterId: c.id,
      visibility: 'personal',
      player:
        '已确认交易：' +
        saved.give.map((r) => r.name + '×' + r.quantity).join('、') +
        '；付出' +
        pay / 100 +
        'GP',
      reply:
        '已交付：' +
        saved.take.map((r) => r.name + '×' + r.quantity).join('、') +
        '；支付' +
        receive / 100 +
        'GP',
    })
    n.memory = n.memory.slice(-80)
    room.world = world
    room.worldRevision++
    return true
  }
  return true
}
export function projectTrades(
  room: Room,
  member: RoomMember,
  npcIds: readonly string[],
): TradeView {
  const a = adventure(room),
    cat = catalogue([srd, ...room.world.packs]),
    ownedItems = new Set(
      room.world.characters
        .filter((c) => member.role === 'gm' || member.characterIds.includes(c.id))
        .flatMap((c) => c.inventory.map((i) => i.itemId)),
    )
  return {
    shops: (a.ai?.npcs ?? [])
      .filter(
        (n) =>
          n.enabled &&
          !n.hidden &&
          n.sceneId === a.activeSceneId &&
          (!n.initiallyAbsent || n.appeared) &&
          !n.body?.dead &&
          n.attitude !== 'hostile' &&
          npcIds.includes(n.id) &&
          (n.merchantPolicy?.enabled ?? true) &&
          (n.stock.length || n.merchantPolicy?.buy),
      )
      .map((n) => ({
        npcId: n.id,
        name: n.name,
        buyRestricted: !!n.merchantPolicy?.buyItems.length,
        policy:
          member.role === 'gm'
            ? (n.merchantPolicy ?? defaultMerchant())
            : {
                ...(n.merchantPolicy ?? defaultMerchant()),
                buyItems: (n.merchantPolicy?.buyItems ?? []).filter((id) => ownedItems.has(id)),
                blockedItems: (n.merchantPolicy?.blockedItems ?? []).filter((id) =>
                  ownedItems.has(id),
                ),
              },
        stock: n.stock
          .filter((s) => s.quantity > 0 && !n.merchantPolicy?.blockedItems.includes(s.itemId))
          .map((s) => ({
            id: s.id ?? stockId(n, n.stock.indexOf(s)),
            itemId: s.itemId,
            name: s.inventoryState
              ? inventoryName(
                  s.inventoryState,
                  cat.items.find((i) => i.id === s.itemId)?.name ?? '已登记物品',
                )
              : (cat.items.find((i) => i.id === s.itemId)?.name ?? '缺少物品定义'),
            quantity: s.quantity,
            priceCP: copper(s.priceGP),
            special: !!s.inventoryState,
          })),
      })),
    sessions: clone(
      (a.trades?.sessions ?? [])
        .filter(
          (t) =>
            member.role === 'gm' ||
            (t.sessionId === member.id && member.characterIds.includes(t.characterId)),
        )
        .slice(-100),
    ),
  }
}
