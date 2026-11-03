import type { Authoring } from '../persistence/script-authoring-schema'
import type { CompiledAuthoring } from './script-authoring'
import { AUTHORING_MODULES, type AuthoringModuleId } from './authoring-modules'
import {
  authoringRequirementWarnings,
  authoringRequirementsSchema,
  defaultAuthoringRequirements,
  type AuthoringRequirements,
} from './authoring-requirements'

export interface AuthoringFinding {
  module: AuthoringModuleId
  path: string
  message: string
}

/** Design warnings, never runtime authorization or claims that natural-language secrets are safe. */
export function authoringConfigurationFindings(source: Authoring): AuthoringFinding[] {
  const findings: AuthoringFinding[] = []
  const add = (module: AuthoringModuleId, path: string, message: string) =>
    findings.push({ module, path, message })
  const keyItems = new Set(
    source.scenes.flatMap((s) =>
      s.points.flatMap((p) => p.itemUse?.requirements.map((r) => r.itemId) ?? []),
    ),
  )
  for (const n of source.npcs) {
    const path = `npcs.${n.key}`
    if (n.merchantPolicy?.enabled) {
      const p = n.merchantPolicy
      if (p.buy && (n.coinsGP === 0 || (n.coinsGP === undefined && n.cardType !== 'character')))
        add(
          'commerce',
          path + '.coinsGP',
          `${n.name}允许收购但现金为0；现金收购会受限，若刻意纯易物请在GM说明中注明`,
        )
      else if (p.buy && n.coinsGP === undefined && n.cardType === 'character')
        add('commerce', path + '.coinsGP', `${n.name}商店沿用职业卡初始钱包；请核对实际金币与收购预算，不自动追加资金`)
      if (!n.stock?.some((row) => row.quantity > 0))
        add(
          'commerce',
          path + '.stock',
          `${n.name}没有可出售库存；请确认是仅收购／易物商人还是遗漏设计`,
        )
      if (p.autoPurchase)
        add(
          'commerce',
          path + '.merchantPolicy.autoPurchase',
          `${n.name}请求启用预授权购买，请GM核对价格和范围；这不是NPC台词免审`,
        )
      for (const row of n.stock ?? []) {
        if (row.priceGP === 0 && !p.zeroPrice)
          add('commerce', path + '.stock', `${n.name}的${row.itemId}标价0GP但未允许零价；请明确价格，不能用0代替未知价格`)
        if (Math.abs(row.priceGP * 100 - Math.round(row.priceGP * 100)) > 1e-6)
          add('commerce', path + '.stock', `${n.name}的${row.itemId}价格小于铜币精度，请核对两位GP小数`)
        if (keyItems.has(row.itemId) && !p.blockedItems.includes(row.itemId))
          add(
            'commerce',
            path + '.stock',
            `${n.name}库存包含关键互动条件物品${row.itemId}，未加入交易禁止清单；请核对剧情设计`,
          )
        if (n.consumables?.some((c) => c.itemId === row.itemId))
          add(
            'commerce',
            path + '.stock',
            `${n.name}的${row.itemId}同时出现在自身消耗品与出售库存；确认是分别持有，避免重复设计`,
          )
        if (
          n.character?.build.equipped &&
          Object.values(n.character.build.equipped).includes(row.itemId)
        )
          add(
            'commerce',
            path + '.stock',
            `${n.name}的${row.itemId}同时用于职业卡装备和出售库存，请核对独立数量`,
          )
      }
    }
    const k = n.knowledgeProfile
    if (
      k?.enabled &&
      (k.hiddenMembership ||
        k.templateIds.some((id) =>
          source.knowledgeDesign?.templates.some((t) => t.id === id && t.visibility === 'private'),
        ))
    )
      add(
        'knowledge',
        path + '.knowledgeProfile',
        `${n.name}关联私密知识或隐藏身份；请人工核对公开简介、口吻、广播及美术，程序不能保证自然语言完全不泄密`,
      )
    if (n.cardType === 'character' && n.consumables?.length)
      add(
        'characters',
        path + '.consumables',
        `${n.name}使用完整职业卡；施法材料与实际角色背包请在开团后核对，不能仅凭NPC简明消耗品代替`,
      )
  }
  for (const s of source.scenes) {
    const path = `scenes.${s.key}`
    if(s.fog?.mode==='enclosed'){
      if(!s.fog.areas?.length&&s.environment!=='outdoor')add('fog',path+'.fog.areas',`${s.name}未划封闭区域；整张地图的地形和普通标记将公开，请核对室内／混合区域`)
      for(const area of s.fog.areas??[])if(!area.initiallyRevealed&&!area.manualOnly&&!area.doorIds.length)add('fog',path+'.fog.areas',`${s.name}区域“${area.name}”没有边界门，核对实际入口／GM揭示`)
    }
    if (s.fog?.enabled && !s.spatialSetup)
      add('fog', path + '.fog', `${s.name}启用迷雾但未登记空间照度；开团需核对玩家感官和实际光源`)
    if (s.spatialSetup?.light === 'dark' || s.spatialSetup?.light === 'magical-darkness') {
      const light = s.effectSetup?.regions.some(
        (r) => !r.hidden && r.light && r.light.bright + r.light.dimExtra > 0,
      )
      if (!light)
        add(
          'fog',
          path + '.spatialSetup.light',
          `${s.name}为黑暗环境且无初始公开逻辑光源；核对黑暗视觉、魔法黑暗及携带照明，图片中的灯不代表实际光源`,
        )
    }
    for (const p of s.points) {
      if (p.itemUse && p.itemUse.fallback === 'none')
        add(
          'mechanisms',
          `${path}.points.${p.key}.itemUse`,
          `${s.name}/${p.name}无备用检定；核对所需物品的获得入口及失败替代路线`,
        )
    }
  }
  return findings
}

export function authoringConfiguredModules(source: Authoring): Record<AuthoringModuleId, number> {
  return {
    characters: source.npcs.filter((n) => n.cardType === 'character').length,
    knowledge:
      (source.knowledgeDesign?.factions.length ?? 0) +
      (source.knowledgeDesign?.templates.length ?? 0),
    commerce: source.npcs.filter((n) => n.merchantPolicy?.enabled).length,
    fog: source.scenes.filter((s) => s.fog?.enabled).length,
    space: source.scenes.filter((s) => s.spatialSetup).length,
    mechanisms:
      source.scenes.reduce(
        (v, s) =>
          v + (s.links?.length ?? 0) + s.points.filter((p) => p.itemUse || p.discovery).length,
        0,
      ) + (source.quests ?? []).reduce((v, q) => v + (q.steps?.length ?? 0), 0),
    magic: source.scenes.filter(
      (s) =>
        s.effectSetup &&
        (s.effectSetup.regions.length ||
          s.effectSetup.containers.length ||
          s.effectSetup.materials.length),
    ).length,
  }
}

export const AUTHORING_LAUNCH_CHECKLIST = [
  '确认玩家人数、1–5级规则范围、实际角色卡、入场落点与NPC占格；冒险等级不自动升级角色。',
  '检查各场景迷雾、照度、墙门阻隔、实际光源与玩家感官；初始公开格可以为空。GM全图不代表玩家可见。',
  '核对商店钱包、库存、价格、关键道具禁止交易、领取权限；按需确认预授权，台词免审不等于成交免审。',
  '核对NPC初始公私知识、组织成员及声望策略；模型、Mem0、QQ身份和Bot在开团后单独配置，不从创作包继承旧团历史。',
  '为需要旅行的NPC明确告知已知出口，核对高度与支撑；探索规划、移动与跨场景权限由GM单独设置。',
  '核对机关成功／失败、出场组、小目标和替代路线；推进、发奖及成长参考仍由GM确认。',
  '核对职业／模板能力、实际装备、昂贵材料与场景效果；G类结果留待GM，召唤须开团后合法施放，不伪造初始历史。',
  '检查生图底图不包含GM秘密、发现答案或黑雾；玩家视图需在导入后按实际角色核验。',
]

export function authoringReadiness(
  compiled: CompiledAuthoring,
  requirements: AuthoringRequirements,
) {
  const source = compiled.source,
    configured = authoringConfiguredModules(source)
  const validated = authoringRequirementsSchema.safeParse(requirements)
  const options = validated.success ? validated.data : defaultAuthoringRequirements()
  const modules = AUTHORING_MODULES.map((m) => ({
    id: m.id,
    label: m.label,
    count: configured[m.id],
    preference: options.modules[m.id],
    status:
      options.modules[m.id] === 'required' && !configured[m.id]
        ? '需求缺项'
        : configured[m.id]
          ? '已配置'
          : '未配置（可选）',
  }))
  const missing = modules
    .filter((m) => m.status === '需求缺项')
    .map((m) => `${m.label}：需求要求设计，但创作JSON尚未配置`)
  return {
    modules,
    warnings: [
      ...new Set([
        ...compiled.warnings,
        ...authoringRequirementWarnings(source, options),
        ...missing,
        ...(!validated.success
          ? ['结构化需求未通过校验：' + validated.error.issues.map((i) => i.message).join('；')]
          : []),
      ]),
    ],
    npcs: source.npcs.map((n, i) => {
      const compiledNpc = compiled.definition.npcs[i]
      const card = compiled.definition.characters.find((c) => c.id === compiledNpc?.characterId)
      return {
        key: n.key,
        name: n.name,
        scene: source.scenes.find((s) => s.key === n.scene)?.name ?? n.scene,
        card:
          n.cardType === 'character'
            ? `${n.character?.build.classId} · ${(n.character?.growth.length ?? 0) + 1}级完整职业卡`
            : `模板简明卡 · ${n.template}`,
        abilities: compiledNpc?.abilities.length ?? 0,
        preparedSpells: card?.initial.preparedSpells?.length ?? 0,
        equipment: card?.inventory.map((i) => `${i.itemId}×${i.quantity}`).join('、') ?? '',
        stock: n.stock?.reduce((a, r) => a + r.quantity, 0) ?? 0,
        stockRows: n.stock?.map((r) => `${r.itemId}×${r.quantity} · ${r.priceGP}GP`) ?? [],
        coins: card?.coins ?? compiledNpc?.coins ?? 0,
        merchant: !!n.merchantPolicy?.enabled,
        knowledge:
          n.knowledgeProfile?.templateIds.map((id) => {
            const t = source.knowledgeDesign?.templates.find((t) => t.id === id)
            return t
              ? `${t.name}（${t.layer}／${t.visibility === 'private' ? '私密' : '公开'}）`
              : id
          }) ?? [],
        faction:
          source.knowledgeDesign?.factions.find((f) => f.id === n.knowledgeProfile?.factionId)
            ?.name ?? '无组织',
      }
    }),
    scenes: source.scenes.map((s) => ({
      key: s.key,
      name: s.name,
      landing: `${s.landing.x},${s.landing.y}`,
      fog: s.fog?.enabled
        ? s.fog.mode==='enclosed'?`${s.fog.shared?'共享':'按角色'}封闭探索 · ${s.fog.areas?.length??0}区域 · 显示半径${s.fog.rangeFeet??60}尺`:`${s.fog.shared ? '共享' : '按角色'}迷雾 · 初始公开${s.fog.initial.length}格`
        : '未启用迷雾',
      light: s.spatialSetup?.light ?? '未指定照度',
      objects: s.spatialSetup?.objects.length ?? 0,
      effects: s.effectSetup?.regions.length ?? 0,
      containers: s.effectSetup?.containers.length ?? 0,
    })),
    containers: source.scenes.flatMap((s) =>
      s.points
        .filter((p) => p.kind === 'chest')
        .map((p) => ({
          key: s.key + '/' + p.key,
          name: s.name + ' / ' + p.name,
          content: p.container
            ? `${p.container.items.map((i) => `${i.itemId}×${i.quantity}`).join('、') || '无物品'} · ${p.container.coins}GP${p.container.emptyReason ? ' · 刻意为空' : ''}`
            : '未配置战利品（旧JSON兼容）',
          condition:
            p.itemUse?.requirements
              .map((r) => `${r.itemId}×${r.quantity}（${r.mode}）`)
              .join('、') || '无物品条件',
        })),
    ),
    interactions: source.scenes.flatMap((s) =>
      s.points
        .filter(
          (p) =>
            p.check ||
            p.itemUse ||
            p.arrivalGroup ||
            p.failureArrivalGroup ||
            p.exit ||
            p.rescueNpc ||
            p.battle ||
            s.links?.some((l) => l.source === p.key),
        )
        .map((p) => ({
          key: `${s.key}/${p.key}`,
          name: `${s.name} / ${p.name}`,
          condition:
            [
              p.check ? `${p.check.skill} DC${p.check.dc}` : '',
              p.itemUse
                ? p.itemUse.requirements
                    .map((r) => `${r.itemId}×${r.quantity}（${r.mode}）`)
                    .join('、')
                : '',
            ]
              .filter(Boolean)
              .join('；') || '普通互动，按原规则确认',
          success:
            [
              p.arrivalGroup ? `出场：${p.arrivalGroup}` : '',
              p.rescueNpc ? `解救NPC：${p.rescueNpc}（须GM确认）` : '',
              p.battle ? `战斗预设：${p.battle}（须GM配置参战者）` : '',
              ...(s.links
                ?.filter((l) => l.source === p.key && l.outcome === 'success')
                .map(
                  (l) =>
                    `${l.name}→${[...l.effects.map((e) => e.operation + ':' + e.point), ...(l.arrivalGroups?.map((id) => '出场:' + id) ?? [])].join('、')}`,
                ) ?? []),
              p.exit ? `出口→${p.exit.scene}/${p.exit.point}` : '',
            ]
              .filter(Boolean)
              .join('；') || '无额外结构效果',
          failure:
            [
              p.failureArrivalGroup ? `出场：${p.failureArrivalGroup}` : '',
              ...(s.links
                ?.filter((l) => l.source === p.key && l.outcome === 'failure')
                .map((l) => l.name) ?? []),
            ]
              .filter(Boolean)
              .join('；') || '无额外结构效果',
          quests: (source.quests ?? [])
            .flatMap((q) =>
              (q.steps ?? [])
                .filter((step) => step.scene === s.key && step.point === p.key)
                .map((step) => `${q.title} / ${step.title}（仅建议推进）`),
            )
            .join('；'),
        })),
    ),
    checklist: [...AUTHORING_LAUNCH_CHECKLIST],
  }
}

export function authoringLaunchText(
  compiled: CompiledAuthoring,
  requirements: AuthoringRequirements,
) {
  const r = authoringReadiness(compiled, requirements)
  return [
    `# ${compiled.source.title} · GM开团检查清单`,
    '这是制作时设计摘要，不是实际玩家视野验证或运行权限授权。',
    ...r.modules.map((m) => `- ${m.label}：${m.status}（${m.count}）`),
    '',
    '## 需核对事项',
    ...r.warnings.map((w) => `- ${w}`),
    '',
    '## 开团交接',
    ...r.checklist.map((s) => `- [ ] ${s}`),
  ].join('\n')
}
