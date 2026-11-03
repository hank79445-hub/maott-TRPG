import type { Spell } from './types'
import { spellEffect } from './combat-rules'
import { SPELL_AUDIT_RULES } from './spell-audit-rules'
import { isZoneSpell } from './ongoing-spells'

/** Rule facts, implementation routing, and acceptance are deliberately separate. */
export function spellAuditRow(spell: Spell) {
  const facts = SPELL_AUDIT_RULES[spell.id]
  if (!facts) throw new Error(`法术清单缺少明确规则事实：${spell.id}`)
  if (facts.catalogueText !== spell.description)
    throw new Error(`法术正文已变化，请重新核对清单：${spell.id}`)
  const profile = spellEffect(spell.id, 5, Math.max(1, spell.level))
  const candidate = !facts.categories.includes('pure-damage')
  const manual = profile.kind === 'manual'
  const zone = isZoneSpell(spell.id)
  const summon = ['summon-beast', 'summon-fey', 'summon-undead'].includes(spell.id)
  const specialRoute =
    spell.id === 'shield'
      ? 'reaction-shield：待结算窗口内校验触发攻击/魔法飞弹并登记护盾'
      : summon
        ? 'cast → spellSummon → 独立 companion actor / 紧随主人先攻；不进入通用 pending manual'
        : zone
          ? 'cast → PersistentZone（清空 pending）→ GM areaConfirmed → zone-trigger / resolve；区域持续、次数与弹药独立保存'
          : spell.id === 'lightning-arrow'
            ? 'cast → lightning-replacement / pending save → resolve；替换原攻击并分别记录原目标及范围豁免'
            : null
  const dimension = (id: string, requirement: unknown) => ({
    id: `${spell.id}/${id}`,
    requirement,
    status: 'unverified' as const,
    evidence: [] as string[],
  })
  return {
    id: spell.id,
    name: spell.name,
    english: spell.english,
    level: spell.level,
    source: spell.source,
    ruleSource: facts.ruleSource,
    candidate,
    classification: facts.categories[0],
    categories: facts.categories,
    classificationBasis:
      '逐规则 ID 显式分类；直接伤害含持续攻击/伤害区域；仅赋予武器加伤的增益归 support。纯伤害仍可能有多目标/多段伤害及特殊选型。',
    targetAndRange: { range: spell.range, rules: facts.targets },
    castingTime: spell.castingTime,
    components: spell.components,
    resources: {
      rules: facts.resources,
      slot:
        spell.level === 0
          ? '戏法不消耗法术位；仍检查合法来源、动作及成分。'
          : `基础 ${spell.level} 环；须校验实际可用来源及环位，仪式/免费来源分别核对。`,
      ritual: spell.ritual,
      limitation:
        '目录元数据与CHM表头同时保留；材料价格、耗材及触发条件需逐项验收，不能由扣位成功代替。',
    },
    duration: spell.duration,
    concentration: spell.concentration,
    ritual: spell.ritual,
    sourceHeader: facts.sourceHeader,
    rulesText: facts.sourceText,
    catalogueText: spell.description,
    contentNotes: facts.contentWarnings,
    currentProfile: profile,
    currentEntry:
      specialRoute ??
      (manual
        ? 'cast → pending manual → resolve(command.manual)，部分通用字段可写入'
        : `cast → ${profile.kind} → resolve；仅表示当前路由，不代表规则闭环`),
    routingEvidence: [
      {
        path: 'src/core/combat-rules.ts',
        symbol: 'spellEffect',
        fact: `spellEffect(${spell.id}, 5, ${Math.max(1, spell.level)}) 返回上列 currentProfile；仅抽样基础环及5级。`,
      },
      {
        path: 'src/core/combat.ts',
        symbol: 'cast / resolve',
        fact: '施法来源、动作预算、待结算对象与资源走服务器；具体法术约束仍须定向验证。',
      },
      ...(specialRoute
        ? [
            {
              path: 'src/core/combat.ts',
              symbol: zone
                ? 'isZoneSpell / zone-trigger'
                : summon
                  ? 'spellSummon / companion-power'
                  : spell.id === 'shield'
                    ? 'reaction-shield'
                    : 'lightning-replacement',
              fact: specialRoute,
            },
          ]
        : []),
      ...(manual && !specialRoute
        ? [
            {
              path: 'src/core/combat.ts',
              symbol: "p.kind === 'manual'",
              fact: 'command.manual 可提交伤害、治疗、单状态、回合、重复豁免、AC/速度修正及必填说明。不能表达任意场景事实或完整法术规则。',
            },
          ]
        : []),
    ],
    immunity: facts.immunity,
    savingThrows: facts.savingThrows,
    repeatAndEnd: facts.repeatAndEnd,
    upcasting: facts.upcasting,
    outsideCombat: {
      requirement: `按 ${facts.ruleSource.title} 的正文与表头游戏时长推进，保留来源、目标及每次触发；进入/离开战斗不是自然解除条件。`,
      ruleTriggers: facts.repeatAndEnd,
      status: '逐术战斗外操作与重连/读档未全部验收',
    },
    visibility: {
      rules: facts.visibility,
      policy:
        'GM/自身完整；其他玩家与NPC模型仅获得自身/可感知/明确授权事实。规则给予的特殊知情单独核对，不能直接公开来源和精确期限。',
      status: '逐术受众投影未全部验收',
    },
    automation: {
      status: 'partial-unverified',
      observedRoute: profile.kind,
      specialRoute,
      effectKey: profile.effect ?? null,
      limitation: 'profile、effectKey、代码分支或文本出现均只证明入口存在，不是通过验收。',
    },
    gmWorkflow: {
      status: specialRoute
        ? 'concrete-route-unverified'
        : manual
          ? 'partial-generic'
          : 'requires-spell-specific-verification',
      available: specialRoute
        ? [
            specialRoute,
            '存在专用可执行入口；目标/空间/时机由GM确认，仍须逐规则验证功能和保存恢复。',
          ]
        : manual
          ? [
              '选择施法及目标',
              'GM 提交 command.manual 有限结算字段和说明',
              '服务器应用支持的数值/状态并留记录',
            ]
          : ['GM 确认目标、空间和可感知事实；使用现有结算入口'],
      missing: facts.categories.includes('environment')
        ? [
            '场景几何/光照/遮蔽/幻象/触发条件不能由通用 manual 说明自动建立；需逐术验证具体操作和持久对象。',
          ]
        : facts.categories.includes('communication')
          ? [
              '须逐术验证收件人/可沟通类型/语言、私密传递、知识边界及持续资格；不能以普通聊天替代规则资格。',
            ]
          : ['须按本术正文逐项确认现有字段是否足以表达目标、豁免、效果、免疫和完整结束规则。'],
    },
    gaps: [
      `${spell.id}：合法目标/非法目标、动作/成分/耗材、免疫/抵抗尚无完整逐术验收证据。`,
      `${spell.id}：效果真实约束、持续/提前结束、升环、战斗外与保存读档尚无完整逐术验收证据。`,
      '通用GM说明文本不计为规则要求的具体操作完成；存在可执行入口也须验证对应规则与失败无部分改动。',
    ],
    dependencies: [
      ...(spell.concentration || spell.duration !== 'Instantaneous'
        ? ['来源型持续效果及游戏时间']
        : []),
      ...(facts.categories.includes('environment') ? ['场景空间/持久对象/触发记录'] : []),
      ...(facts.categories.includes('communication') ? ['沟通资格及私密受众'] : []),
      '服务器目标与资源校验',
      '权限投影',
    ],
    acceptance: [
      dimension('targets', facts.targets),
      dimension('resources', facts.resources),
      dimension('save-immunity', [...facts.savingThrows, ...facts.immunity]),
      dimension('actual-effect', facts.sourceText),
      dimension('repeat-end', facts.repeatAndEnd),
      dimension('upcast', facts.upcasting),
      dimension(
        'outside-save-reload',
        `${spell.id} 的目标/来源/期限/待结算在战斗外、切场景、重连及读档保留；动作资源去重。`,
      ),
      dimension('privacy', facts.visibility),
    ],
    inventoryStatus: 'CHM逐标题事实已归档；显式分类',
    status: '未完成逐术验收',
    tests: ['tests/v17-spell-audit.test.ts（仅清单结构/规则事实/漂移保护，不证明法术实现完成）'],
  }
}
