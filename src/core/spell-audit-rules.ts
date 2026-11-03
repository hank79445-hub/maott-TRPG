/** Explicit current 0–3 inventory facts from the supplied 2024 CHM (GB18030).
 * Classification is an ID-level editorial decision, never inferred from a runtime profile.
 * Quoted rule clauses are evidence; they are not implementation/acceptance claims.
 * Catalogue text is pinned to expose drift; review facts before updating a changed spell.
 */
export interface SpellAuditFacts {
  categories: string[]
  catalogueText: string
  ruleSource: { edition: string; path: string; anchor?: string; title: string; encoding: string }
  sourceHeader: string[]
  sourceText: string
  targets: string[]
  resources: string[]
  savingThrows: string[]
  immunity: string[]
  repeatAndEnd: string[]
  upcasting: string[]
  visibility: string[]
  contentWarnings: string[]
}
export const SPELL_AUDIT_RULES: Record<string, SpellAuditFacts> = {
  'acid-splash': {
    categories: ['pure-damage'],
    catalogueText:
      'You create an acidic bubble at a point within range, where it explodes in a 5-foot-radius Sphere. Each creature in that Sphere must succeed on a Dexterity saving throw or take 1d6 Acid damage. Cantrip Upgrade. The damage increases by 1d6 when you reach levels 5 (2d6), 11 (3d6), and 17 (4d6).',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Acid_Splash',
      title: '酸液飞溅｜Acid Splash',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '塑能 戏法（术士、法师、奇械师）',
      '施法时间：动作',
      '施法距离：60 尺',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你在施法距离内一点创造出一颗酸液泡，以该点5尺球状范围爆发。该球状区域内的每名生物必须通过一次敏捷豁免，否则受到1d6点强酸伤害。 戏法强化。本法术的伤害会在你达到下列等级时提升1d6：5级（2d6）、11级（3d6）以及17级（4d6）。',
    targets: [
      '你在施法距离内一点创造出一颗酸液泡，以该点5尺球状范围爆发。',
      '该球状区域内的每名生物必须通过一次敏捷豁免，否则受到1d6点强酸伤害。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: ['该球状区域内的每名生物必须通过一次敏捷豁免，否则受到1d6点强酸伤害。'],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: [
      '戏法强化。',
      '本法术的伤害会在你达到下列等级时提升1d6：5级（2d6）、11级（3d6）以及17级（4d6）。',
    ],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  alarm: {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'You set an alarm against intrusion. Choose a door, a window, or an area within range that is no larger than a 20-foot Cube. Until the spell ends, an alarm alerts you whenever a creature touches or enters the warded area. When you cast the spell, you can designate creatures that won’t set off the alarm. You also choose whether the alarm is audible or mental: Audible Alarm. The alarm produces the sound of a handbell for 10 seconds within 60 feet of the warded area. Mental Alarm. You are alerted by a mental ping if you are within 1 mile of the warded area. This ping awakens you if you’re asleep.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Alarm',
      title: '警报术｜Alarm',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 防护（游侠、法师、奇械师）',
      '施法时间：1 分钟或仪式',
      '施法距离：30 尺',
      '法术成分：V、S、M（一个小铃铛和一小段银线）',
      '持续时间：8 小时',
    ],
    sourceText:
      '你设置一个针对不速之客的警报。在施法距离内指定一扇门窗或选择一个边长不大于20 尺的立方区域。在法术持续时间内，任何触碰或进入被法术保护区域的生物都会触发警报。施法时，你可以决定哪些生物不会触发警报，还可以选择警报方式为声音警报或是精神警报。 声音警报Audible Alarm。警报将在其保护区域 60 尺范围内响起持续 10 秒的摇铃声。 精神警报Mental Alarm。 如果你距离目标区域不超过 1 里，警报会在你脑海中会传来“乒”的警报声。如果你在睡觉，则警报将使你惊醒。',
    targets: [
      '在施法距离内指定一扇门窗或选择一个边长不大于20 尺的立方区域。',
      '在法术持续时间内，任何触碰或进入被法术保护区域的生物都会触发警报。',
      '施法时，你可以决定哪些生物不会触发警报，还可以选择警报方式为声音警报或是精神警报。',
      '警报将在其保护区域 60 尺范围内响起持续 10 秒的摇铃声。',
      '如果你距离目标区域不超过 1 里，警报会在你脑海中会传来“乒”的警报声。',
    ],
    resources: ['施法时间：1 分钟或仪式', '法术成分：V、S、M（一个小铃铛和一小段银线）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '如果你距离目标区域不超过 1 里，警报会在你脑海中会传来“乒”的警报声。',
      '如果你在睡觉，则警报将使你惊醒。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '施法时，你可以决定哪些生物不会触发警报，还可以选择警报方式为声音警报或是精神警报。',
      '声音警报Audible Alarm。',
      '精神警报Mental Alarm。',
    ],
    contentWarnings: [],
  },
  'animal-friendship': {
    categories: ['non-damage', 'condition'],
    catalogueText:
      'Target a Beast that you can see within range. The target must succeed on a Wisdom saving throw or have the Charmed condition for the duration. If you or one of your allies deals damage to the target, the spells ends. Using a Higher-Level Spell Slot. You can target one additional Beast for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Animal_Friendship',
      title: '化兽为友｜Animal Friendship',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 惑控（吟游诗人、德鲁伊、游侠）',
      '施法时间：动作',
      '施法距离：30 尺',
      '法术成分：V、S、M（一点食物）',
      '持续时间：24 小时',
    ],
    sourceText:
      '在施法距离内指定一只你能看见的野兽。该野兽必须通过一次感知豁免，否则在法术持续时间内陷入魅惑状态。如果你或你的盟友对目标造成伤害，法术将提前终止。 升环施法。你使用的法术位每比一环高一环，就可以多选择一个野兽作为目标。',
    targets: [
      '在施法距离内指定一只你能看见的野兽。',
      '如果你或你的盟友对目标造成伤害，法术将提前终止。',
      '你使用的法术位每比一环高一环，就可以多选择一个野兽作为目标。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一点食物）'],
    savingThrows: ['该野兽必须通过一次感知豁免，否则在法术持续时间内陷入魅惑状态。'],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['如果你或你的盟友对目标造成伤害，法术将提前终止。'],
    upcasting: ['升环施法。', '你使用的法术位每比一环高一环，就可以多选择一个野兽作为目标。'],
    visibility: [
      '在施法距离内指定一只你能看见的野兽。',
      '该野兽必须通过一次感知豁免，否则在法术持续时间内陷入魅惑状态。',
    ],
    contentWarnings: [],
  },
  bane: {
    categories: ['non-damage', 'support'],
    catalogueText:
      'Up to three creatures of your choice that you can see within range must each make a Charisma saving throw. Whenever a target that fails this save makes an attack roll or a saving throw before the spell ends, the target must subtract 1d4 from the attack roll or save. Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Bane',
      title: '灾祸术｜Bane',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 惑控（吟游诗人、牧师、魔契师）',
      '施法时间：动作',
      '施法距离：30尺',
      '法术成分：V、S、M（一滴血）',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '你选择施法距离内至多三个你可见的生物，迫使其分别进行一次魅力豁免。在法术终止前，豁免失败于此次魅力豁免的目标进行的每次攻击检定与豁免检定都必须承受1d4的减值。 升环施法。使用的法术位每比一环高一环，你就可以额外选择一个生物作为目标。',
    targets: [
      '你选择施法距离内至多三个你可见的生物，迫使其分别进行一次魅力豁免。',
      '在法术终止前，豁免失败于此次魅力豁免的目标进行的每次攻击检定与豁免检定都必须承受1d4的减值。',
      '使用的法术位每比一环高一环，你就可以额外选择一个生物作为目标。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一滴血）'],
    savingThrows: [
      '你选择施法距离内至多三个你可见的生物，迫使其分别进行一次魅力豁免。',
      '在法术终止前，豁免失败于此次魅力豁免的目标进行的每次攻击检定与豁免检定都必须承受1d4的减值。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '在法术终止前，豁免失败于此次魅力豁免的目标进行的每次攻击检定与豁免检定都必须承受1d4的减值。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，你就可以额外选择一个生物作为目标。'],
    visibility: ['你选择施法距离内至多三个你可见的生物，迫使其分别进行一次魅力豁免。'],
    contentWarnings: [],
  },
  bless: {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You bless up to three creatures within range. Whenever a target makes an attack roll or a saving throw before the spell ends, the target adds 1d4 to the attack roll or save. Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Bless',
      title: '祝福术｜Bless',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 惑控（牧师、圣武士）',
      '施法时间：动作',
      '施法距离：30尺',
      '法术成分：V、S、M（一枚价值5+GP的圣徽）',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '你祝福施法范围内至多三个生物。在法术终止前，受术目标进行的每次攻击检定与豁免检定都将获得1d4的加值。 升环施法。使用的法术位每比一环高一环，你就可以额外选择一个生物作为目标。',
    targets: [
      '你祝福施法范围内至多三个生物。',
      '在法术终止前，受术目标进行的每次攻击检定与豁免检定都将获得1d4的加值。',
      '使用的法术位每比一环高一环，你就可以额外选择一个生物作为目标。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一枚价值5+GP的圣徽）'],
    savingThrows: ['在法术终止前，受术目标进行的每次攻击检定与豁免检定都将获得1d4的加值。'],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['在法术终止前，受术目标进行的每次攻击检定与豁免检定都将获得1d4的加值。'],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，你就可以额外选择一个生物作为目标。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'burning-hands': {
    categories: ['damage-with-rider', 'environment'],
    catalogueText:
      'A thin sheet of flames shoots forth from you. Each creature in a 15-foot Cone makes a Dexterity saving throw, taking 3d6 Fire damage on a failed save or half as much damage on a successful one. Flammable objects in the Cone that aren’t being worn or carried start burning. Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Burning_Hands',
      title: '燃烧之手｜Burning Hands',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 塑能（术士、法师）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你向前喷射出一片火焰。处于15尺锥状区域内的生物必须进行一次敏捷豁免。豁免失败者受到3d6火焰伤害，豁免成功者受到一半伤害。 在此锥状区域内的未被着装或携带的易燃物件会开始燃烧。 升环施法。你使用的法术位每比一环高一环，此法术的伤害就会提升1d6。',
    targets: [
      '处于15尺锥状区域内的生物必须进行一次敏捷豁免。',
      '在此锥状区域内的未被着装或携带的易燃物件会开始燃烧。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '处于15尺锥状区域内的生物必须进行一次敏捷豁免。',
      '豁免失败者受到3d6火焰伤害，豁免成功者受到一半伤害。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['升环施法。', '你使用的法术位每比一环高一环，此法术的伤害就会提升1d6。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'charm-person': {
    categories: ['non-damage', 'condition'],
    catalogueText:
      'One Humanoid you can see within range makes a Wisdom saving throw. It does so with Advantage if you or your allies are fighting it. On a failed save, the target has the Charmed condition until the spell ends or until you or your allies damage it. The Charmed creature is Friendly to you. When the spell ends, the target knows it was Charmed by you. Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Charm_Person',
      title: '魅惑类人｜Charm Person',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 惑控（吟游诗人、德鲁伊、术士、魔契师、法师）',
      '施法时间：动作',
      '施法距离：30 尺',
      '法术成分：V、S',
      '持续时间：1 小时',
    ],
    sourceText:
      '选择法术距离内你可见的一名类人生物，迫使该生物进行一次感知豁免，如果你或者你的同伴正在与它战斗，它进行的这次豁免将具有优势。如果它豁免失败，它陷入魅惑状态直到法术结束，或者直到你或你的同伴对它造成伤害。被魅惑的生物将对你友好。在法术结束时，生物会知道它曾被你魅惑。 升环施法。使用的法术位每比一环高一环，你就可以额外选择一个生物作为目标。',
    targets: [
      '选择法术距离内你可见的一名类人生物，迫使该生物进行一次感知豁免，如果你或者你的同伴正在与它战斗，它进行的这次豁免将具有优势。',
      '被魅惑的生物将对你友好。',
      '在法术结束时，生物会知道它曾被你魅惑。',
      '使用的法术位每比一环高一环，你就可以额外选择一个生物作为目标。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '选择法术距离内你可见的一名类人生物，迫使该生物进行一次感知豁免，如果你或者你的同伴正在与它战斗，它进行的这次豁免将具有优势。',
      '如果它豁免失败，它陷入魅惑状态直到法术结束，或者直到你或你的同伴对它造成伤害。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '选择法术距离内你可见的一名类人生物，迫使该生物进行一次感知豁免，如果你或者你的同伴正在与它战斗，它进行的这次豁免将具有优势。',
      '如果它豁免失败，它陷入魅惑状态直到法术结束，或者直到你或你的同伴对它造成伤害。',
      '在法术结束时，生物会知道它曾被你魅惑。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，你就可以额外选择一个生物作为目标。'],
    visibility: [
      '选择法术距离内你可见的一名类人生物，迫使该生物进行一次感知豁免，如果你或者你的同伴正在与它战斗，它进行的这次豁免将具有优势。',
      '在法术结束时，生物会知道它曾被你魅惑。',
    ],
    contentWarnings: [],
  },
  'chill-touch': {
    categories: ['damage-with-rider'],
    catalogueText:
      'Channeling the chill of the grave, make a melee spell attack against a target within reach. On a hit, the target takes 1d10 Necrotic damage, and it can’t regain Hit Points until the end of your next turn. Cantrip Upgrade. The damage increases by 1d10 when you reach levels 5 (2d10), 11 (3d10), and 17 (4d10).',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Chill_Touch',
      title: '颤栗之触｜Chill Touch',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '死灵 戏法（术士、魔契师、法师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你引导出来自坟墓的刺骨阴冷，对目标进行一次近战法术攻击。命中时，目标将受到1d10点暗蚀伤害，并且直至你下一回合的结束前都无法恢复生命值。 戏法强化。 法术的伤害会在你到达下列等级时增加1d10：5级（2d10）、11级（3d10）以及17级（4d10）。',
    targets: [
      '你引导出来自坟墓的刺骨阴冷，对目标进行一次近战法术攻击。',
      '命中时，目标将受到1d10点暗蚀伤害，并且直至你下一回合的结束前都无法恢复生命值。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '命中时，目标将受到1d10点暗蚀伤害，并且直至你下一回合的结束前都无法恢复生命值。',
    ],
    upcasting: [
      '戏法强化。',
      '法术的伤害会在你到达下列等级时增加1d10：5级（2d10）、11级（3d10）以及17级（4d10）。',
    ],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'chromatic-orb': {
    categories: ['pure-damage'],
    catalogueText:
      'You hurl an orb of energy at a target within range. Choose Acid, Cold, Fire, Lightning, Poison, or Thunder for the type of orb you create, and then make a ranged spell attack against the target. On a hit, the target takes 3d8 damage of the chosen type. If you roll the same number on two or more of the d8s, the orb leaps to a different target of your choice within 30 feet of the target. Make an attack roll against the new target, and make a new damage roll. The orb can’t leap again unless you cast the spell with a level 2+ spell slot. Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 1. The orb can leap a maximum number of times equal to the level of the slot expended, and a creature can be targeted only once by each casting of this spell.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Chromatic_Orb',
      title: '繁彩球｜Chromatic Orb',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 塑能（术士、法师）',
      '施法时间：动作',
      '施法距离：90 尺',
      '法术成分： V、S、M（一枚价值50GP+的钻石）',
      '持续时间：立即',
    ],
    sourceText:
      '你向施法距离内某个目标掷出一颗能量球。从强酸、寒冷、火焰、闪电、毒素、雷鸣中选择一个作为创造出来的球体的伤害类型，然后对该目标发动一次远程法术攻击。命中时，该目标将受到 3d8 点你所选类型的伤害。 如果你的d8骰中有两枚（或更多）投出了相同的数字，能量球将会从原目标跃向其周围30尺内由你所选择的另一个目标。你需要对新目标再进行一次攻击检定，然后进行一次新的伤害掷骰。能量球无法再次进行此种跳跃，除非你施展此法术时使用了环阶2+的法术位。 升环施法。使用的法术位每高一环，法术的伤害就增加1d8。能量球能够跳跃的最大次数等同于所消耗的法术位环阶，但每次施展此法术时，每名生物只能被指定为此法术目标一次。',
    targets: [
      '你向施法距离内某个目标掷出一颗能量球。',
      '从强酸、寒冷、火焰、闪电、毒素、雷鸣中选择一个作为创造出来的球体的伤害类型，然后对该目标发动一次远程法术攻击。',
      '命中时，该目标将受到 3d8 点你所选类型的伤害。',
      '如果你的d8骰中有两枚（或更多）投出了相同的数字，能量球将会从原目标跃向其周围30尺内由你所选择的另一个目标。',
      '你需要对新目标再进行一次攻击检定，然后进行一次新的伤害掷骰。',
      '能量球能够跳跃的最大次数等同于所消耗的法术位环阶，但每次施展此法术时，每名生物只能被指定为此法术目标一次。',
    ],
    resources: ['施法时间：动作', '法术成分： V、S、M（一枚价值50GP+的钻石）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '如果你的d8骰中有两枚（或更多）投出了相同的数字，能量球将会从原目标跃向其周围30尺内由你所选择的另一个目标。',
      '能量球无法再次进行此种跳跃，除非你施展此法术时使用了环阶2+的法术位。',
      '能量球能够跳跃的最大次数等同于所消耗的法术位环阶，但每次施展此法术时，每名生物只能被指定为此法术目标一次。',
    ],
    upcasting: [
      '能量球无法再次进行此种跳跃，除非你施展此法术时使用了环阶2+的法术位。',
      '升环施法。',
      '使用的法术位每高一环，法术的伤害就增加1d8。',
      '能量球能够跳跃的最大次数等同于所消耗的法术位环阶，但每次施展此法术时，每名生物只能被指定为此法术目标一次。',
    ],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'color-spray': {
    categories: ['non-damage', 'condition'],
    catalogueText:
      'You launch a dazzling array of flashing, colorful light. Each creature in a 15-foot Cone originating from you must succeed on a Constitution saving throw or have the Blinded condition until the end of your next turn.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Color_Spray',
      title: '七彩喷射｜Color Spray',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 幻术（吟游诗人、术士、法师）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、S、M（一撮彩色沙子）',
      '持续时间：立即',
    ],
    sourceText:
      '你射出一道炫目的闪耀彩光。以你为源点的15尺锥状区域内的每个生物必须成功通过一次体质豁免，否则陷入目盲状态，持续至下个你的回合结束。',
    targets: [
      '以你为源点的15尺锥状区域内的每个生物必须成功通过一次体质豁免，否则陷入目盲状态，持续至下个你的回合结束。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一撮彩色沙子）'],
    savingThrows: [
      '以你为源点的15尺锥状区域内的每个生物必须成功通过一次体质豁免，否则陷入目盲状态，持续至下个你的回合结束。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '以你为源点的15尺锥状区域内的每个生物必须成功通过一次体质豁免，否则陷入目盲状态，持续至下个你的回合结束。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '以你为源点的15尺锥状区域内的每个生物必须成功通过一次体质豁免，否则陷入目盲状态，持续至下个你的回合结束。',
    ],
    contentWarnings: [],
  },
  command: {
    categories: ['non-damage', 'condition'],
    catalogueText:
      'You speak a one-word command to a creature you can see within range. The target must succeed on a Wisdom saving throw or follow the command on its next turn. Choose the command from these options: Approach. The target moves toward you by the shortest and most direct route, ending its turn if it moves within 5 feet of you. Drop. The target drops whatever it is holding and then ends its turn. Flee. The target spends its turn moving away from you by the fastest available means. Grovel. The target has the Prone condition and then ends its turn. Halt. On its turn, the target doesn’t move and takes no action or Bonus Action. Using a Higher-Level Spell Slot. You can affect one additional creature for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Command',
      title: '命令术｜Command',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 惑控（吟游诗人、牧师、圣武士）',
      '施法时间：动作',
      '施法距离：60 尺',
      '法术成分：V',
      '持续时间：立即',
    ],
    sourceText:
      '你对施法距离内一个你能看见的生物说出一个单词的命令。目标生物必须通过一次感知豁免，否则在它自己的下一回合中，其必须服从这道命令行事。从以下选项中选择一条命令： 过来Approach。目标以最短最直接的路线向你移动，若其到达你5尺范围内，其会结束自己的回合。 放下Drop。目标放下持握的任何东西，然后结束自己的回合。 走开Flee。目标消耗其整个回合，以最快最有效的方式远离你。 趴下Grovel。目标陷入倒地状态并结束自己的回合。 立定Halt。在其回合内，目标不进行移动且不作任何动作和附赠动作。 升环施法。使用的法术位每比一环高一环，你就可以额外选择一个生物作为目标。',
    targets: [
      '你对施法距离内一个你能看见的生物说出一个单词的命令。',
      '目标生物必须通过一次感知豁免，否则在它自己的下一回合中，其必须服从这道命令行事。',
      '从以下选项中选择一条命令： 过来Approach。',
      '目标以最短最直接的路线向你移动，若其到达你5尺范围内，其会结束自己的回合。',
      '目标放下持握的任何东西，然后结束自己的回合。',
      '目标消耗其整个回合，以最快最有效的方式远离你。',
      '目标陷入倒地状态并结束自己的回合。',
      '在其回合内，目标不进行移动且不作任何动作和附赠动作。',
      '使用的法术位每比一环高一环，你就可以额外选择一个生物作为目标。',
    ],
    resources: ['施法时间：动作', '法术成分：V'],
    savingThrows: [
      '目标生物必须通过一次感知豁免，否则在它自己的下一回合中，其必须服从这道命令行事。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '目标生物必须通过一次感知豁免，否则在它自己的下一回合中，其必须服从这道命令行事。',
      '目标以最短最直接的路线向你移动，若其到达你5尺范围内，其会结束自己的回合。',
      '目标放下持握的任何东西，然后结束自己的回合。',
      '目标消耗其整个回合，以最快最有效的方式远离你。',
      '目标陷入倒地状态并结束自己的回合。',
      '在其回合内，目标不进行移动且不作任何动作和附赠动作。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，你就可以额外选择一个生物作为目标。'],
    visibility: [
      '你对施法距离内一个你能看见的生物说出一个单词的命令。',
      '目标生物必须通过一次感知豁免，否则在它自己的下一回合中，其必须服从这道命令行事。',
    ],
    contentWarnings: [],
  },
  'comprehend-languages': {
    categories: ['non-damage', 'communication'],
    catalogueText:
      'For the duration, you understand the literal mean- ing of any language that you hear or see signed. You also understand any written language that you see, but you must be touching the surface on which the words are written. It takes about 1 minute to read one page of text. This spell doesn’t decode symbols or secret messages.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Comprehend_Languages',
      title: '通晓语言｜Comprehend Languages',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 预言（吟游诗人、术士、魔契师、法师）',
      '施法时间：动作或仪式',
      '施法距离：自身',
      '法术成分：V、S、M（一撮煤灰和盐）',
      '持续时间：1 小时',
    ],
    sourceText:
      '你在法术持续时间内知晓你所听到或看到手语的所有语言的字面意义。你也可以通过触碰书写的文字来读懂其字面意义。以这种方式阅读每页文字需要花费 1 分钟的时间。这个法术并不能解读符号和暗语。',
    targets: ['你也可以通过触碰书写的文字来读懂其字面意义。'],
    resources: ['施法时间：动作或仪式', '法术成分：V、S、M（一撮煤灰和盐）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['你在法术持续时间内知晓你所听到或看到手语的所有语言的字面意义。'],
    contentWarnings: [],
  },
  'create-or-destroy-water': {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'You do one of the following: Create Water. You create up to 10 gallons of clean water within range in an open container. Alternatively, the water falls as rain in a 30-foot Cube within range, extinguishing exposed flames there. Destroy Water. You destroy up to 10 gallons of water in an open container within range. Alternatively, you destroy fog in a 30-foot Cube within range. Using a Higher-Level Spell Slot. You create or destroy 10 additional gallons of water, or the size of the Cube increases by 5 feet, for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Create_or_Destroy_Water',
      title: '造水术/枯水术｜Create or Destroy Water',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 变化（牧师、德鲁伊）',
      '施法时间：动作',
      '施法距离：30尺',
      '法术成分：V、S、M（水沙混合物）',
      '持续时间：立即',
    ],
    sourceText:
      '你选择其一执行： 造水术Create Water。你在施法距离内一个打开的容器中创造至多10加仑干净的水。作为另一种选项，你使施法距离内一处30尺的立方区域降下雨水并浇灭区域内不受遮盖的火焰。 枯水术Destroy Water。你使施法距离内一个打开的容器里至多10加仑水枯竭不见。作为另一种选项，你使施法距离内一片30尺立方 区域的浓雾消失不见。 升环施法。 使用的法术位每比一环高一环，法术就多创造或多枯竭10加仑额外的水分，另一种选项能影响的立方 区域边长增加5尺。',
    targets: [
      '你选择其一执行： 造水术Create Water。',
      '你在施法距离内一个打开的容器中创造至多10加仑干净的水。',
      '作为另一种选项，你使施法距离内一处30尺的立方区域降下雨水并浇灭区域内不受遮盖的火焰。',
      '你使施法距离内一个打开的容器里至多10加仑水枯竭不见。',
      '作为另一种选项，你使施法距离内一片30尺立方 区域的浓雾消失不见。',
      '使用的法术位每比一环高一环，法术就多创造或多枯竭10加仑额外的水分，另一种选项能影响的立方 区域边长增加5尺。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（水沙混合物）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['作为另一种选项，你使施法距离内一片30尺立方 区域的浓雾消失不见。'],
    upcasting: [
      '升环施法。',
      '使用的法术位每比一环高一环，法术就多创造或多枯竭10加仑额外的水分，另一种选项能影响的立方 区域边长增加5尺。',
    ],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'cure-wounds': {
    categories: ['non-damage', 'healing'],
    catalogueText:
      'A creature you touch regains a number of Hit Points equal to 2d8 plus your spellcasting ability modifier. Using a Higher-Level Spell Slot. The healing in- creases by 2d8 for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Cure_Wounds',
      title: '疗伤术｜Cure Wounds',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 防护（吟游诗人、牧师、德鲁伊、圣武士、游侠、奇械师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你触碰的一名生物恢复等同于2d8+你施法属性调整值点生命值。 升环施法。使用的法术位每比一环高一环，此法术的治疗量就增加2d8点。',
    targets: [
      '你触碰的一名生物恢复等同于2d8+你施法属性调整值点生命值。',
      '使用的法术位每比一环高一环，此法术的治疗量就增加2d8点。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，此法术的治疗量就增加2d8点。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'dancing-lights': {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'You create up to four torch-size lights within range, making them appear as torches, lanterns, or glowing orbs that hover for the duration. Alternatively, you combine the four lights into one glowing Medium form that is vaguely humanlike. Whichever form you choose, each light sheds Dim Light in a 10- foot radius. As a Bonus Action, you can move the lights up to 60 feet to a space within range. A light must be within 20 feet of another light created by this spell, and a light vanishes if it exceeds the spell’s range.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Dancing_Lights',
      title: '舞光术｜Dancing Lights',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '幻术 戏法（吟游诗人、术士、法师、奇械师）',
      '施法时间：动作',
      '施法距离：120尺',
      '法术成分：V、S、M（一点磷）',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '你在施法距离内创造至多四个火把大小的光源，使其在法术持续时间内看起来如同火把、灯笼或悬浮珠。或者，你可以将四个光源合并为一个发光的整体形态，使其看上去像一个模糊的中型人形。无论你选择哪种形态，每个光源都会发出10尺半径的微光光照 。 你可以用附赠动作将光源移动至多60尺至施法距离内的一处空间。一个由此法术创造的光源必须始终位于任一光源周围20尺内，而超出施法距离的光源会随即熄灭。',
    targets: [
      '你在施法距离内创造至多四个火把大小的光源，使其在法术持续时间内看起来如同火把、灯笼或悬浮珠。',
      '无论你选择哪种形态，每个光源都会发出10尺半径的微光光照 。',
      '你可以用附赠动作将光源移动至多60尺至施法距离内的一处空间。',
      '一个由此法术创造的光源必须始终位于任一光源周围20尺内，而超出施法距离的光源会随即熄灭。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一点磷）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['无论你选择哪种形态，每个光源都会发出10尺半径的微光光照 。'],
    contentWarnings: [],
  },
  'detect-evil-and-good': {
    categories: ['non-damage', 'perception'],
    catalogueText:
      'For the duration, you sense the location of any Aberration, Celestial, Elemental, Fey, Fiend, or Undead within 30 feet of yourself. You also sense whether the Hallow spell is active there and, if so, where. The spell is blocked by 1 foot of stone, dirt, or wood; 1 inch of metal; or a thin sheet of lead.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Detect_Evil_and_Good',
      title: '侦测善恶｜Detect Evil and Good',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 预言（牧师、圣武士）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、S',
      '持续时间：专注，至多10分钟',
    ],
    sourceText:
      '在法术持续时间内，你定位距你30尺内任何异怪、天族、元素、妖精、邪魔、亡灵。你也可以感知到范围内是否具有激活的圣居Hallow并确定其位置。 此法术会被1尺厚的岩石、泥土或木头，1寸厚的金属，或薄薄一层铅阻隔。',
    targets: ['你也可以感知到范围内是否具有激活的圣居Hallow并确定其位置。'],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['你也可以感知到范围内是否具有激活的圣居Hallow并确定其位置。'],
    contentWarnings: [],
  },
  'detect-magic': {
    categories: ['non-damage', 'perception'],
    catalogueText:
      'For the duration, you sense the presence of magical effects within 30 feet of yourself. If you sense such effects, you can take the Magic action to see a faint aura around any visible creature or object in the area that bears the magic, and if an effect was created by a spell, you learn the spell’s school of magic. The spell is blocked by 1 foot of stone, dirt, or wood; 1 inch of metal; or a thin sheet of lead.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Detect_Magic',
      title: '侦测魔法｜Detect Magic',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 预言（吟游诗人、牧师、德鲁伊、圣武士、游侠、术士、魔契师、法师、奇械师）',
      '施法时间：动作或仪式',
      '施法距离：自身',
      '法术成分：V、S',
      '持续时间：专注，至多10分钟',
    ],
    sourceText:
      '在法术持续时间内，你感受到距你30尺内的魔法效应。若你感知到了此类效应，则你可以用一个魔法动作以看到任何带有该魔法效应的可见生物或物件周围环绕着的微弱灵光，且若该魔法效应属于被法术创造的效应，则你可分辨出其所属的魔法学派。 此法术会被1尺厚的岩石、泥土或木头，1寸厚的金属，或薄薄一层铅阻隔。',
    targets: [
      '若你感知到了此类效应，则你可以用一个魔法动作以看到任何带有该魔法效应的可见生物或物件周围环绕着的微弱灵光，且若该魔法效应属于被法术创造的效应，则你可分辨出其所属的魔法学派。',
    ],
    resources: ['施法时间：动作或仪式', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '若你感知到了此类效应，则你可以用一个魔法动作以看到任何带有该魔法效应的可见生物或物件周围环绕着的微弱灵光，且若该魔法效应属于被法术创造的效应，则你可分辨出其所属的魔法学派。',
    ],
    contentWarnings: [],
  },
  'detect-poison-and-disease': {
    categories: ['non-damage', 'perception'],
    catalogueText:
      'For the duration, you sense the location of poisons, poisonous or venomous creatures, and magical contagions within 30 feet of yourself. You sense the kind of poison, creature, or contagion in each case. The spell is blocked by 1 foot of stone, dirt, or wood; 1 inch of metal; or a thin sheet of lead.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Detect_Poison_and_Disease',
      title: '侦测毒性和疾病｜Detect Poison and Disease',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 预言（牧师、德鲁伊、圣武士、游侠）',
      '施法时间：动作或仪式',
      '施法距离：自身',
      '法术成分：V、S、M（一片紫杉叶）',
      '持续时间：专注，至多10分钟',
    ],
    sourceText:
      '在法术持续时间内，你定位距你30尺内的毒药、有毒生物和魔法疫病。你可以感知到毒药、有毒生物和疫病的种类。 此法术会被1尺厚的岩石、泥土或木头，1寸厚的金属，或薄薄一层铅阻隔。',
    targets: [
      '在法术持续时间内，你定位距你30尺内的毒药、有毒生物和魔法疫病。',
      '你可以感知到毒药、有毒生物和疫病的种类。',
    ],
    resources: ['施法时间：动作或仪式', '法术成分：V、S、M（一片紫杉叶）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['你可以感知到毒药、有毒生物和疫病的种类。'],
    contentWarnings: [],
  },
  'disguise-self': {
    categories: ['non-damage', 'perception'],
    catalogueText:
      'You make yourself—including your clothing, armor, weapons, and other belongings on your person— look different until the spell ends. You can seem 1 foot shorter or taller and can appear heavier or lighter. You must adopt a form that has the same basic arrangement of limbs as you have. Otherwise, the extent of the illusion is up to you. The changes wrought by this spell fail to hold up to physical inspection. For example, if you use this spell to add a hat to your outfit, objects pass through the hat, and anyone who touches it would feel nothing. To discern that you are disguised, a creature must take the Study action to inspect your appearance and succeed on an Intelligence (Investigation) check against your spell save DC.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Disguise_Self',
      title: '易容术｜Disguise Self',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 幻术（吟游诗人、术士、法师、奇械师）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、S',
      '持续时间：1小时',
    ],
    sourceText:
      '你改变自身以及随身的衣物、护甲、武器等在你身上的所有物。该效应在法术终止时结束。肉眼看来你的身高可以有1尺的增减，体态可胖可瘦。你必须选择一个和你肢体基础排列方式一致的形态。此外，幻术的影响范围由你决定。 此法术产生的变化无法应对物理检查。比如，你用此法术添了一顶帽子，那么现实物件会从帽子穿过去，且任何触碰帽子的人将摸不到任何东西。 如果一名生物想要分辨你是否易容，则必须使用一个研究动作研究你的外貌，并成功于一次对抗你法术豁免DC的智力（调查）检定。',
    targets: [
      '你改变自身以及随身的衣物、护甲、武器等在你身上的所有物。',
      '你必须选择一个和你肢体基础排列方式一致的形态。',
      '此外，幻术的影响范围由你决定。',
      '比如，你用此法术添了一顶帽子，那么现实物件会从帽子穿过去，且任何触碰帽子的人将摸不到任何东西。',
      '如果一名生物想要分辨你是否易容，则必须使用一个研究动作研究你的外貌，并成功于一次对抗你法术豁免DC的智力（调查）检定。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '该效应在法术终止时结束。',
      '如果一名生物想要分辨你是否易容，则必须使用一个研究动作研究你的外貌，并成功于一次对抗你法术豁免DC的智力（调查）检定。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'dissonant-whispers': {
    categories: ['damage-with-rider'],
    catalogueText:
      'One creature of your choice that you can see within range hears a discordant melody in its mind. The target makes a Wisdom saving throw. On a failed save, it takes 3d6 Psychic damage and must immediately use its Reaction, if available, to move as far away from you as it can, using the safest route. On a successful save, the target takes half as much damage only. Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Dissonant_Whispers',
      title: '不谐低语｜Dissonant Whispers',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 惑控（吟游诗人）',
      '施法时间：动作',
      '施法距离：60尺',
      '法术成分：V',
      '持续时间：立即',
    ],
    sourceText:
      '一名施法距离内你选择的可见生物的心灵中听见一段不协和旋律。目标进行一次感知豁免。豁免失败则受到3d6点心灵伤害，并立即执行其反应（若可用）尽可能往远离你的方向移动，并采取最安全的路径。豁免成功则只受一半伤害。 升环施法。使用的法术位每比一环高一环，伤害就提高1d6。',
    targets: [
      '一名施法距离内你选择的可见生物的心灵中听见一段不协和旋律。',
      '目标进行一次感知豁免。',
      '豁免失败则受到3d6点心灵伤害，并立即执行其反应（若可用）尽可能往远离你的方向移动，并采取最安全的路径。',
    ],
    resources: ['施法时间：动作', '法术成分：V'],
    savingThrows: [
      '目标进行一次感知豁免。',
      '豁免失败则受到3d6点心灵伤害，并立即执行其反应（若可用）尽可能往远离你的方向移动，并采取最安全的路径。',
      '豁免成功则只受一半伤害。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，伤害就提高1d6。'],
    visibility: [
      '一名施法距离内你选择的可见生物的心灵中听见一段不协和旋律。',
      '目标进行一次感知豁免。',
      '豁免失败则受到3d6点心灵伤害，并立即执行其反应（若可用）尽可能往远离你的方向移动，并采取最安全的路径。',
    ],
    contentWarnings: [],
  },
  'divine-favor': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'Until the spell ends, your attacks with weapons deal an extra 1d4 Radiant damage on a hit.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Divine_Favor',
      title: '神恩｜Divine Favor',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 变化（圣武士）',
      '施法时间：附赠动作',
      '施法距离：自身',
      '法术成分：V、S',
      '持续时间：1分钟',
    ],
    sourceText: '直到法术结束之前，你使用武器的攻击在命中时造成额外1d4点光耀伤害。',
    targets: ['直到法术结束之前，你使用武器的攻击在命中时造成额外1d4点光耀伤害。'],
    resources: ['施法时间：附赠动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['直到法术结束之前，你使用武器的攻击在命中时造成额外1d4点光耀伤害。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'divine-smite': {
    categories: ['pure-damage'],
    catalogueText:
      'The target takes an extra 2d8 Radiant damage from the attack. The damage increases by 1d8 if the target is a Fiend or an Undead. Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Divine_Smite',
      title: '至圣斩｜Divine Smite',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 塑能（圣武士）',
      '施法时间：附赠动作，当你使用近战武器或徒手打击命中一个生物后立即执行',
      '施法距离：自身',
      '法术成分：V',
      '持续时间：立即',
    ],
    sourceText:
      '被该次攻击检定命中的目标会在此次攻击中额外受到2d8点光耀伤害。若目标为邪魔生物或亡灵生物，则此伤害增加1d8。 升环施法。使用的法术位每比一环高一环，此法术的伤害就提高1d8。',
    targets: [
      '被该次攻击检定命中的目标会在此次攻击中额外受到2d8点光耀伤害。',
      '若目标为邪魔生物或亡灵生物，则此伤害增加1d8。',
    ],
    resources: [
      '施法时间：附赠动作，当你使用近战武器或徒手打击命中一个生物后立即执行',
      '法术成分：V',
    ],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，此法术的伤害就提高1d8。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  druidcraft: {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'Whispering to the spirits of nature, you create one of the following effects within range. Weather Sensor. You create a Tiny, harmless sensory effect that predicts what the weather will be at your location for the next 24 hours. The effect might manifest as a golden orb for clear skies, a cloud for rain, falling snowflakes for snow, and so on. This effect persists for 1 round. Bloom. You instantly make a flower blossom, a seed pod open, or a leaf bud bloom. Sensory Effect. You create a harmless sensory effect, such as falling leaves, spectral dancing fairies, a gentle breeze, the sound of an animal, or the faint odor of skunk. The effect must fit in a 5-foot Cube. Fire Play. You light or snuff out a candle, a torch, or a campfire.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Druidcraft',
      title: '德鲁伊伎俩｜Druidcraft',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '变化 戏法（德鲁伊）',
      '施法时间：动作',
      '施法距离：30尺',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你向自然精魂低语，在施法距离内创造出下述效应之一。 感知天气Weather Sensor。你创造一个微型 而无害的感官效应，并以之预报你所在地接下来24小时的天气状况。该效应可表现为一个代表晴空的金球、一朵代表雨天的云彩、代表雪日而飘飞的雪花等等。该效应将持续1轮。 盛放Blossom。你可以立即让一朵鲜花绽放，让一颗种子破壳，或是让一片叶蕾发芽。 感官效应Sensory Effect。 你创造一个无害的感官效应，例如落叶、如幽灵般舞动的小仙灵们、微风、动物的声音或者臭鼬的微弱臭气。该效应只能在5尺的立方 区域内起效。 玩火Fire Play。 你点亮/熄灭一根蜡烛、一根火把或一处小篝火。',
    targets: [
      '你向自然精魂低语，在施法距离内创造出下述效应之一。',
      '该效应只能在5尺的立方 区域内起效。',
      '你点亮/熄灭一根蜡烛、一根火把或一处小篝火。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '感知天气Weather Sensor。',
      '你创造一个无害的感官效应，例如落叶、如幽灵般舞动的小仙灵们、微风、动物的声音或者臭鼬的微弱臭气。',
    ],
    contentWarnings: [],
  },
  'eldritch-blast': {
    categories: ['pure-damage'],
    catalogueText:
      'You hurl a beam of crackling energy. Make a ranged spell attack against one creature or object in range. On a hit, the target takes 1d10 Force damage. Cantrip Upgrade. The spell creates two beams at level 5, three beams at level 11, and four beams at level 17. You can direct the beams at the same target or at different ones. Make a separate attack roll for each beam.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Eldritch_Blast',
      title: '魔能爆｜Eldritch Blast',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '塑能 戏法（魔契师）',
      '施法时间：动作',
      '施法距离：120尺',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你释放出一束爆裂能量射线，对施法距离内一名生物或一个物件发动一次远程法术攻击。命中时，目标将受1d10点力场伤害。 戏法强化。到达5级后此法术将创造出两条射线，11级后三条，17级后四条。你可以使这些射线攻击同一个目标或分别攻击不同的目标。你需要为每条射线分别进行攻击检定。',
    targets: [
      '你释放出一束爆裂能量射线，对施法距离内一名生物或一个物件发动一次远程法术攻击。',
      '命中时，目标将受1d10点力场伤害。',
      '你可以使这些射线攻击同一个目标或分别攻击不同的目标。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['命中时，目标将受1d10点力场伤害。'],
    upcasting: ['戏法强化。', '到达5级后此法术将创造出两条射线，11级后三条，17级后四条。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  elementalism: {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'You exert control over the elements, creating one of the following effects within range. Beckon Air. You create a breeze strong enough to ripple cloth, stir dust, rustle leaves, and close open doors and shutters, all in a 5-foot Cube. Doors and shutters being held open by someone or something aren’t affected. Beckon Earth. You create a thin shroud of dust or sand that covers surfaces in a 5-foot-square area, or you cause a single word to appear in your handwriting in a patch of dirt or sand. Beckon Fire. You create a thin cloud of harmless embers and colored, scented smoke in a 5-foot Cube. You choose the color and scent, and the embers can light candles, torches, or lamps in that area. The smoke’s scent lingers for 1 minute. Beckon Water. You create a spray of cool mist that lightly dampens creatures and objects in a 5-foot Cube. Alternatively, you create 1 cup of clean water either in an open container or on a surface, and the water evaporates in 1 minute. Sculpt Element. You cause dirt, sand, fire, smoke, mist, or water that can fit in a 1-foot Cube to assume a crude shape (such as that of a creature) for 1 hour.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Elementalism',
      title: '四象法门｜Elementalism',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '变化 戏法（德鲁伊、术士、法师、奇械师）',
      '施法时间：动作',
      '施法距离：30尺',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你操控元素，在施法距离内创造下述效应之一。 召气Beckon Air。你在一处5尺立方区域内创造一股和风，其足以吹动布料、搅动灰尘、使落叶沙沙作响、关闭开着的门和百叶窗。若开着的门/百叶窗被某人/某物顶住，则其不受该效应影响。 召土Beckon Earth。你创造灰尘或沙子组成的薄帷，覆盖在5尺立方区域内的表面上，或者你可以在一堆泥土或沙子中使一个单词以你的手写体出现。 召火Beckon Fire。你在一处5尺立方区域内创造一片无害余烬与一股富有色彩和气味的烟。你选择烟的色彩和气味，而余烬可以点燃区域中的蜡烛、火把或油灯。烟的气味会存留1分钟。 召水Beckon Water。你在一处5尺立方范围内创造一片凉爽的，使范围内生物和物件略微潮湿的雾气。或者，你可以在一个有开口的容器或表面上创造出一杯干净的水，水会在1分钟内蒸发。 塑形元素Sculpt Element。你使1尺立方区域内的泥土、沙子、火焰、烟尘、雾气或水呈现出一个粗略的形状（如一名生物），持续1小时。',
    targets: [
      '你操控元素，在施法距离内创造下述效应之一。',
      '你在一处5尺立方区域内创造一股和风，其足以吹动布料、搅动灰尘、使落叶沙沙作响、关闭开着的门和百叶窗。',
      '你创造灰尘或沙子组成的薄帷，覆盖在5尺立方区域内的表面上，或者你可以在一堆泥土或沙子中使一个单词以你的手写体出现。',
      '你在一处5尺立方区域内创造一片无害余烬与一股富有色彩和气味的烟。',
      '你选择烟的色彩和气味，而余烬可以点燃区域中的蜡烛、火把或油灯。',
      '你在一处5尺立方范围内创造一片凉爽的，使范围内生物和物件略微潮湿的雾气。',
      '你使1尺立方区域内的泥土、沙子、火焰、烟尘、雾气或水呈现出一个粗略的形状（如一名生物），持续1小时。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['若开着的门/百叶窗被某人/某物顶住，则其不受该效应影响。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'ensnaring-strike': {
    categories: ['damage-with-rider', 'condition'],
    catalogueText:
      'As you hit the target, grasping vines appear on it, and it makes a Strength saving throw. A Large or larger creature has Advantage on this save. On a failed save, the target has the Restrained condition until the spell ends. On a successful save, the vines shrivel away, and the spell ends. While Restrained, the target takes 1d6 Piercing damage at the start of each of its turns. The target or a creature within reach of it can take an action to make a Strength (Athletics) check against your spell save DC. On a success, the spell ends. Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Ensnaring_Strike',
      title: '捕获打击｜Ensnaring Strike',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 咒法（游侠）',
      '施法时间：附赠动作，在你用武器命中目标后立即可用',
      '施法距离：自身',
      '法术成分：V',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '你命中目标时，目标身上出现一根紧紧将其攫住的藤蔓，使其进行一次力量豁免，大型及更大体型的生物进行该豁免时具有优势。豁免失败，则目标将直到法术结束为止陷入束缚状态。豁免成功，则藤蔓立即枯萎，法术结束。 处于束缚状态期间，目标在其每回合开始受到1d6点穿刺伤害。目标或其他位于其触及内的生物可用一个动作进行一次对抗法术豁免DC的力量（运动）检定。检定成功则法术结束。 升环施法。使用的法术位每比一环高一环，此法术的伤害就提高1d6点。',
    targets: [
      '你命中目标时，目标身上出现一根紧紧将其攫住的藤蔓，使其进行一次力量豁免，大型及更大体型的生物进行该豁免时具有优势。',
      '豁免失败，则目标将直到法术结束为止陷入束缚状态。',
      '处于束缚状态期间，目标在其每回合开始受到1d6点穿刺伤害。',
      '目标或其他位于其触及内的生物可用一个动作进行一次对抗法术豁免DC的力量（运动）检定。',
      '使用的法术位每比一环高一环，此法术的伤害就提高1d6点。',
    ],
    resources: ['施法时间：附赠动作，在你用武器命中目标后立即可用', '法术成分：V'],
    savingThrows: [
      '你命中目标时，目标身上出现一根紧紧将其攫住的藤蔓，使其进行一次力量豁免，大型及更大体型的生物进行该豁免时具有优势。',
      '豁免失败，则目标将直到法术结束为止陷入束缚状态。',
      '豁免成功，则藤蔓立即枯萎，法术结束。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '豁免失败，则目标将直到法术结束为止陷入束缚状态。',
      '豁免成功，则藤蔓立即枯萎，法术结束。',
      '处于束缚状态期间，目标在其每回合开始受到1d6点穿刺伤害。',
      '检定成功则法术结束。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，此法术的伤害就提高1d6点。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  entangle: {
    categories: ['non-damage', 'environment', 'condition'],
    catalogueText:
      'Grasping plants sprout from the ground in a 20-foot square within range. For the duration, these plants turn the ground in the area into Difficult Terrain. They disappear when the spell ends. Each creature (other than you) in the area when you cast the spell must succeed on a Strength saving throw or have the Restrained condition until the spell ends. A Restrained creature can take an action to make a Strength (Athletics) check against your spell save DC. On a success, it frees itself from the grasping plants and is no longer Restrained by them.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Entangle',
      title: '纠缠术｜Entangle',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 咒法（德鲁伊、游侠）',
      '施法时间：动作',
      '施法距离：90尺',
      '法术成分：V、S',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '缠绕的植物在施法距离内从20尺方状区域地面中破土而出。在法术持续时间内，这片被植物覆盖的区域变为困难地形 。法术结束时，这些植物会消失。 在你施展法术时，该区域内的生物（除你之外）必须成功于一次力量豁免，否则陷入束缚状态，直到法术终止。一名因此被束缚的生物可以用其动作进行一次力量（运动）检定对抗该法术的豁免DC。检定成功则成功摆脱缠绕在其身上的藤蔓并不再被其束缚。',
    targets: [
      '缠绕的植物在施法距离内从20尺方状区域地面中破土而出。',
      '在法术持续时间内，这片被植物覆盖的区域变为困难地形 。',
      '在你施展法术时，该区域内的生物（除你之外）必须成功于一次力量豁免，否则陷入束缚状态，直到法术终止。',
      '一名因此被束缚的生物可以用其动作进行一次力量（运动）检定对抗该法术的豁免DC。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '在你施展法术时，该区域内的生物（除你之外）必须成功于一次力量豁免，否则陷入束缚状态，直到法术终止。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '法术结束时，这些植物会消失。',
      '在你施展法术时，该区域内的生物（除你之外）必须成功于一次力量豁免，否则陷入束缚状态，直到法术终止。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'expeditious-retreat': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You take the Dash action, and until the spell ends, you can take that action again as a Bonus Action.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Expeditious_Retreat',
      title: '脚底抹油｜Expeditious Retreat',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 变化（术士、魔契师、法师、奇械师）',
      '施法时间：附赠动作',
      '施法距离：自身',
      '法术成分：V、S',
      '持续时间：专注，至多10分钟',
    ],
    sourceText: '你执行疾走动作，且直到法术结束为止，你均能使用附赠动作执行疾走 动作。',
    targets: ['本术目标由下列完整正文限定；无可简化的生物目标字段。'],
    resources: ['施法时间：附赠动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['你执行疾走动作，且直到法术结束为止，你均能使用附赠动作执行疾走 动作。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'faerie-fire': {
    categories: ['non-damage', 'perception'],
    catalogueText:
      'Objects in a 20-foot Cube within range are outlined in blue, green, or violet light (your choice). Each creature in the Cube is also outlined if it fails a Dexterity saving throw. For the duration, objects and affected creatures shed Dim Light in a 10-foot ra- dius and can’t benefit from the Invisible condition. Attack rolls against an affected creature or object have Advantage if the attacker can see it.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Faerie_Fire',
      title: '妖火｜Faerie Fire',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 塑能（吟游诗人、德鲁伊、奇械师）',
      '施法时间：动作',
      '施法距离：60尺',
      '法术成分：V',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '施法距离内一处20尺立方区域内每个物件的轮廓都将被蓝色、绿色、或紫色的光芒所勾勒（颜色由你指定）。区域内的生物则必须进行一次敏捷豁免，豁免失败时会被彩色光芒勾勒出轮廓。受术物件和生物在法术持续时间内发出10尺半径的微光光照 。 受术生物或物件无法受益于隐形状态，且任何能看见他们的攻击者对其发动的攻击检定具有优势。',
    targets: [
      '施法距离内一处20尺立方区域内每个物件的轮廓都将被蓝色、绿色、或紫色的光芒所勾勒（颜色由你指定）。',
      '区域内的生物则必须进行一次敏捷豁免，豁免失败时会被彩色光芒勾勒出轮廓。',
      '受术物件和生物在法术持续时间内发出10尺半径的微光光照 。',
      '受术生物或物件无法受益于隐形状态，且任何能看见他们的攻击者对其发动的攻击检定具有优势。',
    ],
    resources: ['施法时间：动作', '法术成分：V'],
    savingThrows: ['区域内的生物则必须进行一次敏捷豁免，豁免失败时会被彩色光芒勾勒出轮廓。'],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '受术物件和生物在法术持续时间内发出10尺半径的微光光照 。',
      '受术生物或物件无法受益于隐形状态，且任何能看见他们的攻击者对其发动的攻击检定具有优势。',
    ],
    contentWarnings: [],
  },
  'false-life': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You gain 2d4 + 4 Temporary Hit Points. Using a Higher-Level Spell Slot. You gain 5 additional Temporary Hit Points for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'False_Life',
      title: '虚假生命｜False Life',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 死灵（术士、法师、奇械师）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、S、M（一滴酒精）',
      '持续时间：立即',
    ],
    sourceText:
      '你获得2d4+4点临时生命值。 升环施法。使用的法术位每比一环高一环，其给予的临时生命值就增加5。',
    targets: ['你获得2d4+4点临时生命值。'],
    resources: ['施法时间：动作', '法术成分：V、S、M（一滴酒精）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，其给予的临时生命值就增加5。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'feather-fall': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'Choose up to five falling creatures within range. A falling creature’s rate of descent slows to 60 feet per round until the spell ends. If a creature lands before the spell ends, the creature takes no damage from the fall, and the spell ends for that creature.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Feather_Fall',
      title: '羽落术｜Feather Fall',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 变化（吟游诗人、术士、法师、奇械师）',
      '施法时间：反应，你或距你60尺内的可见生物坠落时可用',
      '施法距离：60尺',
      '法术成分：V、M（一小根羽毛或一块羽绒）',
      '持续时间：1分钟',
    ],
    sourceText:
      '指定施法距离内至多五个正坠落的生物。受术生物的坠落速度在法术持续时间内降低至每回合60尺。如果该生物在法术终止前落地，则其不会受到任何坠落伤害，且着地后法术对该生物的效应随即终止。',
    targets: [
      '指定施法距离内至多五个正坠落的生物。',
      '受术生物的坠落速度在法术持续时间内降低至每回合60尺。',
      '如果该生物在法术终止前落地，则其不会受到任何坠落伤害，且着地后法术对该生物的效应随即终止。',
    ],
    resources: [
      '施法时间：反应，你或距你60尺内的可见生物坠落时可用',
      '法术成分：V、M（一小根羽毛或一块羽绒）',
    ],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '受术生物的坠落速度在法术持续时间内降低至每回合60尺。',
      '如果该生物在法术终止前落地，则其不会受到任何坠落伤害，且着地后法术对该生物的效应随即终止。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'find-familiar': {
    categories: ['non-damage', 'summoning'],
    catalogueText:
      'You gain the service of a familiar, a spirit that takes an animal form you choose: Bat, Cat, Frog, Hawk, Lizard, Octopus, Owl, Rat, Raven, Spider, Weasel, or another Beast that has a Challenge Rating of 0. Appearing in an unoccupied space within range, the familiar has the statistics of the chosen form (see “Monsters”), though it is a Celestial, Fey, or Fiend (your choice) instead of a Beast. Your familiar acts independently of you, but it obeys your commands. Telepathic Connection. While your familiar is within 100 feet of you, you can communicate with it telepathically. Additionally, as a Bonus Action, you can see through the familiar’s eyes and hear what it hears until the start of your next turn, gaining the benefits of any special senses it has. Finally, when you cast a spell with a range of touch, your familiar can deliver the touch. Your fa- miliar must be within 100 feet of you, and it must take a Reaction to deliver the touch when you cast the spell. Combat. The familiar is an ally to you and your allies. It rolls its own Initiative and acts on its own turn. A familiar can’t attack, but it can take other actions as normal. Disappearance of the Familiar. When the familiar drops to 0 Hit Points, it disappears. It reappears after you cast this spell again. As a Magic action, you can temporarily dismiss the familiar to a pocket dimension. Alternatively, you can dismiss it forever. As a Magic action while it is temporarily dismissed, you can cause it to reappear in an unoccupied space within 30 feet of you. Whenever the familiar drops to 0 Hit Points or disappears into the pocket dimension, it leaves behind in its space anything it was wearing or carrying. One Familiar Only. You can’t have more than one familiar at a time. If you cast this spell while you have a familiar, you instead cause it to adopt a new eligible form.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Find_Familiar',
      title: '寻获魔宠｜Find Familiar',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 咒法（法师）',
      '施法时间：1小时或仪式',
      '施法距离：10尺',
      '法术成分：V、S、M（价值10+GP的焚香，作为法术耗材）',
      '持续时间：立即',
    ],
    sourceText:
      '你获得一只为你服务的魔宠，魔宠精魄可以采用下述你选择的动物形态之一：蝙蝠Bat、猫Cat、蛙Frog、隼Hawk、蜥蜴Lizard、章鱼Octopus、猫头鹰Owl、鼠Rat、渡鸦Raven、蜘蛛Spider、鼬Weasel，你也可以选择其他挑战等级为0的野兽作为魔宠的形态。魔宠出现在施法距离内一处未占据空间，虽然有着所选的生物属性数据，但其生物类型为天族、妖精、邪魔之一（由你选择）而非野兽。你的魔宠可脱离你独立行动，不过它会一直遵循你的命令行事。 心灵连接Telepathic Connection。你的魔宠距你100尺内期间，你可以与其进行心灵交流。此外，你还能够以一个附赠动作将自己的视觉和听觉切换到魔宠的感官，并一持续至你下一回合开始。在此期间，你同时享有该魔宠自身的特殊感官。 最后，当你施展施法距离为触碰的法术时，你的魔宠可以帮你传递这道触碰法术。此时你的魔宠必须距你100尺内，且在你施展这道法术时你的魔宠需要执行一个反应才能将其传递。 战斗Combat。魔宠是你和你盟友的盟友。战斗时，它为自己骰先攻，并在自己回合里行动。魔宠无法攻击，但是它能如常执行其他动作。 魔宠的消失Disappearance of the Familiar。当魔宠生命值降至0点时，它会消失。它会在你再次施展此法术后重新出现。你可以用一个魔法动作，暂时解散你的魔宠，将其送入一个口袋位面。你也可以选择永久解散它。暂时解散时，你可以用一个魔法动作使其重新出现于距你30尺内任意未占空间中。当魔宠生命值归0或消失进入了口袋位面时，它都会将自己穿着或携带的任何物品留在自己曾占据的空间中。 独一无二One Familiar Only。你在同一时间不能拥有多于一只魔宠。如果你在已拥有一只魔宠期间施展此法术，作为替代，你会使其采用一个新的符合条件的形态。',
    targets: [
      '你获得一只为你服务的魔宠，魔宠精魄可以采用下述你选择的动物形态之一：蝙蝠Bat、猫Cat、蛙Frog、隼Hawk、蜥蜴Lizard、章鱼Octopus、猫头鹰Owl、鼠Rat、渡鸦Raven、蜘蛛Spider、鼬Weasel，你也可以选择其他挑战等级为0的野兽作为魔宠的形态。',
      '魔宠出现在施法距离内一处未占据空间，虽然有着所选的生物属性数据，但其生物类型为天族、妖精、邪魔之一（由你选择）而非野兽。',
      '在此期间，你同时享有该魔宠自身的特殊感官。',
      '最后，当你施展施法距离为触碰的法术时，你的魔宠可以帮你传递这道触碰法术。',
      '当魔宠生命值降至0点时，它会消失。',
      '你也可以选择永久解散它。',
      '当魔宠生命值归0或消失进入了口袋位面时，它都会将自己穿着或携带的任何物品留在自己曾占据的空间中。',
    ],
    resources: ['施法时间：1小时或仪式', '法术成分：V、S、M（价值10+GP的焚香，作为法术耗材）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '你获得一只为你服务的魔宠，魔宠精魄可以采用下述你选择的动物形态之一：蝙蝠Bat、猫Cat、蛙Frog、隼Hawk、蜥蜴Lizard、章鱼Octopus、猫头鹰Owl、鼠Rat、渡鸦Raven、蜘蛛Spider、鼬Weasel，你也可以选择其他挑战等级为0的野兽作为魔宠的形态。',
      '此外，你还能够以一个附赠动作将自己的视觉和听觉切换到魔宠的感官，并一持续至你下一回合开始。',
      '最后，当你施展施法距离为触碰的法术时，你的魔宠可以帮你传递这道触碰法术。',
      '战斗时，它为自己骰先攻，并在自己回合里行动。',
      '魔宠的消失Disappearance of the Familiar。',
      '当魔宠生命值降至0点时，它会消失。',
      '它会在你再次施展此法术后重新出现。',
      '暂时解散时，你可以用一个魔法动作使其重新出现于距你30尺内任意未占空间中。',
      '当魔宠生命值归0或消失进入了口袋位面时，它都会将自己穿着或携带的任何物品留在自己曾占据的空间中。',
      '如果你在已拥有一只魔宠期间施展此法术，作为替代，你会使其采用一个新的符合条件的形态。',
    ],
    upcasting: [
      '你获得一只为你服务的魔宠，魔宠精魄可以采用下述你选择的动物形态之一：蝙蝠Bat、猫Cat、蛙Frog、隼Hawk、蜥蜴Lizard、章鱼Octopus、猫头鹰Owl、鼠Rat、渡鸦Raven、蜘蛛Spider、鼬Weasel，你也可以选择其他挑战等级为0的野兽作为魔宠的形态。',
    ],
    visibility: [
      '心灵连接Telepathic Connection。',
      '你的魔宠距你100尺内期间，你可以与其进行心灵交流。',
      '此外，你还能够以一个附赠动作将自己的视觉和听觉切换到魔宠的感官，并一持续至你下一回合开始。',
    ],
    contentWarnings: [],
  },
  'fire-bolt': {
    categories: ['damage-with-rider', 'environment'],
    catalogueText:
      'You hurl a mote of fire at a creature or an object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 Fire damage. A flammable object hit by this spell starts burning if it isn’t being worn or carried. Cantrip Upgrade. The damage increases by 1d10 when you reach levels 5 (2d10), 11 (3d10), and 17 (4d10).',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Fire_Bolt',
      title: '火焰箭｜Fire Bolt',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '塑能 戏法（术士、法师、奇械师）',
      '施法时间：动作',
      '施法距离：120尺',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你对施法距离内一名生物或物件掷出一把火焰，对目标进行一次远程法术攻击。命中则目标将受到1d10火焰伤害。未被着装或携带的可燃物件被该法术命中时将开始燃烧。 戏法强化。到达特定等级后，此戏法的伤害将增加1d10：5级（2d10）、11级（3d10）、17级（4d10）。',
    targets: [
      '你对施法距离内一名生物或物件掷出一把火焰，对目标进行一次远程法术攻击。',
      '命中则目标将受到1d10火焰伤害。',
      '未被着装或携带的可燃物件被该法术命中时将开始燃烧。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: [
      '戏法强化。',
      '到达特定等级后，此戏法的伤害将增加1d10：5级（2d10）、11级（3d10）、17级（4d10）。',
    ],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'floating-disk': {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'This spell creates a circular, horizontal plane of force, 3 feet in diameter and 1 inch thick, that floats 3 feet above the ground in an unoccupied space of your choice that you can see within range. The disk remains for the duration and can hold up to 500 pounds. If more weight is placed on it, the spell ends, and everything on the disk falls to the ground. The disk is immobile while you are within 20 feet of it. If you move more than 20 feet away from it, the disk follows you so that it remains within 20 feet of you. It can move across uneven terrain, up or down stairs, slopes and the like, but it can’t cross an elevation change of 10 feet or more. For example, the disk can’t move across a 10-foot-deep pit, nor could it leave such a pit if it was created at the bottom. If you move more than 100 feet from the disk (typically because it can’t move around an obstacle to follow you), the spell ends.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: "Tenser's_Floating_Disk",
      title: "谭森浮碟术｜Tenser's Floating Disk",
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 咒法（法师）',
      '施法时间：动作或仪式',
      '施法距离：30尺',
      '法术成分：V、S、M（一滴汞）',
      '持续时间：1小时',
    ],
    sourceText:
      '指定施法距离内一处你可见的未占空间，并在该处创造一个圆盘状的碟型水平力场。浮碟直径3尺，厚1寸，悬浮在离地3尺的空中。其可以在法术持续时间内持续存在，并至多可负载500磅重量。如果放在浮碟上的物件重量超过500磅，则该法术终止，浮碟上的所有东西也将掉落至地上。 浮碟距你20尺内时静止不动。只要你与其距离超过20尺，浮碟就会跟随你移动，并保持在距你20尺范围内。浮碟可以自由跨越崎岖地形、上下阶梯、斜坡面、诸如此类的地面，但它不能越过高差超过10尺的地面。例如，浮碟不能越过一个10尺深的坑；如果将浮碟创造在这个坑的坑底，则它将无法离开这个坑。 如果你距浮碟超过100尺（通常是因为它受障碍所阻无法跟上你），则法术终止。',
    targets: [
      '指定施法距离内一处你可见的未占空间，并在该处创造一个圆盘状的碟型水平力场。',
      '如果放在浮碟上的物件重量超过500磅，则该法术终止，浮碟上的所有东西也将掉落至地上。',
      '只要你与其距离超过20尺，浮碟就会跟随你移动，并保持在距你20尺范围内。',
    ],
    resources: ['施法时间：动作或仪式', '法术成分：V、S、M（一滴汞）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '如果放在浮碟上的物件重量超过500磅，则该法术终止，浮碟上的所有东西也将掉落至地上。',
      '例如，浮碟不能越过一个10尺深的坑；如果将浮碟创造在这个坑的坑底，则它将无法离开这个坑。',
      '如果你距浮碟超过100尺（通常是因为它受障碍所阻无法跟上你），则法术终止。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['指定施法距离内一处你可见的未占空间，并在该处创造一个圆盘状的碟型水平力场。'],
    contentWarnings: [],
  },
  'fog-cloud': {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'You create a 20-foot-radius Sphere of fog centered on a point within range. The Sphere is Heavily Obscured. It lasts for the duration or until a strong wind (such as one created by Gust of Wind ) dis- perses it. Using a Higher-Level Spell Slot. The fog’s radius increases by 20 feet for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Fog_Cloud',
      title: '云雾术｜Fog Cloud',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 咒法（德鲁伊、游侠、术士、法师）',
      '施法时间：动作',
      '施法距离：120尺',
      '法术成分：V、S',
      '持续时间：专注，至多1小时',
    ],
    sourceText:
      '你以施法距离内一点为中心创造一片半径20尺的球状浓雾。球状区域被重度遮蔽。浓雾持续至法术持续时间结束，被强风（比如造风术Gust of Wind创造的风）吹散时法术也将提前结束。 升环施法。 使用的法术位每比一环高一环，浓雾的半径就增加20尺。',
    targets: ['你以施法距离内一点为中心创造一片半径20尺的球状浓雾。', '球状区域被重度遮蔽。'],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '浓雾持续至法术持续时间结束，被强风（比如造风术Gust of Wind创造的风）吹散时法术也将提前结束。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，浓雾的半径就增加20尺。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  goodberry: {
    categories: ['non-damage', 'healing'],
    catalogueText:
      'Ten berries appear in your hand and are infused with magic for the duration. A creature can take a Bonus Action to eat one berry. Eating a berry restores 1 Hit Point, and the berry provides enough nourishment to sustain a creature for one day. Uneaten berries disappear when the spell ends.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Goodberry',
      title: '神莓术｜Goodberry',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 咒法（德鲁伊、游侠）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、S、M（一根槲寄生）',
      '持续时间：24小时',
    ],
    sourceText:
      '10颗浆果出现在你手里。果子在法术持续时间内充满魔法。一名生物可以用一个附赠动作 吃下一颗浆果。吃掉一颗浆果者恢复1生命值，且一枚浆果就可以满足该生物一整天的营养需求。 法术结束时还没有被吃掉的浆果会消失。',
    targets: [
      '一名生物可以用一个附赠动作 吃下一颗浆果。',
      '吃掉一颗浆果者恢复1生命值，且一枚浆果就可以满足该生物一整天的营养需求。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一根槲寄生）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['法术结束时还没有被吃掉的浆果会消失。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  grease: {
    categories: ['non-damage', 'environment', 'condition'],
    catalogueText:
      'Nonflammable grease covers the ground in a 10- foot square centered on a point within range and turns it into Difficult Terrain for the duration. When the grease appears, each creature standing in its area must succeed on a Dexterity saving throw or have the Prone condition. A creature that enters the area or ends its turn there must also succeed on that save or fall Prone.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Grease',
      title: '油腻术｜Grease',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 咒法（术士、法师、奇械师）',
      '施法时间：动作',
      '施法距离：60尺',
      '法术成分：V、S、M（一块猪皮或黄油）',
      '持续时间：1分钟',
    ],
    sourceText:
      '你在施法距离内指定一点，光滑的不可燃油脂以该点为中心覆盖一处10尺的方状区域。在法术持续时间内。该区域变为困难地形 。 油脂出现时，站在其范围内的每个生物必须成功通过一次敏捷豁免，否则陷入倒地状态。进入该区域或在区域内结束其回合的生物也必须进行该敏捷豁免，豁免失败则陷入倒地。',
    targets: [
      '你在施法距离内指定一点，光滑的不可燃油脂以该点为中心覆盖一处10尺的方状区域。',
      '该区域变为困难地形 。',
      '油脂出现时，站在其范围内的每个生物必须成功通过一次敏捷豁免，否则陷入倒地状态。',
      '进入该区域或在区域内结束其回合的生物也必须进行该敏捷豁免，豁免失败则陷入倒地。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一块猪皮或黄油）'],
    savingThrows: [
      '油脂出现时，站在其范围内的每个生物必须成功通过一次敏捷豁免，否则陷入倒地状态。',
      '进入该区域或在区域内结束其回合的生物也必须进行该敏捷豁免，豁免失败则陷入倒地。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '进入该区域或在区域内结束其回合的生物也必须进行该敏捷豁免，豁免失败则陷入倒地。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  guidance: {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You touch a willing creature and choose a skill. Until the spell ends, the creature adds 1d4 to any ability check using the chosen skill.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Guidance',
      title: '神导术｜Guidance',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '预言 戏法（牧师、德鲁伊、奇械师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '你触碰一名自愿生物并选择一项技能。直到法术结束为止，受术生物在进行使用到所选技能的任何属性检定时，该次检定具有1d4加值。',
    targets: [
      '你触碰一名自愿生物并选择一项技能。',
      '直到法术结束为止，受术生物在进行使用到所选技能的任何属性检定时，该次检定具有1d4加值。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '直到法术结束为止，受术生物在进行使用到所选技能的任何属性检定时，该次检定具有1d4加值。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'guiding-bolt': {
    categories: ['damage-with-rider'],
    catalogueText:
      'You hurl a bolt of light toward a creature within range. Make a ranged spell attack against the target. On a hit, it takes 4d6 Radiant damage, and the next attack roll made against it before the end of your next turn has Advantage. Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Guiding_Bolt',
      title: '光导箭｜Guiding Bolt',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 塑能（牧师）',
      '施法时间：动作',
      '施法距离：120尺',
      '法术成分：V、S',
      '持续时间：1轮',
    ],
    sourceText:
      '你向施法距离内的一名生物掷出一道光箭。对目标进行一次远程法术攻击。命中时，目标受4d6点光耀伤害。在你下个回合结束前，对目标发动的下一次攻击检定具有优势。 升环施法。使用的法术位每比一环高一环，此法术的伤害就增加1d6点。',
    targets: [
      '你向施法距离内的一名生物掷出一道光箭。',
      '对目标进行一次远程法术攻击。',
      '命中时，目标受4d6点光耀伤害。',
      '在你下个回合结束前，对目标发动的下一次攻击检定具有优势。',
      '使用的法术位每比一环高一环，此法术的伤害就增加1d6点。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['在你下个回合结束前，对目标发动的下一次攻击检定具有优势。'],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，此法术的伤害就增加1d6点。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'healing-word': {
    categories: ['non-damage', 'healing'],
    catalogueText:
      'A creature of your choice that you can see within range regains Hit Points equal to 2d4 plus your spellcasting ability modifier. Using a Higher-Level Spell Slot. The healing in- creases by 2d4 for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Healing_Word',
      title: '治愈真言｜Healing Word',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 防护（吟游诗人、牧师、德鲁伊）',
      '施法时间：附赠动作',
      '施法距离：60尺',
      '法术成分：V',
      '持续时间：立即',
    ],
    sourceText:
      '你指定施法距离内一个你能看见的生物并恢复其生命值，恢复量等于2d4+你的施法属性调整值。 升环施法。 使用的法术位每比一环高一环，此法术的治疗量就增加2d4点。',
    targets: [
      '你指定施法距离内一个你能看见的生物并恢复其生命值，恢复量等于2d4+你的施法属性调整值。',
      '使用的法术位每比一环高一环，此法术的治疗量就增加2d4点。',
    ],
    resources: ['施法时间：附赠动作', '法术成分：V'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，此法术的治疗量就增加2d4点。'],
    visibility: [
      '你指定施法距离内一个你能看见的生物并恢复其生命值，恢复量等于2d4+你的施法属性调整值。',
    ],
    contentWarnings: [],
  },
  'hellish-rebuke': {
    categories: ['pure-damage'],
    catalogueText:
      'The creature that damaged you is momentarily surrounded by green flames. It makes a Dexterity saving throw, taking 2d10 Fire damage on a failed save or half as much damage on a successful one. Using a Higher-Level Spell Slot. The damage increases by 1d10 for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Hellish_Rebuke',
      title: '炼狱叱喝｜Hellish Rebuke',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 塑能（魔契师）',
      '施法时间： 反应，当你受到来自60尺内你可见生物的伤害时执行。',
      '施法距离：60尺',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '伤害你的生物立刻被绿色的烈焰席卷。该生物必须进行一次敏捷豁免，豁免失败则受到2d10点火焰伤害，豁免成功则受到一半伤害。 升环施法。 使用的法术位每比一环高一环，此法术的伤害就增加1d10点。',
    targets: [
      '伤害你的生物立刻被绿色的烈焰席卷。',
      '该生物必须进行一次敏捷豁免，豁免失败则受到2d10点火焰伤害，豁免成功则受到一半伤害。',
      '使用的法术位每比一环高一环，此法术的伤害就增加1d10点。',
    ],
    resources: ['施法时间： 反应，当你受到来自60尺内你可见生物的伤害时执行。', '法术成分：V、S'],
    savingThrows: [
      '该生物必须进行一次敏捷豁免，豁免失败则受到2d10点火焰伤害，豁免成功则受到一半伤害。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '该生物必须进行一次敏捷豁免，豁免失败则受到2d10点火焰伤害，豁免成功则受到一半伤害。',
      '使用的法术位每比一环高一环，此法术的伤害就增加1d10点。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，此法术的伤害就增加1d10点。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  heroism: {
    categories: ['non-damage', 'support'],
    catalogueText:
      'A willing creature you touch is imbued with bravery. Until the spell ends, the creature is immune to the Frightened condition and gains Temporary Hit Points equal to your spellcasting ability modifier at the start of each of its turns. Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Heroism',
      title: '英雄气概｜Heroism',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 惑控（吟游诗人、圣武士）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '你触碰一个自愿生物使其充满勇气。该生物直至法术终止前免疫恐慌状态，且它将在其每回合开始时获得等同于你施法属性调整值的临时生命值。 升环施法。使用的法术位每比一环高一环，你就可以额外选择一个生物作为目标。',
    targets: [
      '你触碰一个自愿生物使其充满勇气。',
      '该生物直至法术终止前免疫恐慌状态，且它将在其每回合开始时获得等同于你施法属性调整值的临时生命值。',
      '使用的法术位每比一环高一环，你就可以额外选择一个生物作为目标。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: [
      '该生物直至法术终止前免疫恐慌状态，且它将在其每回合开始时获得等同于你施法属性调整值的临时生命值。',
    ],
    repeatAndEnd: [
      '该生物直至法术终止前免疫恐慌状态，且它将在其每回合开始时获得等同于你施法属性调整值的临时生命值。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，你就可以额外选择一个生物作为目标。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  hex: {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You place a curse on a creature that you can see within range. Until the spell ends, you deal an extra 1d6 Necrotic damage to the target whenever you hit it with an attack roll. Also, choose one ability when you cast the spell. The target has Disadvantage on ability checks made with the chosen ability. If the target drops to 0 Hit Points before this spell ends, you can take a Bonus Action on a later turn to curse a new creature. Using a Higher-Level Spell Slot. Your Concentration can last longer with a spell slot of level 2 (up to 4 hours), 3–4 (up to 8 hours), or 5+ (24 hours).',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Hex',
      title: '脆弱诅咒｜Hex',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 惑控（魔契师）',
      '施法时间：附赠动作',
      '施法距离：90尺',
      '法术成分：V、S、M（一只风干的蝾螈眼）',
      '持续时间：专注，至多1小时',
    ],
    sourceText:
      '你对施法距离内一个你能看见的一个生物施加诅咒。每当你以攻击检定命中该目标时，你对其额外造成1d6暗蚀伤害，直至法术结束。此外，你在施展该法术时选择一项属性，使该目标进行所选属性的属性检定时具有劣势 。 如果目标在法术终止前 HP 降至 0，则你可以在法术终止前后续的某一回合中使用一个附赠动作 诅咒另一个生物。 升环施法。 使用二环法术位施展该法术时，其专注可以维持至多4小时。使用三环或四环法术位施展该法术时，其专注可以维持至多8小时。使用环阶5+的法术位施展该法术时，其专注可以维持至多 24 小时。',
    targets: [
      '你对施法距离内一个你能看见的一个生物施加诅咒。',
      '每当你以攻击检定命中该目标时，你对其额外造成1d6暗蚀伤害，直至法术结束。',
      '此外，你在施展该法术时选择一项属性，使该目标进行所选属性的属性检定时具有劣势 。',
      '如果目标在法术终止前 HP 降至 0，则你可以在法术终止前后续的某一回合中使用一个附赠动作 诅咒另一个生物。',
    ],
    resources: ['施法时间：附赠动作', '法术成分：V、S、M（一只风干的蝾螈眼）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '每当你以攻击检定命中该目标时，你对其额外造成1d6暗蚀伤害，直至法术结束。',
      '如果目标在法术终止前 HP 降至 0，则你可以在法术终止前后续的某一回合中使用一个附赠动作 诅咒另一个生物。',
    ],
    upcasting: ['升环施法。', '使用环阶5+的法术位施展该法术时，其专注可以维持至多 24 小时。'],
    visibility: ['你对施法距离内一个你能看见的一个生物施加诅咒。'],
    contentWarnings: [],
  },
  'hideous-laughter': {
    categories: ['non-damage', 'condition'],
    catalogueText:
      'One creature of your choice that you can see within range makes a Wisdom saving throw. On a failed save, it has the Prone and Incapacitated conditions for the duration. During that time, it laughs uncontrollably if it’s capable of laughter, and it can’t end the Prone condition on itself. At the end of each of its turns and each time it takes damage, it makes another Wisdom saving throw. The target has Advantage on the save if the save is triggered by damage. On a successful save, the spell ends. Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: "Tasha's_Hideous_Laughter",
      title: "塔莎狂笑术｜Tasha's Hideous Laughter",
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 惑控（吟游诗人、魔契师、法师）',
      '施法时间：动作',
      '施法距离：30尺',
      '法术成分：V、S、M（一块甜馅饼和一根羽毛）',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '施法距离内你可见的一名生物进行一次感知豁免。豁免失败，目标在持续时间内陷入失能和倒地状态。在此期间，目标会不受控制地狂笑（只要它能够发笑），且无法结束自身的倒地状态。 目标在其每回合结束或受到伤害时，可以再进行一次感知豁免。如果豁免是因受到伤害所致，则该次豁免具有优势。豁免成功时，法术终止。 升环施法。使用的法术位每比一环高一环，你就可以额外选择一个生物作为目标。',
    targets: [
      '施法距离内你可见的一名生物进行一次感知豁免。',
      '豁免失败，目标在持续时间内陷入失能和倒地状态。',
      '在此期间，目标会不受控制地狂笑（只要它能够发笑），且无法结束自身的倒地状态。',
      '目标在其每回合结束或受到伤害时，可以再进行一次感知豁免。',
      '使用的法术位每比一环高一环，你就可以额外选择一个生物作为目标。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一块甜馅饼和一根羽毛）'],
    savingThrows: [
      '施法距离内你可见的一名生物进行一次感知豁免。',
      '豁免失败，目标在持续时间内陷入失能和倒地状态。',
      '目标在其每回合结束或受到伤害时，可以再进行一次感知豁免。',
      '如果豁免是因受到伤害所致，则该次豁免具有优势。',
      '豁免成功时，法术终止。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '在此期间，目标会不受控制地狂笑（只要它能够发笑），且无法结束自身的倒地状态。',
      '目标在其每回合结束或受到伤害时，可以再进行一次感知豁免。',
      '如果豁免是因受到伤害所致，则该次豁免具有优势。',
      '豁免成功时，法术终止。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，你就可以额外选择一个生物作为目标。'],
    visibility: [
      '施法距离内你可见的一名生物进行一次感知豁免。',
      '目标在其每回合结束或受到伤害时，可以再进行一次感知豁免。',
    ],
    contentWarnings: [],
  },
  'hunter-s-mark': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You magically mark one creature you can see within range as your quarry. Until the spell ends, you deal an extra 1d6 Force damage to the target whenever you hit it with an attack roll. You also have Advantage on any Wisdom (Perception or Survival) check you make to find it. If the target drops to 0 Hit Points before this spell ends, you can take a Bonus Action to move the mark to a new creature you can see within range. Using a Higher-Level Spell Slot. Your Concentration can last longer with a spell slot of level 3–4 (up to 8 hours) or 5+ (up to 24 hours).',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: "Hunter's_Mark",
      title: "猎人印记｜Hunter's Mark",
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 预言（游侠）',
      '施法时间：附赠动作',
      '施法距离：90尺',
      '法术成分：V',
      '持续时间：专注，至多1小时',
    ],
    sourceText:
      '你指定施法距离内一个你能看见的生物并以魔法标记其作为你的猎物。每当你以攻击检定命中该目标时，你对其额外造成1d6力场伤害，且每当你为寻找目标生物而进行感知（察觉或求生）检定时都具有优势，直至法术结束。 如果在法术结束前目标 HP 降至 0，则你可以用附赠动作 将标记转移至施法距离内的另一个可见生物。 升环施法。使用三环或四环法术位施展该法术时，其专注可以维持至多8小时。使用环阶5+的法术位施展该法术时，其专注可以维持至多 24 小时。',
    targets: [
      '你指定施法距离内一个你能看见的生物并以魔法标记其作为你的猎物。',
      '每当你以攻击检定命中该目标时，你对其额外造成1d6力场伤害，且每当你为寻找目标生物而进行感知（察觉或求生）检定时都具有优势，直至法术结束。',
      '如果在法术结束前目标 HP 降至 0，则你可以用附赠动作 将标记转移至施法距离内的另一个可见生物。',
    ],
    resources: ['施法时间：附赠动作', '法术成分：V'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '每当你以攻击检定命中该目标时，你对其额外造成1d6力场伤害，且每当你为寻找目标生物而进行感知（察觉或求生）检定时都具有优势，直至法术结束。',
      '如果在法术结束前目标 HP 降至 0，则你可以用附赠动作 将标记转移至施法距离内的另一个可见生物。',
    ],
    upcasting: ['升环施法。', '使用环阶5+的法术位施展该法术时，其专注可以维持至多 24 小时。'],
    visibility: [
      '你指定施法距离内一个你能看见的生物并以魔法标记其作为你的猎物。',
      '每当你以攻击检定命中该目标时，你对其额外造成1d6力场伤害，且每当你为寻找目标生物而进行感知（察觉或求生）检定时都具有优势，直至法术结束。',
      '如果在法术结束前目标 HP 降至 0，则你可以用附赠动作 将标记转移至施法距离内的另一个可见生物。',
    ],
    contentWarnings: [],
  },
  'ice-knife': {
    categories: ['pure-damage'],
    catalogueText:
      'You create a shard of ice and fling it at one creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 Piercing damage. Hit or miss, the shard then explodes. The target and each creature within 5 feet of it must succeed on a Dexterity saving throw or take 2d6 Cold damage. Using a Higher-Level Spell Slot. The Cold damage increases by 1d6 for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Ice_Knife',
      title: '冰刃｜Ice Knife',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 咒法（德鲁伊、术士、法师）',
      '施法时间：动作',
      '施法距离：60尺',
      '法术成分：S、M（一滴水或一块冰）',
      '持续时间：立即',
    ],
    sourceText:
      '你制造出一块冰晶裂片，并将它射向施法距离内的一个生物。你对目标进行一次远程法术攻击。若击中，目标受到 1d10 点穿刺伤害。无论击中与否，裂片都会在那之后立刻爆裂。攻击目标和其5尺范围内的每名生物都必须通过一次敏捷豁免检定，否则将受到 2d6 点寒冷伤害。 升环施法。 你使用的法术位每比一环高一环，寒冷伤害就增加1d6。',
    targets: [
      '你制造出一块冰晶裂片，并将它射向施法距离内的一个生物。',
      '你对目标进行一次远程法术攻击。',
      '若击中，目标受到 1d10 点穿刺伤害。',
      '攻击目标和其5尺范围内的每名生物都必须通过一次敏捷豁免检定，否则将受到 2d6 点寒冷伤害。',
    ],
    resources: ['施法时间：动作', '法术成分：S、M（一滴水或一块冰）'],
    savingThrows: [
      '攻击目标和其5尺范围内的每名生物都必须通过一次敏捷豁免检定，否则将受到 2d6 点寒冷伤害。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['升环施法。', '你使用的法术位每比一环高一环，寒冷伤害就增加1d6。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  identify: {
    categories: ['non-damage', 'perception'],
    catalogueText:
      'You touch an object throughout the spell’s casting. If the object is a magic item or some other magical object, you learn its properties and how to use them, whether it requires Attunement, and how many charges it has, if any. You learn whether any ongoing spells are affecting the item and what they are. If the item was created by a spell, you learn that spell’s name. If you instead touch a creature throughout the casting, you learn which ongoing spells, if any, are currently affecting it.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Identify',
      title: '鉴定术｜Identify',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 预言（吟游诗人、法师、奇械师）',
      '施法时间：1分钟或仪式',
      '施法距离：触碰',
      '法术成分： V、S、M（一颗价值100GP+的珍珠）',
      '持续时间：立即',
    ],
    sourceText:
      '你需要在施法过程中与某个物件保持接触。如果该物件是魔法物品之类的魔法性物件，你将知晓其属性和使用方式，以及了解是否需要同调、剩余多少充能数（若其有）。你还可以发现是否有法术正影响着该物件，以及这些法术具体是什么。如果该物件是由法术创造出来的物件，你将知晓该法术的名称。 你也可以改为在施法过程中一直接触一名生物，而你将知晓正在影响该生物的那些法术（若有）是哪些法术。',
    targets: [
      '你需要在施法过程中与某个物件保持接触。',
      '如果该物件是魔法物品之类的魔法性物件，你将知晓其属性和使用方式，以及了解是否需要同调、剩余多少充能数（若其有）。',
      '你还可以发现是否有法术正影响着该物件，以及这些法术具体是什么。',
      '如果该物件是由法术创造出来的物件，你将知晓该法术的名称。',
      '你也可以改为在施法过程中一直接触一名生物，而你将知晓正在影响该生物的那些法术（若有）是哪些法术。',
    ],
    resources: ['施法时间：1分钟或仪式', '法术成分： V、S、M（一颗价值100GP+的珍珠）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '如果该物件是魔法物品之类的魔法性物件，你将知晓其属性和使用方式，以及了解是否需要同调、剩余多少充能数（若其有）。',
      '如果该物件是由法术创造出来的物件，你将知晓该法术的名称。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '如果该物件是魔法物品之类的魔法性物件，你将知晓其属性和使用方式，以及了解是否需要同调、剩余多少充能数（若其有）。',
      '你还可以发现是否有法术正影响着该物件，以及这些法术具体是什么。',
      '如果该物件是由法术创造出来的物件，你将知晓该法术的名称。',
      '你也可以改为在施法过程中一直接触一名生物，而你将知晓正在影响该生物的那些法术（若有）是哪些法术。',
    ],
    contentWarnings: [],
  },
  'illusory-script': {
    categories: ['non-damage', 'environment', 'perception'],
    catalogueText:
      'You write on parchment, paper, or another suitable material and imbue it with an illusion that lasts for the duration. To you and any creatures you designate when you cast the spell, the writing appears normal, seems to be written in your hand, and conveys whatever meaning you intended when you wrote the text. To all others, the writing appears as if it were written in an unknown or magical script that is unintelligible. Alternatively, the illusion can alter the meaning, handwriting, and language of the text, though the language must be one you know. If the spell is dispelled, the original script and the illusion both disappear. A creature that has Truesight can read the hidden message.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Illusory_Script',
      title: '迷幻手稿｜Illusory Script',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 幻术（吟游诗人、法师）',
      '施法时间：1分钟或仪式',
      '施法距离：触碰',
      '法术成分：V、S、M（价值 10+GP 的墨水，作为法术耗材）',
      '持续时间：10日',
    ],
    sourceText:
      '你在羊皮纸，纸张或是其他适合书写的材质上书写文字并对其施加一个强力的幻象。其效应将持续至法术终止。 文件对于你和你施法时所指定的生物而言是一份普通的文件，文件内容即是以你的笔迹传达你写下手稿时想要传达的一切意义。而对于所有其他阅读者而言，该文件看起来就像由难懂的未知文字或魔法文字所书写。此外，你还可以使该文件呈现出完全不同的信息，使其看起来是用另一种笔迹或者语言所书写，不过你必须懂得该语言。 如果法术被解除，则幻象和原始手稿一同消失不见。 拥有真实视觉的生物可以读出其内被隐藏的信息。',
    targets: [
      '文件对于你和你施法时所指定的生物而言是一份普通的文件，文件内容即是以你的笔迹传达你写下手稿时想要传达的一切意义。',
      '拥有真实视觉的生物可以读出其内被隐藏的信息。',
    ],
    resources: ['施法时间：1分钟或仪式', '法术成分：V、S、M（价值 10+GP 的墨水，作为法术耗材）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['其效应将持续至法术终止。', '如果法术被解除，则幻象和原始手稿一同消失不见。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '你在羊皮纸，纸张或是其他适合书写的材质上书写文字并对其施加一个强力的幻象。',
      '如果法术被解除，则幻象和原始手稿一同消失不见。',
      '拥有真实视觉的生物可以读出其内被隐藏的信息。',
    ],
    contentWarnings: [],
  },
  'inflict-wounds': {
    categories: ['pure-damage'],
    catalogueText:
      'A creature you touch makes a Constitution saving throw, taking 2d10 Necrotic damage on a failed save or half as much damage on a successful one. Using a Higher-Level Spell Slot. The damage increases by 1d10 for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Inflict_Wounds',
      title: '致伤术｜Inflict Wounds',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 死灵（牧师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你迫使触碰的一名生物进行体质豁免检定，豁免失败将受到 2d10 的暗蚀伤害，豁免成功则受到半数伤害。 升环施法。你使用的法术位每比一环高一环，暗蚀伤害就增加1d10。',
    targets: [
      '你迫使触碰的一名生物进行体质豁免检定，豁免失败将受到 2d10 的暗蚀伤害，豁免成功则受到半数伤害。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '你迫使触碰的一名生物进行体质豁免检定，豁免失败将受到 2d10 的暗蚀伤害，豁免成功则受到半数伤害。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['升环施法。', '你使用的法术位每比一环高一环，暗蚀伤害就增加1d10。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  jump: {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You touch a willing creature. Once on each of its turns until the spell ends, that creature can jump up to 30 feet by spending 10 feet of movement. Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Jump',
      title: '跳跃术｜Jump',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 变化（德鲁伊、游侠、术士、法师、奇械师）',
      '施法时间：附赠动作',
      '施法距离：触碰',
      '法术成分：V、S、M（一只蚱蜢的后腿）',
      '持续时间：1分钟',
    ],
    sourceText:
      '你触碰一个自愿生物。在法术结束前，每该生物他的回合内一次，其可以消耗10尺移动力来跳跃至多30尺距离。 升环施法。使用的法术位每比一环高一环，你就可以额外选择一个生物作为目标。',
    targets: [
      '你触碰一个自愿生物。',
      '在法术结束前，每该生物他的回合内一次，其可以消耗10尺移动力来跳跃至多30尺距离。',
      '使用的法术位每比一环高一环，你就可以额外选择一个生物作为目标。',
    ],
    resources: ['施法时间：附赠动作', '法术成分：V、S、M（一只蚱蜢的后腿）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '在法术结束前，每该生物他的回合内一次，其可以消耗10尺移动力来跳跃至多30尺距离。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，你就可以额外选择一个生物作为目标。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  light: {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'You touch one Large or smaller object that isn’t being worn or carried by someone else. Until the spell ends, the object sheds Bright Light in a 20-foot radius and Dim Light for an additional 20 feet. The light can be colored as you like. Covering the object with something opaque blocks the light. The spell ends if you cast it again.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Light',
      title: '光亮术｜Light',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '塑能 戏法（吟游诗人、牧师、术士、法师、奇械师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、M（一只萤火虫或一片磷光苔藓）',
      '持续时间：1小时',
    ],
    sourceText:
      '你触碰一个体型不超过大型，且未被他人携带/着装的物件。在法术终止前，物件将发出20尺半径的明亮光照以及额外20尺的微光光照。光的颜色由你决定。 该物件被不透明的东西完全遮盖时，其光照也将被遮挡。此法术将在你再次施展它时提前终止。',
    targets: [
      '你触碰一个体型不超过大型，且未被他人携带/着装的物件。',
      '在法术终止前，物件将发出20尺半径的明亮光照以及额外20尺的微光光照。',
      '该物件被不透明的东西完全遮盖时，其光照也将被遮挡。',
    ],
    resources: ['施法时间：动作', '法术成分：V、M（一只萤火虫或一片磷光苔藓）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '在法术终止前，物件将发出20尺半径的明亮光照以及额外20尺的微光光照。',
      '此法术将在你再次施展它时提前终止。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '在法术终止前，物件将发出20尺半径的明亮光照以及额外20尺的微光光照。',
      '该物件被不透明的东西完全遮盖时，其光照也将被遮挡。',
    ],
    contentWarnings: [],
  },
  longstrider: {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You touch a creature. The target’s Speed increases by 10 feet until the spell ends. Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Longstrider',
      title: '大步奔行｜Longstrider',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 变化（吟游诗人、德鲁伊、游侠、法师、奇械师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S、M（一撮泥土）',
      '持续时间：1 小时',
    ],
    sourceText:
      '你触碰一个生物，该目标的速度增加10尺，直至法术结束。 升环施法。使用的法术位每比一环高一环，你就可以额外指定一个目标。',
    targets: [
      '你触碰一个生物，该目标的速度增加10尺，直至法术结束。',
      '使用的法术位每比一环高一环，你就可以额外指定一个目标。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一撮泥土）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['你触碰一个生物，该目标的速度增加10尺，直至法术结束。'],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，你就可以额外指定一个目标。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'mage-armor': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You touch a willing creature who isn’t wearing armor. Until the spell ends, the target’s base AC becomes 13 plus its Dexterity modifier. The spell ends early if the target dons armor.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Mage_Armor',
      title: '法师护甲｜Mage Armor',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 防护（术士、法师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S、M（一块鞣制过的皮革）',
      '持续时间：8小时',
    ],
    sourceText:
      '你触碰一个未着装护甲的自愿生物。直至法术终止前，目标的基础AC变为 13+它的敏捷调整值。当目标穿上护甲时，此法术将提前终止。',
    targets: [
      '你触碰一个未着装护甲的自愿生物。',
      '直至法术终止前，目标的基础AC变为 13+它的敏捷调整值。',
      '当目标穿上护甲时，此法术将提前终止。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一块鞣制过的皮革）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '直至法术终止前，目标的基础AC变为 13+它的敏捷调整值。',
      '当目标穿上护甲时，此法术将提前终止。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'mage-hand': {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'A spectral, floating hand appears at a point you choose within range. The hand lasts for the dura- tion. The hand vanishes if it is ever more than 30 feet away from you or if you cast this spell again. When you cast the spell, you can use the hand to manipulate an object, open an unlocked door or container, stow or retrieve an item from an open container, or pour the contents out of a vial. As a Magic action on your later turns, you can control the hand thus again. As part of that action, you can move the hand up to 30 feet. The hand can’t attack, activate magic items, or carry more than 10 pounds.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Mage_Hand',
      title: '法师之手｜Mage Hand',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '咒法 戏法（吟游诗人、术士、魔契师、法师、奇械师）',
      '施法时间：动作',
      '施法距离：30尺',
      '法术成分：V、S',
      '持续时间：1分钟',
    ],
    sourceText:
      '一只漂浮的幽灵手出现在施法距离内你指定的一点。幽灵手持续存在至法术终止。如果幽灵手与你之间的距离超过30尺，则幽灵手将消失不见。若你再次施展了此法术，现存的幽灵手也将提前消失。 你可以在施展该法术时使用幽灵手实施一个行为：你可以操控一个物件、打开一扇未上锁的门或容器、将一件物品放入或取出一个打开的容器、或是将小瓶中的内容物倾倒出来。 在后续的回合中，你可以用魔法 动作控制幽灵手再次实施上述行为之一。而作为那次动作的一部分，你还可以令幽灵手移动至多30尺。 该幽灵手不能攻击，也不能激活魔法物品或承载超过10磅重的物质。',
    targets: [
      '一只漂浮的幽灵手出现在施法距离内你指定的一点。',
      '如果幽灵手与你之间的距离超过30尺，则幽灵手将消失不见。',
      '你可以在施展该法术时使用幽灵手实施一个行为：你可以操控一个物件、打开一扇未上锁的门或容器、将一件物品放入或取出一个打开的容器、或是将小瓶中的内容物倾倒出来。',
      '该幽灵手不能攻击，也不能激活魔法物品或承载超过10磅重的物质。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '幽灵手持续存在至法术终止。',
      '如果幽灵手与你之间的距离超过30尺，则幽灵手将消失不见。',
      '若你再次施展了此法术，现存的幽灵手也将提前消失。',
      '在后续的回合中，你可以用魔法 动作控制幽灵手再次实施上述行为之一。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'magic-missile': {
    categories: ['pure-damage'],
    catalogueText:
      'You create three glowing darts of magical force. Each dart strikes a creature of your choice that you can see within range. A dart deals 1d4 + 1 Force damage to its target. The darts all strike simultaneously, and you can direct them to hit one creature or several. Using a Higher-Level Spell Slot. The spell creates one more dart for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Magic_Missile',
      title: '魔法飞弹｜Magic Missile',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 塑能（术士、法师）',
      '施法时间：动作',
      '施法距离：120尺',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你创造三枚由魔法力场形成的闪光飞镖，并让每发飞镖袭向施法距离内你能看见的指定生物。每发飞镖对目标造成1d4+1点力场伤害。所有飞镖将同时袭向目标，而你还可以指定它们击中同一个目标或是分别击中几个目标。 升环施法。 使用的法术位每比一环高一环，该法术就会多制造出一支飞镖。',
    targets: [
      '你创造三枚由魔法力场形成的闪光飞镖，并让每发飞镖袭向施法距离内你能看见的指定生物。',
      '每发飞镖对目标造成1d4+1点力场伤害。',
      '所有飞镖将同时袭向目标，而你还可以指定它们击中同一个目标或是分别击中几个目标。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，该法术就会多制造出一支飞镖。'],
    visibility: [
      '你创造三枚由魔法力场形成的闪光飞镖，并让每发飞镖袭向施法距离内你能看见的指定生物。',
    ],
    contentWarnings: [],
  },
  mending: {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'This spell repairs a single break or tear in an object you touch, such as a broken chain link, two halves of a broken key, a torn cloak, or a leaking wineskin. As long as the break or tear is no larger than 1 foot in any dimension, you mend it, leaving no trace of the former damage. This spell can physically repair a magic item, but it can’t restore magic to such an object.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Mending',
      title: '修复术｜Mending',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '变化 戏法（吟游诗人、牧师、德鲁伊、术士、法师）',
      '施法时间：1分钟',
      '施法距离：触碰',
      '法术成分：V、S、M（两块天然磁石）',
      '持续时间：立即',
    ],
    sourceText:
      '该法术修复你所触碰一个物件上的一处破损或裂缝，例如修复一条断裂的链条、一把碎成两半的钥匙、一件撕裂的斗篷、一个漏了的酒袋等。只要破损或断裂处在任意方向上都不超过 1 尺，你就可以不留痕迹地修复它。 该法术可以物理性地修复一件魔法物品，但无法恢复其上的魔法。 （编注：奇械师的职业特性直接给予了这一法术，因此这一法术现不在奇械师法术列表上。）',
    targets: [
      '该法术修复你所触碰一个物件上的一处破损或裂缝，例如修复一条断裂的链条、一把碎成两半的钥匙、一件撕裂的斗篷、一个漏了的酒袋等。',
      '该法术可以物理性地修复一件魔法物品，但无法恢复其上的魔法。',
    ],
    resources: ['施法时间：1分钟', '法术成分：V、S、M（两块天然磁石）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  message: {
    categories: ['non-damage', 'communication'],
    catalogueText:
      'You point toward a creature within range and whisper a message. The target (and only the target) hears the message and can reply in a whisper that only you can hear. You can cast this spell through solid objects if you are familiar with the target and know it is beyond the barrier. Magical silence; 1 foot of stone, metal, or wood; or a thin sheet of lead blocks the spell.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Message',
      title: '传讯术｜Message',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '变化 戏法（吟游诗人、德鲁伊、术士、法师、奇械师）',
      '施法时间：动作',
      '施法距离：120尺',
      '法术成分：S、M（一段铜线）',
      '持续时间：立即',
    ],
    sourceText:
      '你用指向施法距离内的一名生物并低声说出一段信息。该目标（且只有该目标）会听到这段信息，并且可以用只有你能听见的低语回复你。 你可以隔着固态物件施展此法术，但你必须熟悉法术目标并知晓其就在阻挡物后方。魔法性的沉默效应，1尺厚的石头、金属或木料，或是一片薄铅都可以阻挡此法术。',
    targets: [
      '你用指向施法距离内的一名生物并低声说出一段信息。',
      '该目标（且只有该目标）会听到这段信息，并且可以用只有你能听见的低语回复你。',
      '你可以隔着固态物件施展此法术，但你必须熟悉法术目标并知晓其就在阻挡物后方。',
    ],
    resources: ['施法时间：动作', '法术成分：S、M（一段铜线）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '该目标（且只有该目标）会听到这段信息，并且可以用只有你能听见的低语回复你。',
      '你可以隔着固态物件施展此法术，但你必须熟悉法术目标并知晓其就在阻挡物后方。',
    ],
    contentWarnings: [],
  },
  'minor-illusion': {
    categories: ['non-damage', 'environment', 'perception'],
    catalogueText:
      'You create a sound or an image of an object within range that lasts for the duration. See the descriptions below for the effects of each. The illusion ends if you cast this spell again. If a creature takes a Study action to examine the sound or image, the creature can determine that it is an illusion with a successful Intelligence (Investigation) check against your spell save DC. If a crea- ture discerns the illusion for what it is, the illusion becomes faint to the creature. Sound. If you create a sound, its volume can range from a whisper to a scream. It can be your voice, someone else’s voice, a lion’s roar, a beating of drums, or any other sound you choose. The sound continues unabated throughout the duration, or you can make discrete sounds at different times before the spell ends. Image. If you create an image of an object—such as a chair, muddy footprints, or a small chest—it must be no larger than a 5-foot Cube. The image can’t create sound, light, smell, or any other sensory effect. Physical interaction with the image reveals it to be an illusion, since things can pass through it.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Minor_Illusion',
      title: '次级幻象｜Minor Illusion',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '幻术 戏法（吟游诗人、术士、魔契师、法师）',
      '施法时间：动作',
      '施法距离：30尺',
      '法术成分：S、M（少量羊毛）',
      '持续时间：1分钟',
    ],
    sourceText:
      '你在施法距离内创造一段声响或一个物件的影像，并使之维持至法术持续时间结束，详见以下对应效应的描述。你可以再次施展该法术来终止幻象。 生物用研究动作调查该声响或影像时，其必须进行一次对抗该法术豁免 DC 的智力（调查）检定，检定成功则判断出是幻象。对于识破幻象的生物而言，幻象会变得模糊不清。 声响Sound。如果你创造一段声响，其音量可以是低声耳语也可以是高声尖叫。它可以是你或其他任何人的嗓音，或者是一头狮子的咆哮、一段鼓声以及任何你指定的其他声响。声响在持续时间内不会减弱，或者你也可以于法术终止前在不同的时间段创造几段分散的声响。 影像Image。如果你创造一个物件的影像，比如一把椅子、泥泞的脚印、一个小箱子等，则该物件各方向上大小不得大于5尺立方区域。该影像不具有声音、光亮、味道或任何其他的感官效应。由于影像可以被任何物体穿透，因此与之进行物理互动时都会揭露其幻象的本质。',
    targets: [
      '你在施法距离内创造一段声响或一个物件的影像，并使之维持至法术持续时间结束，详见以下对应效应的描述。',
      '生物用研究动作调查该声响或影像时，其必须进行一次对抗该法术豁免 DC 的智力（调查）检定，检定成功则判断出是幻象。',
      '对于识破幻象的生物而言，幻象会变得模糊不清。',
      '它可以是你或其他任何人的嗓音，或者是一头狮子的咆哮、一段鼓声以及任何你指定的其他声响。',
      '如果你创造一个物件的影像，比如一把椅子、泥泞的脚印、一个小箱子等，则该物件各方向上大小不得大于5尺立方区域。',
      '由于影像可以被任何物体穿透，因此与之进行物理互动时都会揭露其幻象的本质。',
    ],
    resources: ['施法时间：动作', '法术成分：S、M（少量羊毛）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '你在施法距离内创造一段声响或一个物件的影像，并使之维持至法术持续时间结束，详见以下对应效应的描述。',
      '你可以再次施展该法术来终止幻象。',
      '如果你创造一段声响，其音量可以是低声耳语也可以是高声尖叫。',
      '声响在持续时间内不会减弱，或者你也可以于法术终止前在不同的时间段创造几段分散的声响。',
      '如果你创造一个物件的影像，比如一把椅子、泥泞的脚印、一个小箱子等，则该物件各方向上大小不得大于5尺立方区域。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '你可以再次施展该法术来终止幻象。',
      '生物用研究动作调查该声响或影像时，其必须进行一次对抗该法术豁免 DC 的智力（调查）检定，检定成功则判断出是幻象。',
      '对于识破幻象的生物而言，幻象会变得模糊不清。',
      '该影像不具有声音、光亮、味道或任何其他的感官效应。',
      '由于影像可以被任何物体穿透，因此与之进行物理互动时都会揭露其幻象的本质。',
    ],
    contentWarnings: [],
  },
  'poison-spray': {
    categories: ['pure-damage'],
    catalogueText:
      'You spray toxic mist at a creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d12 Poison damage. Cantrip Upgrade. The damage increases by 1d12 when you reach levels 5 (2d12), 11 (3d12), and 17 (4d12).',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Poison_Spray',
      title: '毒气喷涌｜Poison Spray',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '死灵 戏法（德鲁伊、术士、魔契师、法师、奇械师）',
      '施法时间：动作',
      '施法距离：30尺',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你向施法距离内一个你可见的生物喷出一股毒气。对目标进行一次远程法术攻击。命中时，目标将受1d12点毒素伤害。 戏法强化。 到达特定等级后，此戏法的伤害将增加1d12：5级（2d12）、11级（3d12）、17级（4d12）。',
    targets: [
      '你向施法距离内一个你可见的生物喷出一股毒气。',
      '对目标进行一次远程法术攻击。',
      '命中时，目标将受1d12点毒素伤害。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: [
      '戏法强化。',
      '到达特定等级后，此戏法的伤害将增加1d12：5级（2d12）、11级（3d12）、17级（4d12）。',
    ],
    visibility: ['你向施法距离内一个你可见的生物喷出一股毒气。'],
    contentWarnings: [],
  },
  prestidigitation: {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'You create a magical effect within range. Choose the effect from the options below. If you cast this spell multiple times, you can have up to three of its non-instantaneous effects active at a time. Sensory Effect. You create an instantaneous, harmless sensory effect, such as a shower of sparks, a puff of wind, faint musical notes, or an odd odor. Fire Play. You instantaneously light or snuff out a candle, a torch, or a small campfire. Clean or Soil. You instantaneously clean or soil an object no larger than 1 cubic foot. Minor Sensation. You chill, warm, or flavor up to 1 cubic foot of nonliving material for 1 hour. Magic Mark. You make a color, a small mark, or a symbol appear on an object or a surface for 1 hour. Minor Creation. You create a nonmagical trinket or an illusory image that can fit in your hand. It lasts until the end of your next turn. A trinket can deal no damage and has no monetary worth.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Prestidigitation',
      title: '魔法伎俩｜Prestidigitation',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '变化 戏法（吟游诗人、术士、魔契师、法师、奇械师）',
      '施法时间：动作',
      '施法距离：10尺',
      '法术成分：V、S',
      '持续时间：至多1小时',
    ],
    sourceText:
      '你在施法距离内创造一个魔法效应。从下述效应中选择一项。如果你多次施展该法术，则可以同时维持至多三个不同的非即时效应。 感官效应Sensory Effect。 你创造一个立即生效的，无害的感官效应，比如一束火花，一阵风，微弱音乐或古怪的臭味。 玩火Fire Play。 你立即点燃或熄灭一根蜡烛、一根火把或一处小篝火。 清洁或弄脏Clean or Soil。 你立即清洁或弄脏一个体积不大于1立方尺的物件。 次级感觉Minor Sensation。 你使一个不大于1立方尺的非活体物质变冷、变暖或对其调味，持续1小时。 魔法印记Magic Mark。 你在一个物件或一个表面上创造一块色斑，一个小印记，或者一个徽记，持续1小时。 次级造物Minor Creation。 你创造出一个非魔法小饰品或一张虚幻图像，其大小不能超过你的手掌大小，它会持续存在至下个你的回合结束为止。一个小饰品不能造成伤害，也不值任何钱。',
    targets: [
      '你在施法距离内创造一个魔法效应。',
      '从下述效应中选择一项。',
      '你立即点燃或熄灭一根蜡烛、一根火把或一处小篝火。',
      '你立即清洁或弄脏一个体积不大于1立方尺的物件。',
      '你在一个物件或一个表面上创造一块色斑，一个小印记，或者一个徽记，持续1小时。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '如果你多次施展该法术，则可以同时维持至多三个不同的非即时效应。',
      '你创造出一个非魔法小饰品或一张虚幻图像，其大小不能超过你的手掌大小，它会持续存在至下个你的回合结束为止。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'produce-flame': {
    categories: ['damage-with-rider', 'environment'],
    catalogueText:
      'A flickering flame appears in your hand and remains there for the duration. While there, the flame emits no heat and ignites nothing, and it sheds Bright Light in a 20-foot radius and Dim Light for an additional 20 feet. The spell ends if you cast it again. Until the spell ends, you can take a Magic action to hurl fire at a creature or an object within 60 feet of you. Make a ranged spell attack. On a hit, the target takes 1d8 Fire damage. Cantrip Upgrade. The damage increases by 1d8 when you reach levels 5 (2d8), 11 (3d8), and 17 (4d8).',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Produce_Flame',
      title: '燃火术｜Produce Flame',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '咒法 戏法（德鲁伊）',
      '施法时间：附赠动作',
      '施法距离：自身',
      '法术成分：V、S',
      '持续时间：10分钟',
    ],
    sourceText:
      '一朵摇曳的火焰出现在你手中，火焰会存在至法术持续时间结束为止。火焰在你手中期间，不会散发任何热量也不会点燃任何东西，发出20尺半径的明亮光照，以及其外20尺范围的微光光照 。此法术会在你再次施展它时提前终止。 直到法术结束为止，你可以用魔法动作向60尺内的一名生物或一个物件丢出火焰。进行一次远程法术攻击。命中时，目标将受到1d8点火焰伤害。 戏法强化。 到达特定等级后，此戏法的伤害将增加1d8：5级（2d8）、11级（3d8）、17级（4d8）。',
    targets: [
      '火焰在你手中期间，不会散发任何热量也不会点燃任何东西，发出20尺半径的明亮光照，以及其外20尺范围的微光光照 。',
      '直到法术结束为止，你可以用魔法动作向60尺内的一名生物或一个物件丢出火焰。',
      '命中时，目标将受到1d8点火焰伤害。',
    ],
    resources: ['施法时间：附赠动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '一朵摇曳的火焰出现在你手中，火焰会存在至法术持续时间结束为止。',
      '此法术会在你再次施展它时提前终止。',
      '直到法术结束为止，你可以用魔法动作向60尺内的一名生物或一个物件丢出火焰。',
    ],
    upcasting: [
      '戏法强化。',
      '到达特定等级后，此戏法的伤害将增加1d8：5级（2d8）、11级（3d8）、17级（4d8）。',
    ],
    visibility: [
      '火焰在你手中期间，不会散发任何热量也不会点燃任何东西，发出20尺半径的明亮光照，以及其外20尺范围的微光光照 。',
    ],
    contentWarnings: [],
  },
  'protection-from-evil-and-good': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'Until the spell ends, one willing creature you touch is protected against creatures that are Aberrations, Celestials, Elementals, Fey, Fiends, or Undead. The protection grants several benefits. Creatures of those types have Disadvantage on attack rolls against the target. The target also can’t be possessed by or gain the Charmed or Frightened conditions from them. If the target is already possessed, Charmed, or Frightened by such a creature, the target has Advantage on any new saving throw against the relevant effect.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Protection_from_Evil_and_Good',
      title: '防护善恶｜Protection from Evil and Good',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 防护（牧师、德鲁伊、圣武士、魔契师、法师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S、M（一瓶25GP+的圣水，作为此法术的耗材）',
      '持续时间：专注，至多10分钟',
    ],
    sourceText:
      '法术结束前，你使触碰的一名自愿生物获得针对下述生物类型的防护：异怪、天族、元素、妖精、邪魔、亡灵。 此防护提供下述几种增益。上述生物类型的生物对目标的攻击检定具有劣势。目标不能被其附身，也不会因其陷入魅惑或恐慌状态。如果目标已经被具有上述生物类型的生物附身，或其魅惑或恐慌状态影响，目标后续进行的相关效应的豁免检定也将具有优势。',
    targets: [
      '法术结束前，你使触碰的一名自愿生物获得针对下述生物类型的防护：异怪、天族、元素、妖精、邪魔、亡灵。',
      '上述生物类型的生物对目标的攻击检定具有劣势。',
      '目标不能被其附身，也不会因其陷入魅惑或恐慌状态。',
      '如果目标已经被具有上述生物类型的生物附身，或其魅惑或恐慌状态影响，目标后续进行的相关效应的豁免检定也将具有优势。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一瓶25GP+的圣水，作为此法术的耗材）'],
    savingThrows: [
      '如果目标已经被具有上述生物类型的生物附身，或其魅惑或恐慌状态影响，目标后续进行的相关效应的豁免检定也将具有优势。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '法术结束前，你使触碰的一名自愿生物获得针对下述生物类型的防护：异怪、天族、元素、妖精、邪魔、亡灵。',
      '如果目标已经被具有上述生物类型的生物附身，或其魅惑或恐慌状态影响，目标后续进行的相关效应的豁免检定也将具有优势。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'purify-food-and-drink': {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'You remove poison and rot from nonmagical food and drink in a 5-foot-radius Sphere centered on a point within range.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Purify_Food_and_Drink',
      title: '净化饮食｜Purify Food and Drink',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 变化（牧师、德鲁伊、圣武士、奇械师）',
      '施法时间：动作或仪式',
      '施法距离：10尺',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText: '以施法距离内一点为中心，你移除半径5尺球状 区域内非魔法食物与饮品中的毒素和腐败。',
    targets: ['以施法距离内一点为中心，你移除半径5尺球状 区域内非魔法食物与饮品中的毒素和腐败。'],
    resources: ['施法时间：动作或仪式', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'ray-of-frost': {
    categories: ['damage-with-rider'],
    catalogueText:
      'A frigid beam of blue-white light streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, it takes 1d8 Cold damage, and its Speed is reduced by 10 feet until the start of your next turn. Cantrip Upgrade. The damage increases by 1d8 when you reach levels 5 (2d8), 11 (3d8), and 17 (4d8).',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Ray_of_Frost',
      title: '冷冻射线｜Ray of Frost',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '塑能 戏法（术士、法师、奇械师）',
      '施法时间：动作',
      '施法距离：60尺',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '一道蓝白色的冰冷光束朝施法距离内的一名生物射去。对目标进行一次远程法术攻击。命中时，目标将受到1d8点寒冷伤害，且其速度将被减少10尺，直到你的下一回合开始为止。 戏法强化。 到达特定等级后，此戏法的伤害将增加1d8：5级（2d8）、11级（3d8）、17级（4d8）。',
    targets: [
      '一道蓝白色的冰冷光束朝施法距离内的一名生物射去。',
      '对目标进行一次远程法术攻击。',
      '命中时，目标将受到1d8点寒冷伤害，且其速度将被减少10尺，直到你的下一回合开始为止。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '命中时，目标将受到1d8点寒冷伤害，且其速度将被减少10尺，直到你的下一回合开始为止。',
    ],
    upcasting: [
      '戏法强化。',
      '到达特定等级后，此戏法的伤害将增加1d8：5级（2d8）、11级（3d8）、17级（4d8）。',
    ],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'ray-of-sickness': {
    categories: ['damage-with-rider', 'condition'],
    catalogueText:
      'You shoot a greenish ray at a creature within range. Make a ranged spell attack against the target. On a hit, the target takes 2d8 Poison damage and has the Poisoned condition until the end of your next turn. Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Ray_of_Sickness',
      title: '致病射线｜Ray of Sickness',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 死灵（术士、法师）',
      '施法时间：动作',
      '施法距离：60尺',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你朝施法距离内一名生物射出一道绿色射线。对目标进行一次远程法术攻击。若命中，则目标受到2d8点毒素伤害且陷入中毒状态，持续至你的下一回合结束。 升环施法。 使用的法术位每比一环高一环，此法术的伤害就增加1d8点。',
    targets: [
      '你朝施法距离内一名生物射出一道绿色射线。',
      '对目标进行一次远程法术攻击。',
      '若命中，则目标受到2d8点毒素伤害且陷入中毒状态，持续至你的下一回合结束。',
      '使用的法术位每比一环高一环，此法术的伤害就增加1d8点。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['若命中，则目标受到2d8点毒素伤害且陷入中毒状态，持续至你的下一回合结束。'],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，此法术的伤害就增加1d8点。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  resistance: {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You touch a willing creature and choose a damage type: Acid, Bludgeoning, Cold, Fire, Lightning, Necrotic, Piercing, Poison, Radiant, Slashing, or Thunder. When the creature takes damage of the chosen type before the spell ends, the creature reduces the total damage taken by 1d4. A creature can benefit from this spell only once per turn.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Resistance',
      title: '抵抗术｜Resistance',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '防护 戏法（牧师、德鲁伊、奇械师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '你触碰一名自愿生物并选择一种伤害类型：强酸、钝击、寒冷、火焰、闪电、暗蚀、穿刺、毒素、光耀、挥砍、雷鸣。在此法术结束之前，每当该生物受到所选类型伤害时，那名生物所受的总伤害减少1d4。一名生物一回合只能受到一次该法术的增益。',
    targets: [
      '你触碰一名自愿生物并选择一种伤害类型：强酸、钝击、寒冷、火焰、闪电、暗蚀、穿刺、毒素、光耀、挥砍、雷鸣。',
      '在此法术结束之前，每当该生物受到所选类型伤害时，那名生物所受的总伤害减少1d4。',
      '一名生物一回合只能受到一次该法术的增益。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '在此法术结束之前，每当该生物受到所选类型伤害时，那名生物所受的总伤害减少1d4。',
      '一名生物一回合只能受到一次该法术的增益。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'sacred-flame': {
    categories: ['pure-damage'],
    catalogueText:
      'Flame-like radiance descends on a creature that you can see within range. The target must succeed on a Dexterity saving throw or take 1d8 Radiant damage. The target gains no benefit from Half Cover or Three-Quarters Cover for this save. Cantrip Upgrade. The damage increases by 1d8 when you reach levels 5 (2d8), 11 (3d8), and 17 (4d8).',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Sacred_Flame',
      title: '圣火术｜Sacred Flame',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '塑能 戏法（牧师）',
      '施法时间：动作',
      '施法距离：60 尺',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '如同烈焰般的辉光向着施法距离内你能看见的一名生物倾泻而下。目标必须要通过一次敏捷豁免，否则将受到1d8点光耀伤害。在这次豁免检定中，目标无法享受来自半身掩护和四分之三掩护 的增益。 戏法强化。该法术的伤害会在你达到下列等级时增加1d8：5级（2d8），11 级（3d8），17 级（4d8）。',
    targets: [
      '如同烈焰般的辉光向着施法距离内你能看见的一名生物倾泻而下。',
      '目标必须要通过一次敏捷豁免，否则将受到1d8点光耀伤害。',
      '在这次豁免检定中，目标无法享受来自半身掩护和四分之三掩护 的增益。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '目标必须要通过一次敏捷豁免，否则将受到1d8点光耀伤害。',
      '在这次豁免检定中，目标无法享受来自半身掩护和四分之三掩护 的增益。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: [
      '戏法强化。',
      '该法术的伤害会在你达到下列等级时增加1d8：5级（2d8），11 级（3d8），17 级（4d8）。',
    ],
    visibility: ['如同烈焰般的辉光向着施法距离内你能看见的一名生物倾泻而下。'],
    contentWarnings: [],
  },
  sanctuary: {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You ward a creature within range. Until the spell ends, any creature who targets the warded crea- ture with an attack roll or a damaging spell must succeed on a Wisdom saving throw or either choose a new target or lose the attack or spell. This spell doesn’t protect the warded creature from areas of effect. The spell ends if the warded creature makes an attack roll, casts a spell, or deals damage.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Sanctuary',
      title: '庇护术｜Sanctuary',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 防护（牧师、奇械师）',
      '施法时间：附赠动作',
      '施法距离：30 尺',
      '法术成分：V、S、M（一块镜子碎片）',
      '持续时间：1 分钟',
    ],
    sourceText:
      '你为施法距离内的一名生物施加守护。在法术终止前，当任何生物将受守护的生物定为其攻击检定或伤害性法术的目标时，该生物都必须成功通过一次感知豁免，否则该生物必须改为选定另一名生物作为新的目标或者失去本次的攻击或法术。不过此法术无法令受术者免受区域效应的影响。 若受保护生物发动一次攻击，施展一道法术，或是造成任何伤害，则该法术随之终止。',
    targets: [
      '你为施法距离内的一名生物施加守护。',
      '在法术终止前，当任何生物将受守护的生物定为其攻击检定或伤害性法术的目标时，该生物都必须成功通过一次感知豁免，否则该生物必须改为选定另一名生物作为新的目标或者失去本次的攻击或法术。',
      '不过此法术无法令受术者免受区域效应的影响。',
      '若受保护生物发动一次攻击，施展一道法术，或是造成任何伤害，则该法术随之终止。',
    ],
    resources: ['施法时间：附赠动作', '法术成分：V、S、M（一块镜子碎片）'],
    savingThrows: [
      '在法术终止前，当任何生物将受守护的生物定为其攻击检定或伤害性法术的目标时，该生物都必须成功通过一次感知豁免，否则该生物必须改为选定另一名生物作为新的目标或者失去本次的攻击或法术。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '在法术终止前，当任何生物将受守护的生物定为其攻击检定或伤害性法术的目标时，该生物都必须成功通过一次感知豁免，否则该生物必须改为选定另一名生物作为新的目标或者失去本次的攻击或法术。',
      '若受保护生物发动一次攻击，施展一道法术，或是造成任何伤害，则该法术随之终止。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '在法术终止前，当任何生物将受守护的生物定为其攻击检定或伤害性法术的目标时，该生物都必须成功通过一次感知豁免，否则该生物必须改为选定另一名生物作为新的目标或者失去本次的攻击或法术。',
    ],
    contentWarnings: [],
  },
  'searing-smite': {
    categories: ['damage-with-rider'],
    catalogueText:
      'As you hit the target, it takes an extra 1d6 Fire damage from the attack. At the start of each of its turns until the spell ends, the target takes 1d6 Fire damage and then makes a Constitution saving throw. On a failed save, the spell continues. On a successful save, the spell ends. Using a Higher-Level Spell Slot. All the damage increases by 1d6 for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Searing_Smite',
      title: '炽焰斩｜Searing Smite',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 塑能（圣武士）',
      '施法时间：附赠动作，当你使用近战武器或徒手打击命中一个目标后立即执行',
      '施法距离：自身',
      '法术成分：V',
      '持续时间：1分钟',
    ],
    sourceText:
      '被该次攻击检定命中的目标会在此次攻击中额外受到1d6火焰伤害。直至法术终止前，目标会在其每个回合开始时受到1d6点火焰伤害，并进行一次体质豁免。豁免失败则法术继续生效，成功则法术终止。 升环施法。使用的法术位每比一环高一环，此法术造成的所有伤害都会增加1d6点。',
    targets: [
      '被该次攻击检定命中的目标会在此次攻击中额外受到1d6火焰伤害。',
      '直至法术终止前，目标会在其每个回合开始时受到1d6点火焰伤害，并进行一次体质豁免。',
      '使用的法术位每比一环高一环，此法术造成的所有伤害都会增加1d6点。',
    ],
    resources: [
      '施法时间：附赠动作，当你使用近战武器或徒手打击命中一个目标后立即执行',
      '法术成分：V',
    ],
    savingThrows: [
      '直至法术终止前，目标会在其每个回合开始时受到1d6点火焰伤害，并进行一次体质豁免。',
      '豁免失败则法术继续生效，成功则法术终止。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '直至法术终止前，目标会在其每个回合开始时受到1d6点火焰伤害，并进行一次体质豁免。',
      '豁免失败则法术继续生效，成功则法术终止。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，此法术造成的所有伤害都会增加1d6点。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  shield: {
    categories: ['non-damage', 'support'],
    catalogueText:
      'An imperceptible barrier of magical force protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from Magic Missile .',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Shield',
      title: '护盾术｜Shield',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 防护（术士、法师）',
      '施法时间：反应，当你被攻击命中或被作为魔法飞弹Magic Missile法术的目标时执行',
      '施法距离：自身',
      '法术成分：V、S',
      '持续时间：1 轮',
    ],
    sourceText:
      '一道看不见的力场制护盾浮现在你身旁，保护着你。在你的下一回合开始前，你的 AC 具有+5 加值（在触发该法术的攻击之前生效），并且不会受到魔法飞弹Magic Missle的伤害。',
    targets: ['本术目标由下列完整正文限定；无可简化的生物目标字段。'],
    resources: [
      '施法时间：反应，当你被攻击命中或被作为魔法飞弹Magic Missile法术的目标时执行',
      '法术成分：V、S',
    ],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '在你的下一回合开始前，你的 AC 具有+5 加值（在触发该法术的攻击之前生效），并且不会受到魔法飞弹Magic Missle的伤害。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'shield-of-faith': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'A shimmering field surrounds a creature of your choice within range, granting it a +2 bonus to AC for the duration.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Shield_of_Faith',
      title: '虔诚护盾｜Shield of Faith',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 防护（牧师、圣武士）',
      '施法时间：附赠动作',
      '施法距离：60 尺',
      '法术成分：V、S、M（一张祷文卷轴）',
      '持续时间：专注，至多 10 分钟',
    ],
    sourceText:
      '一片闪着微光的能量场围绕着施法距离内你指定的一个生物，使目标在法术持续时间内AC获得+2 加值。',
    targets: [
      '一片闪着微光的能量场围绕着施法距离内你指定的一个生物，使目标在法术持续时间内AC获得+2 加值。',
    ],
    resources: ['施法时间：附赠动作', '法术成分：V、S、M（一张祷文卷轴）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '一片闪着微光的能量场围绕着施法距离内你指定的一个生物，使目标在法术持续时间内AC获得+2 加值。',
    ],
    contentWarnings: [],
  },
  shillelagh: {
    categories: ['non-damage', 'support'],
    catalogueText:
      'A Club or Quarterstaff you are holding is imbued with nature’s power. For the duration, you can use your spellcasting ability instead of Strength for the attack and damage rolls of melee attacks using that weapon, and the weapon’s damage die becomes a d8. If the attack deals damage, it can be Force damage or the weapon’s normal damage type (your choice). The spell ends early if you cast it again or if you let go of the weapon. Cantrip Upgrade. The damage die changes when you reach levels 5 (d10), 11 (d12), and 17 (2d6).',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Shillelagh',
      title: '橡棍术｜Shillelagh',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '变化 戏法（德鲁伊）',
      '施法时间：附赠动作',
      '施法距离：自身',
      '法术成分：V、S、M（槲寄生）',
      '持续时间：1分钟',
    ],
    sourceText:
      '你将自然之力灌入手中持握的一根短棒或长棍中。你在法术持续时间内使用该武器进行近战攻击时，可以用你的施法属性代替力量属性来进行攻击检定和伤害掷骰，且该武器的伤害骰变为d8。此类攻击造成伤害时，你可以选择将其伤害类型改为力场伤害，或是维持武器原本的伤害类型。你再次施展该法术或丢掉该武器时，该法术也随之终止。 戏法强化。 到达特定等级后，受术武器的伤害骰会改变：5级（1d10），11级（1d12），17级（2d6）。',
    targets: [
      '此类攻击造成伤害时，你可以选择将其伤害类型改为力场伤害，或是维持武器原本的伤害类型。',
    ],
    resources: ['施法时间：附赠动作', '法术成分：V、S、M（槲寄生）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['你再次施展该法术或丢掉该武器时，该法术也随之终止。'],
    upcasting: [
      '戏法强化。',
      '到达特定等级后，受术武器的伤害骰会改变：5级（1d10），11级（1d12），17级（2d6）。',
    ],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'shocking-grasp': {
    categories: ['damage-with-rider'],
    catalogueText:
      'Lightning springs from you to a creature that you try to touch. Make a melee spell attack against the target. On a hit, the target takes 1d8 Lightning damage, and it can’t make Opportunity Attacks until the start of its next turn. Cantrip Upgrade. The damage increases by 1d8 when you reach levels 5 (2d8), 11 (3d8), and 17 (4d8).',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Shocking_Grasp',
      title: '电爪｜Shocking Grasp',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '塑能 戏法（术士、法师、奇械师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你放出闪电，击向一名你试图触碰的生物。对目标发动一次近战法术攻击。若命中，则目标受到 1d8 点闪电伤害，并且在其下一回合开始前不能执行借机攻击。 戏法强化。 到达特定等级后，此戏法的伤害将增加1d8：5级（2d8）、11级（3d8）、17级（4d8）。',
    targets: [
      '你放出闪电，击向一名你试图触碰的生物。',
      '对目标发动一次近战法术攻击。',
      '若命中，则目标受到 1d8 点闪电伤害，并且在其下一回合开始前不能执行借机攻击。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['若命中，则目标受到 1d8 点闪电伤害，并且在其下一回合开始前不能执行借机攻击。'],
    upcasting: [
      '戏法强化。',
      '到达特定等级后，此戏法的伤害将增加1d8：5级（2d8）、11级（3d8）、17级（4d8）。',
    ],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'silent-image': {
    categories: ['non-damage', 'environment', 'perception'],
    catalogueText:
      'You create the image of an object, a creature, or some other visible phenomenon that is no larger than a 15-foot Cube. The image appears at a spot within range and lasts for the duration. The image is purely visual; it isn’t accompanied by sound, smell, or other sensory effects. As a Magic action, you can cause the image to move to any spot within range. As the image changes location, you can alter its appearance so that its movements appear natural for the image. For example, if you create an image of a creature and move it, you can alter the image so that it appears to be walking. Physical interaction with the image reveals it to be an illusion, since things can pass through it. A creature that takes a Study action to examine the image can determine that it is an illusion with a successful Intelligence (Investigation) check against your spell save DC. If a creature discerns the illusion for what it is, the creature can see through the image.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Silent_Image',
      title: '无声幻影｜Silent Image',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 幻术（吟游诗人、术士、法师）',
      '施法时间：动作',
      '施法距离：60 尺',
      '法术成分：V、S、M（少量羊毛）',
      '持续时间：专注，至多 10 分钟',
    ],
    sourceText:
      '你创造一个影像，其形象来自一个大小不超过边长 15 尺立方体的物件，生物或其他的可视现象。影像出现在施法距离内的一处位置并在法术持续时间内持续存在。该影像是纯粹的视觉影像；它不会被听觉，嗅觉或其他感官感受到。 你可以使用魔法动作将影像移动到施法距离内的另一个位置。影像改变位置时，你可以改变影像的外观使其移动得更自然。例如，如果你创造了一个生物的影像并移动它，则你可以改变影像，使它看起来就像是在走路。 由于影像无法被碰到，任何与该影像进行的物理互动都会暴露其幻象的本质。一个生物使用研究动作调查影像时，它可以进行一次对抗法术豁免 DC 的智力（调查）检定。辨出幻象的生物可以看破该影像，在该生物看来会透过影像看到其背后的事物。',
    targets: [
      '你创造一个影像，其形象来自一个大小不超过边长 15 尺立方体的物件，生物或其他的可视现象。',
      '影像出现在施法距离内的一处位置并在法术持续时间内持续存在。',
      '你可以使用魔法动作将影像移动到施法距离内的另一个位置。',
      '例如，如果你创造了一个生物的影像并移动它，则你可以改变影像，使它看起来就像是在走路。',
      '一个生物使用研究动作调查影像时，它可以进行一次对抗法术豁免 DC 的智力（调查）检定。',
      '辨出幻象的生物可以看破该影像，在该生物看来会透过影像看到其背后的事物。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（少量羊毛）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '例如，如果你创造了一个生物的影像并移动它，则你可以改变影像，使它看起来就像是在走路。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '该影像是纯粹的视觉影像；它不会被听觉，嗅觉或其他感官感受到。',
      '由于影像无法被碰到，任何与该影像进行的物理互动都会暴露其幻象的本质。',
      '辨出幻象的生物可以看破该影像，在该生物看来会透过影像看到其背后的事物。',
    ],
    contentWarnings: [],
  },
  sleep: {
    categories: ['non-damage', 'condition'],
    catalogueText:
      'Each creature of your choice in a 5-foot-radius Sphere centered on a point within range must succeed on a Wisdom saving throw or have the Inca- pacitated condition until the end of its next turn, at which point it must repeat the save. If the target fails the second save, the target has the Unconscious condition for the duration. The spell ends on a target if it takes damage or someone within 5 feet of it takes an action to shake it out of the spell’s effect. Creatures that don’t sleep, such as elves, or that have Immunity to the Exhaustion condition automatically succeed on saves against this spell.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Sleep',
      title: '睡眠术｜Sleep',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 惑控（吟游诗人、术士、法师）',
      '施法时间：动作',
      '施法距离：60 尺',
      '法术成分：V、S、M（一把细沙或玫瑰花瓣）',
      '持续时间：专注，至多1 分钟',
    ],
    sourceText:
      '以施法距离内一点为源点，5尺半径球状区域内每个你选择的生物都必须成功通过一次感知豁免否则直到其下个回合结束陷入失能状态。在其下个回合结束时，它必须重复此豁免。如果目标第二次豁免失败，目标在持续时间内陷入昏迷状态。若目标受到伤害或其5尺内有人用一个动作将其摇醒，目标身上的法术结束。 不需要睡眠的生物（例如精灵）或免疫力竭状态的生物自动成功通过对抗此法术的豁免。',
    targets: [
      '以施法距离内一点为源点，5尺半径球状区域内每个你选择的生物都必须成功通过一次感知豁免否则直到其下个回合结束陷入失能状态。',
      '如果目标第二次豁免失败，目标在持续时间内陷入昏迷状态。',
      '若目标受到伤害或其5尺内有人用一个动作将其摇醒，目标身上的法术结束。',
      '不需要睡眠的生物（例如精灵）或免疫力竭状态的生物自动成功通过对抗此法术的豁免。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一把细沙或玫瑰花瓣）'],
    savingThrows: [
      '以施法距离内一点为源点，5尺半径球状区域内每个你选择的生物都必须成功通过一次感知豁免否则直到其下个回合结束陷入失能状态。',
      '在其下个回合结束时，它必须重复此豁免。',
      '如果目标第二次豁免失败，目标在持续时间内陷入昏迷状态。',
      '不需要睡眠的生物（例如精灵）或免疫力竭状态的生物自动成功通过对抗此法术的豁免。',
    ],
    immunity: ['不需要睡眠的生物（例如精灵）或免疫力竭状态的生物自动成功通过对抗此法术的豁免。'],
    repeatAndEnd: [
      '以施法距离内一点为源点，5尺半径球状区域内每个你选择的生物都必须成功通过一次感知豁免否则直到其下个回合结束陷入失能状态。',
      '在其下个回合结束时，它必须重复此豁免。',
      '如果目标第二次豁免失败，目标在持续时间内陷入昏迷状态。',
      '若目标受到伤害或其5尺内有人用一个动作将其摇醒，目标身上的法术结束。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '以施法距离内一点为源点，5尺半径球状区域内每个你选择的生物都必须成功通过一次感知豁免否则直到其下个回合结束陷入失能状态。',
    ],
    contentWarnings: [],
  },
  'sorcerous-burst': {
    categories: ['pure-damage'],
    catalogueText:
      'You cast sorcerous energy at one creature or object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d8 damage of a type you choose: Acid, Cold, Fire, Lightning, Poison, Psychic, or Thunder. If you roll an 8 on a d8 for this spell, you can roll another d8, and add it to the damage. When you cast this spell, the maximum number of these d8s you can add to the spell’s damage equals your spellcast- ing ability modifier. Cantrip Upgrade. The damage increases by 1d8 when you reach levels 5 (2d8), 11 (3d8), and 17 (4d8).',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Sorcerous_Burst',
      title: '术法爆发｜Sorcerous Burst',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '塑能 戏法（术士）',
      '施法时间：动作',
      '施法距离：120尺',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你向施法距离内的一名生物或一个物件施展术法能量。对目标进行一次远程攻击检定，命中时，目标将受到1d8点伤害。由你选择法术造成何种类型的伤害：强酸，寒冷，火焰，闪电，毒素，心灵或雷鸣。 如果你在此法术的任一d8骰上丢出了8，你便可以立刻再丢一枚d8，并将其加入此法术的伤害中。施展此法术时，你最多以此法造成的额外d8伤害骰数量等同于你的施法属性调整值。 戏法强化。到达特定等级后，此戏法的初始伤害将增加1d8：5级（2d8）、11级（3d8）、17级（4d8）。',
    targets: [
      '你向施法距离内的一名生物或一个物件施展术法能量。',
      '对目标进行一次远程攻击检定，命中时，目标将受到1d8点伤害。',
      '由你选择法术造成何种类型的伤害：强酸，寒冷，火焰，闪电，毒素，心灵或雷鸣。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '如果你在此法术的任一d8骰上丢出了8，你便可以立刻再丢一枚d8，并将其加入此法术的伤害中。',
    ],
    upcasting: [
      '戏法强化。',
      '到达特定等级后，此戏法的初始伤害将增加1d8：5级（2d8）、11级（3d8）、17级（4d8）。',
    ],
    visibility: ['由你选择法术造成何种类型的伤害：强酸，寒冷，火焰，闪电，毒素，心灵或雷鸣。'],
    contentWarnings: [],
  },
  'spare-the-dying': {
    categories: ['non-damage', 'healing'],
    catalogueText:
      'Choose a creature within range that has 0 Hit Points and isn’t dead. The creature becomes Stable. Cantrip Upgrade. The range doubles when you reach levels 5 (30 feet), 11 (60 feet), and 17 (120 feet).',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Spare_the_Dying',
      title: '维生术｜Spare the Dying',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '死灵 戏法（牧师、德鲁伊、奇械师）',
      '施法时间：动作',
      '施法距离：15尺',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '选择施法距离内一名生命值为0但还未死亡的生物，使该生物变为伤势稳定。 戏法强化。到达特定等级后，此法术的施法距离将翻倍：5级（30尺），11级（60尺），17级（120尺）。',
    targets: [
      '选择施法距离内一名生命值为0但还未死亡的生物，使该生物变为伤势稳定。',
      '到达特定等级后，此法术的施法距离将翻倍：5级（30尺），11级（60尺），17级（120尺）。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['选择施法距离内一名生命值为0但还未死亡的生物，使该生物变为伤势稳定。'],
    upcasting: [
      '戏法强化。',
      '到达特定等级后，此法术的施法距离将翻倍：5级（30尺），11级（60尺），17级（120尺）。',
    ],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'speak-with-animals': {
    categories: ['non-damage', 'communication'],
    catalogueText:
      'For the duration, you can comprehend and verbally communicate with Beasts, and you can use any of the Influence action’s skill options with them. Most Beasts have little to say about topics that don’t pertain to survival or companionship, but at minimum, a Beast can give you information about nearby locations and monsters, including whatever it has perceived within the past day.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Speak_with_Animals',
      title: '动物交谈｜Speak with Animals',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 预言（吟游诗人、德鲁伊、游侠、魔契师）',
      '施法时间：动作或仪式',
      '施法距离：自身',
      '法术成分：V、S',
      '持续时间：10 分钟',
    ],
    sourceText:
      '你在法术持续时间内获得理解野兽生物并用语言与其沟通的能力，并且你可以对它们使用交涉动作时任何技能选项都可以适用。 大多数野兽在谈及和生存与伙伴无关的话题时能说的很少，但至少，一只野兽能够给你提供周遭的地点和怪物的情报，包括任何它们近一日内察觉到过的东西。',
    targets: [
      '你在法术持续时间内获得理解野兽生物并用语言与其沟通的能力，并且你可以对它们使用交涉动作时任何技能选项都可以适用。',
      '大多数野兽在谈及和生存与伙伴无关的话题时能说的很少，但至少，一只野兽能够给你提供周遭的地点和怪物的情报，包括任何它们近一日内察觉到过的东西。',
    ],
    resources: ['施法时间：动作或仪式', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '大多数野兽在谈及和生存与伙伴无关的话题时能说的很少，但至少，一只野兽能够给你提供周遭的地点和怪物的情报，包括任何它们近一日内察觉到过的东西。',
    ],
    contentWarnings: [],
  },
  'starry-wisp': {
    categories: ['damage-with-rider'],
    catalogueText:
      'You launch a mote of light at one creature or object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d8 Radiant damage, and until the end of your next turn, it emits Dim Light in a 10-foot radius and can’t benefit from the Invisible condition. Cantrip Upgrade. The damage increases by 1d8 when you reach levels 5 (2d8), 11 (3d8), and 17 (4d8).',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Starry_Wisp',
      title: '点点星芒｜Starry Wisp',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '塑能 戏法（吟游诗人、德鲁伊）',
      '施法时间：动作',
      '施法距离：60 尺',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你对施法距离内一名生物或一个物件射出一点光芒。对目标进行一次远程法术攻击。命中时，目标将受到1d8点光耀伤害，并且直到你的下个回合结束前，它会散发出10尺微光光照，且无法受益于隐形 状态。 戏法强化。到达特定等级后，此戏法的伤害将增加1d8：5级（2d8），11 级（3d8），17 级1d8（4d8）。',
    targets: [
      '你对施法距离内一名生物或一个物件射出一点光芒。',
      '对目标进行一次远程法术攻击。',
      '命中时，目标将受到1d8点光耀伤害，并且直到你的下个回合结束前，它会散发出10尺微光光照，且无法受益于隐形 状态。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '命中时，目标将受到1d8点光耀伤害，并且直到你的下个回合结束前，它会散发出10尺微光光照，且无法受益于隐形 状态。',
    ],
    upcasting: [
      '戏法强化。',
      '到达特定等级后，此戏法的伤害将增加1d8：5级（2d8），11 级（3d8），17 级1d8（4d8）。',
    ],
    visibility: [
      '命中时，目标将受到1d8点光耀伤害，并且直到你的下个回合结束前，它会散发出10尺微光光照，且无法受益于隐形 状态。',
    ],
    contentWarnings: [],
  },
  thaumaturgy: {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'You manifest a minor wonder within range. You create one of the effects below within range. If you cast this spell multiple times, you can have up to three of its 1-minute effects active at a time. Altered Eyes. You alter the appearance of your eyes for 1 minute. Booming Voice. Your voice booms up to three times as loud as normal for 1 minute. For the dura- tion, you have Advantage on Charisma (Intimida- tion) checks. Fire Play. You cause flames to flicker, brighten, dim, or change color for 1 minute. Invisible Hand. You instantaneously cause an unlocked door or window to fly open or slam shut. Phantom Sound. You create an instantaneous sound that originates from a point of your choice within range, such as a rumble of thunder, the cry of a raven, or ominous whispers. Tremors. You cause harmless tremors in the ground for 1 minute.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Thaumaturgy',
      title: '奇术｜Thaumaturgy',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '变化 戏法（牧师）',
      '施法时间：动作',
      '施法距离：30尺',
      '法术成分：V',
      '持续时间：1分钟',
    ],
    sourceText:
      '你在施法距离内显现一道次级奇迹。你在施法距离内创造下述效应之一。如果你多次施展该法术，则可以同时维持至多三个不同的1分钟效应。 改变眼睛Altered Eyes。 你改变自己眼睛的外观，其效应持续1分钟。 扩音Booming Voice。 你的语音音量变为通常情况下的三倍大，其效应持续1分钟。在此期间，你在魅力（威吓）检定上具有优势 。 玩火Fire Play。 你使一团火焰闪烁、变亮、变暗或变色，其效应持续1分钟。 看不见的手Invisible Hand。 你使一扇没有上锁的门/窗立即打开或关上。 幻音Phantom Sound。 指定施法距离内的一点，你使该点发出一道短暂的声音，例如雷鸣声，渡鸦叫声或不祥低语声。 震动Tremors。 你在地面上引发无害的震动，其效应持续1分钟。',
    targets: [
      '你在施法距离内显现一道次级奇迹。',
      '你在施法距离内创造下述效应之一。',
      '指定施法距离内的一点，你使该点发出一道短暂的声音，例如雷鸣声，渡鸦叫声或不祥低语声。',
    ],
    resources: ['施法时间：动作', '法术成分：V'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['如果你多次施展该法术，则可以同时维持至多三个不同的1分钟效应。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '指定施法距离内的一点，你使该点发出一道短暂的声音，例如雷鸣声，渡鸦叫声或不祥低语声。',
    ],
    contentWarnings: [],
  },
  thunderwave: {
    categories: ['damage-with-rider', 'environment'],
    catalogueText:
      'You unleash a wave of thunderous energy. Each creature in a 15-foot Cube originating from you makes a Constitution saving throw. On a failed save, a creature takes 2d8 Thunder damage and is pushed 10 feet away from you. On a successful save, a creature takes half as much damage only. In addition, unsecured objects that are entirely within the Cube are pushed 10 feet away from you, and a thunderous boom is audible within 300 feet. Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 1.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Thunderwave',
      title: '雷鸣波｜Thunderwave',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 塑能（吟游诗人、德鲁伊、术士、法师）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你释放出一道雷鸣能量。在以你为源点15尺立方区域内的每名生物必须进行一次体质豁免。豁免失败者将受到2d8点雷鸣伤害，并被向远离你的方向推离10尺。豁免成功则只受一半伤害。 此外，所有完全位于该区域内且未被固定住的物件都将被推离10尺。该法术还会发出距你300尺内都能听见的雷霆巨响。 升环施法。使用的法术位每比一环高一环，伤害就提高1d8。',
    targets: [
      '在以你为源点15尺立方区域内的每名生物必须进行一次体质豁免。',
      '豁免失败者将受到2d8点雷鸣伤害，并被向远离你的方向推离10尺。',
      '此外，所有完全位于该区域内且未被固定住的物件都将被推离10尺。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '在以你为源点15尺立方区域内的每名生物必须进行一次体质豁免。',
      '豁免失败者将受到2d8点雷鸣伤害，并被向远离你的方向推离10尺。',
      '豁免成功则只受一半伤害。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，伤害就提高1d8。'],
    visibility: ['该法术还会发出距你300尺内都能听见的雷霆巨响。'],
    contentWarnings: [],
  },
  'true-strike': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'Guided by a flash of magical insight, you make one attack with the weapon used in the spell’s casting. The attack uses your spellcasting ability for the attack and damage rolls instead of using Strength or Dexterity. If the attack deals damage, it can be Ra- diant damage or the weapon’s normal damage type (your choice). Cantrip Upgrade. Whether you deal Radiant damage or the weapon’s normal damage type, the attack deals extra Radiant damage when you reach levels 5 (1d6), 11 (2d6), and 17 (3d6).',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'True_Strike',
      title: '克敌先击｜True Strike',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '预言 戏法（吟游诗人、术士、魔契师、法师、奇械师）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：S、M（一把价值1+CP的你熟练的武器）',
      '持续时间：立即',
    ],
    sourceText:
      '你受到一瞬魔法洞见的指引，使用施展此法术时使用的那把武器发动一次攻击。此次攻击使用你的施法属性（而非力量属性或敏捷属性）进行攻击检定与伤害掷骰。此次攻击造成伤害时，你可以选择将其伤害类型改为光耀伤害，或是维持武器原本的伤害类型。 戏法强化。到达特定等级后，无论你选择造成光耀伤害还是原本类型的伤害，本次攻击都会额外造成光耀伤害：5级（1d6）、11级（2d6）、17级（3d6）。 （译注：根据术语汇编武器攻击条目，“使用武器发动的攻击”就是“武器攻击”（与“法术攻击”并不冲突）。）',
    targets: [
      '此次攻击造成伤害时，你可以选择将其伤害类型改为光耀伤害，或是维持武器原本的伤害类型。',
      '到达特定等级后，无论你选择造成光耀伤害还是原本类型的伤害，本次攻击都会额外造成光耀伤害：5级（1d6）、11级（2d6）、17级（3d6）。',
    ],
    resources: ['施法时间：动作', '法术成分：S、M（一把价值1+CP的你熟练的武器）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: [
      '戏法强化。',
      '到达特定等级后，无论你选择造成光耀伤害还是原本类型的伤害，本次攻击都会额外造成光耀伤害：5级（1d6）、11级（2d6）、17级（3d6）。',
    ],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'unseen-servant': {
    categories: ['non-damage', 'environment', 'summoning'],
    catalogueText:
      'This spell creates an Invisible, mindless, shapeless, Medium force that performs simple tasks at your command until the spell ends. The servant springs into existence in an unoccupied space on the ground within range. It has AC 10, 1 Hit Point, and a Strength of 2, and it can’t attack. If it drops to 0 Hit Points, the spell ends. Once on each of your turns as a Bonus Action, you can mentally command the servant to move up to 15 feet and interact with an object. The servant can perform simple tasks that a human could do, such as fetching things, cleaning, mending, folding clothes, lighting fires, serving food, and pouring drinks. Once you give the command, the servant performs the task to the best of its ability until it completes the task, then waits for your next command. If you command the servant to perform a task that would move it more than 60 feet away from you, the spell ends.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Unseen_Servant',
      title: '隐形仆役｜Unseen Servant',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 咒法（吟游诗人、魔契师、法师）',
      '施法时间：动作或仪式',
      '施法距离：60尺',
      '法术成分：V、S、M（一些线和木头）',
      '持续时间：1小时',
    ],
    sourceText:
      '该法术创造出一个隐形、无心智、无定形的中型力场。你可以在法术终止前命令它进行简单的工作。该仆役被创造出来后出现在施法距离内一处未占空间的地面上。其AC为10，具有1生命值，力量为2，且不能攻击。若仆从的生命值降至 0，则法术终止。 在每个自己回合内以一个附赠动作 ，你可以精神性的对仆役下达一道命令，使其移动至多15尺并与一个物件进行互动。仆役可以做人类能做到的简单工作，例如拿取东西、打扫卫生、修补东西、叠衣服、点火、上菜、倒饮料等。一旦你下达了命令，仆役就会尽全力去进行任务直至完成任务，并在此后等待你的下一个命令。 如果你命令仆役做一件需要它离开你身边60尺的工作，则法术终止。',
    targets: [
      '该仆役被创造出来后出现在施法距离内一处未占空间的地面上。',
      '在每个自己回合内以一个附赠动作 ，你可以精神性的对仆役下达一道命令，使其移动至多15尺并与一个物件进行互动。',
      '仆役可以做人类能做到的简单工作，例如拿取东西、打扫卫生、修补东西、叠衣服、点火、上菜、倒饮料等。',
    ],
    resources: ['施法时间：动作或仪式', '法术成分：V、S、M（一些线和木头）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '你可以在法术终止前命令它进行简单的工作。',
      '若仆从的生命值降至 0，则法术终止。',
      '在每个自己回合内以一个附赠动作 ，你可以精神性的对仆役下达一道命令，使其移动至多15尺并与一个物件进行互动。',
      '如果你命令仆役做一件需要它离开你身边60尺的工作，则法术终止。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '该法术创造出一个隐形、无心智、无定形的中型力场。',
      '在每个自己回合内以一个附赠动作 ，你可以精神性的对仆役下达一道命令，使其移动至多15尺并与一个物件进行互动。',
    ],
    contentWarnings: [],
  },
  'vicious-mockery': {
    categories: ['damage-with-rider'],
    catalogueText:
      'You unleash a string of insults laced with subtle enchantments at one creature you can see or hear within range. The target must succeed on a Wisdom saving throw or take 1d6 Psychic damage and have Disadvantage on the next attack roll it makes before the end of its next turn. Cantrip Upgrade. The damage increases by 1d6 when you reach levels 5 (2d6), 11 (3d6), and 17 (4d6).',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Vicious_Mockery',
      title: '恶言相加｜Vicious Mockery',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '惑控 戏法（吟游诗人）',
      '施法时间：动作',
      '施法距离：60尺',
      '法术成分：V',
      '持续时间：立即',
    ],
    sourceText:
      '你对施法距离内一名你能看见或听见的生物连珠炮式地释出一串蕴涵微妙惑控的侮辱。目标必须通过一次感知豁免，否则受到1d6点心灵伤害，且在其下一回合结束前，其进行的下一次攻击检定具有劣势。 戏法强化。到达特定等级后，此戏法的伤害将增加1d6：5级（2d6）、11级（3d6）、17级（4d6）。',
    targets: [
      '你对施法距离内一名你能看见或听见的生物连珠炮式地释出一串蕴涵微妙惑控的侮辱。',
      '目标必须通过一次感知豁免，否则受到1d6点心灵伤害，且在其下一回合结束前，其进行的下一次攻击检定具有劣势。',
    ],
    resources: ['施法时间：动作', '法术成分：V'],
    savingThrows: [
      '目标必须通过一次感知豁免，否则受到1d6点心灵伤害，且在其下一回合结束前，其进行的下一次攻击检定具有劣势。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '目标必须通过一次感知豁免，否则受到1d6点心灵伤害，且在其下一回合结束前，其进行的下一次攻击检定具有劣势。',
    ],
    upcasting: [
      '戏法强化。',
      '到达特定等级后，此戏法的伤害将增加1d6：5级（2d6）、11级（3d6）、17级（4d6）。',
    ],
    visibility: [
      '你对施法距离内一名你能看见或听见的生物连珠炮式地释出一串蕴涵微妙惑控的侮辱。',
      '目标必须通过一次感知豁免，否则受到1d6点心灵伤害，且在其下一回合结束前，其进行的下一次攻击检定具有劣势。',
    ],
    contentWarnings: [],
  },
  'acid-arrow': {
    categories: ['pure-damage'],
    catalogueText:
      'A shimmering green arrow streaks toward a target within range and bursts in a spray of acid. Make a ranged spell attack against the target. On a hit, the target takes 4d4 Acid damage and 2d4 Acid damage at the end of its next turn. On a miss, the arrow splashes the target with acid for half as much of the initial damage only. Using a Higher-Level Spell Slot. The damage (both initial and later) increases by 1d4 for each spell slot level above 2.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: "Melf's_Acid_Arrow",
      title: "马友夫强酸箭｜Melf's Acid Arrow",
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 塑能（法师）',
      '施法时间：动作',
      '施法距离：90尺',
      '法术成分：V、S、M（大黄粉）',
      '持续时间：立即',
    ],
    sourceText:
      '一支闪烁的绿色箭矢朝一个施法距离内的目标疾速飞去，并炸裂成一滩强酸。对目标进行一次远程法术攻击。若命中，则目标受到4d4点强酸伤害，然后再其下一回合结束时再受到2d4点强酸伤害。若未命中，则箭矢的酸液溅射目标，造成初始伤害一半的伤害。 升环施法。使用的法术位每比二环高一环，此法术伤害（包括初始和后续）增加1d4。',
    targets: [
      '一支闪烁的绿色箭矢朝一个施法距离内的目标疾速飞去，并炸裂成一滩强酸。',
      '对目标进行一次远程法术攻击。',
      '若命中，则目标受到4d4点强酸伤害，然后再其下一回合结束时再受到2d4点强酸伤害。',
      '若未命中，则箭矢的酸液溅射目标，造成初始伤害一半的伤害。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（大黄粉）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['若命中，则目标受到4d4点强酸伤害，然后再其下一回合结束时再受到2d4点强酸伤害。'],
    upcasting: ['升环施法。', '使用的法术位每比二环高一环，此法术伤害（包括初始和后续）增加1d4。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  aid: {
    categories: ['non-damage', 'support', 'healing'],
    catalogueText:
      'Choose up to three creatures within range. Each target’s Hit Point maximum and current Hit Points increase by 5 for the duration. Using a Higher-Level Spell Slot. Each target’s Hit Points increase by 5 for each spell slot level above 2.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Aid',
      title: '援助术｜Aid',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 防护（吟游诗人、牧师、德鲁伊、圣武士、游侠、奇械师）',
      '施法时间：动作',
      '施法距离：30 尺',
      '法术成分：V、S、M（一小片白布）',
      '持续时间：8 小时',
    ],
    sourceText:
      '选择法术距离内至多三个生物。每个目标的生命值上限和当前生命值 在法术持续时间内提高5。 升环施法。使用的法术位每比二环高一环，每个目标的生命值 就额外提高5 。',
    targets: [
      '选择法术距离内至多三个生物。',
      '每个目标的生命值上限和当前生命值 在法术持续时间内提高5。',
      '使用的法术位每比二环高一环，每个目标的生命值 就额外提高5 。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一小片白布）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['每个目标的生命值上限和当前生命值 在法术持续时间内提高5。'],
    upcasting: ['升环施法。', '使用的法术位每比二环高一环，每个目标的生命值 就额外提高5 。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'alter-self': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You alter your physical form. Choose one of the following options. Its effects last for the duration, during which you can take a Magic action to replace the option you chose with a different one. Aquatic Adaptation. You sprout gills and grow webs between your fingers. You can breathe underwater and gain a Swim Speed equal to your Speed. Change Appearance. You alter your appear- ance. You decide what you look like, including your height, weight, facial features, sound of your voice, hair length, coloration, and other distinguishing characteristics. You can make yourself appear as a member of another species, though none of your statistics change. You can’t appear as a creature of a different size, and your basic shape stays the same; if you’re bipedal, you can’t use this spell to become quadrupedal, for instance. For the duration, you can take a Magic action to change your appearance in this way again. Natural Weapons. You grow claws (Slashing), fangs (Piercing), horns (Piercing), or hooves (Bludgeoning). When you use your Unarmed Strike to deal damage with that new growth, it deals 1d6 damage of the type in parentheses instead of dealing the normal damage for your Unarmed Strike, and you use your spellcasting ability modifier for the attack and damage rolls rather than using Strength.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Alter_Self',
      title: '变身术｜Alter Self',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 变化（术士、法师、奇械师）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、S',
      '持续时间：专注，至多 1 小时',
    ],
    sourceText:
      '你变换了自身形态。施法时，从以下选项中选择其一生效，其效应维持至其持续时间结束。在持续时间内，你还能够以一个魔法动作将效应切换为另一个不同的选项。 水生适应Aquatic Adaptation。 你长出鳃和蹼。你可以在水下呼吸，并且获得等同于步行速度的游泳速度。 改变外貌Change Appearance。你改变了自己的外貌。你可以自行设定自己的外观：包括身高、体重、面部细节、声线、头发长短、肤色以及（可能具有的）独特外貌特征。你可以让自己的外观形似其他种族的一员而你的任何数据都不会变化。你无法变为一个体型不同的生物，并且你的基础身体轮廓不会变化。例如，如果你两足行动，就不能变为四足生物。你可以在持续时间内以一个魔法动作改变这些外貌细节。 天生武器Natural Weapons。 你长出爪子（挥砍）、獠牙（穿刺）、犄角（穿刺）或蹄（钝击）。当你使用徒手打击以这些新长的器官造成伤害时，它会造成1d6对应类型伤害，而非你通常的徒手打击伤害，并且你使用你的施法属性调整值来作为你该次攻击及其伤害的调整值，而非力量调整值。',
    targets: [
      '你变换了自身形态。',
      '施法时，从以下选项中选择其一生效，其效应维持至其持续时间结束。',
      '你无法变为一个体型不同的生物，并且你的基础身体轮廓不会变化。',
      '例如，如果你两足行动，就不能变为四足生物。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '施法时，从以下选项中选择其一生效，其效应维持至其持续时间结束。',
      '例如，如果你两足行动，就不能变为四足生物。',
      '当你使用徒手打击以这些新长的器官造成伤害时，它会造成1d6对应类型伤害，而非你通常的徒手打击伤害，并且你使用你的施法属性调整值来作为你该次攻击及其伤害的调整值，而非力量调整值。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'animal-messenger': {
    categories: ['non-damage', 'communication'],
    catalogueText:
      'A Tiny Beast of your choice that you can see within range must succeed on a Charisma saving throw, or it attempts to deliver a message for you (if the target’s Challenge Rating isn’t 0, it automatically succeeds). You specify a location you have visited and a recipient who matches a general description, such as “a person dressed in the uniform of the town guard” or “a red-haired dwarf wearing a pointed hat.” You also communicate a message of up to twenty-five words. The Beast travels for the duration toward the specified location, covering about 25 miles per 24 hours or 50 miles if the Beast can fly. When the Beast arrives, it delivers your message to the creature that you described, mimicking your communication. If the Beast doesn’t reach its destination before the spell ends, the message is lost, and the Beast returns to where you cast the spell. Using a Higher-Level Spell Slot. The spell’s dura- tion increases by 48 hours for each spell slot level above 2.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Animal_Messenger',
      title: '动物信使｜Animal Messenger',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 惑控（吟游诗人、德鲁伊、游侠）',
      '施法时间：动作或仪式',
      '施法距离：30 尺',
      '法术成分：V、S、M（一点食物）',
      '持续时间：24小时',
    ],
    sourceText:
      '指定一只在施法距离内你能看见的微型野兽。该生物必须成功通过一次魅力豁免，否则它会为你传递一则消息（如果该生物的挑战等级不是0，则豁免自动成功）。你选择一个你曾造访过的地点，然后描述收信人的基本信息，如“一个穿着城镇守卫制服的男人或女人”或“一个戴着尖顶帽子的红发矮人”。你还需要说出一段不超过二十五个单词的信息。目标野兽 将会在法术持续时间内前往你选定的地点。会飞的信使24小时内可移动50里，不会飞的信使只能移动25里。 野兽抵达目的地后，会模仿你的声音把信息传递给你描述的人。信使只会把信息传递给符合你描述的人。如果法术持续时间内信使未能抵达目的地则信息将遗失，而曾作为信使的野兽将自行寻路返回你施法的地点。 升环施法。 使用的法术位每比2环高一环，此法术持续时间就增加48小时。',
    targets: [
      '指定一只在施法距离内你能看见的微型野兽。',
      '该生物必须成功通过一次魅力豁免，否则它会为你传递一则消息（如果该生物的挑战等级不是0，则豁免自动成功）。',
      '你选择一个你曾造访过的地点，然后描述收信人的基本信息，如“一个穿着城镇守卫制服的男人或女人”或“一个戴着尖顶帽子的红发矮人”。',
      '目标野兽 将会在法术持续时间内前往你选定的地点。',
      '如果法术持续时间内信使未能抵达目的地则信息将遗失，而曾作为信使的野兽将自行寻路返回你施法的地点。',
    ],
    resources: ['施法时间：动作或仪式', '法术成分：V、S、M（一点食物）'],
    savingThrows: [
      '该生物必须成功通过一次魅力豁免，否则它会为你传递一则消息（如果该生物的挑战等级不是0，则豁免自动成功）。',
    ],
    immunity: [
      '该生物必须成功通过一次魅力豁免，否则它会为你传递一则消息（如果该生物的挑战等级不是0，则豁免自动成功）。',
    ],
    repeatAndEnd: [
      '该生物必须成功通过一次魅力豁免，否则它会为你传递一则消息（如果该生物的挑战等级不是0，则豁免自动成功）。',
      '如果法术持续时间内信使未能抵达目的地则信息将遗失，而曾作为信使的野兽将自行寻路返回你施法的地点。',
    ],
    upcasting: [
      '该生物必须成功通过一次魅力豁免，否则它会为你传递一则消息（如果该生物的挑战等级不是0，则豁免自动成功）。',
      '升环施法。',
      '使用的法术位每比2环高一环，此法术持续时间就增加48小时。',
    ],
    visibility: [
      '指定一只在施法距离内你能看见的微型野兽。',
      '野兽抵达目的地后，会模仿你的声音把信息传递给你描述的人。',
    ],
    contentWarnings: [],
  },
  'animate-dead': {
    categories: ['non-damage', 'environment', 'summoning'],
    catalogueText:
      'Choose a pile of bones or a corpse of a Medium or Small Humanoid within range. The target becomes an Undead creature: a Skeleton if you chose bones or a Zombie if you chose a corpse (see “Monsters” for the stat blocks). On each of your turns, you can take a Bonus Action to mentally command any creature you made with this spell if the creature is within 60 feet of you (if you control multiple creatures, you can command any of them at the same time, issuing the same command to each one). You decide what action the creature will take and where it will move on its next turn, or you can issue a general command, such as to guard a chamber or corridor. If you issue no commands, the creature takes the Dodge action and moves only to avoid harm. Once given an order, the creature continues to follow it until its task is complete. The creature is under your control for 24 hours, after which it stops obeying any command you’ve given it. To maintain control of the creature for another 24 hours, you must cast this spell on the crea- ture again before the current 24-hour period ends. This use of the spell reasserts your control over up to four creatures you have animated with this spell rather than animating a new creature. Using a Higher-Level Spell Slot. You animate or reassert control over two additional Undead crea- tures for each spell slot level above 3. Each of the creatures must come from a different corpse or pile of bones.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Animate_Dead',
      title: '活化死尸｜Animate Dead',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 死灵（牧师、法师）',
      '施法时间：1 分钟',
      '施法距离：10 尺',
      '法术成分：V、S、M（一滴血、一块肉、以及一点骨灰）',
      '持续时间：立即',
    ],
    sourceText:
      '在施法距离内指定一具中型或小型类人遗骨或遗体。目标将变为一名亡灵生物：遗骨变为骷髅Skeleton，遗体则变为丧尸Zombie。（这些生物的资料卡见附录B）。 在你的每个回合内，你可以使用一个附赠动作并以精神命令操纵距离你 60 尺内，任何你用此法术制造的生物（如果你操纵多个生物，则你的命令可以同时传达给它们全部或是其中的某几个，不过每次只能为它们下达同一命令）。你决定被操纵生物下回合执行的动作和如何移动。或者，你也可以选择下达一条宽泛的命令（比如守护某个房间或走廊）。如果你没有下达命令，该生物将执行回避动作且只会为躲避危险而移动。一旦被下达命令，该生物会持续执行命令直到任务完成。 这些受操纵生物只会在 24小时内服从你的命令，在之后，它们会停止遵守你下达的命令。若你想将对这些生物的控制时间再延长24小时，则你必须在当前24小时的时间段终止前再次对这些生物施展该法术。法术的此种用法只能延长你对至多四个你使用此法术所创造生物的控制时间，而不会创造新的生物。 升环施法。使用的法术位每比三环高一环，你就能多唤起两只亡灵生物，或是多延长对两只亡灵生物的控制。你无法用同一具骸骨或遗体唤起多个亡灵生物。',
    targets: [
      '在施法距离内指定一具中型或小型类人遗骨或遗体。',
      '目标将变为一名亡灵生物：遗骨变为骷髅Skeleton，遗体则变为丧尸Zombie。',
      '（这些生物的资料卡见附录B）。',
      '在你的每个回合内，你可以使用一个附赠动作并以精神命令操纵距离你 60 尺内，任何你用此法术制造的生物（如果你操纵多个生物，则你的命令可以同时传达给它们全部或是其中的某几个，不过每次只能为它们下达同一命令）。',
      '你决定被操纵生物下回合执行的动作和如何移动。',
      '或者，你也可以选择下达一条宽泛的命令（比如守护某个房间或走廊）。',
      '如果你没有下达命令，该生物将执行回避动作且只会为躲避危险而移动。',
      '一旦被下达命令，该生物会持续执行命令直到任务完成。',
      '这些受操纵生物只会在 24小时内服从你的命令，在之后，它们会停止遵守你下达的命令。',
      '若你想将对这些生物的控制时间再延长24小时，则你必须在当前24小时的时间段终止前再次对这些生物施展该法术。',
      '法术的此种用法只能延长你对至多四个你使用此法术所创造生物的控制时间，而不会创造新的生物。',
      '使用的法术位每比三环高一环，你就能多唤起两只亡灵生物，或是多延长对两只亡灵生物的控制。',
      '你无法用同一具骸骨或遗体唤起多个亡灵生物。',
    ],
    resources: ['施法时间：1 分钟', '法术成分：V、S、M（一滴血、一块肉、以及一点骨灰）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '在你的每个回合内，你可以使用一个附赠动作并以精神命令操纵距离你 60 尺内，任何你用此法术制造的生物（如果你操纵多个生物，则你的命令可以同时传达给它们全部或是其中的某几个，不过每次只能为它们下达同一命令）。',
      '你决定被操纵生物下回合执行的动作和如何移动。',
      '如果你没有下达命令，该生物将执行回避动作且只会为躲避危险而移动。',
      '一旦被下达命令，该生物会持续执行命令直到任务完成。',
      '若你想将对这些生物的控制时间再延长24小时，则你必须在当前24小时的时间段终止前再次对这些生物施展该法术。',
    ],
    upcasting: [
      '升环施法。',
      '使用的法术位每比三环高一环，你就能多唤起两只亡灵生物，或是多延长对两只亡灵生物的控制。',
    ],
    visibility: [
      '在你的每个回合内，你可以使用一个附赠动作并以精神命令操纵距离你 60 尺内，任何你用此法术制造的生物（如果你操纵多个生物，则你的命令可以同时传达给它们全部或是其中的某几个，不过每次只能为它们下达同一命令）。',
    ],
    contentWarnings: [],
  },
  'arcane-lock': {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'You touch a closed door, window, gate, container, or hatch and magically lock it for the duration. This lock can’t be unlocked by any nonmagical means. You and any creatures you designate when you cast the spell can open and close the object despite the lock. You can also set a password that, when spoken within 5 feet of the object, unlocks it for 1 minute.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Arcane_Lock',
      title: '秘法锁｜Arcane Lock',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 防护（法师、奇械师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S、M（价值25GP+的金粉，作为法术耗材）',
      '持续时间：直到被解除',
    ],
    sourceText:
      '你触碰一个关着的门、窗、容器或出入口，并使目标在法术持续时间内被魔法上锁。秘法锁无法被任何非魔法方式解锁。在你施展法术时你可以选择允许一些其他生物，你和受你允许的生物能够无视秘法锁打开/关闭该物件。你还可以设置一条密语，在该物件5尺内念出密语时，秘法锁将被解锁（持续1分钟）。',
    targets: [
      '你触碰一个关着的门、窗、容器或出入口，并使目标在法术持续时间内被魔法上锁。',
      '在你施展法术时你可以选择允许一些其他生物，你和受你允许的生物能够无视秘法锁打开/关闭该物件。',
      '你还可以设置一条密语，在该物件5尺内念出密语时，秘法锁将被解锁（持续1分钟）。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（价值25GP+的金粉，作为法术耗材）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'arcanist-s-magic-aura': {
    categories: ['non-damage', 'environment', 'perception'],
    catalogueText:
      'With a touch, you place an illusion on a willing crea- ture or an object that isn’t being worn or carried. A creature gains the Mask effect below, and an object gains the False Aura effect below. The effect lasts for the duration. If you cast the spell on the same target every day for 30 days, the illusion lasts until dispelled. Mask (Creature). Choose a creature type other than the target’s actual type. Spells and other magical effects treat the target as if it were a creature of the chosen type. False Aura (Object). You change the way the target appears to spells and magical effects that detect magical auras, such as Detect Magic . You can make a nonmagical object appear magical, make a magic item appear nonmagical, or change the object’s aura so that it appears to belong to a school of magic you choose.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: "Nystul's_Magic_Aura",
      title: "涅斯图魔法灵光｜Nystul's Magic Aura",
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 幻术（法师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S、M（一小片方形丝绸）',
      '持续时间：24小时',
    ],
    sourceText:
      '你触碰一名自愿生物或者一个未被着装或携带的物件以在其上设置一道幻术。生物获得下述伪装效应，物件则获得下述虚假灵光效应。效应持续至法术结束。如果你持续30日每日均对同一个目标施展此法术，则幻术的持续时间变为直至被解除。 伪装Mask（生物）。选择一种目标实际生物类型以外的生物类别。法术和其他魔法效应会将目标生物视为属于该生物类型来处理效果。 虚假灵光False Aura（物件）。你改变物件在能够侦测魔法灵光的侦测法术和魔法效应（例如侦测魔法Detect Magic）中呈现的样子。你可以使一个非魔法物件如同具有魔法性、让一个魔法物件如同只是非魔法的，或者改变物件的魔法灵光学派，使其呈现出由你选择的特定魔法学派的灵光。',
    targets: [
      '你触碰一名自愿生物或者一个未被着装或携带的物件以在其上设置一道幻术。',
      '生物获得下述伪装效应，物件则获得下述虚假灵光效应。',
      '如果你持续30日每日均对同一个目标施展此法术，则幻术的持续时间变为直至被解除。',
      '伪装Mask（生物）。',
      '选择一种目标实际生物类型以外的生物类别。',
      '法术和其他魔法效应会将目标生物视为属于该生物类型来处理效果。',
      '虚假灵光False Aura（物件）。',
      '你改变物件在能够侦测魔法灵光的侦测法术和魔法效应（例如侦测魔法Detect Magic）中呈现的样子。',
      '你可以使一个非魔法物件如同具有魔法性、让一个魔法物件如同只是非魔法的，或者改变物件的魔法灵光学派，使其呈现出由你选择的特定魔法学派的灵光。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一小片方形丝绸）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '效应持续至法术结束。',
      '如果你持续30日每日均对同一个目标施展此法术，则幻术的持续时间变为直至被解除。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  augury: {
    categories: ['non-damage', 'perception'],
    catalogueText:
      'You receive an omen from an otherworldly entity about the results of a course of action that you plan to take within the next 30 minutes. The GM chooses the omen from the Omens table. Omens Omen For Results That Will Be … Weal Good Woe Bad Weal and woe Good and bad Indifference Neither good nor bad The spell doesn’t account for circumstances, such as other spells, that might change the results. If you cast the spell more than once before finishing a Long Rest, there is a cumulative 25 percent chance for each casting after the first that you get no answer.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Augury',
      title: '卜筮术｜Augury',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 预言（牧师、德鲁伊、法师）',
      '施法时间：1 分钟或仪式',
      '施法距离：自身',
      '法术成分：V、S、M（绘有标记的短棒、骨头、卡片、或类似的预言道具，价值25+GP）',
      '持续时间：立即',
    ],
    sourceText:
      '你从异界存在处获得对某道有关你在接下来的30分钟内所计划执行的一系列行动之结果的预示。DM从下列预示中选取一个： 预兆 预兆 预示着… 吉 好的结果。 凶 坏的结果。 吉凶并存 结果既有好的方面，也有坏的方面。 无 结果并无明显的好坏分别。 该法术将不会对任何环境因素进行解释，比如可能会对结果产生改变的一些其他法术。若你在两次长休之间使用两次或更多次的卜筮术，则法术在第一次施展之后会每次累积25%概率会不给出任何结果。',
    targets: ['本术目标由下列完整正文限定；无可简化的生物目标字段。'],
    resources: [
      '施法时间：1 分钟或仪式',
      '法术成分：V、S、M（绘有标记的短棒、骨头、卡片、或类似的预言道具，价值25+GP）',
    ],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '若你在两次长休之间使用两次或更多次的卜筮术，则法术在第一次施展之后会每次累积25%概率会不给出任何结果。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  barkskin: {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You touch a willing creature. Until the spell ends, the target’s skin assumes a bark-like appearance, and the target has an Armor Class of 17 if its AC is lower than that.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Barkskin',
      title: '树肤术｜Barkskin',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 变化（德鲁伊、游侠）',
      '施法时间：附赠动作',
      '施法距离：触碰',
      '法术成分：V、S、M（一把树皮）',
      '持续时间：1小时',
    ],
    sourceText:
      '你触碰一个自愿生物。直到法术终止前，目标的皮肤呈现出树皮样的外貌，并且若目标AC低于17，则其AC变为17。',
    targets: [
      '你触碰一个自愿生物。',
      '直到法术终止前，目标的皮肤呈现出树皮样的外貌，并且若目标AC低于17，则其AC变为17。',
    ],
    resources: ['施法时间：附赠动作', '法术成分：V、S、M（一把树皮）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '直到法术终止前，目标的皮肤呈现出树皮样的外貌，并且若目标AC低于17，则其AC变为17。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'beacon-of-hope': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'Choose any number of creatures within range. For the duration, each target has Advantage on Wisdom saving throws and Death Saving Throws and regains the maximum number of Hit Points possible from any healing.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Beacon_of_Hope',
      title: '希望信标｜Beacon of Hope',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 防护（牧师）',
      '施法时间：动作',
      '施法距离：30尺',
      '法术成分：V、S',
      '持续时间：专注，至多一分钟',
    ],
    sourceText:
      '在施法距离内指定任意数量的生物，并使其在法术持续时间内进行的感知豁免和死亡豁免具有优势。此外，其获得的所有治疗的生命值恢复量都取最大值。',
    targets: [
      '在施法距离内指定任意数量的生物，并使其在法术持续时间内进行的感知豁免和死亡豁免具有优势。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '在施法距离内指定任意数量的生物，并使其在法术持续时间内进行的感知豁免和死亡豁免具有优势。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '在施法距离内指定任意数量的生物，并使其在法术持续时间内进行的感知豁免和死亡豁免具有优势。',
    ],
    contentWarnings: [],
  },
  'bestow-curse': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You touch a creature, which must succeed on a Wisdom saving throw or become cursed for the dura- tion. Until the curse ends, the target suffers one of the following effects of your choice: • Choose one ability. The target has Disadvantage on ability checks and saving throws made with that ability. • The target has Disadvantage on attack rolls against you. • In combat, the target must succeed on a Wisdom saving throw at the start of each of its turns or be forced to take the Dodge action on that turn. • If you deal damage to the target with an attack roll or a spell, the target takes an extra 1d8 Necrotic damage. Using a Higher-Level Spell Slot. If you cast this spell using a level 4 spell slot, you can maintain Concentration on it for up to 10 minutes. If you use a level 5+ spell slot, the spell doesn’t require Con- centration, and the duration becomes 8 hours (level 5–6 slot) or 24 hours (level 7–8 slot). If you use a level 9 spell slot, the spell lasts until dispelled.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Bestow_Curse',
      title: '降咒｜Bestow Curse',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 死灵（吟游诗人、牧师、法师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '你触碰一名生物。该生物必须进行一次感知豁免并成功通过，否则将在法术持续时间内被诅咒。直到该诅咒终止前，目标会遭受以下一项效应，由你选择： 选择一项属性。目标使用该属性所进行的属性检定和豁免检定具有劣势。 目标对你发动的攻击检定具有劣势。 在战斗中，目标在其每回合开始时必须进行一次感知豁免，豁免失败则在该回合中被迫执行回避动作。 若你的攻击检定或法术对目标造成了伤害，则目标还会额外受到1d8暗蚀伤害。 升环施法。使用四环法术位施展此法术时，你可以维持此法术的专注至多10分钟。使用五环及更高环阶的法术位施展此法术时，此法术无需专注，并且持续时间变为8小时（五或六环法术位）或24小时（七或八环法术位）。若你使用九环法术位施展此法术，则此法术会一直持续到被解除为止。',
    targets: [
      '你触碰一名生物。',
      '该生物必须进行一次感知豁免并成功通过，否则将在法术持续时间内被诅咒。',
      '直到该诅咒终止前，目标会遭受以下一项效应，由你选择： 选择一项属性。',
      '目标使用该属性所进行的属性检定和豁免检定具有劣势。',
      '目标对你发动的攻击检定具有劣势。',
      '在战斗中，目标在其每回合开始时必须进行一次感知豁免，豁免失败则在该回合中被迫执行回避动作。',
      '若你的攻击检定或法术对目标造成了伤害，则目标还会额外受到1d8暗蚀伤害。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '该生物必须进行一次感知豁免并成功通过，否则将在法术持续时间内被诅咒。',
      '目标使用该属性所进行的属性检定和豁免检定具有劣势。',
      '在战斗中，目标在其每回合开始时必须进行一次感知豁免，豁免失败则在该回合中被迫执行回避动作。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '直到该诅咒终止前，目标会遭受以下一项效应，由你选择： 选择一项属性。',
      '在战斗中，目标在其每回合开始时必须进行一次感知豁免，豁免失败则在该回合中被迫执行回避动作。',
    ],
    upcasting: [
      '升环施法。',
      '使用五环及更高环阶的法术位施展此法术时，此法术无需专注，并且持续时间变为8小时（五或六环法术位）或24小时（七或八环法术位）。',
    ],
    visibility: [
      '该生物必须进行一次感知豁免并成功通过，否则将在法术持续时间内被诅咒。',
      '在战斗中，目标在其每回合开始时必须进行一次感知豁免，豁免失败则在该回合中被迫执行回避动作。',
    ],
    contentWarnings: [],
  },
  'blindness-deafness': {
    categories: ['non-damage', 'condition'],
    catalogueText:
      'One creature that you can see within range must succeed on a Constitution saving throw, or it has the Blinded or Deafened condition (your choice) for the duration. At the end of each of its turns, the target repeats the save, ending the spell on itself on a success. Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 2.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'BlindnessDeafness',
      title: '目盲术/耳聋术｜Blindness/Deafness',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 变化（吟游诗人、牧师、术士、法师）',
      '施法时间：动作',
      '施法距离：120尺',
      '法术成分：V',
      '持续时间：1分钟',
    ],
    sourceText:
      '处于你施法范围内的一个你可见的生物必须进行一次体质豁免，豁免失败者在法术持续期间陷入目盲或耳聋状态（由你选择）。目标可以在其每个回合结束时重复此豁免，直至豁免成功时结束自己身上的效应。 升环施法。使用的法术位每比二环高一环，你就能多指定一个生物作为法术目标。',
    targets: [
      '处于你施法范围内的一个你可见的生物必须进行一次体质豁免，豁免失败者在法术持续期间陷入目盲或耳聋状态（由你选择）。',
      '目标可以在其每个回合结束时重复此豁免，直至豁免成功时结束自己身上的效应。',
      '使用的法术位每比二环高一环，你就能多指定一个生物作为法术目标。',
    ],
    resources: ['施法时间：动作', '法术成分：V'],
    savingThrows: [
      '处于你施法范围内的一个你可见的生物必须进行一次体质豁免，豁免失败者在法术持续期间陷入目盲或耳聋状态（由你选择）。',
      '目标可以在其每个回合结束时重复此豁免，直至豁免成功时结束自己身上的效应。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['目标可以在其每个回合结束时重复此豁免，直至豁免成功时结束自己身上的效应。'],
    upcasting: ['升环施法。', '使用的法术位每比二环高一环，你就能多指定一个生物作为法术目标。'],
    visibility: [
      '处于你施法范围内的一个你可见的生物必须进行一次体质豁免，豁免失败者在法术持续期间陷入目盲或耳聋状态（由你选择）。',
    ],
    contentWarnings: [],
  },
  blink: {
    categories: ['non-damage', 'support', 'perception'],
    catalogueText:
      'Roll 1d6 at the end of each of your turns for the duration. On a roll of 4–6, you vanish from your current plane of existence and appear in the Ethereal Plane (the spell ends instantly if you are already on that plane). While on the Ethereal Plane, you can perceive the plane you left, which is cast in shades of gray, but you can’t see anything there more than 60 feet away. You can affect and be affected only by other creatures on the Ethereal Plane, and crea- tures on the other plane can’t perceive you unless they have a special ability that lets them perceive things on the Ethereal Plane. You return to the other plane at the start of your next turn and when the spell ends if you are on the Ethereal Plane. You return to an unoccupied space of your choice that you can see within 10 feet of the space you left. If no unoccupied space is available within that range, you appear in the nearest unoccupied space.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Blink',
      title: '闪现术｜Blink',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 变化（术士、法师、奇械师）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、S',
      '持续时间：1分钟',
    ],
    sourceText:
      '你在法术持续时间内每次自己回合结束时掷一次d6。结果为4~6时，你从你现在身处的存在位面消失，并出现在以太位面Ethereal Plane （若你本已身处以太位面，此法术会立即终止）。在你身处以太位面期间，你可以观测到你所离开位面的黑白影像，但只限于60尺之内。你只能影响其他身处以太位面的生物，或被其影响。并且处于其他位面的生物在没有能够观测到以太位面事物的特殊能力的情况下，同样无法观测到你。 你会在你的下一回合开始时返回其他位面；如果当你法术终止时身处以太位面，你同样会返回其他位面。你返回原先位面时会出现在一个你原先位置10尺之内你可见的未占据空间之中。若在此范围内没有未占据空间，则你会出现在最近的未占据空间之中',
    targets: [
      '你只能影响其他身处以太位面的生物，或被其影响。',
      '并且处于其他位面的生物在没有能够观测到以太位面事物的特殊能力的情况下，同样无法观测到你。',
      '若在此范围内没有未占据空间，则你会出现在最近的未占据空间之中',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '你在法术持续时间内每次自己回合结束时掷一次d6。',
      '结果为4~6时，你从你现在身处的存在位面消失，并出现在以太位面Ethereal Plane （若你本已身处以太位面，此法术会立即终止）。',
      '你会在你的下一回合开始时返回其他位面；如果当你法术终止时身处以太位面，你同样会返回其他位面。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['你返回原先位面时会出现在一个你原先位置10尺之内你可见的未占据空间之中。'],
    contentWarnings: [],
  },
  blur: {
    categories: ['non-damage', 'support'],
    catalogueText:
      'Your body becomes blurred. For the duration, any creature has Disadvantage on attack rolls against you. An attacker is immune to this effect if it perceives you with Blindsight or Truesight.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Blur',
      title: '朦胧术｜Blur',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 幻术（术士、法师、奇械师）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '你的身体变得模糊不定，难以捉摸。在法术持续时间内，所有生物对你发动的攻击检定具有劣势。不过若攻击者能通过盲视或真实视觉观测你，则其免疫于此法术的效应。',
    targets: ['在法术持续时间内，所有生物对你发动的攻击检定具有劣势。'],
    resources: ['施法时间：动作', '法术成分：V'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['不过若攻击者能通过盲视或真实视觉观测你，则其免疫于此法术的效应。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['不过若攻击者能通过盲视或真实视觉观测你，则其免疫于此法术的效应。'],
    contentWarnings: [],
  },
  'call-lightning': {
    categories: ['damage-with-rider', 'environment'],
    catalogueText:
      'A storm cloud appears at a point within range that you can see above yourself. It takes the shape of a Cylinder that is 10 feet tall with a 60-foot radius. When you cast the spell, choose a point you can see under the cloud. A lightning bolt shoots from the cloud to that point. Each creature within 5 feet of that point makes a Dexterity saving throw, taking 3d10 Lightning damage on a failed save or half as much damage on a successful one. Until the spell ends, you can take a Magic action to call down lightning in that way again, targeting the same point or a different one. If you’re outdoors in a storm when you cast this spell, the spell gives you control over that storm instead of creating a new one. Under such conditions, the spell’s damage increases by 1d10. Using a Higher-Level Spell Slot. The damage increases by 1d10 for each spell slot level above 3.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Call_Lightning',
      title: '召雷术｜Call Lightning',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 咒法（德鲁伊）',
      '施法时间：动作',
      '施法距离：120 尺',
      '法术成分：V、S',
      '持续时间：专注，至多 10 分钟',
    ],
    sourceText:
      '一朵风暴云在施法距离内你上方可见的一点出现。风暴云表现为高10尺、半径60尺的柱状形状。 当你施展这道法术时，选择风暴云下方你可见的一点。一束闪电从云端射向该点。位于该点5尺内的生物进行一次敏捷豁免。豁免失败者受到3d10闪电伤害，豁免成功则仅受半数伤害。 直至法术结束前，你都可以执行一个魔法动作以此法再次降下闪电，并指定闪电射向同一点或另选一点。 若施法时你身处暴风雨环境下的室外，则该法术令你得以控制空中的风暴而非创造一朵新的风暴云。在这种状况下，法术伤害增加1d10。 升环施法。使用的法术位每比三环高一环，此法术的伤害就增加 1d10。',
    targets: [
      '一朵风暴云在施法距离内你上方可见的一点出现。',
      '当你施展这道法术时，选择风暴云下方你可见的一点。',
      '一束闪电从云端射向该点。',
      '位于该点5尺内的生物进行一次敏捷豁免。',
      '直至法术结束前，你都可以执行一个魔法动作以此法再次降下闪电，并指定闪电射向同一点或另选一点。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '位于该点5尺内的生物进行一次敏捷豁免。',
      '豁免失败者受到3d10闪电伤害，豁免成功则仅受半数伤害。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '当你施展这道法术时，选择风暴云下方你可见的一点。',
      '直至法术结束前，你都可以执行一个魔法动作以此法再次降下闪电，并指定闪电射向同一点或另选一点。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比三环高一环，此法术的伤害就增加 1d10。'],
    visibility: [
      '一朵风暴云在施法距离内你上方可见的一点出现。',
      '当你施展这道法术时，选择风暴云下方你可见的一点。',
    ],
    contentWarnings: [],
  },
  'calm-emotions': {
    categories: ['non-damage', 'support', 'condition'],
    catalogueText:
      'Each Humanoid in a 20-foot-radius Sphere centered on a point you choose within range must succeed on a Charisma saving throw or be affected by one of the following effects (choose for each creature): • The creature has Immunity to the Charmed and Frightened conditions until the spell ends. If the creature was already Charmed or Frightened, those conditions are suppressed for the duration. • The creature becomes Indifferent about crea- tures of your choice that it’s Hostile toward. This indifference ends if the target takes damage or witnesses its allies taking damage. When the spell ends, the creature’s attitude returns to normal.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Calm_Emotions',
      title: '安定心神｜Calm Emotions',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 惑控（吟游诗人、牧师）',
      '施法时间：动作',
      '施法距离：60 尺',
      '法术成分：V、S',
      '持续时间：专注，至多 1 分钟',
    ],
    sourceText:
      '你指定施法距离内一点，以该点为源点半径20尺球状区域内的每个类人生物必须成功通过一次魅力豁免，否则将受下列效应之一影响（由你分别为每名生物选择生效的效应）。 直到法术结束，该生物免疫魅惑和恐慌状态。如果该生物已经陷入魅惑或恐慌状态，则这些状态在持续时间内被压制。 该生物对你选择的之前敌对的生物态度变为冷漠。该冷漠态度持续到目标受到伤害或者看到自己的盟友受到伤害。当法术结束时，该生物恢复到原本的态度。',
    targets: [
      '你指定施法距离内一点，以该点为源点半径20尺球状区域内的每个类人生物必须成功通过一次魅力豁免，否则将受下列效应之一影响（由你分别为每名生物选择生效的效应）。',
      '直到法术结束，该生物免疫魅惑和恐慌状态。',
      '如果该生物已经陷入魅惑或恐慌状态，则这些状态在持续时间内被压制。',
      '该生物对你选择的之前敌对的生物态度变为冷漠。',
      '该冷漠态度持续到目标受到伤害或者看到自己的盟友受到伤害。',
      '当法术结束时，该生物恢复到原本的态度。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '你指定施法距离内一点，以该点为源点半径20尺球状区域内的每个类人生物必须成功通过一次魅力豁免，否则将受下列效应之一影响（由你分别为每名生物选择生效的效应）。',
    ],
    immunity: ['直到法术结束，该生物免疫魅惑和恐慌状态。'],
    repeatAndEnd: [
      '直到法术结束，该生物免疫魅惑和恐慌状态。',
      '如果该生物已经陷入魅惑或恐慌状态，则这些状态在持续时间内被压制。',
      '当法术结束时，该生物恢复到原本的态度。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  clairvoyance: {
    categories: ['non-damage', 'environment', 'perception'],
    catalogueText:
      'You create an Invisible sensor within range in a location familiar to you (a place you have visited or seen before) or in an obvious location that is unfamiliar to you (such as behind a door, around a corner, or in a grove of trees). The intangible, invulnerable sensor remains in place for the duration. When you cast the spell, choose seeing or hearing. You can use the chosen sense through the sensor as if you were in its space. As a Bonus Action, you can switch between seeing and hearing. A creature that sees the sensor (such as a creature benefiting from See Invisibility or Truesight) sees a luminous orb about the size of your fist.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Clairvoyance',
      title: '鹰眼术｜Clairvoyance',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 预言（吟游诗人、牧师、术士、法师）',
      '施法时间：10 分钟',
      '施法距离：1 里',
      '法术成分：V、S、M（一件价值100GP+的法器：选择聆听则为一个以珠宝装饰的号角，选择观察则为一颗玻璃眼珠）',
      '持续时间：专注，至多 10 分钟',
    ],
    sourceText:
      '你在施法距离内某处创造一个隐形的传感器，该处可以是你熟悉的地点（你曾到访过或看见过的地方），也可以是你不熟悉的显眼处（比如一扇门后，拐角位置或树林里）。这一无形体且不受伤害的传感器会在法术持续期间停留在该地。 施展该法术时，你可以选择进行观察或是聆听。你可以通过传感器以所选的感官方式感测，如同你处在传感器所在的空间。你能够以一个附赠动作在观察和聆听之间切换。 可以看见传感器的生物（例如一名生物受益于识破隐形See Invisibility或真实视觉时）会看到传感器是一个拳头大小的发光球体。',
    targets: [
      '你在施法距离内某处创造一个隐形的传感器，该处可以是你熟悉的地点（你曾到访过或看见过的地方），也可以是你不熟悉的显眼处（比如一扇门后，拐角位置或树林里）。',
      '施展该法术时，你可以选择进行观察或是聆听。',
      '可以看见传感器的生物（例如一名生物受益于识破隐形See Invisibility或真实视觉时）会看到传感器是一个拳头大小的发光球体。',
    ],
    resources: [
      '施法时间：10 分钟',
      '法术成分：V、S、M（一件价值100GP+的法器：选择聆听则为一个以珠宝装饰的号角，选择观察则为一颗玻璃眼珠）',
    ],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '你在施法距离内某处创造一个隐形的传感器，该处可以是你熟悉的地点（你曾到访过或看见过的地方），也可以是你不熟悉的显眼处（比如一扇门后，拐角位置或树林里）。',
      '可以看见传感器的生物（例如一名生物受益于识破隐形See Invisibility或真实视觉时）会看到传感器是一个拳头大小的发光球体。',
    ],
    contentWarnings: [],
  },
  'conjure-animals': {
    categories: ['damage-with-rider', 'environment', 'summoning'],
    catalogueText:
      'You conjure nature spirits that appear as a Large pack of spectral, intangible animals in an unoccupied space you can see within range. The pack lasts for the duration, and you choose the spirits’ animal form, such as wolves, serpents, or birds. You have Advantage on Strength saving throws while you’re within 5 feet of the pack, and when you move on your turn, you can also move the pack up to 30 feet to an unoccupied space you can see. Whenever the pack moves within 10 feet of a crea- ture you can see and whenever a creature you can see enters a space within 10 feet of the pack or ends its turn there, you can force that creature to make a Dexterity saving throw. On a failed save, the crea- ture takes 3d10 Slashing damage. A creature makes this save only once per turn. Using a Higher-Level Spell Slot. The damage increases by 1d10 for each spell slot level above 3.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Conjure_Animals',
      title: '咒唤兽群｜Conjure Animals',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 咒法（德鲁伊、游侠）',
      '施法时间：动作',
      '施法距离：60 尺',
      '法术成分：V、S',
      '持续时间：专注，至多10分钟',
    ],
    sourceText:
      '你将显现为幽灵般虚幻的大型兽群的自然精魂咒唤在施法距离内一处你可见的未占据空间中。兽群在持续时间内一直存在，并且你可以选择动物精魂的形态——例如狼群、蛇群或是鸟群。 在你位于兽群5尺内期间，你的力量豁免检定具有优势。当你在你的回合移动时，你可以令兽群也移动至多30尺到一处你可见的未占据空间中。 每当兽群在移动中进入了一名你可见的生物10尺内时、一名你可见的生物进入位于兽群10尺内的空间或是在该空间结束其回合时，你都可以迫使该生物进行一次敏捷豁免检定。失败则该生物受到3d10挥砍伤害。一名生物一回合只需要进行一次该豁免。 升环施法。 使用的法术位每比三环高一环，此法术的伤害就增加1d10。',
    targets: [
      '你将显现为幽灵般虚幻的大型兽群的自然精魂咒唤在施法距离内一处你可见的未占据空间中。',
      '兽群在持续时间内一直存在，并且你可以选择动物精魂的形态——例如狼群、蛇群或是鸟群。',
      '每当兽群在移动中进入了一名你可见的生物10尺内时、一名你可见的生物进入位于兽群10尺内的空间或是在该空间结束其回合时，你都可以迫使该生物进行一次敏捷豁免检定。',
      '失败则该生物受到3d10挥砍伤害。',
      '一名生物一回合只需要进行一次该豁免。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '在你位于兽群5尺内期间，你的力量豁免检定具有优势。',
      '每当兽群在移动中进入了一名你可见的生物10尺内时、一名你可见的生物进入位于兽群10尺内的空间或是在该空间结束其回合时，你都可以迫使该生物进行一次敏捷豁免检定。',
      '一名生物一回合只需要进行一次该豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '当你在你的回合移动时，你可以令兽群也移动至多30尺到一处你可见的未占据空间中。',
      '每当兽群在移动中进入了一名你可见的生物10尺内时、一名你可见的生物进入位于兽群10尺内的空间或是在该空间结束其回合时，你都可以迫使该生物进行一次敏捷豁免检定。',
      '一名生物一回合只需要进行一次该豁免。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比三环高一环，此法术的伤害就增加1d10。'],
    visibility: [
      '你将显现为幽灵般虚幻的大型兽群的自然精魂咒唤在施法距离内一处你可见的未占据空间中。',
      '当你在你的回合移动时，你可以令兽群也移动至多30尺到一处你可见的未占据空间中。',
      '每当兽群在移动中进入了一名你可见的生物10尺内时、一名你可见的生物进入位于兽群10尺内的空间或是在该空间结束其回合时，你都可以迫使该生物进行一次敏捷豁免检定。',
    ],
    contentWarnings: [],
  },
  'continual-flame': {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'A flame springs from an object that you touch. The effect casts Bright Light in a 20-foot radius and Dim Light for an additional 20 feet. It looks like a regular flame, but it creates no heat and consumes no fuel. The flame can be covered or hidden but not smothered or quenched.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Continual_Flame',
      title: '不灭明焰｜Continual Flame',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 塑能（牧师、德鲁伊、法师、奇械师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S、M（价值50+GP的红宝石尘，作为法术耗材）',
      '持续时间：直至被解除',
    ],
    sourceText:
      '你所触碰的物件上冒出火焰。这一效应发出半径20尺的明亮光照以及额外20尺的微光光照。法术效应看上去与一般火焰无异，不过其并不会发热，也不需要燃料。你可以掩盖或隐藏火焰，但无法将其闷熄或扑灭。',
    targets: ['你所触碰的物件上冒出火焰。'],
    resources: ['施法时间：动作', '法术成分：V、S、M（价值50+GP的红宝石尘，作为法术耗材）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['这一效应发出半径20尺的明亮光照以及额外20尺的微光光照。'],
    contentWarnings: [],
  },
  counterspell: {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You attempt to interrupt a creature in the process of casting a spell. The creature makes a Constitution saving throw. On a failed save, the spell dissipates with no effect, and the action, Bonus Action, or Reaction used to cast it is wasted. If that spell was cast with a spell slot, the slot isn’t expended.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Counterspell',
      title: '法术反制｜Counterspell',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 防护（术士、魔契师、法师）',
      '施法时间：反应，当你看见60尺内一名生物施展一道具有言语、姿势或材料成分的法术时可用',
      '施法距离：60尺',
      '法术成分：S',
      '持续时间：立即',
    ],
    sourceText:
      '你试图打断一名正在施法的生物。该生物进行一次体质豁免。豁免失败则法术消散且毫无效果，并且用于施展法术的动作、附赠动作或反应随之浪费。如果那道法术是使用法术位施展的，则法术位并不会被消耗。',
    targets: ['你试图打断一名正在施法的生物。', '该生物进行一次体质豁免。'],
    resources: [
      '施法时间：反应，当你看见60尺内一名生物施展一道具有言语、姿势或材料成分的法术时可用',
      '法术成分：S',
    ],
    savingThrows: [
      '该生物进行一次体质豁免。',
      '豁免失败则法术消散且毫无效果，并且用于施展法术的动作、附赠动作或反应随之浪费。',
    ],
    immunity: ['豁免失败则法术消散且毫无效果，并且用于施展法术的动作、附赠动作或反应随之浪费。'],
    repeatAndEnd: [
      '豁免失败则法术消散且毫无效果，并且用于施展法术的动作、附赠动作或反应随之浪费。',
      '如果那道法术是使用法术位施展的，则法术位并不会被消耗。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'create-food-and-water': {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'You create 45 pounds of food and 30 gallons of fresh water on the ground or in containers within range—both useful in fending off the hazards of malnutrition and dehydration. The food is bland but nourishing and looks like a food of your choice, and the water is clean. The food spoils after 24 hours if uneaten.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Create_Food_and_Water',
      title: '造粮术｜Create Food and Water',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 咒法（牧师、圣武士、奇械师）',
      '施法时间：动作',
      '施法距离：30尺',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你在施法距离内的地面上或容器中创造45磅食物和30加仑淡水，该法术创造的食物和水均可用于避免饥饿和脱水 的危害。食物味道寡淡却营养丰富，并且看起来像一种你选择的食物，水也是干净的。食物24小时内未被食用即会变坏。',
    targets: [
      '你在施法距离内的地面上或容器中创造45磅食物和30加仑淡水，该法术创造的食物和水均可用于避免饥饿和脱水 的危害。',
      '食物味道寡淡却营养丰富，并且看起来像一种你选择的食物，水也是干净的。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  darkness: {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'For the duration, magical Darkness spreads from a point within range and fills a 15-foot-radius Sphere. Darkvision can’t see through it, and nonmagical light can’t illuminate it. Alternatively, you cast the spell on an object that isn’t being worn or carried, causing the Darkness to fill a 15-foot Emanation originating from that object. Covering that object with something opaque, such as a bowl or helm, blocks the Darkness. If any of this spell’s area overlaps with an area of Bright Light or Dim Light created by a spell of level 2 or lower, that other spell is dispelled.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Darkness',
      title: '黑暗术｜Darkness',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 塑能（术士、魔契师、法师）',
      '施法时间：动作',
      '施法距离：60尺',
      '法术成分：V、S、M（蝙蝠毛与一块煤）',
      '持续时间：专注，至多10分钟',
    ],
    sourceText:
      '你指定施法距离内一点，并在法术持续时间内使魔法性黑暗充斥以该点为中心半径15尺的球状区域。黑暗视觉也无法看穿这种黑暗，非魔法的光照也无法将其照亮。 或者，你可以将此法术施展于一个未被着装或携带的物件上，使黑暗充斥源自该物件的15尺光环区域。将该物件用不透明的东西遮掩（比如用碗或头盔盖住）时，会将黑暗隔绝。 如果法术区域与任何二环或更低环阶法术创造的明亮光照或微光光照区域重叠，则这些造光的法术将被解除。',
    targets: [
      '你指定施法距离内一点，并在法术持续时间内使魔法性黑暗充斥以该点为中心半径15尺的球状区域。',
      '或者，你可以将此法术施展于一个未被着装或携带的物件上，使黑暗充斥源自该物件的15尺光环区域。',
      '将该物件用不透明的东西遮掩（比如用碗或头盔盖住）时，会将黑暗隔绝。',
      '如果法术区域与任何二环或更低环阶法术创造的明亮光照或微光光照区域重叠，则这些造光的法术将被解除。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（蝙蝠毛与一块煤）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '如果法术区域与任何二环或更低环阶法术创造的明亮光照或微光光照区域重叠，则这些造光的法术将被解除。',
    ],
    upcasting: [
      '如果法术区域与任何二环或更低环阶法术创造的明亮光照或微光光照区域重叠，则这些造光的法术将被解除。',
    ],
    visibility: [
      '你指定施法距离内一点，并在法术持续时间内使魔法性黑暗充斥以该点为中心半径15尺的球状区域。',
      '黑暗视觉也无法看穿这种黑暗，非魔法的光照也无法将其照亮。',
      '或者，你可以将此法术施展于一个未被着装或携带的物件上，使黑暗充斥源自该物件的15尺光环区域。',
      '将该物件用不透明的东西遮掩（比如用碗或头盔盖住）时，会将黑暗隔绝。',
      '如果法术区域与任何二环或更低环阶法术创造的明亮光照或微光光照区域重叠，则这些造光的法术将被解除。',
    ],
    contentWarnings: [],
  },
  darkvision: {
    categories: ['non-damage', 'support', 'perception'],
    catalogueText:
      'For the duration, a willing creature you touch has Darkvision with a range of 150 feet.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Darkvision',
      title: '黑暗视觉｜Darkvision',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 变化（德鲁伊、游侠、术士、法师、奇械师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S、M（一根干胡萝卜）',
      '持续时间：8小时',
    ],
    sourceText: '你触碰一名自愿生物，该生物在法术持续时间内拥有150尺黑暗视觉。',
    targets: ['你触碰一名自愿生物，该生物在法术持续时间内拥有150尺黑暗视觉。'],
    resources: ['施法时间：动作', '法术成分：V、S、M（一根干胡萝卜）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['你触碰一名自愿生物，该生物在法术持续时间内拥有150尺黑暗视觉。'],
    contentWarnings: [],
  },
  daylight: {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'For the duration, sunlight spreads from a point within range and fills a 60-foot-radius Sphere. The sunlight’s area is Bright Light and sheds Dim Light for an additional 60 feet. Alternatively, you cast the spell on an object that isn’t being worn or carried, causing the sunlight to fill a 60-foot Emanation originating from that object. Covering that object with something opaque, such as a bowl or helm, blocks the sunlight. If any of this spell’s area overlaps with an area of Darkness created by a spell of level 3 or lower, that other spell is dispelled.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Daylight',
      title: '昼明术｜Daylight',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 塑能（牧师、德鲁伊、圣武士、游侠、术士）',
      '施法时间：动作',
      '施法距离：60尺',
      '法术成分：V、S',
      '持续时间：1小时',
    ],
    sourceText:
      '法术持续时间内，日光从施法距离内一点发散而出，充斥一个60尺半径的球状区域。日光区域视为明亮光照，且会再额外散发出60尺微光光照。 或者，你可以将此法术施展于一个未被着装或携带的物件上，使日光充斥以该物件为中心的60尺光环区域。将该物件用不透明的东西遮掩（比如用碗或头盔盖住）时，会将日光隔绝。 如果法术区域与任何三环或更低环阶法术创造的黑暗 区域重叠，则这些造暗的法术将被解除。',
    targets: [
      '法术持续时间内，日光从施法距离内一点发散而出，充斥一个60尺半径的球状区域。',
      '日光区域视为明亮光照，且会再额外散发出60尺微光光照。',
      '或者，你可以将此法术施展于一个未被着装或携带的物件上，使日光充斥以该物件为中心的60尺光环区域。',
      '将该物件用不透明的东西遮掩（比如用碗或头盔盖住）时，会将日光隔绝。',
      '如果法术区域与任何三环或更低环阶法术创造的黑暗 区域重叠，则这些造暗的法术将被解除。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '如果法术区域与任何三环或更低环阶法术创造的黑暗 区域重叠，则这些造暗的法术将被解除。',
    ],
    upcasting: [
      '如果法术区域与任何三环或更低环阶法术创造的黑暗 区域重叠，则这些造暗的法术将被解除。',
    ],
    visibility: [
      '日光区域视为明亮光照，且会再额外散发出60尺微光光照。',
      '如果法术区域与任何三环或更低环阶法术创造的黑暗 区域重叠，则这些造暗的法术将被解除。',
    ],
    contentWarnings: [],
  },
  'detect-thoughts': {
    categories: ['non-damage', 'perception'],
    catalogueText:
      'You activate one of the effects below. Until the spell ends, you can activate either effect as a Magic action on your later turns. Sense Thoughts. You sense the presence of thoughts within 30 feet of yourself that belong to creatures that know languages or are telepathic. You don’t read the thoughts, but you know that a thinking creature is present. The spell is blocked by 1 foot of stone, dirt, or wood; 1 inch of metal; or a thin sheet of lead. Read Thoughts. Target one creature you can see within 30 feet of yourself or one creature within 30 feet of yourself that you detected with the Sense Thoughts option. You learn what is most on the target’s mind right now. If the target doesn’t know any languages and isn’t telepathic, you learn nothing. As a Magic action on your next turn, you can try to probe deeper into the target’s mind. If you probe deeper, the target makes a Wisdom saving throw. On a failed save, you discern the target’s reasoning, emotions, and something that looms large in its mind (such as a worry, love, or hate). On a successful save, the spell ends. Either way, the target knows that you are probing into its mind, and until you shift your attention away from the target’s mind, the target can take an action on its turn to make an Intelligence (Arcana) check against your spell save DC, ending the spell on a success.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Detect_Thoughts',
      title: '侦测思想｜Detect Thoughts',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 预言（吟游诗人、术士、法师）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、S、M（1铜币）',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '你激活下述效应之一。直到法术结束为止，你可以在你随后的回合用一个魔法动作以激活下述任意效应之一。 感知思想Sense Thoughts。 你感知距你30尺内，知晓语言或能够心灵感应的思想的存在。你并不会阅读这些思想，但你知道这里存在一名有理智的生物。 此法术会被1尺厚的岩石、泥土或木头，1寸厚的金属，或薄薄一层铅阻隔。 阅读思想Read Thoughts。选择一名距你30尺内的可见生物，或一名距你30尺内被感知思想侦测到的生物。你了解到此时目标最关心的事情。如果目标不知晓任何语言也不能够进行心灵感应，则你不能得到任何信息。 在你的下一回合，用一个魔法动作，你可以尝试深入目标的心灵。如果你选择这么做，目标进行一次感知豁免。豁免失败，则你了解到他的逻辑推理、情绪状态以及他头脑中的一些大事（比如忧虑、挚爱和仇恨的事物）。豁免成功，法术终止。无论豁免是否成功，目标都会知道你正在窥探其心灵，且直到你的注意力从它的心灵上移开为止，目标均可以在其回合内使用动作进行一次智力（奥秘）检定，对抗你的法术豁免DC，目标胜出对抗时，法术终止。',
    targets: [
      '你并不会阅读这些思想，但你知道这里存在一名有理智的生物。',
      '选择一名距你30尺内的可见生物，或一名距你30尺内被感知思想侦测到的生物。',
      '你了解到此时目标最关心的事情。',
      '如果目标不知晓任何语言也不能够进行心灵感应，则你不能得到任何信息。',
      '在你的下一回合，用一个魔法动作，你可以尝试深入目标的心灵。',
      '如果你选择这么做，目标进行一次感知豁免。',
      '无论豁免是否成功，目标都会知道你正在窥探其心灵，且直到你的注意力从它的心灵上移开为止，目标均可以在其回合内使用动作进行一次智力（奥秘）检定，对抗你的法术豁免DC，目标胜出对抗时，法术终止。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（1铜币）'],
    savingThrows: [
      '如果你选择这么做，目标进行一次感知豁免。',
      '豁免失败，则你了解到他的逻辑推理、情绪状态以及他头脑中的一些大事（比如忧虑、挚爱和仇恨的事物）。',
      '豁免成功，法术终止。',
      '无论豁免是否成功，目标都会知道你正在窥探其心灵，且直到你的注意力从它的心灵上移开为止，目标均可以在其回合内使用动作进行一次智力（奥秘）检定，对抗你的法术豁免DC，目标胜出对抗时，法术终止。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '直到法术结束为止，你可以在你随后的回合用一个魔法动作以激活下述任意效应之一。',
      '如果目标不知晓任何语言也不能够进行心灵感应，则你不能得到任何信息。',
      '在你的下一回合，用一个魔法动作，你可以尝试深入目标的心灵。',
      '如果你选择这么做，目标进行一次感知豁免。',
      '豁免成功，法术终止。',
      '无论豁免是否成功，目标都会知道你正在窥探其心灵，且直到你的注意力从它的心灵上移开为止，目标均可以在其回合内使用动作进行一次智力（奥秘）检定，对抗你的法术豁免DC，目标胜出对抗时，法术终止。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '感知思想Sense Thoughts。',
      '你感知距你30尺内，知晓语言或能够心灵感应的思想的存在。',
      '你并不会阅读这些思想，但你知道这里存在一名有理智的生物。',
      '选择一名距你30尺内的可见生物，或一名距你30尺内被感知思想侦测到的生物。',
      '如果目标不知晓任何语言也不能够进行心灵感应，则你不能得到任何信息。',
      '在你的下一回合，用一个魔法动作，你可以尝试深入目标的心灵。',
      '如果你选择这么做，目标进行一次感知豁免。',
      '无论豁免是否成功，目标都会知道你正在窥探其心灵，且直到你的注意力从它的心灵上移开为止，目标均可以在其回合内使用动作进行一次智力（奥秘）检定，对抗你的法术豁免DC，目标胜出对抗时，法术终止。',
    ],
    contentWarnings: [],
  },
  'dispel-magic': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'Choose one creature, object, or magical effect within range. Any ongoing spell of level 3 or lower on the target ends. For each ongoing spell of level 4 or higher on the target, make an ability check using your spellcasting ability (DC 10 plus that spell’s level). On a successful check, the spell ends. Using a Higher-Level Spell Slot. You automatically end a spell on the target if the spell’s level is equal to or less than the level of the spell slot you use.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Dispel_Magic',
      title: '解除魔法｜Dispel Magic',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 防护（吟游诗人、牧师、德鲁伊、圣武士、游侠、术士、魔契师、法师、奇械师）',
      '施法时间：动作',
      '施法距离：120尺',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '在施法距离内选择一名生物、一个物件或一处魔法效应。所有影响该目标的三环或更低环阶法术即告终止。每个影响目标的四环或更高环阶法术都需要以你的施法属性进行一次属性检定（DC 10+目标法术环阶），检定成功时目标法术终止。 升环施法。你自动终止影响目标的小于等于你用于施展该法术的环阶的法术。',
    targets: [
      '在施法距离内选择一名生物、一个物件或一处魔法效应。',
      '所有影响该目标的三环或更低环阶法术即告终止。',
      '每个影响目标的四环或更高环阶法术都需要以你的施法属性进行一次属性检定（DC 10+目标法术环阶），检定成功时目标法术终止。',
      '你自动终止影响目标的小于等于你用于施展该法术的环阶的法术。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '所有影响该目标的三环或更低环阶法术即告终止。',
      '每个影响目标的四环或更高环阶法术都需要以你的施法属性进行一次属性检定（DC 10+目标法术环阶），检定成功时目标法术终止。',
      '你自动终止影响目标的小于等于你用于施展该法术的环阶的法术。',
    ],
    upcasting: [
      '所有影响该目标的三环或更低环阶法术即告终止。',
      '每个影响目标的四环或更高环阶法术都需要以你的施法属性进行一次属性检定（DC 10+目标法术环阶），检定成功时目标法术终止。',
      '升环施法。',
      '你自动终止影响目标的小于等于你用于施展该法术的环阶的法术。',
    ],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'dragon-s-breath': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You touch one willing creature, and choose Acid, Cold, Fire, Lightning, or Poison. Until the spell ends, the target can take a Magic action to exhale a 15-foot Cone. Each creature in that area makes a Dexterity saving throw, taking 3d6 damage of the chosen type on a failed save or half as much damage on a successful one. Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 2.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: "Dragon's_Breath",
      title: "龙息术｜Dragon's Breath",
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 变化（术士、法师、奇械师）',
      '施法时间：附赠动作',
      '施法距离：触碰',
      '法术成分：V、S、M（一根辣椒）',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '你触摸一名自愿生物，然后从强酸、寒冷、火焰、闪电或毒素中任选其一。在法术结束之前，目标可以用一个魔法动作呼出15尺锥形范围的吐息。区域内的所有生物进行一次敏捷豁免，豁免失败受到3d6点所选类型的伤害，豁免成功只受一半伤害。 升环施法。使用的法术位每比二环高一环，此法术的伤害就提高1d6。',
    targets: [
      '你触摸一名自愿生物，然后从强酸、寒冷、火焰、闪电或毒素中任选其一。',
      '在法术结束之前，目标可以用一个魔法动作呼出15尺锥形范围的吐息。',
      '区域内的所有生物进行一次敏捷豁免，豁免失败受到3d6点所选类型的伤害，豁免成功只受一半伤害。',
    ],
    resources: ['施法时间：附赠动作', '法术成分：V、S、M（一根辣椒）'],
    savingThrows: [
      '区域内的所有生物进行一次敏捷豁免，豁免失败受到3d6点所选类型的伤害，豁免成功只受一半伤害。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['在法术结束之前，目标可以用一个魔法动作呼出15尺锥形范围的吐息。'],
    upcasting: ['升环施法。', '使用的法术位每比二环高一环，此法术的伤害就提高1d6。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'enhance-ability': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You touch a creature and choose Strength, Dexterity, Intelligence, Wisdom, or Charisma. For the duration, the target has Advantage on ability checks using the chosen ability. Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 2. You can choose a different ability for each target.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Enhance_Ability',
      title: '强化属性｜Enhance Ability',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 变化（吟游诗人、牧师、德鲁伊、游侠、术士、法师、奇械师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S、M（毛发或羽毛）',
      '持续时间：专注，至多1小时',
    ],
    sourceText:
      '你触碰一名生物并在力量、敏捷、智力、感知、魅力中选择一项属性。法术持续时间内，目标在使用所选属性进行的属性检定具有优势。 升环施法。使用的法术位每比二环高一环，你就可以额外指定一个目标。你可以分别为每个目标选择一项属性。',
    targets: [
      '你触碰一名生物并在力量、敏捷、智力、感知、魅力中选择一项属性。',
      '法术持续时间内，目标在使用所选属性进行的属性检定具有优势。',
      '使用的法术位每比二环高一环，你就可以额外指定一个目标。',
      '你可以分别为每个目标选择一项属性。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（毛发或羽毛）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['升环施法。', '使用的法术位每比二环高一环，你就可以额外指定一个目标。'],
    visibility: ['你触碰一名生物并在力量、敏捷、智力、感知、魅力中选择一项属性。'],
    contentWarnings: [],
  },
  'enlarge-reduce': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'For the duration, the spell enlarges or reduces a creature or an object you can see within range (see the chosen effect below). A targeted object must be neither worn nor carried. If the target is an unwilling creature, it can make a Constitution saving throw. On a successful save, the spell has no effect. Everything that a targeted creature is wearing and carrying changes size with it. Any item it drops returns to normal size at once. A thrown weapon or piece of ammunition returns to normal size immediately after it hits or misses a target. Enlarge. The target’s size increases by one cat- egory—from Medium to Large, for example. The target also has Advantage on Strength checks and Strength saving throws. The target’s attacks with its enlarged weapons or Unarmed Strikes deal an extra 1d4 damage on a hit. Reduce. The target’s size decreases by one category—from Medium to Small, for example. The target also has Disadvantage on Strength checks and Strength saving throws. The target’s attacks with its reduced weapons or Unarmed Strikes deal 1d4 less damage on a hit (this can’t reduce the damage below 1).',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Enlarge_Reduce',
      title: '变巨术/缩小术｜Enlarge/Reduce',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 变化（吟游诗人、德鲁伊、术士、法师、奇械师）',
      '施法时间：动作',
      '施法距离：30尺',
      '法术成分：V、S、M（一撮铁粉）',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '在法术持续时间内，法术使施法距离内一个你可见的生物或物件的大小发生改变（见下可选效应）。若你以物件为目标，则其不能被着装或携带。如果目标为非自愿生物，则其可以进行一次体质豁免。豁免成功则法术无效。 如果目标是生物，则其着装物和携带物的尺寸也随之变化。随后任何从该生物身上脱离的物品都会立即恢复为正常大小。投掷武器和弹药在命中目标或失手后会恢复为正常大小。 变巨Enlarge。目标的体型增大一级（例如从中型变为大型）。目标在力量检定和力量豁免时具有优势。目标使用变巨的武器发动攻击或进行徒手打击时，命中时将额外造成1d4伤害。 缩小Reduce。目标的体型缩小一级（例如从中型变为小型）。目标在力量检定和力量豁免时具有劣势。目标使用缩小的武器发动攻击或进行徒手打击时，命中时将额外减少1d4伤害（以此法无法将该伤害降至1以下）。',
    targets: [
      '在法术持续时间内，法术使施法距离内一个你可见的生物或物件的大小发生改变（见下可选效应）。',
      '若你以物件为目标，则其不能被着装或携带。',
      '如果目标为非自愿生物，则其可以进行一次体质豁免。',
      '如果目标是生物，则其着装物和携带物的尺寸也随之变化。',
      '随后任何从该生物身上脱离的物品都会立即恢复为正常大小。',
      '投掷武器和弹药在命中目标或失手后会恢复为正常大小。',
      '目标的体型增大一级（例如从中型变为大型）。',
      '目标在力量检定和力量豁免时具有优势。',
      '目标使用变巨的武器发动攻击或进行徒手打击时，命中时将额外造成1d4伤害。',
      '目标的体型缩小一级（例如从中型变为小型）。',
      '目标在力量检定和力量豁免时具有劣势。',
      '目标使用缩小的武器发动攻击或进行徒手打击时，命中时将额外减少1d4伤害（以此法无法将该伤害降至1以下）。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一撮铁粉）'],
    savingThrows: [
      '如果目标为非自愿生物，则其可以进行一次体质豁免。',
      '豁免成功则法术无效。',
      '目标在力量检定和力量豁免时具有优势。',
      '目标在力量检定和力量豁免时具有劣势。',
    ],
    immunity: ['豁免成功则法术无效。'],
    repeatAndEnd: [
      '如果目标为非自愿生物，则其可以进行一次体质豁免。',
      '如果目标是生物，则其着装物和携带物的尺寸也随之变化。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '在法术持续时间内，法术使施法距离内一个你可见的生物或物件的大小发生改变（见下可选效应）。',
    ],
    contentWarnings: [],
  },
  enthrall: {
    categories: ['non-damage', 'perception'],
    catalogueText:
      'You weave a distracting string of words, causing creatures of your choice that you can see within range to make a Wisdom saving throw. Any crea- ture you or your companions are fighting automatically succeeds on this save. On a failed save, a target has a −10 penalty to Wisdom (Perception) checks and Passive Perception until the spell ends.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Enthrall',
      title: '注目术｜Enthrall',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 惑控（吟游诗人、魔契师）',
      '施法时间：动作',
      '施法距离：60尺',
      '法术成分：V、S',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '你编排一段使人分心的话语，指定施法距离内任何你能看见的生物。目标生物必须进行一次感知豁免。如果你或你的同伴正在和目标生物战斗，则其自动成功于该豁免。豁免失败时，目标直到法术终止之前进行的感知（察觉）检定与被动察觉值具有-10减值。',
    targets: [
      '你编排一段使人分心的话语，指定施法距离内任何你能看见的生物。',
      '目标生物必须进行一次感知豁免。',
      '如果你或你的同伴正在和目标生物战斗，则其自动成功于该豁免。',
      '豁免失败时，目标直到法术终止之前进行的感知（察觉）检定与被动察觉值具有-10减值。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '目标生物必须进行一次感知豁免。',
      '如果你或你的同伴正在和目标生物战斗，则其自动成功于该豁免。',
      '豁免失败时，目标直到法术终止之前进行的感知（察觉）检定与被动察觉值具有-10减值。',
    ],
    immunity: ['如果你或你的同伴正在和目标生物战斗，则其自动成功于该豁免。'],
    repeatAndEnd: [
      '如果你或你的同伴正在和目标生物战斗，则其自动成功于该豁免。',
      '豁免失败时，目标直到法术终止之前进行的感知（察觉）检定与被动察觉值具有-10减值。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '你编排一段使人分心的话语，指定施法距离内任何你能看见的生物。',
      '目标生物必须进行一次感知豁免。',
      '豁免失败时，目标直到法术终止之前进行的感知（察觉）检定与被动察觉值具有-10减值。',
    ],
    contentWarnings: [],
  },
  fear: {
    categories: ['non-damage', 'condition'],
    catalogueText:
      'Each creature in a 30-foot Cone must succeed on a Wisdom saving throw or drop whatever it is holding and have the Frightened condition for the duration. A Frightened creature takes the Dash action and moves away from you by the safest route on each of its turns unless there is nowhere to move. If the creature ends its turn in a space where it doesn’t have line of sight to you, the creature makes a Wisdom saving throw. On a successful save, the spell ends on that creature.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Fear',
      title: '恐惧术｜Fear',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 幻术（吟游诗人、术士、魔契师、法师）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、S、M（一根白羽毛）',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '30尺锥状区域内的所有生物必须通过一次感知豁免，豁免失败者将丢弃其所有持握物，并在法术持续时间内陷入恐慌状态。 以此法被恐慌的生物必须在自己回合中执行疾走动作，并以此寻找最安全的路线远离你，直至其无路可走为止。如果该生物结束其回合时位于一处使其视觉线中没有你的空间，则其可以再进行一次感知豁免，豁免成功则法术对该生物的效应终止。',
    targets: [
      '30尺锥状区域内的所有生物必须通过一次感知豁免，豁免失败者将丢弃其所有持握物，并在法术持续时间内陷入恐慌状态。',
      '以此法被恐慌的生物必须在自己回合中执行疾走动作，并以此寻找最安全的路线远离你，直至其无路可走为止。',
      '如果该生物结束其回合时位于一处使其视觉线中没有你的空间，则其可以再进行一次感知豁免，豁免成功则法术对该生物的效应终止。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一根白羽毛）'],
    savingThrows: [
      '30尺锥状区域内的所有生物必须通过一次感知豁免，豁免失败者将丢弃其所有持握物，并在法术持续时间内陷入恐慌状态。',
      '如果该生物结束其回合时位于一处使其视觉线中没有你的空间，则其可以再进行一次感知豁免，豁免成功则法术对该生物的效应终止。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '以此法被恐慌的生物必须在自己回合中执行疾走动作，并以此寻找最安全的路线远离你，直至其无路可走为止。',
      '如果该生物结束其回合时位于一处使其视觉线中没有你的空间，则其可以再进行一次感知豁免，豁免成功则法术对该生物的效应终止。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '30尺锥状区域内的所有生物必须通过一次感知豁免，豁免失败者将丢弃其所有持握物，并在法术持续时间内陷入恐慌状态。',
      '如果该生物结束其回合时位于一处使其视觉线中没有你的空间，则其可以再进行一次感知豁免，豁免成功则法术对该生物的效应终止。',
    ],
    contentWarnings: [],
  },
  'find-steed': {
    categories: ['non-damage', 'summoning'],
    catalogueText:
      'You summon an otherworldly being that appears as a loyal steed in an unoccupied space of your choice within range. This creature uses the Otherworldly Steed stat block. If you already have a steed from this spell, the steed is replaced by the new one. The steed resembles a Large, rideable animal of your choice, such as a horse, a camel, a dire wolf, or an elk. Whenever you cast the spell, choose the steed’s creature type—Celestial, Fey, or Fiend— which determines certain traits in the stat block. Combat. The steed is an ally to you and your allies. In combat, it shares your Initiative count, and it functions as a controlled mount while you ride it (as defined in the rules on mounted combat). If you have the Incapacitated condition, the steed takes its turn immediately after yours and acts independently, focusing on protecting you. Disappearance of the Steed. The steed disappears if it drops to 0 Hit Points or if you die. When it disappears, it leaves behind anything it was wearing or carrying. If you cast this spell again, you decide whether you summon the steed that disappeared or a different one. Using a Higher-Level Spell Slot. Use the spell slot’s level for the spell’s level in the stat block.\n\nOtherworldly Steed Large Celestial, Fey, or Fiend (Your Choice), Neutral AC 10 + 1 per spell level HP 5 + 10 per spell level (the steed has a number of Hit Dice [d10s] equal to the spell’s level) Speed 60 ft., Fly 60 ft. (requires level 4+ spell) MOD SAVE MOD SAVE MOD SAVE Str 18 +4 +4 d ex 12 +1 +1 c on 14 +2 +2 int 6 −2 −2 WiS 12 +1 +1 c h A 8 −1 −1 Senses Passive Perception 11 Languages Telepathy 1 mile (works only with you) CR None (XP 0; PB equals your Proficiency Bonus) Traits Life Bond. When you regain Hit Points from a level 1+ spell, the steed regains the same number of Hit Points if you’re within 5 feet of it. Actions Otherworldly Slam. Melee Attack Roll: Bonus equals your spell attack modifier, reach 5 ft. Hit: 1d8 plus the spell’s level of Radiant (Celestial), Psychic (Fey), or Ne- crotic (Fiend) damage. Bonus Actions Fell Glare (Fiend Only; Recharges after a Long Rest). Wisdom Saving Throw: DC equals your spell save DC, one creature within 60 feet the steed can see. Failure: The target has the Frightened condition until the end of your next turn. Fey Step (Fey Only; Recharges after a Long Rest). The steed teleports, along with its rider, to an unoccupied space of your choice up to 60 feet away from itself. Healing Touch (Celestial Only; Recharges after a Long Rest). One creature within 5 feet of the steed regains a number of Hit Points equal to 2d8 plus the spell’s level.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Find_Steed',
      title: '寻获坐骑｜Find Steed',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 咒法（圣武士）',
      '施法时间：动作',
      '施法距离：30尺',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你召唤某个异界存在作为忠诚坐骑，坐骑会出现在施法范围内你选择的未占据空间中。此生物使用异界坐骑Otherworldly Steed 的数据。如果你已经有一只以此法术获得的坐骑，则其会被新坐骑替代。 坐骑看起来像一匹大型的可骑乘动物（由你选择），比如一匹马，一头骆驼，一只恐狼或一头赤鹿。你在施展此法术时从下述三种生物类型中选择坐骑的生物类型：天族、妖精、邪魔，其数据中的特定特质由坐骑的生物类型决定。 异界坐骑Otherworldly Steed 大型天族、妖精或邪魔（由你选择），中立 AC 10+法术环阶 HP 5+每法术环阶10（坐骑具有等于法术环阶数量的生命骰[D10]） 速度 60尺，飞行60尺（需法术为四环及以上） 调整豁免调整豁免调整豁免 力量18+4+4 敏捷12+1+1 体质14+2+2 智力6-2-2 感知12+1+1 魅力8-1-1 感官 被动察觉11 语言 心灵感应1里（仅对你生效） CR 无（XP0；PB等于你的熟练加值） 特质Traits 生命连接Life Bond。 当你从一道一环或以上的法术中恢复生命值时，若你位于坐骑5尺内，则坐骑也会恢复相同数量的生命值。 动作Actions 异界猛击Otherworldly Slam。近战攻击检定：加值等于你的法术攻击加值，触及5尺。命中：1d8+法术环阶点光耀（天族）、心灵（妖精）、暗蚀（邪魔）伤害。 附赠动作Bonus Actions 堕落凝视Fell Glare（仅限邪魔，长休充能）。 感知豁免：DC等同于你的法术豁免DC，一名距坐骑60尺内的可见生物。失败：目标直到你下个回合结束为止陷入恐慌状态。 妖精跨步Fey Step（仅限妖精，长休充能）。坐骑连同其骑手传送至你选择的距其60尺内未占空间中。 治愈之触Healing Touch（仅限天族，长休充能）。一名距坐骑5尺内的生物恢复2d8+法术环阶点生命值。 战斗Combat。坐骑是你和你盟友的盟友。战斗时，它共用你的先攻，并在你骑乘它期间视同受控坐骑（如骑乘战斗规则中所定义）。如果你具有失能状态，则坐骑会在你的回合之后立刻进行自己的回合并独立行动，集中精力保护你。 坐骑的消失Disappearance of the Steed。坐骑在其降至0生命值或你死亡时会消失。当它消失时，它会将自己穿着或携带的任何物品留下。如果你再次施展此法术，你决定是重新召唤消失的那头坐骑还是召唤一头不同的。 升环施法。在生物数据中使用更高的法术环阶。',
    targets: [
      '你召唤某个异界存在作为忠诚坐骑，坐骑会出现在施法范围内你选择的未占据空间中。',
      '此生物使用异界坐骑Otherworldly Steed 的数据。',
      '坐骑看起来像一匹大型的可骑乘动物（由你选择），比如一匹马，一头骆驼，一只恐狼或一头赤鹿。',
      '你在施展此法术时从下述三种生物类型中选择坐骑的生物类型：天族、妖精、邪魔，其数据中的特定特质由坐骑的生物类型决定。',
      '异界坐骑Otherworldly Steed 大型天族、妖精或邪魔（由你选择），中立 AC 10+法术环阶 HP 5+每法术环阶10（坐骑具有等于法术环阶数量的生命骰[D10]） 速度 60尺，飞行60尺（需法术为四环及以上） 调整豁免调整豁免调整豁免 力量18+4+4 敏捷12+1+1 体质14+2+2 智力6-2-2 感知12+1+1 魅力8-1-1 感官 被动察觉11 语言 心灵感应1里（仅对你生效） CR 无（XP0；PB等于你的熟练加值） 特质Traits 生命连接Life Bond。',
      '命中：1d8+法术环阶点光耀（天族）、心灵（妖精）、暗蚀（邪魔）伤害。',
      '感知豁免：DC等同于你的法术豁免DC，一名距坐骑60尺内的可见生物。',
      '失败：目标直到你下个回合结束为止陷入恐慌状态。',
      '坐骑连同其骑手传送至你选择的距其60尺内未占空间中。',
      '一名距坐骑5尺内的生物恢复2d8+法术环阶点生命值。',
      '当它消失时，它会将自己穿着或携带的任何物品留下。',
      '在生物数据中使用更高的法术环阶。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '异界坐骑Otherworldly Steed 大型天族、妖精或邪魔（由你选择），中立 AC 10+法术环阶 HP 5+每法术环阶10（坐骑具有等于法术环阶数量的生命骰[D10]） 速度 60尺，飞行60尺（需法术为四环及以上） 调整豁免调整豁免调整豁免 力量18+4+4 敏捷12+1+1 体质14+2+2 智力6-2-2 感知12+1+1 魅力8-1-1 感官 被动察觉11 语言 心灵感应1里（仅对你生效） CR 无（XP0；PB等于你的熟练加值） 特质Traits 生命连接Life Bond。',
      '感知豁免：DC等同于你的法术豁免DC，一名距坐骑60尺内的可见生物。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '如果你已经有一只以此法术获得的坐骑，则其会被新坐骑替代。',
      '当你从一道一环或以上的法术中恢复生命值时，若你位于坐骑5尺内，则坐骑也会恢复相同数量的生命值。',
      '失败：目标直到你下个回合结束为止陷入恐慌状态。',
      '如果你具有失能状态，则坐骑会在你的回合之后立刻进行自己的回合并独立行动，集中精力保护你。',
      '坐骑的消失Disappearance of the Steed。',
      '坐骑在其降至0生命值或你死亡时会消失。',
      '当它消失时，它会将自己穿着或携带的任何物品留下。',
      '如果你再次施展此法术，你决定是重新召唤消失的那头坐骑还是召唤一头不同的。',
    ],
    upcasting: [
      '异界坐骑Otherworldly Steed 大型天族、妖精或邪魔（由你选择），中立 AC 10+法术环阶 HP 5+每法术环阶10（坐骑具有等于法术环阶数量的生命骰[D10]） 速度 60尺，飞行60尺（需法术为四环及以上） 调整豁免调整豁免调整豁免 力量18+4+4 敏捷12+1+1 体质14+2+2 智力6-2-2 感知12+1+1 魅力8-1-1 感官 被动察觉11 语言 心灵感应1里（仅对你生效） CR 无（XP0；PB等于你的熟练加值） 特质Traits 生命连接Life Bond。',
      '命中：1d8+法术环阶点光耀（天族）、心灵（妖精）、暗蚀（邪魔）伤害。',
      '一名距坐骑5尺内的生物恢复2d8+法术环阶点生命值。',
      '升环施法。',
      '在生物数据中使用更高的法术环阶。',
    ],
    visibility: [
      '异界坐骑Otherworldly Steed 大型天族、妖精或邪魔（由你选择），中立 AC 10+法术环阶 HP 5+每法术环阶10（坐骑具有等于法术环阶数量的生命骰[D10]） 速度 60尺，飞行60尺（需法术为四环及以上） 调整豁免调整豁免调整豁免 力量18+4+4 敏捷12+1+1 体质14+2+2 智力6-2-2 感知12+1+1 魅力8-1-1 感官 被动察觉11 语言 心灵感应1里（仅对你生效） CR 无（XP0；PB等于你的熟练加值） 特质Traits 生命连接Life Bond。',
      '命中：1d8+法术环阶点光耀（天族）、心灵（妖精）、暗蚀（邪魔）伤害。',
      '感知豁免：DC等同于你的法术豁免DC，一名距坐骑60尺内的可见生物。',
    ],
    contentWarnings: [
      '本轮已按CHM修复目录英文抽取边界：移除find-steed无关路径残片，并将Otherworldly Steed数据从fireball归还find-steed；见tests/v17-spell-sources.test.ts。',
    ],
  },
  'find-traps': {
    categories: ['non-damage', 'perception'],
    catalogueText:
      'You sense any trap within range that is within line of sight. A trap, for the purpose of this spell, includes any object or mechanism that was created to cause damage or other danger. Thus, the spell would sense the Alarm or Glyph of Warding spell or a mechanical pit trap, but it wouldn’t reveal a natural weakness in the floor, an unstable ceiling, or a hidden sinkhole. This spell reveals that a trap is present but not its location. You do learn the general nature of the danger posed by a trap you sense.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Find_Traps',
      title: '寻找陷阱｜Find Traps',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 预言（牧师、德鲁伊、游侠）',
      '施法时间：动作',
      '施法距离：120尺',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你感测到施法距离范围内，且在你视觉线范围内的任何陷阱。该法术的目标“陷阱”包括任何创造意图是造成伤害或其他危害的物件或装置。因此该法术可以感测警报术Alarm和守卫刻纹Glyph of Warding ，也可以发现某个陷坑型机械陷阱。不过它不能揭示地板的某处自然产生的脆弱点，或某处不稳定的天花板，又或是某个隐藏的陷坑。 该法术只单纯揭示陷阱的存在而不能得知陷阱的位置。不过你可以知晓所感测到陷阱其能够构成危害的大致形式。',
    targets: [
      '你感测到施法距离范围内，且在你视觉线范围内的任何陷阱。',
      '该法术的目标“陷阱”包括任何创造意图是造成伤害或其他危害的物件或装置。',
      '不过它不能揭示地板的某处自然产生的脆弱点，或某处不稳定的天花板，又或是某个隐藏的陷坑。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '你感测到施法距离范围内，且在你视觉线范围内的任何陷阱。',
      '因此该法术可以感测警报术Alarm和守卫刻纹Glyph of Warding ，也可以发现某个陷坑型机械陷阱。',
      '不过你可以知晓所感测到陷阱其能够构成危害的大致形式。',
    ],
    contentWarnings: [],
  },
  fireball: {
    categories: ['damage-with-rider', 'environment'],
    catalogueText:
      'A bright streak flashes from you to a point you choose within range and then blossoms with a low roar into a fiery explosion. Each creature in a 20-foot-radius Sphere centered on that point makes a Dexterity saving throw, taking 8d6 Fire damage on a failed save or half as much damage on a successful one. Flammable objects in the area that aren’t being worn or carried start burning. Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 3.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Fireball',
      title: '火球术｜Fireball',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 塑能（术士、法师）',
      '施法时间：动作',
      '施法距离：150尺',
      '法术成分：V、S、M（一颗蝙蝠粪和硫磺搓成的小球）',
      '持续时间：立即',
    ],
    sourceText:
      '明亮的闪光从你的指间飞驰向施法距离内你指定的一点，并随着一声低吼迸成一片烈焰。目标点周围半径20尺球状区域内的每个生物必须进行一次敏捷豁免。豁免失败者将受到8d6点火焰伤害，豁免成功则伤害减半。 区域内所有未被着装或携带的可燃物件会开始燃烧。 升环施法。使用的法术位每比三环高一环，此伤害就增加1d6。',
    targets: [
      '明亮的闪光从你的指间飞驰向施法距离内你指定的一点，并随着一声低吼迸成一片烈焰。',
      '目标点周围半径20尺球状区域内的每个生物必须进行一次敏捷豁免。',
      '豁免失败者将受到8d6点火焰伤害，豁免成功则伤害减半。',
      '区域内所有未被着装或携带的可燃物件会开始燃烧。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一颗蝙蝠粪和硫磺搓成的小球）'],
    savingThrows: [
      '目标点周围半径20尺球状区域内的每个生物必须进行一次敏捷豁免。',
      '豁免失败者将受到8d6点火焰伤害，豁免成功则伤害减半。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['升环施法。', '使用的法术位每比三环高一环，此伤害就增加1d6。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [
      '本轮已按CHM修复目录英文抽取边界：移除find-steed无关路径残片，并将Otherworldly Steed数据从fireball归还find-steed；见tests/v17-spell-sources.test.ts。',
    ],
  },
  'flame-blade': {
    categories: ['damage-with-rider', 'environment'],
    catalogueText:
      'You evoke a fiery blade in your free hand. The blade is similar in size and shape to a scimitar, and it lasts for the duration. If you let go of the blade, it disappears, but you can evoke it again as a Bonus Action. As a Magic action, you can make a melee spell attack with the fiery blade. On a hit, the target takes Fire damage equal to 3d6 plus your spellcasting ability modifier. The flaming blade sheds Bright Light in a 10-foot radius and Dim Light for an additional 10 feet. Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 2.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Flame_Blade',
      title: '火焰刀｜Flame Blade',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 塑能（德鲁伊、术士）',
      '施法时间：附赠动作',
      '施法距离：自身',
      '法术成分：V、S、M（一片漆树叶）',
      '持续时间：专注，至多10分钟',
    ],
    sourceText:
      '你在一只空手上召出一把火焰刀。该刀刃的尺寸和形状近似于一把弯刀并在法术持续时间内持续存在。当你放下刀刃时其将消失不见，但你可以用一个附赠动作重新将其唤出。 你可以用一个魔法动作使用该火焰刀发动一次近战法术攻击。若命中，则目标受到3d6+你的施法属性调整值点火焰伤害。 火焰刀提供半径10尺的明亮光照以及额外10尺的微光光照。 升环施法。使用的法术位每比二环高一环，此法术的伤害就增加1d6。',
    targets: ['若命中，则目标受到3d6+你的施法属性调整值点火焰伤害。'],
    resources: ['施法时间：附赠动作', '法术成分：V、S、M（一片漆树叶）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['当你放下刀刃时其将消失不见，但你可以用一个附赠动作重新将其唤出。'],
    upcasting: ['升环施法。', '使用的法术位每比二环高一环，此法术的伤害就增加1d6。'],
    visibility: ['火焰刀提供半径10尺的明亮光照以及额外10尺的微光光照。'],
    contentWarnings: [],
  },
  'flaming-sphere': {
    categories: ['damage-with-rider', 'environment'],
    catalogueText:
      'You create a 5-foot-diameter sphere of fire in an unoccupied space on the ground within range. It lasts for the duration. Any creature that ends its turn within 5 feet of the sphere makes a Dexterity saving throw, taking 2d6 Fire damage on a failed save or half as much damage on a successful one. As a Bonus Action, you can move the sphere up to 30 feet, rolling it along the ground. If you move the sphere into a creature’s space, that creature makes the save against the sphere, and the sphere stops moving for the turn. When you move the sphere, you can direct it over barriers up to 5 feet tall and jump it across pits up to 10 feet wide. Flammable objects that aren’t be- ing worn or carried start burning if touched by the sphere, and it sheds Bright Light in a 20-foot radius and Dim Light for an additional 20 feet. Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 2.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Flaming_Sphere',
      title: '炽焰法球｜Flaming Sphere',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 咒法（德鲁伊、术士、法师）',
      '施法时间：动作',
      '施法距离：60尺',
      '法术成分：V、S、M（一颗蜡球）',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '一颗直径5尺的火焰球显现在施法距离内地面上的一处未占据空间，并在法术持续时间内持续存在。任何生物在火球周围5尺内结束其回合时必须进行一次敏捷豁免。豁免失败者将受到2d6点火焰伤害，豁免成功则伤害减半。 你可以用一个附赠动作将火球沿着地面移动30尺。如果你将火球移入某名生物所占据的空间，则该生物必须进行对抗火球伤害的豁免，而火球在该回合内停止移动。 移动火球时，你可以指引它越过不高于5尺的障碍，或者越过不宽过10尺的陷坑。被火球触碰的任何未被着装或携带的可燃物件都会开始燃烧。火球向其周围散发出半径20尺的明亮光照以及额外20尺的微光光照。 升环施法。使用的法术位每比二环高一环，其伤害就增加1d6。',
    targets: [
      '一颗直径5尺的火焰球显现在施法距离内地面上的一处未占据空间，并在法术持续时间内持续存在。',
      '任何生物在火球周围5尺内结束其回合时必须进行一次敏捷豁免。',
      '豁免失败者将受到2d6点火焰伤害，豁免成功则伤害减半。',
      '如果你将火球移入某名生物所占据的空间，则该生物必须进行对抗火球伤害的豁免，而火球在该回合内停止移动。',
      '被火球触碰的任何未被着装或携带的可燃物件都会开始燃烧。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一颗蜡球）'],
    savingThrows: [
      '任何生物在火球周围5尺内结束其回合时必须进行一次敏捷豁免。',
      '豁免失败者将受到2d6点火焰伤害，豁免成功则伤害减半。',
      '如果你将火球移入某名生物所占据的空间，则该生物必须进行对抗火球伤害的豁免，而火球在该回合内停止移动。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '任何生物在火球周围5尺内结束其回合时必须进行一次敏捷豁免。',
      '如果你将火球移入某名生物所占据的空间，则该生物必须进行对抗火球伤害的豁免，而火球在该回合内停止移动。',
    ],
    upcasting: [
      '移动火球时，你可以指引它越过不高于5尺的障碍，或者越过不宽过10尺的陷坑。',
      '升环施法。',
      '使用的法术位每比二环高一环，其伤害就增加1d6。',
    ],
    visibility: ['火球向其周围散发出半径20尺的明亮光照以及额外20尺的微光光照。'],
    contentWarnings: [],
  },
  fly: {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You touch a willing creature. For the duration, the target gains a Fly Speed of 60 feet and can hover. When the spell ends, the target falls if it is still aloft unless it can stop the fall. Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 3.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Fly',
      title: '飞行术｜Fly',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 变化（术士、魔契师、法师、奇械师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S、M（一根羽毛）',
      '持续时间：专注，至多10分钟',
    ],
    sourceText:
      '你触碰一个自愿生物。目标在法术持续时间内获得60尺的飞行速度且可以悬浮。法术终止时，如果目标仍在空中，否则其随即坠落，除非其有办法阻止坠落。 升环施法。使用的法术位每比三环高一环，你就可以额外再指定一名生物作为法术目标。',
    targets: [
      '你触碰一个自愿生物。',
      '目标在法术持续时间内获得60尺的飞行速度且可以悬浮。',
      '法术终止时，如果目标仍在空中，否则其随即坠落，除非其有办法阻止坠落。',
      '使用的法术位每比三环高一环，你就可以额外再指定一名生物作为法术目标。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一根羽毛）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['法术终止时，如果目标仍在空中，否则其随即坠落，除非其有办法阻止坠落。'],
    upcasting: [
      '升环施法。',
      '使用的法术位每比三环高一环，你就可以额外再指定一名生物作为法术目标。',
    ],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'gaseous-form': {
    categories: ['non-damage', 'support', 'condition'],
    catalogueText:
      'A willing creature you touch shape-shifts, along with everything it’s wearing and carrying, into a misty cloud for the duration. The spell ends on the target if it drops to 0 Hit Points or if it takes a Magic action to end the spell on itself. While in this form, the target’s only method of movement is a Fly Speed of 10 feet, and it can hover. The target can enter and occupy the space of another creature. The target has Resistance to Bludgeoning, Piercing, and Slashing damage; it has Immunity to the Prone condition; and it has Advantage on Strength, Dexterity, and Constitution saving throws. The target can pass through narrow openings, but it treats liquids as though they were solid surfaces. The target can’t talk or manipulate objects, and any objects it was carrying or holding can’t be dropped, used, or otherwise interacted with. Finally, the target can’t attack or cast spells. Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 3.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Gaseous_Form',
      title: '气化形体｜Gaseous Form',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 变化（术士、魔契师、法师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S、M（一小块纱布）',
      '持续时间：专注，至多1小时',
    ],
    sourceText:
      '在法术持续时间内，你将触碰到的一名自愿生物连同其穿着携带物一起转化为一团云雾。如果目标的生命值降至0或其用一个魔法动作终止其身上的法术效应，则该目标身上的法术终止。 在该形态下，目标唯一的移动方式即是10尺的飞行速度，且可以悬浮。该目标可以进入并占据一个已有生物占据的空间。其拥有钝击、穿刺和挥砍伤害的抗性，其对倒地状态免疫，且进行的力量、敏捷、体质豁免具有优势。该目标可以穿过狭隙，但会将液态物质视为固体表面。 云雾形态的目标不能讲话或操作物件，其随身携带或持握的物件不会掉落，也不能被使用或与之互动。另外，目标也不能攻击或施法。 升环施法。使用的法术位每比三环高一环，你就可以额外再指定一名生物作为法术目标。',
    targets: [
      '在法术持续时间内，你将触碰到的一名自愿生物连同其穿着携带物一起转化为一团云雾。',
      '如果目标的生命值降至0或其用一个魔法动作终止其身上的法术效应，则该目标身上的法术终止。',
      '在该形态下，目标唯一的移动方式即是10尺的飞行速度，且可以悬浮。',
      '该目标可以进入并占据一个已有生物占据的空间。',
      '该目标可以穿过狭隙，但会将液态物质视为固体表面。',
      '云雾形态的目标不能讲话或操作物件，其随身携带或持握的物件不会掉落，也不能被使用或与之互动。',
      '另外，目标也不能攻击或施法。',
      '使用的法术位每比三环高一环，你就可以额外再指定一名生物作为法术目标。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一小块纱布）'],
    savingThrows: [
      '其拥有钝击、穿刺和挥砍伤害的抗性，其对倒地状态免疫，且进行的力量、敏捷、体质豁免具有优势。',
    ],
    immunity: [
      '其拥有钝击、穿刺和挥砍伤害的抗性，其对倒地状态免疫，且进行的力量、敏捷、体质豁免具有优势。',
    ],
    repeatAndEnd: [
      '如果目标的生命值降至0或其用一个魔法动作终止其身上的法术效应，则该目标身上的法术终止。',
    ],
    upcasting: [
      '升环施法。',
      '使用的法术位每比三环高一环，你就可以额外再指定一名生物作为法术目标。',
    ],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'gentle-repose': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You touch a corpse or other remains. For the dura- tion, the target is protected from decay and can’t become Undead. The spell also effectively extends the time limit on raising the target from the dead, since days spent under the influence of this spell don’t count against the time limit of spells such as Raise Dead .',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Gentle_Repose',
      title: '遗体防腐｜Gentle Repose',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 死灵（牧师、圣武士、法师）',
      '施法时间：动作或仪式',
      '施法距离：触碰',
      '法术成分：V、S、M（2枚铜币，作为此法术的耗材）',
      '持续时间：10日',
    ],
    sourceText:
      '你触碰一具尸体或其他遗骸。目标在法术持续时间内不会腐烂且无法被转变为亡灵Undead。该法术同样可以有效的延长复活目标的时间限制，因为受该法术影响下度过的时间不计入法术如死者复活Raise Dead 的时间限制内。',
    targets: [
      '你触碰一具尸体或其他遗骸。',
      '目标在法术持续时间内不会腐烂且无法被转变为亡灵Undead。',
      '该法术同样可以有效的延长复活目标的时间限制，因为受该法术影响下度过的时间不计入法术如死者复活Raise Dead 的时间限制内。',
    ],
    resources: ['施法时间：动作或仪式', '法术成分：V、S、M（2枚铜币，作为此法术的耗材）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'glyph-of-warding': {
    categories: ['damage-with-rider', 'environment'],
    catalogueText:
      'You inscribe a glyph that later unleashes a magical effect. You inscribe it either on a surface (such as a table or a section of floor) or within an object that can be closed (such as a book or chest) to conceal the glyph. The glyph can cover an area no larger than 10 feet in diameter. If the surface or object is moved more than 10 feet from where you cast this spell, the glyph is broken, and the spell ends without being triggered. The glyph is nearly imperceptible and requires a successful Wisdom (Perception) check against your spell save DC to notice. When you inscribe the glyph, you set its trigger and choose whether it’s an explosive rune or a spell glyph, as explained below. Set the Trigger. You decide what triggers the glyph when you cast the spell. For glyphs inscribed on a surface, common triggers include touching or stepping on the glyph, removing another object covering it, or approaching within a certain distance of it. For glyphs inscribed within an object, common triggers include opening that object or seeing the glyph. Once a glyph is triggered, this spell ends. You can refine the trigger so that only creatures of certain types activate it (for example, the glyph could be set to affect Aberrations). You can also set conditions for creatures that don’t trigger the glyph, such as those who say a certain password. Explosive Rune. When triggered, the glyph erupts with magical energy in a 20-foot-radius Sphere centered on the glyph. Each creature in the area makes a Dexterity saving throw. A creature takes 5d8 Acid, Cold, Fire, Lightning, or Thunder damage (your choice when you create the glyph) on a failed save or half as much damage on a successful one. Spell Glyph. You can store a prepared spell of level 3 or lower in the glyph by casting it as part of creating the glyph. The spell must target a single creature or an area. The spell being stored has no immediate effect when cast in this way. When the glyph is triggered, the stored spell takes effect. If the spell has a target, it targets the creature that triggered the glyph. If the spell affects an area, the area is centered on that creature. If the spell summons Hostile creatures or creates harmful objects or traps, they appear as close as possible to the intruder and attack it. If the spell requires Concentration, it lasts until the end of its full duration. Using a Higher-Level Spell Slot. The damage of an explosive rune increases by 1d8 for each spell slot level above 3. If you create a spell glyph, you can store any spell of up to the same level as the spell slot you use for the Glyph of Warding.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Glyph_of_Warding',
      title: '守卫刻纹｜Glyph of Warding',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 防护（吟游诗人、牧师、法师、奇械师）',
      '施法时间：1小时',
      '施法距离：触碰',
      '法术成分：V、S、M（价值200GP+的钻石尘，作为法术耗材）',
      '持续时间：直到被解除或触发',
    ],
    sourceText:
      '施展该法术时，你在某个表面（诸如桌面或地板）或某个能被关闭以隐藏刻纹的物件里（诸如书本或宝箱）刻画一个会释放魔法效应的刻纹。该刻纹可以覆盖直径不超过10尺的区域。如果受术的物件或表面从被施法位置被移开超过10尺，则其刻纹被破坏且法术不被触发即告终止。 结界刻纹近乎不可察觉，其需要以你的法术豁免DC进行一次成功的感知（察觉）检定才能被发现。 刻画刻纹时，你可以设定其触发条件，并从爆炸符文和法术刻纹两者中选择其一。 设定触发条件Set the Trigger。你在施法时设定结界刻纹的触发条件。刻画于表面的刻纹其最典型的触发条件包括：触碰或站立在刻纹上；拿掉覆盖在刻纹上的物件；进入刻纹一定范围。刻画在物件内的刻纹其最典型的触发条件包括：打开物件；看到该刻纹。刻纹一旦被触发，则该法术终止。 你可以进一步细化触发条件，比如设定只有特定生物种类（例如设定为只影响异怪Aberration）才能触发刻纹。你还可以为生物设置不触发刻纹的条件，诸如某人说出特定口令。 爆炸符文Explosive Runes。符文被触发时将在半径 20尺球状区域内爆发魔法能量。区域内的每个生物必须进行一次敏捷豁免。豁免失败者将受到5d8点强酸，寒冷，火焰，闪电，或雷鸣伤害（你在制造刻纹时指定），豁免成功则伤害减半。 法术刻纹Spell Glyph。作为创造符文的一部分，你可以施展一道已准备的三环或更低环阶法术，并将其储备在所创造的刻纹中。所储备法术必须以单一生物或一个区域为目标，而被储存的法术以该方式施展时并不会立即生效。 符文被触发时，所储备的法术即刻生效。如果法术有一个目标，则以触发刻纹的生物为目标；如果法术影响一个区域，则该区域以此生物为中心；如果法术召唤敌对Hostile生物或创造伤害性质的物件或陷阱，则这些造物将显现在尽可能靠近触发者的地方并攻击它。如果法术需要专注，则其效应将在其最大持续时间内维持。 升环施法。使用的法术位每比三环高一环，此法术的爆炸符文的伤害就增加1d8。如果你创造一个法术刻纹，则其储备法术的环阶至高可以与你施展守卫刻纹时使用的法术位环阶相同。',
    targets: [
      '施展该法术时，你在某个表面（诸如桌面或地板）或某个能被关闭以隐藏刻纹的物件里（诸如书本或宝箱）刻画一个会释放魔法效应的刻纹。',
      '该刻纹可以覆盖直径不超过10尺的区域。',
      '如果受术的物件或表面从被施法位置被移开超过10尺，则其刻纹被破坏且法术不被触发即告终止。',
      '刻画刻纹时，你可以设定其触发条件，并从爆炸符文和法术刻纹两者中选择其一。',
      '刻画于表面的刻纹其最典型的触发条件包括：触碰或站立在刻纹上；拿掉覆盖在刻纹上的物件；进入刻纹一定范围。',
      '刻画在物件内的刻纹其最典型的触发条件包括：打开物件；看到该刻纹。',
      '你可以进一步细化触发条件，比如设定只有特定生物种类（例如设定为只影响异怪Aberration）才能触发刻纹。',
      '你还可以为生物设置不触发刻纹的条件，诸如某人说出特定口令。',
      '符文被触发时将在半径 20尺球状区域内爆发魔法能量。',
      '区域内的每个生物必须进行一次敏捷豁免。',
      '豁免失败者将受到5d8点强酸，寒冷，火焰，闪电，或雷鸣伤害（你在制造刻纹时指定），豁免成功则伤害减半。',
      '所储备法术必须以单一生物或一个区域为目标，而被储存的法术以该方式施展时并不会立即生效。',
      '如果法术有一个目标，则以触发刻纹的生物为目标；如果法术影响一个区域，则该区域以此生物为中心；如果法术召唤敌对Hostile生物或创造伤害性质的物件或陷阱，则这些造物将显现在尽可能靠近触发者的地方并攻击它。',
    ],
    resources: ['施法时间：1小时', '法术成分：V、S、M（价值200GP+的钻石尘，作为法术耗材）'],
    savingThrows: [
      '区域内的每个生物必须进行一次敏捷豁免。',
      '豁免失败者将受到5d8点强酸，寒冷，火焰，闪电，或雷鸣伤害（你在制造刻纹时指定），豁免成功则伤害减半。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '如果受术的物件或表面从被施法位置被移开超过10尺，则其刻纹被破坏且法术不被触发即告终止。',
      '刻纹一旦被触发，则该法术终止。',
      '如果法术有一个目标，则以触发刻纹的生物为目标；如果法术影响一个区域，则该区域以此生物为中心；如果法术召唤敌对Hostile生物或创造伤害性质的物件或陷阱，则这些造物将显现在尽可能靠近触发者的地方并攻击它。',
      '如果法术需要专注，则其效应将在其最大持续时间内维持。',
      '如果你创造一个法术刻纹，则其储备法术的环阶至高可以与你施展守卫刻纹时使用的法术位环阶相同。',
    ],
    upcasting: [
      '作为创造符文的一部分，你可以施展一道已准备的三环或更低环阶法术，并将其储备在所创造的刻纹中。',
      '升环施法。',
      '使用的法术位每比三环高一环，此法术的爆炸符文的伤害就增加1d8。',
      '如果你创造一个法术刻纹，则其储备法术的环阶至高可以与你施展守卫刻纹时使用的法术位环阶相同。',
    ],
    visibility: [
      '结界刻纹近乎不可察觉，其需要以你的法术豁免DC进行一次成功的感知（察觉）检定才能被发现。',
    ],
    contentWarnings: [],
  },
  'gust-of-wind': {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'A Line of strong wind 60 feet long and 10 feet wide blasts from you in a direction you choose for the duration. Each creature in the Line must succeed on a Strength saving throw or be pushed 15 feet away from you in a direction following the Line. A crea- ture that ends its turn in the Line must make the same save. Any creature in the Line must spend 2 feet of movement for every 1 foot it moves when moving closer to you. The gust disperses gas or vapor, and it extinguishes candles and similar unprotected flames in the area. It causes protected flames, such as those of lanterns, to dance wildly and has a 50 percent chance to extinguish them. As a Bonus Action on your later turns, you can change the direction in which the Line blasts from you.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Gust_of_Wind',
      title: '造风术｜Gust of Wind',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 塑能（德鲁伊、游侠、术士、法师）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、S、M（一颗豆类种子）',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '一股长60尺，宽10尺的线状强风以你为起点向你指定的方向吹去。每名位于线状区域内的生物必须成功于一次力量豁免，豁免失败则沿着线状的方向被推离你15尺。在线状区域内结束其回合的生物也必须进行同样的豁免。 任何生物在线状区域内朝更靠近你的方向移动时，其每移动1尺必须花费2尺的移动力。 强风吹散区域内的毒气或蒸汽，并吹熄蜡烛等不受保护的其他类似火焰。而有保护的火焰（比如提灯）则会剧烈摇晃并有50%的概率被吹熄。 你可以在自己随后的回合内用一个附赠动作改变线状风道的方向。',
    targets: [
      '一股长60尺，宽10尺的线状强风以你为起点向你指定的方向吹去。',
      '每名位于线状区域内的生物必须成功于一次力量豁免，豁免失败则沿着线状的方向被推离你15尺。',
      '在线状区域内结束其回合的生物也必须进行同样的豁免。',
      '任何生物在线状区域内朝更靠近你的方向移动时，其每移动1尺必须花费2尺的移动力。',
      '强风吹散区域内的毒气或蒸汽，并吹熄蜡烛等不受保护的其他类似火焰。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一颗豆类种子）'],
    savingThrows: [
      '每名位于线状区域内的生物必须成功于一次力量豁免，豁免失败则沿着线状的方向被推离你15尺。',
      '在线状区域内结束其回合的生物也必须进行同样的豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '在线状区域内结束其回合的生物也必须进行同样的豁免。',
      '你可以在自己随后的回合内用一个附赠动作改变线状风道的方向。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  haste: {
    categories: ['non-damage', 'support'],
    catalogueText:
      'Choose a willing creature that you can see within range. Until the spell ends, the target’s Speed is doubled, it gains a +2 bonus to Armor Class, it has Advantage on Dexterity saving throws, and it gains an additional action on each of its turns. That action can be used to take only the Attack (one attack only), Dash, Disengage, Hide, or Utilize action. When the spell ends, the target is Incapacitated and has a Speed of 0 until the end of its next turn, as a wave of lethargy washes over it.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Haste',
      title: '加速术｜Haste',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 变化（术士、法师、奇械师）',
      '施法时间：动作',
      '施法距离：30尺',
      '法术成分：V、S、M（一片甘草根切片）',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '指定施法距离内一个你能看见的自愿生物。直至法术终止前，目标速度翻倍；其AC获得+2加值；其进行敏捷豁免时具有优势；其每个回合都可作出一个额外的动作，但该动作只能用于执行攻击动作（仅一次攻击），或者疾走、撤离、躲藏和操作动作。 法术终止时，目标将泛起一阵倦意使其失能并且速度为0，持续至其下一回合结束。',
    targets: [
      '指定施法距离内一个你能看见的自愿生物。',
      '直至法术终止前，目标速度翻倍；其AC获得+2加值；其进行敏捷豁免时具有优势；其每个回合都可作出一个额外的动作，但该动作只能用于执行攻击动作（仅一次攻击），或者疾走、撤离、躲藏和操作动作。',
      '法术终止时，目标将泛起一阵倦意使其失能并且速度为0，持续至其下一回合结束。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一片甘草根切片）'],
    savingThrows: [
      '直至法术终止前，目标速度翻倍；其AC获得+2加值；其进行敏捷豁免时具有优势；其每个回合都可作出一个额外的动作，但该动作只能用于执行攻击动作（仅一次攻击），或者疾走、撤离、躲藏和操作动作。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '直至法术终止前，目标速度翻倍；其AC获得+2加值；其进行敏捷豁免时具有优势；其每个回合都可作出一个额外的动作，但该动作只能用于执行攻击动作（仅一次攻击），或者疾走、撤离、躲藏和操作动作。',
      '法术终止时，目标将泛起一阵倦意使其失能并且速度为0，持续至其下一回合结束。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['指定施法距离内一个你能看见的自愿生物。'],
    contentWarnings: [],
  },
  'heat-metal': {
    categories: ['damage-with-rider'],
    catalogueText:
      'Choose a manufactured metal object, such as a metal weapon or a suit of Heavy or Medium metal armor, that you can see within range. You cause the object to glow red-hot. Any creature in physical contact with the object takes 2d8 Fire damage when you cast the spell. Until the spell ends, you can take a Bonus Action on each of your later turns to deal this damage again if the object is within range. If a creature is holding or wearing the object and takes the damage from it, the creature must succeed on a Constitution saving throw or drop the object if it can. If it doesn’t drop the object, it has Disadvantage on attack rolls and ability checks until the start of your next turn. Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 2.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Heat_Metal',
      title: '灼热金属｜Heat Metal',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 变化（吟游诗人、德鲁伊、奇械师）',
      '施法时间：动作',
      '施法距离：60尺',
      '法术成分：V、S、M（一片铁片和一团火焰）',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '指定施法距离内一件你能看见的人造金属物件（例如一把金属武器，或者一套金属质的重甲或中甲），并使该物件变得炽热。施展该法术时，任何与该物件有物理接触的生物均受到2d8点火焰伤害。直到法术终止前，只要这个物件依然在施法距离内，你都可以在你随后的每个回合以一个附赠动作来再次造成此伤害。 若握持或着装该物件的生物因此受到伤害，则该生物必须通过一次体质豁免，否则如果这个生物只要能丢下该物件，该生物就必须丢下该物件。如果该物件没有被丢下，则直至你的下一回合开始为止，该生物进行攻击检定和属性检定时具有劣势。 升环施法。使用的法术位每比二环高一环，此法术的伤害就增加1d8。',
    targets: [
      '指定施法距离内一件你能看见的人造金属物件（例如一把金属武器，或者一套金属质的重甲或中甲），并使该物件变得炽热。',
      '施展该法术时，任何与该物件有物理接触的生物均受到2d8点火焰伤害。',
      '直到法术终止前，只要这个物件依然在施法距离内，你都可以在你随后的每个回合以一个附赠动作来再次造成此伤害。',
      '若握持或着装该物件的生物因此受到伤害，则该生物必须通过一次体质豁免，否则如果这个生物只要能丢下该物件，该生物就必须丢下该物件。',
      '如果该物件没有被丢下，则直至你的下一回合开始为止，该生物进行攻击检定和属性检定时具有劣势。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一片铁片和一团火焰）'],
    savingThrows: [
      '若握持或着装该物件的生物因此受到伤害，则该生物必须通过一次体质豁免，否则如果这个生物只要能丢下该物件，该生物就必须丢下该物件。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '直到法术终止前，只要这个物件依然在施法距离内，你都可以在你随后的每个回合以一个附赠动作来再次造成此伤害。',
      '若握持或着装该物件的生物因此受到伤害，则该生物必须通过一次体质豁免，否则如果这个生物只要能丢下该物件，该生物就必须丢下该物件。',
      '如果该物件没有被丢下，则直至你的下一回合开始为止，该生物进行攻击检定和属性检定时具有劣势。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比二环高一环，此法术的伤害就增加1d8。'],
    visibility: [
      '指定施法距离内一件你能看见的人造金属物件（例如一把金属武器，或者一套金属质的重甲或中甲），并使该物件变得炽热。',
    ],
    contentWarnings: [],
  },
  'hold-person': {
    categories: ['non-damage', 'condition'],
    catalogueText:
      'Choose a Humanoid that you can see within range. The target must succeed on a Wisdom saving throw or have the Paralyzed condition for the duration. At the end of each of its turns, the target repeats the save, ending the spell on itself on a success. Using a Higher-Level Spell Slot. You can target one additional Humanoid for each spell slot level above 2.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Hold_Person',
      title: '定身类人｜Hold Person',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 惑控（吟游诗人、牧师、德鲁伊、术士、魔契师、法师）',
      '施法时间：动作',
      '施法距离：60尺',
      '法术成分：V、S、M（一片直的小铁片）',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '指定施法距离内一个你能看见的类人生物。该目标必须进行一次感知豁免，豁免失败则其在法术持续时间内陷入麻痹状态。目标在其每回合结束时可以重新进行这次豁免，豁免成功则终止其身上该法术的效应。 升环施法。使用三环或更高法术位施展该法术时，你使用的法术位每比二环高一环，就可以额外指定一个类人作为目标。',
    targets: [
      '指定施法距离内一个你能看见的类人生物。',
      '该目标必须进行一次感知豁免，豁免失败则其在法术持续时间内陷入麻痹状态。',
      '目标在其每回合结束时可以重新进行这次豁免，豁免成功则终止其身上该法术的效应。',
      '使用三环或更高法术位施展该法术时，你使用的法术位每比二环高一环，就可以额外指定一个类人作为目标。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一片直的小铁片）'],
    savingThrows: [
      '该目标必须进行一次感知豁免，豁免失败则其在法术持续时间内陷入麻痹状态。',
      '目标在其每回合结束时可以重新进行这次豁免，豁免成功则终止其身上该法术的效应。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['目标在其每回合结束时可以重新进行这次豁免，豁免成功则终止其身上该法术的效应。'],
    upcasting: [
      '升环施法。',
      '使用三环或更高法术位施展该法术时，你使用的法术位每比二环高一环，就可以额外指定一个类人作为目标。',
    ],
    visibility: [
      '指定施法距离内一个你能看见的类人生物。',
      '该目标必须进行一次感知豁免，豁免失败则其在法术持续时间内陷入麻痹状态。',
    ],
    contentWarnings: [],
  },
  'hypnotic-pattern': {
    categories: ['non-damage', 'condition'],
    catalogueText:
      'You create a twisting pattern of colors in a 30-foot Cube within range. The pattern appears for a moment and vanishes. Each creature in the area who can see the pattern must succeed on a Wisdom saving throw or have the Charmed condition for the duration. While Charmed, the creature has the Inca- pacitated condition and a Speed of 0. The spell ends for an affected creature if it takes any damage or if someone else uses an action to shake the creature out of its stupor.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Hypnotic_Pattern',
      title: '催眠图纹｜Hypnotic Pattern',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 幻术（吟游诗人、术士、魔契师、法师）',
      '施法时间：动作',
      '施法距离：120尺',
      '法术成分：S、M（一撮五彩纸屑）',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '你在施法距离内一处边长 30 尺的立方区域内创造出一个在空中舞动旋转的彩色图纹。图纹在出现片刻后消失，然后迫使区域内每个看到它的生物进行一次感知豁免，豁免失败者将在法术持续时间内陷入魅惑状态。在被该法术魅惑期间，被该法术魅惑的生物陷入失能状态，且速度降为0。 如果受术生物受到任何伤害，或有其他生物用一个动作将其从恍惚中摇醒，则其身上的此效应将提前终止。',
    targets: [
      '你在施法距离内一处边长 30 尺的立方区域内创造出一个在空中舞动旋转的彩色图纹。',
      '图纹在出现片刻后消失，然后迫使区域内每个看到它的生物进行一次感知豁免，豁免失败者将在法术持续时间内陷入魅惑状态。',
      '在被该法术魅惑期间，被该法术魅惑的生物陷入失能状态，且速度降为0。',
      '如果受术生物受到任何伤害，或有其他生物用一个动作将其从恍惚中摇醒，则其身上的此效应将提前终止。',
    ],
    resources: ['施法时间：动作', '法术成分：S、M（一撮五彩纸屑）'],
    savingThrows: [
      '图纹在出现片刻后消失，然后迫使区域内每个看到它的生物进行一次感知豁免，豁免失败者将在法术持续时间内陷入魅惑状态。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '图纹在出现片刻后消失，然后迫使区域内每个看到它的生物进行一次感知豁免，豁免失败者将在法术持续时间内陷入魅惑状态。',
      '在被该法术魅惑期间，被该法术魅惑的生物陷入失能状态，且速度降为0。',
      '如果受术生物受到任何伤害，或有其他生物用一个动作将其从恍惚中摇醒，则其身上的此效应将提前终止。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '图纹在出现片刻后消失，然后迫使区域内每个看到它的生物进行一次感知豁免，豁免失败者将在法术持续时间内陷入魅惑状态。',
    ],
    contentWarnings: [],
  },
  invisibility: {
    categories: ['non-damage', 'support', 'condition', 'perception'],
    catalogueText:
      'A creature you touch has the Invisible condition until the spell ends. The spell ends early immediately after the target makes an attack roll, deals damage, or casts a spell. Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 2.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Invisibility',
      title: '隐形术｜Invisibility',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 幻术（吟游诗人、术士、魔契师、法师、奇械师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S、M（一根包裹在阿拉伯胶中的睫毛）',
      '持续时间：专注，至多1小时',
    ],
    sourceText:
      '你触碰的一个生物进入隐形状态并维持至法术终止。如果目标进行攻击检定、造成伤害或施展法术，则此法术提前终止。 升环施法。使用三环或更高法术位施展该法术时，你使用的法术位每比二环高一环，就可以额外指定一个生物作为目标。',
    targets: [
      '你触碰的一个生物进入隐形状态并维持至法术终止。',
      '如果目标进行攻击检定、造成伤害或施展法术，则此法术提前终止。',
      '使用三环或更高法术位施展该法术时，你使用的法术位每比二环高一环，就可以额外指定一个生物作为目标。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一根包裹在阿拉伯胶中的睫毛）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '你触碰的一个生物进入隐形状态并维持至法术终止。',
      '如果目标进行攻击检定、造成伤害或施展法术，则此法术提前终止。',
    ],
    upcasting: [
      '升环施法。',
      '使用三环或更高法术位施展该法术时，你使用的法术位每比二环高一环，就可以额外指定一个生物作为目标。',
    ],
    visibility: ['你触碰的一个生物进入隐形状态并维持至法术终止。'],
    contentWarnings: [],
  },
  knock: {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'Choose an object that you can see within range. The object can be a door, a box, a chest, a set of mana- cles, a padlock, or another object that contains a mundane or magical means that prevents access. A target that is held shut by a mundane lock or that is stuck or barred becomes unlocked, unstuck, or unbarred. If the object has multiple locks, only one of them is unlocked. If the target is held shut by Arcane Lock , that spell is suppressed for 10 minutes, during which time the target can be opened and closed. When you cast the spell, a loud knock, audible up to 300 feet away, emanates from the target.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Knock',
      title: '敲击术｜Knock',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 变化（吟游诗人、术士、法师）',
      '施法时间：动作',
      '施法距离：60尺',
      '法术成分：V',
      '持续时间：立即',
    ],
    sourceText:
      '指定施法距离内一个你能看见的物件。该物件可以是一扇门，一个盒子，一个箱子，一副镣铐，一把挂锁，或是一个其他的通过魔法或普通手段来防止被打开的物件。 被一把普通锁锁住的目标其锁会被解开，被卡死的目标会被松开，被闩住的目标会被打开。如果目标被多把锁锁住，则只有一把锁会被打开。 若你指定的目标被法术秘法锁arcane locks 锁住，则该秘法锁被压制 10 分钟，这段时间内目标可被正常开启和关闭。 施展该法术时，受术目标会发出一声响亮的敲击声，其声响最远 300 尺内都能听见。',
    targets: [
      '指定施法距离内一个你能看见的物件。',
      '该物件可以是一扇门，一个盒子，一个箱子，一副镣铐，一把挂锁，或是一个其他的通过魔法或普通手段来防止被打开的物件。',
      '被一把普通锁锁住的目标其锁会被解开，被卡死的目标会被松开，被闩住的目标会被打开。',
      '如果目标被多把锁锁住，则只有一把锁会被打开。',
      '若你指定的目标被法术秘法锁arcane locks 锁住，则该秘法锁被压制 10 分钟，这段时间内目标可被正常开启和关闭。',
      '施展该法术时，受术目标会发出一声响亮的敲击声，其声响最远 300 尺内都能听见。',
    ],
    resources: ['施法时间：动作', '法术成分：V'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['如果目标被多把锁锁住，则只有一把锁会被打开。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '指定施法距离内一个你能看见的物件。',
      '施展该法术时，受术目标会发出一声响亮的敲击声，其声响最远 300 尺内都能听见。',
    ],
    contentWarnings: [],
  },
  'lesser-restoration': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You touch a creature and end one condition on it: Blinded, Deafened, Paralyzed, or Poisoned.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Lesser_Restoration',
      title: '次等复原术｜Lesser Restoration',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 防护（吟游诗人、牧师、德鲁伊、圣武士、游侠、奇械师）',
      '施法时间：附赠动作',
      '施法距离：触碰',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText: '你触碰一个生物，并终止正影响它的一种状态：目盲，耳聋，麻痹或中毒 。',
    targets: ['你触碰一个生物，并终止正影响它的一种状态：目盲，耳聋，麻痹或中毒 。'],
    resources: ['施法时间：附赠动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['你触碰一个生物，并终止正影响它的一种状态：目盲，耳聋，麻痹或中毒 。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['你触碰一个生物，并终止正影响它的一种状态：目盲，耳聋，麻痹或中毒 。'],
    contentWarnings: [],
  },
  levitate: {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'One creature or loose object of your choice that you can see within range rises vertically up to 20 feet and remains suspended there for the duration. The spell can levitate an object that weighs up to 500 pounds. An unwilling creature that succeeds on a Constitution saving throw is unaffected. The target can move only by pushing or pulling against a fixed object or surface within reach (such as a wall or a ceiling), which allows it to move as if it were climbing. You can change the target’s altitude by up to 20 feet in either direction on your turn. If you are the target, you can move up or down as part of your move. Otherwise, you can take a Magic action to move the target, which must remain within the spell’s range. When the spell ends, the target floats gently to the ground if it is still aloft.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Levitate',
      title: '浮空术｜Levitate',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 变化（术士、法师、奇械师）',
      '施法时间：动作',
      '施法距离：60 尺',
      '法术成分：V、S、M（一个金属弹簧）',
      '持续时间：专注，至多 10 分钟',
    ],
    sourceText:
      '指定施法距离内你能看见的一个生物或未固定的物件，使其垂直上升至多 20 尺，并在该处维持悬浮直至持续时间结束。该法术可悬浮一个重量至多 500 磅的目标。一个非自愿的生物可以对法术进行一次体质豁免，若成功将避免受其影响。 目标只能通过推或拉一个固定的物件或平面（例如一面墙或者天花板）来进行移动，这种移动方式视为等同于攀爬。你可以在自己回合里将目标的悬浮高度向上或向下改变至多 20 尺：如果你自身就是该法术的目标，则你可以进行上升和下降并将其作为你移动的一部分；如果你不是该法术的目标，则你可以使用魔法动作来移动目标，但目标必须始终处于你的施法距离内。 法术终止时，仍处于空中的目标会缓缓飘落到地面。',
    targets: [
      '指定施法距离内你能看见的一个生物或未固定的物件，使其垂直上升至多 20 尺，并在该处维持悬浮直至持续时间结束。',
      '该法术可悬浮一个重量至多 500 磅的目标。',
      '一个非自愿的生物可以对法术进行一次体质豁免，若成功将避免受其影响。',
      '目标只能通过推或拉一个固定的物件或平面（例如一面墙或者天花板）来进行移动，这种移动方式视为等同于攀爬。',
      '你可以在自己回合里将目标的悬浮高度向上或向下改变至多 20 尺：如果你自身就是该法术的目标，则你可以进行上升和下降并将其作为你移动的一部分；如果你不是该法术的目标，则你可以使用魔法动作来移动目标，但目标必须始终处于你的施法距离内。',
      '法术终止时，仍处于空中的目标会缓缓飘落到地面。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一个金属弹簧）'],
    savingThrows: ['一个非自愿的生物可以对法术进行一次体质豁免，若成功将避免受其影响。'],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '指定施法距离内你能看见的一个生物或未固定的物件，使其垂直上升至多 20 尺，并在该处维持悬浮直至持续时间结束。',
      '你可以在自己回合里将目标的悬浮高度向上或向下改变至多 20 尺：如果你自身就是该法术的目标，则你可以进行上升和下降并将其作为你移动的一部分；如果你不是该法术的目标，则你可以使用魔法动作来移动目标，但目标必须始终处于你的施法距离内。',
      '法术终止时，仍处于空中的目标会缓缓飘落到地面。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '指定施法距离内你能看见的一个生物或未固定的物件，使其垂直上升至多 20 尺，并在该处维持悬浮直至持续时间结束。',
    ],
    contentWarnings: [],
  },
  'lightning-bolt': {
    categories: ['pure-damage'],
    catalogueText:
      'A stroke of lightning forming a 100-foot-long, 5-foot-wide Line blasts out from you in a direction you choose. Each creature in the Line makes a Dexterity saving throw, taking 8d6 Lightning damage on a failed save or half as much damage on a successful one. Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 3.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Lightning_Bolt',
      title: '闪电束｜Lightning Bolt',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 塑能（术士、法师）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、S、M（一些毛皮和一把水晶权杖）',
      '持续时间：立即',
    ],
    sourceText:
      '一束100 尺长，5尺宽的线状闪电从你的位置向你指定的方向爆发迸出。在线状区域内的每个生物必须进行一次敏捷豁免，豁免失败者将受到8d6点闪电伤害，豁免成功则受到一半伤害。 升环施法。 使用的法术位每比三环高一环，此法术的伤害就增加1d6。',
    targets: [
      '一束100 尺长，5尺宽的线状闪电从你的位置向你指定的方向爆发迸出。',
      '在线状区域内的每个生物必须进行一次敏捷豁免，豁免失败者将受到8d6点闪电伤害，豁免成功则受到一半伤害。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一些毛皮和一把水晶权杖）'],
    savingThrows: [
      '在线状区域内的每个生物必须进行一次敏捷豁免，豁免失败者将受到8d6点闪电伤害，豁免成功则受到一半伤害。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['升环施法。', '使用的法术位每比三环高一环，此法术的伤害就增加1d6。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'locate-animals-or-plants': {
    categories: ['non-damage', 'perception'],
    catalogueText:
      'Describe or name a specific kind of Beast, Plant creature, or nonmagical plant. You learn the direction and distance to the closest creature or plant of that kind within 5 miles, if any are present.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Locate_Animals_or_Plants',
      title: '动植物定位术｜Locate Animals or Plants',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 预言（吟游诗人、德鲁伊、游侠）',
      '施法时间：动作或仪式',
      '施法距离：自身',
      '法术成分：V、S、M（一块寻血猎犬的皮毛）',
      '持续时间：立即',
    ],
    sourceText:
      '你点名或描述一种特定的野兽生物、植物 生物或非魔法植物。如果5里内存在该类生物或植物，你将知晓其中最近的个体与你的相对方位和距离。',
    targets: [
      '你点名或描述一种特定的野兽生物、植物 生物或非魔法植物。',
      '如果5里内存在该类生物或植物，你将知晓其中最近的个体与你的相对方位和距离。',
    ],
    resources: ['施法时间：动作或仪式', '法术成分：V、S、M（一块寻血猎犬的皮毛）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['如果5里内存在该类生物或植物，你将知晓其中最近的个体与你的相对方位和距离。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['如果5里内存在该类生物或植物，你将知晓其中最近的个体与你的相对方位和距离。'],
    contentWarnings: [],
  },
  'locate-object': {
    categories: ['non-damage', 'perception'],
    catalogueText:
      'Describe or name an object that is familiar to you. You sense the direction to the object’s location if that object is within 1,000 feet of you. If the object is in motion, you know the direction of its movement. The spell can locate a specific object known to you if you have seen it up close—within 30 feet—at least once. Alternatively, the spell can locate the nearest object of a particular kind, such as a certain kind of apparel, jewelry, furniture, tool, or weapon. This spell can’t locate an object if any thickness of lead blocks a direct path between you and the object.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Locate_Object',
      title: '物件定位术｜Locate Object',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 预言（吟游诗人、牧师、德鲁伊、圣武士、游侠、法师）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、S、M（一根分叉的树枝）',
      '持续时间：专注，至多 10 分钟',
    ],
    sourceText:
      '你点名或描述一个你熟悉的物件。只要该物件与你相距不超过1000尺，你就会感测到该物件的方位。如果该物件正在移动，则你也将知晓其移动的方向。 该法术可定位一个你认识的特定物件，不过你需要曾经在30尺内近距离看到过该物件至少一次；或者它也可定位特定的一类物件（如某种服装、珠宝、家具、工具或武器）中距你最近个体。如果有任意厚度的铅，即使只是薄薄一片铅片阻挡了你与被定位物件间的通路，则该物件也无法被该法术所定位。',
    targets: [
      '你点名或描述一个你熟悉的物件。',
      '只要该物件与你相距不超过1000尺，你就会感测到该物件的方位。',
      '如果该物件正在移动，则你也将知晓其移动的方向。',
      '该法术可定位一个你认识的特定物件，不过你需要曾经在30尺内近距离看到过该物件至少一次；或者它也可定位特定的一类物件（如某种服装、珠宝、家具、工具或武器）中距你最近个体。',
      '如果有任意厚度的铅，即使只是薄薄一片铅片阻挡了你与被定位物件间的通路，则该物件也无法被该法术所定位。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一根分叉的树枝）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '如果该物件正在移动，则你也将知晓其移动的方向。',
      '如果有任意厚度的铅，即使只是薄薄一片铅片阻挡了你与被定位物件间的通路，则该物件也无法被该法术所定位。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['如果该物件正在移动，则你也将知晓其移动的方向。'],
    contentWarnings: [],
  },
  'magic-circle': {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'You create a 10-foot-radius, 20-foot-tall Cylinder of magical energy centered on a point on the ground that you can see within range. Glowing runes appear wherever the Cylinder intersects with the floor or other surface. Choose one or more of the following types of crea- tures: Celestials, Elementals, Fey, Fiends, or Undead. The circle affects a creature of the chosen type in the following ways: • The creature can’t willingly enter the Cylinder by nonmagical means. If the creature tries to use teleportation or interplanar travel to do so, it must first succeed on a Charisma saving throw. • The creature has Disadvantage on attack rolls against targets within the Cylinder. • Targets within the Cylinder can’t be possessed by or gain the Charmed or Frightened condition from the creature. Each time you cast this spell, you can cause its magic to operate in the reverse direction, preventing a creature of the specified type from leaving the Cylinder and protecting targets outside it. Using a Higher-Level Spell Slot. The duration in- creases by 1 hour for each spell slot level above 3.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Magic_Circle',
      title: '防护法阵｜Magic Circle',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 防护（牧师、圣武士、魔契师、法师）',
      '施法时间：1分钟',
      '施法距离：10尺',
      '法术成分： V、S、M（总价值100GP+的盐和银粉，作为法术耗材）',
      '持续时间：1小时',
    ],
    sourceText:
      '指定施法距离内地面上你能看见的一点，并以该处为中心创造一个 10 尺半径、20 尺高的柱状魔法能量。承载能量柱的地面或其他平面上会显现出闪光的符文。 指定以下生物类型中的一种或多种：天族、元素、妖精、邪魔、亡灵。法阵将会对被指定类型的生物产生以下效应： 该类生物不能以非魔法手段主动进入柱状区域内。如果该类生物试图使用传送或位面旅行进入此区域，则它必须先进行一次魅力豁免以判定其是否成功。 该类生物对柱状区域内的生物进行攻击检定时具有劣势。 柱状区域内的目标不受该类生物所魅惑、恐慌、或附身 。 施展该法术时，你可以选择让魔法作用于相反的方向来阻止特定种类的生物离开柱状区域内，以保护区域外的目标。 升环施法。使用的法术位每比三环高一环，法术持续时间就增加 1 小时。',
    targets: [
      '指定施法距离内地面上你能看见的一点，并以该处为中心创造一个 10 尺半径、20 尺高的柱状魔法能量。',
      '指定以下生物类型中的一种或多种：天族、元素、妖精、邪魔、亡灵。',
      '法阵将会对被指定类型的生物产生以下效应： 该类生物不能以非魔法手段主动进入柱状区域内。',
      '如果该类生物试图使用传送或位面旅行进入此区域，则它必须先进行一次魅力豁免以判定其是否成功。',
      '该类生物对柱状区域内的生物进行攻击检定时具有劣势。',
      '柱状区域内的目标不受该类生物所魅惑、恐慌、或附身 。',
      '施展该法术时，你可以选择让魔法作用于相反的方向来阻止特定种类的生物离开柱状区域内，以保护区域外的目标。',
    ],
    resources: ['施法时间：1分钟', '法术成分： V、S、M（总价值100GP+的盐和银粉，作为法术耗材）'],
    savingThrows: [
      '如果该类生物试图使用传送或位面旅行进入此区域，则它必须先进行一次魅力豁免以判定其是否成功。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '如果该类生物试图使用传送或位面旅行进入此区域，则它必须先进行一次魅力豁免以判定其是否成功。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比三环高一环，法术持续时间就增加 1 小时。'],
    visibility: [
      '指定施法距离内地面上你能看见的一点，并以该处为中心创造一个 10 尺半径、20 尺高的柱状魔法能量。',
    ],
    contentWarnings: [],
  },
  'magic-mouth': {
    categories: ['non-damage', 'communication', 'environment'],
    catalogueText:
      'You implant a message within an object in range—a message that is uttered when a trigger condition is met. Choose an object that you can see and that isn’t being worn or carried by another creature. Then speak the message, which must be 25 words or fewer, though it can be delivered over as long as 10 minutes. Finally, determine the circumstance that will trigger the spell to deliver your message. When that trigger occurs, a magical mouth appears on the object and recites the message in your voice and at the same volume you spoke. If the object you chose has a mouth or something that looks like a mouth (for example, the mouth of a statue), the magical mouth appears there, so the words appear to come from the object’s mouth. When you cast this spell, you can have the spell end after it delivers its message, or it can remain and repeat its message whenever the trigger occurs. The trigger can be as general or as detailed as you like, though it must be based on visual or audible conditions that occur within 30 feet of the object. For example, you could instruct the mouth to speak when any creature moves within 30 feet of the object or when a silver bell rings within 30 feet of it.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Magic_Mouth',
      title: '魔嘴术｜Magic Mouth',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 幻术（吟游诗人、法师、奇械师）',
      '施法时间：1分钟或仪式',
      '施法距离：30尺',
      '法术成分： V、S、M（价值10GP+的玉粉，作为法术耗材）',
      '持续时间：直到被解除',
    ],
    sourceText:
      '你将一段信息植入施法距离内的一个物件中，其信息会在满足预设事件时说出。指定一个你能看见且未被另一生物穿着或携带的物件。然后，你可以使用至多10分钟来传达这段不超过25个字的信息。最后再来设定触发法术传达信息的事件。预设的事件发生时，目标物件上出现一张魔法嘴，并用与你相同的声音和音量复述所存储的信息。如果你指定的目标本身有一张嘴或者类似嘴的结构（例如雕像的嘴），则魔法嘴将生成在该嘴结构的位置，使其看起来如同是物件的嘴在说话一样。施展该法术时，你可以让法术在传达过信息后随即终止，或者也可以让法术一直持续并在每次被预设条件触发时进行复述。你所决定的触发条件可以很概括也可以很具体，不过你只能根据目标物件30尺内的视觉或听觉状况来设定条件。例如，你可以命令魔嘴在任何生物移动至物件30尺内时说出信息，或者当其30尺内有银铃响起时说出信息。',
    targets: [
      '你将一段信息植入施法距离内的一个物件中，其信息会在满足预设事件时说出。',
      '指定一个你能看见且未被另一生物穿着或携带的物件。',
      '预设的事件发生时，目标物件上出现一张魔法嘴，并用与你相同的声音和音量复述所存储的信息。',
      '如果你指定的目标本身有一张嘴或者类似嘴的结构（例如雕像的嘴），则魔法嘴将生成在该嘴结构的位置，使其看起来如同是物件的嘴在说话一样。',
      '你所决定的触发条件可以很概括也可以很具体，不过你只能根据目标物件30尺内的视觉或听觉状况来设定条件。',
      '例如，你可以命令魔嘴在任何生物移动至物件30尺内时说出信息，或者当其30尺内有银铃响起时说出信息。',
    ],
    resources: ['施法时间：1分钟或仪式', '法术成分： V、S、M（价值10GP+的玉粉，作为法术耗材）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '如果你指定的目标本身有一张嘴或者类似嘴的结构（例如雕像的嘴），则魔法嘴将生成在该嘴结构的位置，使其看起来如同是物件的嘴在说话一样。',
      '施展该法术时，你可以让法术在传达过信息后随即终止，或者也可以让法术一直持续并在每次被预设条件触发时进行复述。',
      '例如，你可以命令魔嘴在任何生物移动至物件30尺内时说出信息，或者当其30尺内有银铃响起时说出信息。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '指定一个你能看见且未被另一生物穿着或携带的物件。',
      '预设的事件发生时，目标物件上出现一张魔法嘴，并用与你相同的声音和音量复述所存储的信息。',
      '你所决定的触发条件可以很概括也可以很具体，不过你只能根据目标物件30尺内的视觉或听觉状况来设定条件。',
    ],
    contentWarnings: [],
  },
  'magic-weapon': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You touch a nonmagical weapon. Until the spell ends, that weapon becomes a magic weapon with a +1 bonus to attack rolls and damage rolls. The spell ends early if you cast it again. Using a Higher-Level Spell Slot. The bonus in- creases to +2 with a level 3–5 spell slot. The bonus increases to +3 with a level 6+ spell slot.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Magic_Weapon',
      title: '魔化武器｜Magic Weapon',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 变化（圣武士、游侠、术士、法师、奇械师）',
      '施法时间：附赠动作',
      '施法距离：触碰',
      '法术成分：V、S',
      '持续时间：1小时',
    ],
    sourceText:
      '你触碰一件非魔法武器。直到法术结束前，它成为魔法武器且在进行攻击检定和伤害掷骰时具有+1 加值。你再次施展该法术时，先前的效应提前结束。 升环施法。使用三至五环的法术位时，此法术的加值增加至+2；使用高于五环的法术位时，此法术的加值增加至+3。',
    targets: ['你触碰一件非魔法武器。'],
    resources: ['施法时间：附赠动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '直到法术结束前，它成为魔法武器且在进行攻击检定和伤害掷骰时具有+1 加值。',
      '你再次施展该法术时，先前的效应提前结束。',
    ],
    upcasting: [
      '升环施法。',
      '使用三至五环的法术位时，此法术的加值增加至+2；使用高于五环的法术位时，此法术的加值增加至+3。',
    ],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'major-image': {
    categories: ['non-damage', 'environment', 'perception'],
    catalogueText:
      'You create the image of an object, a creature, or some other visible phenomenon that is no larger than a 20-foot Cube. The image appears at a spot that you can see within range and lasts for the duration. It seems real, including sounds, smells, and temperature appropriate to the thing depicted, but it can’t deal damage or cause conditions. If you are within range of the illusion, you can take a Magic action to cause the image to move to any other spot within range. As the image changes location, you can alter its appearance so that its movements appear natural for the image. For example, if you create an image of a creature and move it, you can alter the image so that it appears to be walking. Similarly, you can cause the illusion to make different sounds at different times, even making it carry on a conversation, for example. Physical interaction with the image reveals it to be an illusion, for things can pass through it. A crea- ture that takes a Study action to examine the image can determine that it is an illusion with a successful Intelligence (Investigation) check against your spell save DC. If a creature discerns the illusion for what it is, the creature can see through the image, and its other sensory qualities become faint to the creature. Using a Higher-Level Spell Slot. The spell lasts until dispelled, without requiring Concentration, if cast with a level 4+ spell slot.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Major_Image',
      title: '高级幻影｜Major Image',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 幻术（吟游诗人、术士、魔契师、法师）',
      '施法时间：动作',
      '施法距离：120尺',
      '法术成分：V、S、M（一撮羊毛）',
      '持续时间：专注，至多10分钟',
    ],
    sourceText:
      '你创造一个影像，其形象来自一个大小不超过边长20尺立方体的物件或生物，或是其他的可视现象。影像出现在施法距离内你能看见的一处位置并在法术持续时间内维持存在。它看起来完全是真实的，并且还具有相应的声音、气味和温度。但它无法造成伤害或让人陷入任何状态。 在该幻象施法距离内时，你可以用一个魔法动作将影像移动到施法距离内的另一个位置。影像改变位置时，你可以改变影像的外表来使它移动得更自然。例如，如果你创造了一个生物的影像并移动它，则你可以改变影像，使它看起来就像是在走路。或者你也可以让影像在不同的时间发出不同的声音，甚至可以让它参与一场对话。 由于影像可以被穿过，任何与该影像进行的物理互动都会暴露其幻象的本质。一个生物用研究动作调查影像时，它可以进行一次对抗你的法术豁免 DC 的智力（调查）检定，以判定是否看穿幻象。辨出幻象的生物可以看破该影像，而影像的其他感官效应在该生物看来会变得微弱而模糊。 升环施法。 使用高于三环的法术位时，法术时间持续至被解除且无需专注。',
    targets: [
      '你创造一个影像，其形象来自一个大小不超过边长20尺立方体的物件或生物，或是其他的可视现象。',
      '影像出现在施法距离内你能看见的一处位置并在法术持续时间内维持存在。',
      '在该幻象施法距离内时，你可以用一个魔法动作将影像移动到施法距离内的另一个位置。',
      '例如，如果你创造了一个生物的影像并移动它，则你可以改变影像，使它看起来就像是在走路。',
      '一个生物用研究动作调查影像时，它可以进行一次对抗你的法术豁免 DC 的智力（调查）检定，以判定是否看穿幻象。',
      '辨出幻象的生物可以看破该影像，而影像的其他感官效应在该生物看来会变得微弱而模糊。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一撮羊毛）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '例如，如果你创造了一个生物的影像并移动它，则你可以改变影像，使它看起来就像是在走路。',
    ],
    upcasting: ['升环施法。', '使用高于三环的法术位时，法术时间持续至被解除且无需专注。'],
    visibility: [
      '影像出现在施法距离内你能看见的一处位置并在法术持续时间内维持存在。',
      '它看起来完全是真实的，并且还具有相应的声音、气味和温度。',
      '在该幻象施法距离内时，你可以用一个魔法动作将影像移动到施法距离内的另一个位置。',
      '或者你也可以让影像在不同的时间发出不同的声音，甚至可以让它参与一场对话。',
      '由于影像可以被穿过，任何与该影像进行的物理互动都会暴露其幻象的本质。',
      '一个生物用研究动作调查影像时，它可以进行一次对抗你的法术豁免 DC 的智力（调查）检定，以判定是否看穿幻象。',
      '辨出幻象的生物可以看破该影像，而影像的其他感官效应在该生物看来会变得微弱而模糊。',
    ],
    contentWarnings: [],
  },
  'mass-healing-word': {
    categories: ['non-damage', 'healing'],
    catalogueText:
      'Up to six creatures of your choice that you can see within range regain Hit Points equal to 2d4 plus your spellcasting ability modifier. Using a Higher-Level Spell Slot. The healing in- creases by 1d4 for each spell slot level above 3.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Mass_Healing_Word',
      title: '群体治愈真言｜Mass Healing Word',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 防护（吟游诗人、牧师）',
      '施法时间：附赠动作',
      '施法距离：60尺',
      '法术成分：V',
      '持续时间：立即',
    ],
    sourceText:
      '指定施法距离内至多六个你能看见的生物，使它们恢复 2d4+你的施法属性调整值 点生命值。 升环施法。使用的法术位每比三环高一环，此法术的治疗量就增加1d4。',
    targets: ['指定施法距离内至多六个你能看见的生物，使它们恢复 2d4+你的施法属性调整值 点生命值。'],
    resources: ['施法时间：附赠动作', '法术成分：V'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['升环施法。', '使用的法术位每比三环高一环，此法术的治疗量就增加1d4。'],
    visibility: [
      '指定施法距离内至多六个你能看见的生物，使它们恢复 2d4+你的施法属性调整值 点生命值。',
    ],
    contentWarnings: [],
  },
  'meld-into-stone': {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'You step into a stone object or surface large enough to fully contain your body, merging yourself and your equipment with the stone for the duration. You must touch the stone to do so. Nothing of your presence remains visible or otherwise detectable by nonmagical senses. While merged with the stone, you can’t see what occurs outside it, and any Wisdom (Perception) checks you make to hear sounds outside it are made with Disadvantage. You remain aware of the passage of time and can cast spells on yourself while merged in the stone. You can use 5 feet of movement to leave the stone where you entered it, which ends the spell. You otherwise can’t move. Minor physical damage to the stone doesn’t harm you, but its partial destruction or a change in its shape (to the extent that you no longer fit within it) expels you and deals 6d6 Force damage to you. The stone’s complete destruction (or transmutation into a different substance) expels you and deals 50 Force damage to you. If expelled, you move into an unoccupied space closest to where you first entered and have the Prone condition.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Meld_Into_Stone',
      title: '融身入石｜Meld Into Stone',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 变化（牧师、德鲁伊、游侠）',
      '施法时间：动作或仪式',
      '施法距离：触碰',
      '法术成分：V、S',
      '持续时间：8小时',
    ],
    sourceText:
      '你进入一个足以完全容纳你身体的石料物件或石料表面内，使你自己和你携带的所有装备在法术持续时间内与石料融为一体。你必须触碰该石料来做到这件事。此后，任何非魔法的感官都无法看到或侦测到你的存在。 与石料融合后，你看不到外界发生了什么，并且你为了聆听外界声音而进行的任何感知（察觉）检定都具有劣势。与石头融合时，你仍能感觉到时间的流逝，也可以对自己施展法术。你无法移动，但可以消耗5尺移动力从进入石头的地方离开石内，法术随之终止。 石头所受的轻微损伤不会对你造成伤害，不过石头部分损毁或者形状改变时（改变到不再适合容纳你的程度），会将你从石中排挤出并对你造成6d6点力场伤害。石头完全损毁（或材质改变）时，也会将你从石中排挤出并对你造成50点力场伤害。被排挤出石头时，你移动至距离第一次进入石头处最近的一处未占据空间位置，并陷入倒地状态。',
    targets: [
      '你进入一个足以完全容纳你身体的石料物件或石料表面内，使你自己和你携带的所有装备在法术持续时间内与石料融为一体。',
      '你必须触碰该石料来做到这件事。',
      '石头所受的轻微损伤不会对你造成伤害，不过石头部分损毁或者形状改变时（改变到不再适合容纳你的程度），会将你从石中排挤出并对你造成6d6点力场伤害。',
      '石头完全损毁（或材质改变）时，也会将你从石中排挤出并对你造成50点力场伤害。',
      '被排挤出石头时，你移动至距离第一次进入石头处最近的一处未占据空间位置，并陷入倒地状态。',
    ],
    resources: ['施法时间：动作或仪式', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '你无法移动，但可以消耗5尺移动力从进入石头的地方离开石内，法术随之终止。',
      '石头完全损毁（或材质改变）时，也会将你从石中排挤出并对你造成50点力场伤害。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '与石料融合后，你看不到外界发生了什么，并且你为了聆听外界声音而进行的任何感知（察觉）检定都具有劣势。',
    ],
    contentWarnings: [],
  },
  'mind-spike': {
    categories: ['damage-with-rider', 'perception'],
    catalogueText:
      'You drive a spike of psionic energy into the mind of one creature you can see within range. The target makes a Wisdom saving throw, taking 3d8 Psychic damage on a failed save or half as much damage on a successful one. On a failed save, you also always know the target’s location until the spell ends, but only while the two of you are on the same plane of existence. While you have this knowledge, the target can’t become hidden from you, and if it has the Invisible condition, it gains no benefit from that condition against you. Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 2.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Mind_Spike',
      title: '心灵尖刺｜Mind Spike',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 预言（术士、魔契师、法师）',
      '施法时间：动作',
      '施法距离：120尺',
      '法术成分：S',
      '持续时间：专注，至多1小时',
    ],
    sourceText:
      '指定施法距离内一个可见生物，你驱动一道心灵能量的锥刺侵入目标的心智。目标必须进行一次感知豁免检定，失败则会受到3d8点心灵伤害，成功则只受一半伤害。在目标豁免失败时，你在法术结束之前能时刻得知目标所在的位置，只要你们还处于同一个存在位面上。当你拥有目标的位置信息时，目标将不能对你躲藏，并且如果它隐形了，在对抗你时它不能从这个状态中受益。 升环施法。使用的法术位每比二环高一环，此法术的伤害就增加1d8。',
    targets: [
      '指定施法距离内一个可见生物，你驱动一道心灵能量的锥刺侵入目标的心智。',
      '目标必须进行一次感知豁免检定，失败则会受到3d8点心灵伤害，成功则只受一半伤害。',
      '在目标豁免失败时，你在法术结束之前能时刻得知目标所在的位置，只要你们还处于同一个存在位面上。',
      '当你拥有目标的位置信息时，目标将不能对你躲藏，并且如果它隐形了，在对抗你时它不能从这个状态中受益。',
    ],
    resources: ['施法时间：动作', '法术成分：S'],
    savingThrows: [
      '目标必须进行一次感知豁免检定，失败则会受到3d8点心灵伤害，成功则只受一半伤害。',
      '在目标豁免失败时，你在法术结束之前能时刻得知目标所在的位置，只要你们还处于同一个存在位面上。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '在目标豁免失败时，你在法术结束之前能时刻得知目标所在的位置，只要你们还处于同一个存在位面上。',
      '当你拥有目标的位置信息时，目标将不能对你躲藏，并且如果它隐形了，在对抗你时它不能从这个状态中受益。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比二环高一环，此法术的伤害就增加1d8。'],
    visibility: [
      '指定施法距离内一个可见生物，你驱动一道心灵能量的锥刺侵入目标的心智。',
      '目标必须进行一次感知豁免检定，失败则会受到3d8点心灵伤害，成功则只受一半伤害。',
      '当你拥有目标的位置信息时，目标将不能对你躲藏，并且如果它隐形了，在对抗你时它不能从这个状态中受益。',
    ],
    contentWarnings: [],
  },
  'mirror-image': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'Three illusory duplicates of yourself appear in your space. Until the spell ends, the duplicates move with you and mimic your actions, shifting position so it’s impossible to track which image is real. Each time a creature hits you with an attack roll during the spell’s duration, roll a d6 for each of your remaining duplicates. If any of the d6s rolls a 3 or higher, one of the duplicates is hit instead of you, and the duplicate is destroyed. The duplicates otherwise ignore all other damage and effects. The spell ends when all three duplicates are destroyed. A creature is unaffected by this spell if it has the Blinded condition, Blindsight, or Truesight.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Mirror_Image',
      title: '镜影术｜Mirror Image',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 幻术（吟游诗人、术士、魔契师、法师）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、S',
      '持续时间：1分钟',
    ],
    sourceText:
      '三个你自身的幻象分身出现在你所处的空间中。直到法术终止前，分身都会随你移动，并模仿你的动作和位置变换，使人无法追踪判断哪一个是你的真身。 在法术持续时间内，每当一个生物攻击命中你时，为每个剩余分身投掷一个d6，只要有任一d6骰出3或以上，一个分身代你承受本次命中并随之被摧毁。分身无视所有其他的伤害和效应。三个分身都被摧毁时，法术随之结束。 如果一名生物处于目盲状态，或拥有盲视，或拥有真实视觉，则该法术无法影响该生物。',
    targets: [
      '三个你自身的幻象分身出现在你所处的空间中。',
      '在法术持续时间内，每当一个生物攻击命中你时，为每个剩余分身投掷一个d6，只要有任一d6骰出3或以上，一个分身代你承受本次命中并随之被摧毁。',
      '如果一名生物处于目盲状态，或拥有盲视，或拥有真实视觉，则该法术无法影响该生物。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '直到法术终止前，分身都会随你移动，并模仿你的动作和位置变换，使人无法追踪判断哪一个是你的真身。',
      '在法术持续时间内，每当一个生物攻击命中你时，为每个剩余分身投掷一个d6，只要有任一d6骰出3或以上，一个分身代你承受本次命中并随之被摧毁。',
      '三个分身都被摧毁时，法术随之结束。',
      '如果一名生物处于目盲状态，或拥有盲视，或拥有真实视觉，则该法术无法影响该生物。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '三个你自身的幻象分身出现在你所处的空间中。',
      '如果一名生物处于目盲状态，或拥有盲视，或拥有真实视觉，则该法术无法影响该生物。',
    ],
    contentWarnings: [],
  },
  'misty-step': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space you can see.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Misty_Step',
      title: '迷踪步｜Misty Step',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 咒法（术士、魔契师、法师）',
      '施法时间：附赠动作',
      '施法距离：自身',
      '法术成分：V',
      '持续时间：立即',
    ],
    sourceText: '你短暂地被银白的雾气所笼罩，传送到至多30尺内一个你能看见且未占据空间。',
    targets: ['本术目标由下列完整正文限定；无可简化的生物目标字段。'],
    resources: ['施法时间：附赠动作', '法术成分：V'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['你短暂地被银白的雾气所笼罩，传送到至多30尺内一个你能看见且未占据空间。'],
    contentWarnings: [],
  },
  moonbeam: {
    categories: ['damage-with-rider', 'environment'],
    catalogueText:
      'A silvery beam of pale light shines down in a 5-foot-radius, 40-foot-high Cylinder centered on a point within range. Until the spell ends, Dim Light fills the Cylinder, and you can take a Magic action on later turns to move the Cylinder up to 60 feet. When the Cylinder appears, each creature in it makes a Constitution saving throw. On a failed save, a creature takes 2d10 Radiant damage, and if the creature is shape-shifted (as a result of the Polymorph spell, for example), it reverts to its true form and can’t shape-shift until it leaves the Cylinder. On a successful save, a creature takes half as much damage only. A creature also makes this save when the spell’s area moves into its space and when it enters the spell’s area or ends its turn there. A crea- ture makes this save only once per turn. Using a Higher-Level Spell Slot. The damage increases by 1d10 for each spell slot level above 2.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Moonbeam',
      title: '月华之光｜Moonbeam',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 塑能（德鲁伊）',
      '施法时间：动作',
      '施法距离：120尺',
      '法术成分：V、S、M（一片月籽藤叶）',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '指定施法距离内一点，一束淡淡的银光照耀在以该点为中心半径5尺、高40尺的柱状区域内。直至法术终止前，柱状区域内处于微光光照。在施展该法术的后续回合内，你能够以一个魔法动作将柱状区域移动至多60尺。柱状区域出现时，每个区域内的生物进行一次体质豁免检定，豁免失败则受到2d10的光耀伤害，且若该生物已变形（例如受法术变形术Polymorph影响），其变回真实形态，且无法在离开柱状区域前变形。豁免成功则仅承受前述伤害的一半。在法术区域进入生物空间、生物进入法术区域或在其内结束回合时，目标生物也需要进行该体质豁免检定。一名生物每回合仅需进行一次该豁免检定。 升环施法。使用的法术位每比二环高一环，此法术的伤害就增加1d10。',
    targets: [
      '指定施法距离内一点，一束淡淡的银光照耀在以该点为中心半径5尺、高40尺的柱状区域内。',
      '直至法术终止前，柱状区域内处于微光光照。',
      '在施展该法术的后续回合内，你能够以一个魔法动作将柱状区域移动至多60尺。',
      '柱状区域出现时，每个区域内的生物进行一次体质豁免检定，豁免失败则受到2d10的光耀伤害，且若该生物已变形（例如受法术变形术Polymorph影响），其变回真实形态，且无法在离开柱状区域前变形。',
      '在法术区域进入生物空间、生物进入法术区域或在其内结束回合时，目标生物也需要进行该体质豁免检定。',
      '一名生物每回合仅需进行一次该豁免检定。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一片月籽藤叶）'],
    savingThrows: [
      '柱状区域出现时，每个区域内的生物进行一次体质豁免检定，豁免失败则受到2d10的光耀伤害，且若该生物已变形（例如受法术变形术Polymorph影响），其变回真实形态，且无法在离开柱状区域前变形。',
      '豁免成功则仅承受前述伤害的一半。',
      '在法术区域进入生物空间、生物进入法术区域或在其内结束回合时，目标生物也需要进行该体质豁免检定。',
      '一名生物每回合仅需进行一次该豁免检定。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '直至法术终止前，柱状区域内处于微光光照。',
      '在施展该法术的后续回合内，你能够以一个魔法动作将柱状区域移动至多60尺。',
      '在法术区域进入生物空间、生物进入法术区域或在其内结束回合时，目标生物也需要进行该体质豁免检定。',
      '一名生物每回合仅需进行一次该豁免检定。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比二环高一环，此法术的伤害就增加1d10。'],
    visibility: [
      '指定施法距离内一点，一束淡淡的银光照耀在以该点为中心半径5尺、高40尺的柱状区域内。',
      '直至法术终止前，柱状区域内处于微光光照。',
    ],
    contentWarnings: [],
  },
  nondetection: {
    categories: ['non-damage', 'support', 'perception'],
    catalogueText:
      'For the duration, you hide a target that you touch from Divination spells. The target can be a willing creature, or it can be a place or an object no larger than 10 feet in any dimension. The target can’t be targeted by any Divination spell or perceived through magical scrying sensors.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Nondetection',
      title: '回避侦测｜Nondetection',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 防护（吟游诗人、游侠、法师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S、M（一撮价值25+GP的钻石尘，作为法术耗材）',
      '持续时间：8小时',
    ],
    sourceText:
      '法术持续时间内，你使你触碰的目标不会被预言法术发现。目标可以是一名自愿生物，或者是在任何方向上都不超过10尺的一处地点或一个物件。目标不能被任何预言法术选为目标，也不能被魔法探知传感器感测到。',
    targets: [
      '法术持续时间内，你使你触碰的目标不会被预言法术发现。',
      '目标可以是一名自愿生物，或者是在任何方向上都不超过10尺的一处地点或一个物件。',
      '目标不能被任何预言法术选为目标，也不能被魔法探知传感器感测到。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一撮价值25+GP的钻石尘，作为法术耗材）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['法术持续时间内，你使你触碰的目标不会被预言法术发现。'],
    contentWarnings: [],
  },
  'pass-without-trace': {
    categories: ['non-damage', 'support', 'perception'],
    catalogueText:
      'You radiate a concealing aura in a 30-foot Emana- tion for the duration. While in the aura, you and each creature you choose have a +10 bonus to Dex- terity (Stealth) checks and leave no tracks.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Pass_without_Trace',
      title: '行动无踪｜Pass without Trace',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 防护（德鲁伊、游侠）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、S、M（槲寄生烧成的灰烬）',
      '持续时间：专注，至多1小时',
    ],
    sourceText:
      '你在法术持续时间于30尺光环范围内散发出遮蔽灵光。位于灵光范围期间，你和每名你选择的生物在敏捷（隐匿）检定上获得+10加值，且不会留下任何踪迹。',
    targets: [
      '你在法术持续时间于30尺光环范围内散发出遮蔽灵光。',
      '位于灵光范围期间，你和每名你选择的生物在敏捷（隐匿）检定上获得+10加值，且不会留下任何踪迹。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（槲寄生烧成的灰烬）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'phantasmal-force': {
    categories: ['damage-with-rider', 'condition'],
    catalogueText:
      'You attempt to craft an illusion in the mind of a creature you can see within range. The target makes an Intelligence saving throw. On a failed save, you create a phantasmal object, creature, or other phenomenon that is no larger than a 10-foot Cube and that is perceivable only to the target for the duration. The phantasm includes sound, tem- perature, and other stimuli. The target can take a Study action to examine the phantasm with an Intelligence (Investigation) check against your spell save DC. If the check succeeds, the target realizes that the phantasm is an illusion, and the spell ends. While affected by the spell, the target treats the phantasm as if it were real and rationalizes any illogical outcomes from interacting with it. For example, if the target steps through a phantasmal bridge and survives the fall, it believes the bridge exists and something else caused it to fall. An affected target can even take damage from the illusion if the phantasm represents a dangerous creature or hazard. On each of your turns, such a phantasm can deal 2d8 Psychic damage to the target if it is in the phantasm’s area or within 5 feet of the phantasm. The target perceives the damage as a type appropriate to the illusion.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Phantasmal_Force',
      title: '魅影之力｜Phantasmal Force',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 幻术（吟游诗人、术士、法师）',
      '施法时间：动作',
      '施法距离：60尺',
      '法术成分：V、S、M（一点羊毛）',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '你试图向施法距离内你可见的一名生物脑内植入一段幻术。目标进行一次智力豁免。豁免失败时，你创造出一个不大于10尺立方且只能被目标感知到的魅影物件，生物或其他你指定的现象。魅影将持续至法术终止。该魅影包括声音、温度和其他感官因素。目标可以用研究动作进行一次对抗你法术豁免DC的智力（调查）检定来仔细研究这个魅影。检定成功则目标意识到魅影是一道幻术，法术终止。目标受法术影响期间会认定魅影是真实的，并且会合理化任何与其互动产生的不合逻辑的结果。例如，若目标试图走过一座跨越峡谷的魅影桥时从桥上坠落并存活，它仍然会相信该桥是真实存在的，并且会觉得是其他什么东西导致了自己的坠落。若魅影代表着一名危险生物或一处灾害，则受术目标甚至还会受到幻术的直接伤害。在每个你的回合中，若目标在魅影区域内或距其5尺范围内，则上述形态的魅影可以对目标造成2d8点心灵伤害。而此时目标则会感觉该伤害类型与魅影适于造成的一种伤害类型相符。',
    targets: [
      '你试图向施法距离内你可见的一名生物脑内植入一段幻术。',
      '目标进行一次智力豁免。',
      '豁免失败时，你创造出一个不大于10尺立方且只能被目标感知到的魅影物件，生物或其他你指定的现象。',
      '目标可以用研究动作进行一次对抗你法术豁免DC的智力（调查）检定来仔细研究这个魅影。',
      '检定成功则目标意识到魅影是一道幻术，法术终止。',
      '目标受法术影响期间会认定魅影是真实的，并且会合理化任何与其互动产生的不合逻辑的结果。',
      '例如，若目标试图走过一座跨越峡谷的魅影桥时从桥上坠落并存活，它仍然会相信该桥是真实存在的，并且会觉得是其他什么东西导致了自己的坠落。',
      '若魅影代表着一名危险生物或一处灾害，则受术目标甚至还会受到幻术的直接伤害。',
      '在每个你的回合中，若目标在魅影区域内或距其5尺范围内，则上述形态的魅影可以对目标造成2d8点心灵伤害。',
      '而此时目标则会感觉该伤害类型与魅影适于造成的一种伤害类型相符。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一点羊毛）'],
    savingThrows: [
      '目标进行一次智力豁免。',
      '豁免失败时，你创造出一个不大于10尺立方且只能被目标感知到的魅影物件，生物或其他你指定的现象。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '魅影将持续至法术终止。',
      '检定成功则目标意识到魅影是一道幻术，法术终止。',
      '在每个你的回合中，若目标在魅影区域内或距其5尺范围内，则上述形态的魅影可以对目标造成2d8点心灵伤害。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '你试图向施法距离内你可见的一名生物脑内植入一段幻术。',
      '豁免失败时，你创造出一个不大于10尺立方且只能被目标感知到的魅影物件，生物或其他你指定的现象。',
      '该魅影包括声音、温度和其他感官因素。',
      '检定成功则目标意识到魅影是一道幻术，法术终止。',
      '在每个你的回合中，若目标在魅影区域内或距其5尺范围内，则上述形态的魅影可以对目标造成2d8点心灵伤害。',
    ],
    contentWarnings: [],
  },
  'phantom-steed': {
    categories: ['non-damage', 'environment', 'summoning'],
    catalogueText:
      'A Large, quasi-real, horselike creature appears on the ground in an unoccupied space of your choice within range. You decide the creature’s appearance, and it is equipped with a saddle, bit, and bridle. Any of the equipment created by the spell vanishes in a puff of smoke if it is carried more than 10 feet away from the steed. For the duration, you or a creature you choose can ride the steed. The steed uses the Riding Horse stat block (see “Monsters”), except it has a Speed of 100 feet and can travel 13 miles in an hour. When the spell ends, the steed gradually fades, giving the rider 1 minute to dismount. The spell ends early if the steed takes any damage.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Phantom_Steed',
      title: '魅影驹｜Phantom Steed',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 幻术（法师）',
      '施法时间：1分钟或仪式',
      '施法距离：30尺',
      '法术成分：V、S',
      '持续时间：1小时',
    ],
    sourceText:
      '一匹拟真的大型马形生物出现在施法距离内你选择的一处地面上的未占据空间中。你决定该生物的样貌，且它装备着鞍座、嚼子和缰绳。这些随法术创造的装备一旦离开坐骑10尺即化作一阵烟消失不见。 在法术持续时间内，你或者一名你指定的生物可以骑乘此坐骑。坐骑使用乘用马Riding Horse的数据（见附录B），不过其具有100尺速度，每小时可行进13里。法术终止时，坐骑会慢慢消失，骑手有1分钟的时间下马。坐骑受到伤害时，法术将提前终止。',
    targets: [
      '一匹拟真的大型马形生物出现在施法距离内你选择的一处地面上的未占据空间中。',
      '你决定该生物的样貌，且它装备着鞍座、嚼子和缰绳。',
      '在法术持续时间内，你或者一名你指定的生物可以骑乘此坐骑。',
    ],
    resources: ['施法时间：1分钟或仪式', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '这些随法术创造的装备一旦离开坐骑10尺即化作一阵烟消失不见。',
      '法术终止时，坐骑会慢慢消失，骑手有1分钟的时间下马。',
      '坐骑受到伤害时，法术将提前终止。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'plant-growth': {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'This spell channels vitality into plants. The casting time you use determines whether the spell has the Overgrowth or the Enrichment effect below. Overgrowth. Choose a point within range. All normal plants in a 100-foot-radius Sphere centered on that point become thick and overgrown. A crea- ture moving through that area must spend 4 feet of movement for every 1 foot it moves. You can exclude one or more areas of any size within the spell’s area from being affected. Enrichment. All plants in a half-mile radius centered on a point within range become enriched for 365 days. The plants yield twice the normal amount of food when harvested. They can benefit from only one Plant Growth per year.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Plant_Growth',
      title: '植物滋长｜Plant Growth',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 变化（吟游诗人、德鲁伊、游侠）',
      '施法时间：动作（繁茂）或8小时（丰产）',
      '施法距离：150尺',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '该法术将活力引导给特定区域中的植物。本法术的施法时间取决于你选择下述效应之一：繁茂或丰产。 繁茂Overgrowth。 你指定施法距离内一点，以该点为中心100尺半径的球状范围内的普通植物将变的粗壮繁茂。一名穿过该区域的生物每移动1尺必须花费4尺移动力。你可以在该法术范围内空出一块或多块任意大小的区域，将其排除在法术效应影响之外。 丰产Enrichment。 你指定施法距离内一点，距该点半里内的植物的产量将在365日内被强化。这些植物收获时将产出两倍于正常产量的作物。这些植物每年仅能从一道植物滋长中获益。',
    targets: [
      '该法术将活力引导给特定区域中的植物。',
      '本法术的施法时间取决于你选择下述效应之一：繁茂或丰产。',
      '你指定施法距离内一点，以该点为中心100尺半径的球状范围内的普通植物将变的粗壮繁茂。',
      '一名穿过该区域的生物每移动1尺必须花费4尺移动力。',
      '你可以在该法术范围内空出一块或多块任意大小的区域，将其排除在法术效应影响之外。',
      '你指定施法距离内一点，距该点半里内的植物的产量将在365日内被强化。',
    ],
    resources: ['施法时间：动作（繁茂）或8小时（丰产）', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'prayer-of-healing': {
    categories: ['non-damage', 'healing'],
    catalogueText:
      'Up to five creatures of your choice who remain within range for the spell’s entire casting gain the benefits of a Short Rest and also regain 2d8 Hit Points. A creature can’t be affected by this spell again until that creature finishes a Long Rest. Using a Higher-Level Spell Slot. The healing in- creases by 1d8 for each spell slot level above 2.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Prayer_of_Healing',
      title: '治疗祷言｜Prayer of Healing',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 防护（牧师、圣武士）',
      '施法时间：10分钟',
      '施法距离：30尺',
      '法术成分：V',
      '持续时间：立即',
    ],
    sourceText:
      '在施展法术期间一直位于施法距离内的至多五名生物获得等同于一次短休的增益，并且恢复2d8点生命值。一名生物直到完成一次长休为止不能再次被此法术影响。 升环施法。使用的法术位每比二环高一环，此法术的治疗量就增加1d8。',
    targets: [
      '在施展法术期间一直位于施法距离内的至多五名生物获得等同于一次短休的增益，并且恢复2d8点生命值。',
      '一名生物直到完成一次长休为止不能再次被此法术影响。',
    ],
    resources: ['施法时间：10分钟', '法术成分：V'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['一名生物直到完成一次长休为止不能再次被此法术影响。'],
    upcasting: ['升环施法。', '使用的法术位每比二环高一环，此法术的治疗量就增加1d8。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'protection-from-energy': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'For the duration, the willing creature you touch has Resistance to one damage type of your choice: Acid, Cold, Fire, Lightning, or Thunder.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Protection_from_Energy',
      title: '防护能量｜Protection from Energy',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 防护（牧师、德鲁伊、游侠、术士、法师、奇械师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S',
      '持续时间：专注，至多1小时',
    ],
    sourceText:
      '法术持续时间内，你触碰的一名自愿生物具有你选择的一种伤害类型的抗性：强酸、寒冷、火焰、闪电、雷鸣。',
    targets: [
      '法术持续时间内，你触碰的一名自愿生物具有你选择的一种伤害类型的抗性：强酸、寒冷、火焰、闪电、雷鸣。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'protection-from-poison': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You touch a creature and end the Poisoned condition on it. For the duration, the target has Advantage on saving throws to avoid or end the Poisoned condition, and it has Resistance to Poison damage.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Protection_from_Poison',
      title: '防护毒素｜Protection from Poison',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 防护（牧师、德鲁伊、圣武士、游侠、奇械师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S',
      '持续时间：1小时',
    ],
    sourceText:
      '你触碰一名生物并结束其陷入的中毒状态。在持续时间内，目标为避免陷入或结束中毒状态所做的豁免具有优势，且具有毒素伤害的抗性。',
    targets: [
      '你触碰一名生物并结束其陷入的中毒状态。',
      '在持续时间内，目标为避免陷入或结束中毒状态所做的豁免具有优势，且具有毒素伤害的抗性。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '在持续时间内，目标为避免陷入或结束中毒状态所做的豁免具有优势，且具有毒素伤害的抗性。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '你触碰一名生物并结束其陷入的中毒状态。',
      '在持续时间内，目标为避免陷入或结束中毒状态所做的豁免具有优势，且具有毒素伤害的抗性。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'ray-of-enfeeblement': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'A beam of enervating energy shoots from you toward a creature within range. The target must make a Constitution saving throw. On a successful save, the target has Disadvantage on the next attack roll it makes until the start of your next turn. On a failed save, the target has Disadvantage on Strength-based D20 Tests for the duration. During that time, it also subtracts 1d8 from all its damage rolls. The target repeats the save at the end of each of its turns, ending the spell on a success.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Ray_of_Enfeeblement',
      title: '衰弱射线｜Ray of Enfeeblement',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 死灵（魔契师、法师）',
      '施法时间：动作',
      '施法距离：60尺',
      '法术成分：V、S',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '你向施法距离内的一名生物射出一道让人衰弱的能量射线。目标必须进行一次体质豁免。豁免成功，则目标直到你的下个回合开始在下一次攻击掷骰上具有劣势。豁免失败，目标在持续时间内在使用力量属性的D20检定上具有劣势。同样的，在此期间，其所有的伤害掷骰获得1d8的减值。目标在每个其回合结束时可以重复豁免，豁免成功则法术终止。',
    targets: [
      '你向施法距离内的一名生物射出一道让人衰弱的能量射线。',
      '目标必须进行一次体质豁免。',
      '豁免成功，则目标直到你的下个回合开始在下一次攻击掷骰上具有劣势。',
      '豁免失败，目标在持续时间内在使用力量属性的D20检定上具有劣势。',
      '目标在每个其回合结束时可以重复豁免，豁免成功则法术终止。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '目标必须进行一次体质豁免。',
      '豁免成功，则目标直到你的下个回合开始在下一次攻击掷骰上具有劣势。',
      '豁免失败，目标在持续时间内在使用力量属性的D20检定上具有劣势。',
      '目标在每个其回合结束时可以重复豁免，豁免成功则法术终止。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '豁免成功，则目标直到你的下个回合开始在下一次攻击掷骰上具有劣势。',
      '目标在每个其回合结束时可以重复豁免，豁免成功则法术终止。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'remove-curse': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'At your touch, all curses affecting one creature or object end. If the object is a cursed magic item, its curse remains, but the spell breaks its owner’s Attunement to the object so it can be removed or discarded.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Remove_Curse',
      title: '移除诅咒｜Remove Curse',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 防护（牧师、圣武士、魔契师、法师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你触碰一名生物或一个物件，使影响其的所有诅咒终止。如果该物件是一件诅咒魔法物品，则其上的诅咒将维持，不过该法术可以打破诅咒物品与其所有者之间的同调，使其所有者可以将其卸下或丢弃。',
    targets: [
      '你触碰一名生物或一个物件，使影响其的所有诅咒终止。',
      '如果该物件是一件诅咒魔法物品，则其上的诅咒将维持，不过该法术可以打破诅咒物品与其所有者之间的同调，使其所有者可以将其卸下或丢弃。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '你触碰一名生物或一个物件，使影响其的所有诅咒终止。',
      '如果该物件是一件诅咒魔法物品，则其上的诅咒将维持，不过该法术可以打破诅咒物品与其所有者之间的同调，使其所有者可以将其卸下或丢弃。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  revivify: {
    categories: ['non-damage', 'support', 'healing'],
    catalogueText:
      'You touch a creature that has died within the last minute. That creature revives with 1 Hit Point. This spell can’t revive a creature that has died of old age, nor does it restore any missing body parts.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Revivify',
      title: '回生术｜Revivify',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 死灵（牧师、德鲁伊、圣武士、游侠、奇械师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S、M（一颗价值300+GP的钻石，作为法术耗材）',
      '持续时间：立即',
    ],
    sourceText:
      '你接触在前一分钟内刚刚死亡的一名生物。该生物以1点生命值回生。该法术不能复活老死的生物，也不能恢复失去的身体部位。',
    targets: [
      '你接触在前一分钟内刚刚死亡的一名生物。',
      '该生物以1点生命值回生。',
      '该法术不能复活老死的生物，也不能恢复失去的身体部位。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一颗价值300+GP的钻石，作为法术耗材）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['该法术不能复活老死的生物，也不能恢复失去的身体部位。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'rope-trick': {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'You touch a rope. One end of it hovers upward until the rope hangs perpendicular to the ground or the rope reaches a ceiling. At the rope’s upper end, an Invisible 3-foot-by-5-foot portal opens to an extra- dimensional space that lasts until the spell ends. That space can be reached by climbing the rope, which can be pulled into or dropped out of it. The space can hold up to eight Medium or smaller creatures. Attacks, spells, and other effects can’t pass into or out of the space, but creatures inside it can see through the portal. Anything inside the space drops out when the spell ends.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Rope_Trick',
      title: '魔绳术｜Rope Trick',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 变化（法师、奇械师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S、M（一段绳子）',
      '持续时间：1小时',
    ],
    sourceText:
      '你接触一段绳子。绳的一端会向上升起，直到整条绳索都垂直于地面挂在空中或绳子触及天花板。绳子向上的末端存在一个隐形的3尺×5尺大小的传送门，其通往一个法术持续时间内一直存在的异次元空间。沿着绳子向上攀爬即可进入此空间，绳子也可被拽入空间中或从空间中丢出。空间可容纳至多八名体型不超过中型的生物。攻击，法术和其他效应均无法穿过空间而出入，但空间内的生物可以通过入口看到外面的景象。法术终止时，异次元空间内的一切东西都会掉出来。',
    targets: [
      '你接触一段绳子。',
      '空间可容纳至多八名体型不超过中型的生物。',
      '攻击，法术和其他效应均无法穿过空间而出入，但空间内的生物可以通过入口看到外面的景象。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一段绳子）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '绳的一端会向上升起，直到整条绳索都垂直于地面挂在空中或绳子触及天花板。',
      '法术终止时，异次元空间内的一切东西都会掉出来。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '绳子向上的末端存在一个隐形的3尺×5尺大小的传送门，其通往一个法术持续时间内一直存在的异次元空间。',
    ],
    contentWarnings: [],
  },
  'scorching-ray': {
    categories: ['pure-damage'],
    catalogueText:
      'You hurl three fiery rays. You can hurl them at one target within range or at several. Make a ranged spell attack for each ray. On a hit, the target takes 2d6 Fire damage. Using a Higher-Level Spell Slot. You create one additional ray for each spell slot level above 2.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Scorching_Ray',
      title: '灼热射线｜Scorching Ray',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 塑能（术士、法师）',
      '施法时间：动作',
      '施法距离：120 尺',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你射出三道火焰的射线。你可以将其射向施法距离内的一个或多个目标。每道射线需要你分别进行一次远程法术攻击。若命中，则目标受到2d6点火焰伤害。 升环施法。使用的法术位每比二环高一环，你就能多创造出一道射线。',
    targets: ['你可以将其射向施法距离内的一个或多个目标。', '若命中，则目标受到2d6点火焰伤害。'],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['升环施法。', '使用的法术位每比二环高一环，你就能多创造出一道射线。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'see-invisibility': {
    categories: ['non-damage', 'support', 'perception'],
    catalogueText:
      'For the duration, you see creatures and objects that have the Invisible condition as if they were visible, and you can see into the Ethereal Plane. Creatures and objects there appear ghostly.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'See_Invisibility',
      title: '识破隐形｜See Invisibility',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 预言（吟游诗人、术士、法师、奇械师）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、S、M（一撮滑石粉）',
      '持续时间：1 小时',
    ],
    sourceText:
      '在法术持续时间内，你能看见任何处于隐形状态的生物和物件，如同其处于正常可见状态一样。你还能够看见以太位面，以太位面的生物和物件在你眼中会以幽灵般的半透明形状显现。',
    targets: [
      '在法术持续时间内，你能看见任何处于隐形状态的生物和物件，如同其处于正常可见状态一样。',
      '你还能够看见以太位面，以太位面的生物和物件在你眼中会以幽灵般的半透明形状显现。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一撮滑石粉）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '在法术持续时间内，你能看见任何处于隐形状态的生物和物件，如同其处于正常可见状态一样。',
      '你还能够看见以太位面，以太位面的生物和物件在你眼中会以幽灵般的半透明形状显现。',
    ],
    contentWarnings: [],
  },
  sending: {
    categories: ['non-damage', 'communication'],
    catalogueText:
      'You send a short message of 25 words or fewer to a creature you have met or a creature described to you by someone who has met it. The target hears the message in its mind, recognizes you as the sender if it knows you, and can answer in a like manner immediately. The spell enables targets to understand the meaning of your message. You can send the message across any distance and even to other planes of existence, but if the target is on a different plane than you, there is a 5 percent chance that the message doesn’t arrive. You know if the delivery fails. Upon receiving your message, a creature can block your ability to reach it again with this spell for 8 hours. If you try to send another message during that time, you learn that you are blocked, and the spell fails.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Sending',
      title: '短讯术｜Sending',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 预言（吟游诗人、牧师、法师）',
      '施法时间：动作',
      '施法距离：无限',
      '法术成分：V、S、M（一段铜线）',
      '持续时间：立即',
    ],
    sourceText:
      '你向你所遇到过的或某人遇到过且向你描述的一个生物发送一小段二十五个词以内的信息。该生物将在心中听到你的信息，它可以认出你是发讯人（如果他认识你），还可以用同样的方式立即回复一条讯息。法术会让目标能够理解你短讯的信息。 你的传讯可以跨越任意长的距离，甚至能跨越位面。但如果目标和你不在同一个存在位面，则短讯术有5%的概率无法到达。如果讯息没能传达，你将得知这一结果。 在收到你的信息后，一个生物能够屏蔽你以这个法术再次对他发信的能力，持续8小时。如果你在这段时间内试图送出另一条信息，你会得知你的短讯被屏蔽，并且法术失败。',
    targets: [
      '你向你所遇到过的或某人遇到过且向你描述的一个生物发送一小段二十五个词以内的信息。',
      '该生物将在心中听到你的信息，它可以认出你是发讯人（如果他认识你），还可以用同样的方式立即回复一条讯息。',
      '法术会让目标能够理解你短讯的信息。',
      '你的传讯可以跨越任意长的距离，甚至能跨越位面。',
      '但如果目标和你不在同一个存在位面，则短讯术有5%的概率无法到达。',
      '在收到你的信息后，一个生物能够屏蔽你以这个法术再次对他发信的能力，持续8小时。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一段铜线）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '该生物将在心中听到你的信息，它可以认出你是发讯人（如果他认识你），还可以用同样的方式立即回复一条讯息。',
      '但如果目标和你不在同一个存在位面，则短讯术有5%的概率无法到达。',
      '如果讯息没能传达，你将得知这一结果。',
      '在收到你的信息后，一个生物能够屏蔽你以这个法术再次对他发信的能力，持续8小时。',
      '如果你在这段时间内试图送出另一条信息，你会得知你的短讯被屏蔽，并且法术失败。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '该生物将在心中听到你的信息，它可以认出你是发讯人（如果他认识你），还可以用同样的方式立即回复一条讯息。',
    ],
    contentWarnings: [],
  },
  shatter: {
    categories: ['pure-damage'],
    catalogueText:
      'A loud noise erupts from a point of your choice within range. Each creature in a 10-foot-radius Sphere centered there makes a Constitution saving throw, taking 3d8 Thunder damage on a failed save or half as much damage on a successful one. A Construct has Disadvantage on the save. A nonmagical object that isn’t being worn or car- ried also takes the damage if it’s in the spell’s area. Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 2.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Shatter',
      title: '粉碎音波｜Shatter',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 塑能（吟游诗人、术士、法师）',
      '施法时间：动作',
      '施法距离：60 尺',
      '法术成分：V、S、M（一片云母）',
      '持续时间：立即',
    ],
    sourceText:
      '一阵震耳欲聋的噪音在你指定的施法距离内一点上爆发出来。以该点为中心半径10尺球状区域内的所有生物必须要进行一次体质豁免。豁免失败将受到3d8点雷鸣伤害；豁免成功受到半数伤害。构装生物进行该豁免时具有劣势。如果法术的范围内存在不被任何生物着装携带的非魔法物件，则它也要受到该伤害。 升环施法。使用的法术位每比二环高一环，此法术的伤害就增加1d8。',
    targets: [
      '一阵震耳欲聋的噪音在你指定的施法距离内一点上爆发出来。',
      '以该点为中心半径10尺球状区域内的所有生物必须要进行一次体质豁免。',
      '豁免失败将受到3d8点雷鸣伤害；豁免成功受到半数伤害。',
      '构装生物进行该豁免时具有劣势。',
      '如果法术的范围内存在不被任何生物着装携带的非魔法物件，则它也要受到该伤害。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一片云母）'],
    savingThrows: [
      '以该点为中心半径10尺球状区域内的所有生物必须要进行一次体质豁免。',
      '豁免失败将受到3d8点雷鸣伤害；豁免成功受到半数伤害。',
      '构装生物进行该豁免时具有劣势。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['如果法术的范围内存在不被任何生物着装携带的非魔法物件，则它也要受到该伤害。'],
    upcasting: ['升环施法。', '使用的法术位每比二环高一环，此法术的伤害就增加1d8。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'shining-smite': {
    categories: ['non-damage', 'condition'],
    catalogueText:
      'The target hit by the strike takes an extra 2d6 Radiant damage from the attack. Until the spell ends, the target sheds Bright Light in a 5-foot radius, attack rolls against it have Advantage, and it can’t benefit from the Invisible condition. Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 2.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Shining_Smite',
      title: '闪耀斩｜Shining Smite',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 变化（圣武士）',
      '施法时间：附赠动作，当你使用近战武器或徒手打击命中一个生物后立即执行',
      '施法距离：自身',
      '法术成分：V',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '被该次攻击检定命中的目标会在此次攻击中额外受到2d6点光耀伤害。目标会发出半径5尺的明亮光照直至法术结束。在此期间，对其进行的攻击检定具有优势，且其无法受益于隐形状态。 升环施法。 使用的法术位每比二环高一环，此法术的额外伤害就增加1d6。 （注：本法术在PHB2014中原名印记斩Branding Smite）',
    targets: [
      '被该次攻击检定命中的目标会在此次攻击中额外受到2d6点光耀伤害。',
      '目标会发出半径5尺的明亮光照直至法术结束。',
    ],
    resources: [
      '施法时间：附赠动作，当你使用近战武器或徒手打击命中一个生物后立即执行',
      '法术成分：V',
    ],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['目标会发出半径5尺的明亮光照直至法术结束。'],
    upcasting: ['升环施法。', '使用的法术位每比二环高一环，此法术的额外伤害就增加1d6。'],
    visibility: [
      '目标会发出半径5尺的明亮光照直至法术结束。',
      '在此期间，对其进行的攻击检定具有优势，且其无法受益于隐形状态。',
    ],
    contentWarnings: [],
  },
  silence: {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'For the duration, no sound can be created within or pass through a 20-foot-radius Sphere centered on a point you choose within range. Any creature or object entirely inside the Sphere has Immunity to Thunder damage, and creatures have the Deafened condition while entirely inside it. Casting a spell that includes a Verbal component is impossible there.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Silence',
      title: '沉默术｜Silence',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 幻术（吟游诗人、牧师、游侠）',
      '施法时间：动作或仪式',
      '施法距离：120 尺',
      '法术成分：V、S',
      '持续时间：专注，至多 10 分钟',
    ],
    sourceText:
      '你指定施法距离内一点，以该点为中心半径20尺的球状区域在法术持续时间内将无法产生任何声音，且外界的声音也无法于该区域内传播。任何完全位于该区域内的生物和物件都将免疫雷鸣伤害，而完全位于该区域内的任何生物都将陷入耳聋状态。此外，该区域内无法施展包含言语成分的法术。',
    targets: [
      '你指定施法距离内一点，以该点为中心半径20尺的球状区域在法术持续时间内将无法产生任何声音，且外界的声音也无法于该区域内传播。',
      '任何完全位于该区域内的生物和物件都将免疫雷鸣伤害，而完全位于该区域内的任何生物都将陷入耳聋状态。',
      '此外，该区域内无法施展包含言语成分的法术。',
    ],
    resources: ['施法时间：动作或仪式', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: [
      '任何完全位于该区域内的生物和物件都将免疫雷鸣伤害，而完全位于该区域内的任何生物都将陷入耳聋状态。',
    ],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '你指定施法距离内一点，以该点为中心半径20尺的球状区域在法术持续时间内将无法产生任何声音，且外界的声音也无法于该区域内传播。',
    ],
    contentWarnings: [],
  },
  'sleet-storm': {
    categories: ['non-damage', 'environment', 'condition'],
    catalogueText:
      'Until the spell ends, sleet falls in a 40-foot-tall, 20-foot-radius Cylinder centered on a point you choose within range. The area is Heavily Obscured, and exposed flames in the area are doused. Ground in the Cylinder is Difficult Terrain. When a creature enters the Cylinder for the first time on a turn or starts its turn there, it must succeed on a Dexterity saving throw or have the Prone condition and lose Concentration.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Sleet_Storm',
      title: '雪雨暴｜Sleet Storm',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 咒法（德鲁伊、术士、法师）',
      '施法时间：动作',
      '施法距离：150 尺',
      '法术成分：V、S、M（一把迷你雨伞）',
      '持续时间：专注，至多 1 分钟',
    ],
    sourceText:
      '你指定施法距离内一点，并使以该点为中心，高40尺、半径20尺的柱状区域内降下冷冻刺骨的冻雨和冰雹直至法术终止。该区域将造成重度遮蔽，且该区域内的一切外露的暴露在外的明火都将被浇熄。 该区域的地面变成困难地形。生物在一个回合内首次进入该区域或在区域内开始其回合时，它必须成功通过一次敏捷豁免，否则将陷入倒地状态并失去专注。',
    targets: [
      '你指定施法距离内一点，并使以该点为中心，高40尺、半径20尺的柱状区域内降下冷冻刺骨的冻雨和冰雹直至法术终止。',
      '该区域将造成重度遮蔽，且该区域内的一切外露的暴露在外的明火都将被浇熄。',
      '该区域的地面变成困难地形。',
      '生物在一个回合内首次进入该区域或在区域内开始其回合时，它必须成功通过一次敏捷豁免，否则将陷入倒地状态并失去专注。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一把迷你雨伞）'],
    savingThrows: [
      '生物在一个回合内首次进入该区域或在区域内开始其回合时，它必须成功通过一次敏捷豁免，否则将陷入倒地状态并失去专注。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '你指定施法距离内一点，并使以该点为中心，高40尺、半径20尺的柱状区域内降下冷冻刺骨的冻雨和冰雹直至法术终止。',
      '生物在一个回合内首次进入该区域或在区域内开始其回合时，它必须成功通过一次敏捷豁免，否则将陷入倒地状态并失去专注。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  slow: {
    categories: ['non-damage', 'condition'],
    catalogueText:
      'You alter time around up to six creatures of your choice in a 40-foot Cube within range. Each target must succeed on a Wisdom saving throw or be affected by this spell for the duration. An affected target’s Speed is halved, it takes a −2 penalty to AC and Dexterity saving throws, and it can’t take Reactions. On its turns, it can take either an action or a Bonus Action, not both, and it can make only one attack if it takes the Attack action. If it casts a spell with a Somatic component, there is a 25 percent chance the spell fails as a result of the target making the spell’s gestures too slowly. An affected target repeats the save at the end of each of its turns, ending the spell on itself on a success.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Slow',
      title: '缓慢术｜Slow',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 变化（吟游诗人、术士、法师）',
      '施法时间：动作',
      '施法距离：120 尺',
      '法术成分：V、S、M（一滴糖浆）',
      '持续时间：专注，至多 1 分钟',
    ],
    sourceText:
      '你在施法距离内一处 40 尺立方区域内指定至多六个生物并扭曲其周围的时间流。每个目标都要进行一次感知豁免，豁免失败则受到该法术影响直至法术终止。 被影响的生物的速度减半，而其 AC 和敏捷豁免都获得-2减值，且不能执行反应。该生物在其回合中仅可以执行一个动作或一个附赠动作，但不能同时执行二者。且当它执行攻击动作时，它只能发动一次攻击。 如果该生物尝试施展一个具有姿势成分的法术，则其法术有25%的概率会因为生物的动作太慢而施展失败。 受术生物在其每个回合结束时可以再进行一次该感知豁免，豁免成功则终止其身上的该法术效应。',
    targets: [
      '你在施法距离内一处 40 尺立方区域内指定至多六个生物并扭曲其周围的时间流。',
      '每个目标都要进行一次感知豁免，豁免失败则受到该法术影响直至法术终止。',
      '被影响的生物的速度减半，而其 AC 和敏捷豁免都获得-2减值，且不能执行反应。',
      '该生物在其回合中仅可以执行一个动作或一个附赠动作，但不能同时执行二者。',
      '如果该生物尝试施展一个具有姿势成分的法术，则其法术有25%的概率会因为生物的动作太慢而施展失败。',
      '受术生物在其每个回合结束时可以再进行一次该感知豁免，豁免成功则终止其身上的该法术效应。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一滴糖浆）'],
    savingThrows: [
      '每个目标都要进行一次感知豁免，豁免失败则受到该法术影响直至法术终止。',
      '被影响的生物的速度减半，而其 AC 和敏捷豁免都获得-2减值，且不能执行反应。',
      '受术生物在其每个回合结束时可以再进行一次该感知豁免，豁免成功则终止其身上的该法术效应。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '每个目标都要进行一次感知豁免，豁免失败则受到该法术影响直至法术终止。',
      '该生物在其回合中仅可以执行一个动作或一个附赠动作，但不能同时执行二者。',
      '且当它执行攻击动作时，它只能发动一次攻击。',
      '如果该生物尝试施展一个具有姿势成分的法术，则其法术有25%的概率会因为生物的动作太慢而施展失败。',
      '受术生物在其每个回合结束时可以再进行一次该感知豁免，豁免成功则终止其身上的该法术效应。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '每个目标都要进行一次感知豁免，豁免失败则受到该法术影响直至法术终止。',
      '受术生物在其每个回合结束时可以再进行一次该感知豁免，豁免成功则终止其身上的该法术效应。',
    ],
    contentWarnings: [],
  },
  'speak-with-dead': {
    categories: ['non-damage', 'communication'],
    catalogueText:
      'You grant the semblance of life to a corpse of your choice within range, allowing it to answer questions you pose. The corpse must have a mouth, and this spell fails if the deceased creature was Undead when it died. The spell also fails if the corpse was the target of this spell within the past 10 days. Until the spell ends, you can ask the corpse up to five questions. The corpse knows only what it knew in life, including the languages it knew. Answers are usually brief, cryptic, or repetitive, and the corpse is under no compulsion to offer a truthful answer if you are antagonistic toward it or it recognizes you as an enemy. This spell doesn’t return the creature’s soul to its body, only its animating spirit. Thus, the corpse can’t learn new information, doesn’t compre- hend anything that has happened since it died, and can’t speculate about future events.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Speak_with_Dead',
      title: '死者交谈｜Speak with Dead',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 死灵（吟游诗人、牧师、法师）',
      '施法时间：动作',
      '施法距离：10 尺',
      '法术成分：V、S、M（燃烧的香）',
      '持续时间：10 分钟',
    ],
    sourceText:
      '你给施法距离内一具你所选择的尸体施以复生的表象，让其可回答你的问题。这具尸体必须还有一张嘴，且如果该生物死亡时是亡灵生物，则施法失败。若目标尸体在最近十日内曾被作为该法术的目标，则本次施法失败。 在法术终止前，你可以向尸体提出最多五个问题。尸体的知识和它讲述的语言仅限于其生前所知。回答通常是简短，含糊或重复的语句，而且如果你对尸体抱有敌意或者尸体认为你是其敌人，它也不是一定要给你正确的答复。该法术并不能让该生物的灵魂返回其身体中，只是活化了其精神。因此，该尸体不能认知新的信息，不能理解它死后发生的任何事情，也不能对未来的事件作出猜测。',
    targets: [
      '你给施法距离内一具你所选择的尸体施以复生的表象，让其可回答你的问题。',
      '这具尸体必须还有一张嘴，且如果该生物死亡时是亡灵生物，则施法失败。',
      '若目标尸体在最近十日内曾被作为该法术的目标，则本次施法失败。',
      '该法术并不能让该生物的灵魂返回其身体中，只是活化了其精神。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（燃烧的香）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '这具尸体必须还有一张嘴，且如果该生物死亡时是亡灵生物，则施法失败。',
      '在法术终止前，你可以向尸体提出最多五个问题。',
      '回答通常是简短，含糊或重复的语句，而且如果你对尸体抱有敌意或者尸体认为你是其敌人，它也不是一定要给你正确的答复。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['该法术并不能让该生物的灵魂返回其身体中，只是活化了其精神。'],
    contentWarnings: [],
  },
  'speak-with-plants': {
    categories: ['non-damage', 'communication', 'environment'],
    catalogueText:
      'You imbue plants in an immobile 30-foot Emanation with limited sentience and animation, giving them the ability to communicate with you and follow your simple commands. You can question plants about events in the spell’s area within the past day, gaining information about creatures that have passed, weather, and other circumstances. You can also turn Difficult Terrain caused by plant growth (such as thickets and undergrowth) into ordinary terrain that lasts for the duration. Or you can turn ordinary terrain where plants are present into Difficult Terrain that lasts for the duration. The spell doesn’t enable plants to uproot them- selves and move about, but they can move their branches, tendrils, and stalks for you. If a Plant creature is in the area, you can communicate with it as if you shared a common language.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Speak_with_Plants',
      title: '植物交谈｜Speak with Plants',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 变化（吟游诗人、德鲁伊、游侠）',
      '施法时间：动作',
      '施法距离：自身（半径 30 尺）',
      '法术成分：V、S',
      '持续时间：10 分钟',
    ],
    sourceText:
      '你给周围30尺固定灵光范围内的植物赋予有限的知觉与活力，使其能够与你沟通和按你的简单命令行事。你可以向植物询问最近一日该法术区域内所发生的事，由此了解有关于曾路过这里的生物、天气和其他状况的信息。 你可以让区域内因植物生长形成的困难地形（如灌木丛）在法术持续时间内变为普通地形。你也可以在法术持续时间内将有植物生长的普通地形变成困难地形。 虽然该法术并不能让植物拔根而起或移动位置，但它们可以依你的意愿而活动自己的树枝、藤蔓和茎秆。 如果法术区域内有一个植物生物，你可以如同有共同语言一般与其交流。',
    targets: [
      '你给周围30尺固定灵光范围内的植物赋予有限的知觉与活力，使其能够与你沟通和按你的简单命令行事。',
      '你可以向植物询问最近一日该法术区域内所发生的事，由此了解有关于曾路过这里的生物、天气和其他状况的信息。',
      '你可以让区域内因植物生长形成的困难地形（如灌木丛）在法术持续时间内变为普通地形。',
      '如果法术区域内有一个植物生物，你可以如同有共同语言一般与其交流。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['如果法术区域内有一个植物生物，你可以如同有共同语言一般与其交流。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'spider-climb': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'Until the spell ends, one willing creature you touch gains the ability to move up, down, and across vertical surfaces and along ceilings, while leaving its hands free. The target also gains a Climb Speed equal to its Speed. Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 2.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Spider_Climb',
      title: '蛛行术｜Spider Climb',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 变化（术士、魔契师、法师、奇械师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S、M（一滴沥青和一只蜘蛛）',
      '持续时间：专注，至多 1 小时',
    ],
    sourceText:
      '你触碰一个自愿的生物，并使其在法术终止前能够在垂直表面上下或横向移动，其甚至可以在天花板上倒挂着移动而不需要用到双手。另外，目标获得等同于其速度的攀爬速度。 升环施法。使用的法术位每比2环高一环，你便能额外指定一个生物作为法术的目标。',
    targets: [
      '你触碰一个自愿的生物，并使其在法术终止前能够在垂直表面上下或横向移动，其甚至可以在天花板上倒挂着移动而不需要用到双手。',
      '另外，目标获得等同于其速度的攀爬速度。',
      '使用的法术位每比2环高一环，你便能额外指定一个生物作为法术的目标。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一滴沥青和一只蜘蛛）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '你触碰一个自愿的生物，并使其在法术终止前能够在垂直表面上下或横向移动，其甚至可以在天花板上倒挂着移动而不需要用到双手。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比2环高一环，你便能额外指定一个生物作为法术的目标。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'spike-growth': {
    categories: ['damage-with-rider', 'environment'],
    catalogueText:
      'The ground in a 20-foot-radius Sphere centered on a point within range sprouts hard spikes and thorns. The area becomes Difficult Terrain for the duration. When a creature moves into or within the area, it takes 2d4 Piercing damage for every 5 feet it travels. The transformation of the ground is camouflaged to look natural. Any creature that can’t see the area when the spell is cast must take a Search action and succeed on a Wisdom (Perception or Survival) check against your spell save DC to recognize the terrain as hazardous before entering it.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Spike_Growth',
      title: '荆棘丛生｜Spike Growth',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 变化（德鲁伊、游侠）',
      '施法时间：动作',
      '施法距离：150尺',
      '法术成分：V、S、M（七根棘刺）',
      '持续时间：专注，至多 10 分钟',
    ],
    sourceText:
      '以施法距离内一点为中心半径20尺的球状区域的地面扭曲变形，大片坚硬的棘刺破土而出。该区域在法术持续时间内视为困难地形。而生物进入该区域或在其中移动时，其每移动5尺就要受到2d4穿刺伤害。法术导致的地面变形经过伪装，使其看起来并无异样。如果生物在你施展此法术时看不见这片区域，则它只有在执行一次搜索动作并成功进行一次感知（察觉或求生）检定后，才能在进入之前发现该区域隐藏的危险。',
    targets: [
      '以施法距离内一点为中心半径20尺的球状区域的地面扭曲变形，大片坚硬的棘刺破土而出。',
      '该区域在法术持续时间内视为困难地形。',
      '而生物进入该区域或在其中移动时，其每移动5尺就要受到2d4穿刺伤害。',
      '如果生物在你施展此法术时看不见这片区域，则它只有在执行一次搜索动作并成功进行一次感知（察觉或求生）检定后，才能在进入之前发现该区域隐藏的危险。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（七根棘刺）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '如果生物在你施展此法术时看不见这片区域，则它只有在执行一次搜索动作并成功进行一次感知（察觉或求生）检定后，才能在进入之前发现该区域隐藏的危险。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '如果生物在你施展此法术时看不见这片区域，则它只有在执行一次搜索动作并成功进行一次感知（察觉或求生）检定后，才能在进入之前发现该区域隐藏的危险。',
    ],
    contentWarnings: [],
  },
  'spirit-guardians': {
    categories: ['damage-with-rider', 'environment'],
    catalogueText:
      'Protective spirits flit around you in a 15-foot Ema- nation for the duration. If you are good or neutral, their spectral form appears angelic or fey (your choice). If you are evil, they appear fiendish. When you cast this spell, you can designate crea- tures to be unaffected by it. Any other creature’s Speed is halved in the Emanation, and whenever the Emanation enters a creature’s space and whenever a creature enters the Emanation or ends its turn there, the creature must make a Wisdom saving throw. On a failed save, the creature takes 3d8 Ra- diant damage (if you are good or neutral) or 3d8 Necrotic damage (if you are evil). On a successful save, the creature takes half as much damage. A creature makes this save only once per turn. Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 3.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Spirit_Guardians',
      title: '灵体卫士｜Spirit Guardians',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 咒法（牧师）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、S、M（一卷祷文）',
      '持续时间：专注，至多 10 分钟',
    ],
    sourceText:
      '在法术持续时间内，保护性的灵体环绕在你的周围15尺光环区域内飞舞。如果你属于善良或中立阵营，则它们飘渺的身形看起来像是天使或妖精（由你选择）。如果你属于邪恶阵营，则它们将形如邪魔。 施展此法术时，你可以指定特定生物让其不受该法术影响。除此之外的生物在光环区域内将受法术影响致速度被减半。当光环进入一个生物的空间、一个生物进入光环或在光环内结束回合时，其必须进行一次感知豁免。豁免失败将受到3d8光耀伤害（如果你属于善良或中立）或3d8暗蚀伤害（如果你属于邪恶），豁免成功则只受到一半伤害。一名生物一回合仅需进行一次该豁免。 升环施法。 使用的法术位每比三环高一环，此法术的伤害就增加 1d8。',
    targets: [
      '在法术持续时间内，保护性的灵体环绕在你的周围15尺光环区域内飞舞。',
      '如果你属于善良或中立阵营，则它们飘渺的身形看起来像是天使或妖精（由你选择）。',
      '施展此法术时，你可以指定特定生物让其不受该法术影响。',
      '除此之外的生物在光环区域内将受法术影响致速度被减半。',
      '当光环进入一个生物的空间、一个生物进入光环或在光环内结束回合时，其必须进行一次感知豁免。',
      '一名生物一回合仅需进行一次该豁免。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一卷祷文）'],
    savingThrows: [
      '当光环进入一个生物的空间、一个生物进入光环或在光环内结束回合时，其必须进行一次感知豁免。',
      '豁免失败将受到3d8光耀伤害（如果你属于善良或中立）或3d8暗蚀伤害（如果你属于邪恶），豁免成功则只受到一半伤害。',
      '一名生物一回合仅需进行一次该豁免。',
    ],
    immunity: ['施展此法术时，你可以指定特定生物让其不受该法术影响。'],
    repeatAndEnd: [
      '如果你属于善良或中立阵营，则它们飘渺的身形看起来像是天使或妖精（由你选择）。',
      '如果你属于邪恶阵营，则它们将形如邪魔。',
      '当光环进入一个生物的空间、一个生物进入光环或在光环内结束回合时，其必须进行一次感知豁免。',
      '豁免失败将受到3d8光耀伤害（如果你属于善良或中立）或3d8暗蚀伤害（如果你属于邪恶），豁免成功则只受到一半伤害。',
      '一名生物一回合仅需进行一次该豁免。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比三环高一环，此法术的伤害就增加 1d8。'],
    visibility: [
      '当光环进入一个生物的空间、一个生物进入光环或在光环内结束回合时，其必须进行一次感知豁免。',
    ],
    contentWarnings: [],
  },
  'spiritual-weapon': {
    categories: ['damage-with-rider', 'environment'],
    catalogueText:
      'You create a floating, spectral force that resembles a weapon of your choice and lasts for the duration. The force appears within range in a space of your choice, and you can immediately make one melee spell attack against one creature within 5 feet of the force. On a hit, the target takes Force damage equal to 1d8 plus your spellcasting ability modifier. As a Bonus Action on your later turns, you can move the force up to 20 feet and repeat the attack against a creature within 5 feet of it. Using a Higher-Level Spell Slot. The damage increases by 1d8 for every slot level above 2.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Spiritual_Weapon',
      title: '灵体武器｜Spiritual Weapon',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 塑能（牧师）',
      '施法时间：附赠动作',
      '施法距离：60 尺',
      '法术成分：V、S',
      '持续时间：专注，至多1 分钟',
    ],
    sourceText:
      '你创造出一块形似你选择的武器的浮空灵体力场，并使其持续到法术持续时间结束。它出现在施法距离内你选择的一点，并且你可以立即对该武器周围5尺内的一个生物发动一次近战法术攻击。若命中，则目标受到 1d8+你的施法属性调整值 点力场伤害。在你之后的回合内，你可以用附赠动作让该武器移动至多20尺，并再对它周围5尺内的一个生物发动一次同样的攻击。 升环施法。 使用的法术位每比二环高一环，此法术的伤害就增加1d8。',
    targets: [
      '你创造出一块形似你选择的武器的浮空灵体力场，并使其持续到法术持续时间结束。',
      '它出现在施法距离内你选择的一点，并且你可以立即对该武器周围5尺内的一个生物发动一次近战法术攻击。',
      '若命中，则目标受到 1d8+你的施法属性调整值 点力场伤害。',
      '在你之后的回合内，你可以用附赠动作让该武器移动至多20尺，并再对它周围5尺内的一个生物发动一次同样的攻击。',
    ],
    resources: ['施法时间：附赠动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '你创造出一块形似你选择的武器的浮空灵体力场，并使其持续到法术持续时间结束。',
      '在你之后的回合内，你可以用附赠动作让该武器移动至多20尺，并再对它周围5尺内的一个生物发动一次同样的攻击。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比二环高一环，此法术的伤害就增加1d8。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'stinking-cloud': {
    categories: ['non-damage', 'environment', 'condition'],
    catalogueText:
      'You create a 20-foot-radius Sphere of yellow, nau- seating gas centered on a point within range. The cloud is Heavily Obscured. The cloud lingers in the air for the duration or until a strong wind (such as the one created by Gust of Wind ) disperses it. Each creature that starts its turn in the Sphere must succeed on a Constitution saving throw or have the Poisoned condition until the end of the current turn. While Poisoned in this way, the creature can’t take an action or a Bonus Action.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Stinking_Cloud',
      title: '臭云术｜Stinking Cloud',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 咒法（吟游诗人、术士、法师）',
      '施法时间：动作',
      '施法距离：90 尺',
      '法术成分：V、S、M（一个臭鸡蛋）',
      '持续时间：专注，至多 1 分钟',
    ],
    sourceText:
      '你以施法距离内一点为中心创造出一团半径 20 尺的黄色恶心气体云团球状区域。云团内形成重度遮蔽。云团会一直留在空中，直至法术持续时间结束或一阵强风（比如造风术Gust of Wind创造的强风）将其吹散为止。 如果一个生物在其回合开始时位于云团内，则它必须成功通过一次体质豁免。否则将陷入中毒状态直到其当前回合结束。因此而陷入中毒状态期间，该生物无法执行动作或附赠动作。',
    targets: [
      '你以施法距离内一点为中心创造出一团半径 20 尺的黄色恶心气体云团球状区域。',
      '如果一个生物在其回合开始时位于云团内，则它必须成功通过一次体质豁免。',
      '因此而陷入中毒状态期间，该生物无法执行动作或附赠动作。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一个臭鸡蛋）'],
    savingThrows: ['如果一个生物在其回合开始时位于云团内，则它必须成功通过一次体质豁免。'],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '云团会一直留在空中，直至法术持续时间结束或一阵强风（比如造风术Gust of Wind创造的强风）将其吹散为止。',
      '如果一个生物在其回合开始时位于云团内，则它必须成功通过一次体质豁免。',
      '否则将陷入中毒状态直到其当前回合结束。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  suggestion: {
    categories: ['non-damage', 'condition'],
    catalogueText:
      'You suggest a course of activity—described in no more than 25 words—to one creature you can see within range that can hear and understand you. The suggestion must sound achievable and not involve anything that would obviously deal damage to the target or its allies. For example, you could say, “Fetch the key to the cult’s treasure vault, and give the key to me.” Or you could say, “Stop fighting, leave this library peacefully, and don’t return.” The target must succeed on a Wisdom saving throw or have the Charmed condition for the duration or until you or your allies deal damage to the target. The Charmed target pursues the suggestion to the best of its ability. The suggested activity can continue for the entire duration, but if the suggested activity can be completed in a shorter time, the spell ends for the target upon completing it.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Suggestion',
      title: '暗示术｜Suggestion',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 惑控（吟游诗人、术士、魔契师、法师）',
      '施法时间：动作',
      '施法距离：30 尺',
      '法术成分：V、M（一滴蜂蜜）',
      '持续时间：专注，至多 8 小时',
    ],
    sourceText:
      '你以魔法影响施法距离内一个你能看见的生物，并对其施以某种行动暗示（不超过25个词）。由你指定的受术目标必须能听到并理解你的话语。暗示必须听起来可行，也不涉及明显会对目标及其盟友造成伤害的内容。比如说，你可以说“把邪教的宝库钥匙找来，然后给我。”或者：“别打了，让图书馆保持安静，然后出去别回来。” 目标必须成功通过一次感知豁免，否则在法术持续时间内陷入魅惑，若你或你的盟友对其造成伤害此法术将提前结束。被魅惑的生物会尽其所能地执行你所描述的行为。你所暗示的行为可能会在法术持续时间内始终一直进行，而如果你所暗示的活动可以用更短的时间完成，则此法术会在目标完成了你的要求后随即终止。',
    targets: [
      '你以魔法影响施法距离内一个你能看见的生物，并对其施以某种行动暗示（不超过25个词）。',
      '由你指定的受术目标必须能听到并理解你的话语。',
      '暗示必须听起来可行，也不涉及明显会对目标及其盟友造成伤害的内容。',
      '” 目标必须成功通过一次感知豁免，否则在法术持续时间内陷入魅惑，若你或你的盟友对其造成伤害此法术将提前结束。',
      '被魅惑的生物会尽其所能地执行你所描述的行为。',
      '你所暗示的行为可能会在法术持续时间内始终一直进行，而如果你所暗示的活动可以用更短的时间完成，则此法术会在目标完成了你的要求后随即终止。',
    ],
    resources: ['施法时间：动作', '法术成分：V、M（一滴蜂蜜）'],
    savingThrows: [
      '” 目标必须成功通过一次感知豁免，否则在法术持续时间内陷入魅惑，若你或你的盟友对其造成伤害此法术将提前结束。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '” 目标必须成功通过一次感知豁免，否则在法术持续时间内陷入魅惑，若你或你的盟友对其造成伤害此法术将提前结束。',
      '你所暗示的行为可能会在法术持续时间内始终一直进行，而如果你所暗示的活动可以用更短的时间完成，则此法术会在目标完成了你的要求后随即终止。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '你以魔法影响施法距离内一个你能看见的生物，并对其施以某种行动暗示（不超过25个词）。',
      '由你指定的受术目标必须能听到并理解你的话语。',
      '” 目标必须成功通过一次感知豁免，否则在法术持续时间内陷入魅惑，若你或你的盟友对其造成伤害此法术将提前结束。',
    ],
    contentWarnings: [],
  },
  'tiny-hut': {
    categories: ['non-damage', 'environment'],
    catalogueText:
      'A 10-foot Emanation springs into existence around you and remains stationary for the duration. The spell fails when you cast it if the Emanation isn’t big enough to fully encapsulate all creatures in its area. Creatures and objects within the Emanation when you cast the spell can move through it freely. All other creatures and objects are barred from passing through it. Spells of level 3 or lower can’t be cast through it, and the effects of such spells can’t extend into it. The atmosphere inside the Emanation is comfort- able and dry, regardless of the weather outside. Until the spell ends, you can command the interior to have Dim Light or Darkness (no action required). The Em- anation is opaque from the outside and of any color you choose, but it’s transparent from the inside. The spell ends early if you leave the Emanation or if you cast it again.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: "Leomund's_Tiny_Hut",
      title: "李欧蒙小屋｜Leomund's Tiny Hut",
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 塑能（吟游诗人、法师）',
      '施法时间：1分钟或仪式',
      '施法距离：自身',
      '法术成分：V、S、M（一个小水晶珠子）',
      '持续时间：8 小时',
    ],
    sourceText:
      '你释放出半径10尺的光环，光环会在法术持续时间内保持存在并固定在原地。施展此法术时，若光环的大小不足以完全覆盖其区域内的所有生物，法术的施展会失败。 在施展此法术时即处于光环内的生物和物件可以自由进出光环。而所有其他生物和物件都将被阻挡而无法进出。三环或更低级别的法术既无法直接穿过光环施展，也无法使法术效果延伸至穿过光环。 光环内的空气干爽舒适，而无论外侧气候如何。你可以在法术终止前使光环内的光照变为微光光照或黑暗（无需任何动作）。光环从外侧看是不透明的，并且呈现出由你选定的颜色，但从内侧看它则是透明的。 当你离开该区域，或试图再次施展该法术时，法术将提前终止。',
    targets: [
      '施展此法术时，若光环的大小不足以完全覆盖其区域内的所有生物，法术的施展会失败。',
      '在施展此法术时即处于光环内的生物和物件可以自由进出光环。',
      '而所有其他生物和物件都将被阻挡而无法进出。',
      '当你离开该区域，或试图再次施展该法术时，法术将提前终止。',
    ],
    resources: ['施法时间：1分钟或仪式', '法术成分：V、S、M（一个小水晶珠子）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '你可以在法术终止前使光环内的光照变为微光光照或黑暗（无需任何动作）。',
      '当你离开该区域，或试图再次施展该法术时，法术将提前终止。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['你可以在法术终止前使光环内的光照变为微光光照或黑暗（无需任何动作）。'],
    contentWarnings: [],
  },
  tongues: {
    categories: ['non-damage', 'communication'],
    catalogueText:
      'This spell grants the creature you touch the ability to understand any spoken or signed language that it hears or sees. Moreover, when the target communicates by speaking or signing, any creature that knows at least one language can understand it if that creature can hear the speech or see the signing.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Tongues',
      title: '巧言术｜Tongues',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 预言（吟游诗人、牧师、术士、魔契师、法师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、M（一座微缩庙塔）',
      '持续时间：1小时',
    ],
    sourceText:
      '此法术赋予你触碰的一名生物理解任何其能看见或听见的口语或手语的能力。此外，当目标生物以口语或手语进行交流时，任何能听见其话语或看见其手语，且知道至少一门语言的生物都能理解它。',
    targets: [
      '此法术赋予你触碰的一名生物理解任何其能看见或听见的口语或手语的能力。',
      '此外，当目标生物以口语或手语进行交流时，任何能听见其话语或看见其手语，且知道至少一门语言的生物都能理解它。',
    ],
    resources: ['施法时间：动作', '法术成分：V、M（一座微缩庙塔）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '此外，当目标生物以口语或手语进行交流时，任何能听见其话语或看见其手语，且知道至少一门语言的生物都能理解它。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '此法术赋予你触碰的一名生物理解任何其能看见或听见的口语或手语的能力。',
      '此外，当目标生物以口语或手语进行交流时，任何能听见其话语或看见其手语，且知道至少一门语言的生物都能理解它。',
    ],
    contentWarnings: [],
  },
  'vampiric-touch': {
    categories: ['damage-with-rider', 'healing'],
    catalogueText:
      'The touch of your shadow-wreathed hand can siphon life force from others to heal your wounds. Make a melee spell attack against one creature within reach. On a hit, the target takes 3d6 Necrotic damage, and you regain Hit Points equal to half the amount of Necrotic damage dealt. Until the spell ends, you can make the attack again on each of your turns as a Magic action, targeting the same creature or a different one. Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 3.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Vampiric_Touch',
      title: '汲血之触｜Vampiric Touch',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 死灵（术士、魔契师、法师）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、S',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '你的阴影环绕着的手可以吸取他人的生命力来为自己疗伤。对你触及范围内的一名生物进行一次近战法术攻击。若命中，则目标受到3d6点暗蚀伤害，而你则恢复数值等同于所造成暗蚀伤害一半的生命值。 该法术终止前，你可以在你的每个回合内用魔法动作对相同或不同的生物进行一次这样的攻击。 升环施法。使用的法术位每比三环高一环，此法术的伤害就提高1d6。',
    targets: [
      '对你触及范围内的一名生物进行一次近战法术攻击。',
      '若命中，则目标受到3d6点暗蚀伤害，而你则恢复数值等同于所造成暗蚀伤害一半的生命值。',
      '该法术终止前，你可以在你的每个回合内用魔法动作对相同或不同的生物进行一次这样的攻击。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '该法术终止前，你可以在你的每个回合内用魔法动作对相同或不同的生物进行一次这样的攻击。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比三环高一环，此法术的伤害就提高1d6。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'warding-bond': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'You touch another creature that is willing and create a mystic connection between you and the target until the spell ends. While the target is within 60 feet of you, it gains a +1 bonus to AC and saving throws, and it has Resistance to all damage. Also, each time it takes damage, you take the same amount of damage. The spell ends if you drop to 0 Hit Points or if you and the target become separated by more than 60 feet. It also ends if the spell is cast again on either of the connected creatures.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Warding_Bond',
      title: '守护之链｜Warding Bond',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 防护（牧师、圣武士）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S、M（一对铂金戒指（每个价值50GP+），你和目标在法术持续时间内需保持佩戴它们）',
      '持续时间：1小时',
    ],
    sourceText:
      '你触碰另一个自愿的生物，在法术终止前在你和目标之间建立一道神秘的连接。目标位于你身边60尺内时，其AC和豁免检定具有+1加值，且对所有伤害具有抗性。此外，每当目标受到伤害时，你也会受到同样的伤害。 如果你的生命值降至0，或你与目标距离超过60尺，则该法术终止。如果再有守护之链被施展于两个已被连接生物中的任意一方时，原有的法术将立刻终止。',
    targets: [
      '你触碰另一个自愿的生物，在法术终止前在你和目标之间建立一道神秘的连接。',
      '目标位于你身边60尺内时，其AC和豁免检定具有+1加值，且对所有伤害具有抗性。',
      '此外，每当目标受到伤害时，你也会受到同样的伤害。',
      '如果你的生命值降至0，或你与目标距离超过60尺，则该法术终止。',
      '如果再有守护之链被施展于两个已被连接生物中的任意一方时，原有的法术将立刻终止。',
    ],
    resources: [
      '施法时间：动作',
      '法术成分：V、S、M（一对铂金戒指（每个价值50GP+），你和目标在法术持续时间内需保持佩戴它们）',
    ],
    savingThrows: ['目标位于你身边60尺内时，其AC和豁免检定具有+1加值，且对所有伤害具有抗性。'],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '你触碰另一个自愿的生物，在法术终止前在你和目标之间建立一道神秘的连接。',
      '此外，每当目标受到伤害时，你也会受到同样的伤害。',
      '如果你的生命值降至0，或你与目标距离超过60尺，则该法术终止。',
      '如果再有守护之链被施展于两个已被连接生物中的任意一方时，原有的法术将立刻终止。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'water-breathing': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'This spell grants up to ten willing creatures of your choice within range the ability to breathe underwater until the spell ends. Affected creatures also retain their normal mode of respiration.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Water_Breathing',
      title: '水下呼吸｜Water Breathing',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 变化（德鲁伊、游侠、术士、法师、奇械师）',
      '施法时间：动作或仪式',
      '施法距离：30尺',
      '法术成分：V、S、M（一根短芦苇）',
      '持续时间：24小时',
    ],
    sourceText:
      '在法术终止前，该法术让施法距离内你所选择的至多十个自愿生物获得在水下呼吸的能力。此外，受术者依然保有正常的呼吸能力。',
    targets: ['在法术终止前，该法术让施法距离内你所选择的至多十个自愿生物获得在水下呼吸的能力。'],
    resources: ['施法时间：动作或仪式', '法术成分：V、S、M（一根短芦苇）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '在法术终止前，该法术让施法距离内你所选择的至多十个自愿生物获得在水下呼吸的能力。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'water-walk': {
    categories: ['non-damage', 'support'],
    catalogueText:
      'This spell grants the ability to move across any liquid surface—such as water, acid, mud, snow, quicksand, or lava—as if it were harmless solid ground (crea- tures crossing molten lava can still take damage from the heat). Up to ten willing creatures of your choice within range gain this ability for the duration. An affected target must take a Bonus Action to pass from the liquid’s surface into the liquid itself and vice versa, but if the target falls into the liquid, the target passes through the surface into the liquid below.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Water_Walk',
      title: '水上行走｜Water Walk',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 变化（牧师、德鲁伊、游侠、术士、奇械师）',
      '施法时间：动作或仪式',
      '施法距离：30尺',
      '法术成分：V、S、M（一个软木塞）',
      '持续时间：1小时',
    ],
    sourceText:
      '此法术赋予你选择的位于施法距离内的至多十名生物在持续时间内将任何液体表面（比如水、酸、泥、雪、流沙、岩浆等）视作无害的固体地面穿越的能力（穿越熔岩的生物仍然会因炽热受到伤害）。 一名受影响的目标必须用一个附赠动作才能穿过液体表面进入其内部，反之亦然。然而若目标将因坠落而进入液体中，则其会直接穿过液体表面，如常进入其内部。',
    targets: [
      '此法术赋予你选择的位于施法距离内的至多十名生物在持续时间内将任何液体表面（比如水、酸、泥、雪、流沙、岩浆等）视作无害的固体地面穿越的能力（穿越熔岩的生物仍然会因炽热受到伤害）。',
      '一名受影响的目标必须用一个附赠动作才能穿过液体表面进入其内部，反之亦然。',
      '然而若目标将因坠落而进入液体中，则其会直接穿过液体表面，如常进入其内部。',
    ],
    resources: ['施法时间：动作或仪式', '法术成分：V、S、M（一个软木塞）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  web: {
    categories: ['damage-with-rider', 'environment', 'condition'],
    catalogueText:
      'You conjure a mass of sticky webbing at a point within range. The webs fill a 20-foot Cube there for the duration. The webs are Difficult Terrain, and the area within them is Lightly Obscured. If the webs aren’t anchored between two solid masses (such as walls or trees) or layered across a floor, wall, or ceiling, the web collapses on itself, and the spell ends at the start of your next turn. Webs layered over a flat surface have a depth of 5 feet. The first time a creature enters the webs on a turn or starts its turn there, it must succeed on a Dexterity saving throw or have the Restrained condition while in the webs or until it breaks free. A creature Restrained by the webs can take an action to make a Strength (Athletics) check against your spell save DC. If it succeeds, it is no longer Restrained. The webs are flammable. Any 5-foot Cube of webs exposed to fire burns away in 1 round, dealing 2d4 Fire damage to any creature that starts its turn in the fire.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Web',
      title: '蛛网术｜Web',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 咒法（术士、法师、奇械师）',
      '施法时间：动作',
      '施法距离：60尺',
      '法术成分：V、S、M（少量蜘蛛网）',
      '持续时间：专注，至多1小时',
    ],
    sourceText:
      '你在施法距离内指定一点召唤出一大片黏黏的网状物。蛛网覆盖以该点为源点的 20 尺立方区域，并在法术持续时间内维持存在。蛛网范围内视为困难地形，并造成轻度遮蔽 。 如果蛛网没有被固定在两个固体中间（例如墙和树）或跨在一片地板、墙壁、天花板中间，则蛛网会自动坍塌，而导致法术在你的下一回合开始时终止。摊在平面上的蛛网深度为 5 尺。 在一个回合中首次进入蛛网，或任何在蛛网中开始其回合的生物必须进行一次敏捷豁免，否则陷入束缚状态，直至其离开蛛网或挣脱束缚。 一名因蛛网陷入束缚状态的生物可以用一个动作进行一次对抗你的法术豁免DC的力量（运动）检定。如果成功，则其不再被束缚。 蛛网是可燃的。任何5尺立方区域的蛛网在遇到火焰后会在一轮内燃烧殆尽，并对火焰中开始其回合的生物造成2d4点火焰伤害。',
    targets: [
      '你在施法距离内指定一点召唤出一大片黏黏的网状物。',
      '蛛网覆盖以该点为源点的 20 尺立方区域，并在法术持续时间内维持存在。',
      '蛛网范围内视为困难地形，并造成轻度遮蔽 。',
      '在一个回合中首次进入蛛网，或任何在蛛网中开始其回合的生物必须进行一次敏捷豁免，否则陷入束缚状态，直至其离开蛛网或挣脱束缚。',
      '一名因蛛网陷入束缚状态的生物可以用一个动作进行一次对抗你的法术豁免DC的力量（运动）检定。',
      '任何5尺立方区域的蛛网在遇到火焰后会在一轮内燃烧殆尽，并对火焰中开始其回合的生物造成2d4点火焰伤害。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（少量蜘蛛网）'],
    savingThrows: [
      '在一个回合中首次进入蛛网，或任何在蛛网中开始其回合的生物必须进行一次敏捷豁免，否则陷入束缚状态，直至其离开蛛网或挣脱束缚。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '如果蛛网没有被固定在两个固体中间（例如墙和树）或跨在一片地板、墙壁、天花板中间，则蛛网会自动坍塌，而导致法术在你的下一回合开始时终止。',
      '在一个回合中首次进入蛛网，或任何在蛛网中开始其回合的生物必须进行一次敏捷豁免，否则陷入束缚状态，直至其离开蛛网或挣脱束缚。',
      '如果成功，则其不再被束缚。',
      '任何5尺立方区域的蛛网在遇到火焰后会在一轮内燃烧殆尽，并对火焰中开始其回合的生物造成2d4点火焰伤害。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'wind-wall': {
    categories: ['damage-with-rider', 'environment'],
    catalogueText:
      'A wall of strong wind rises from the ground at a point you choose within range. You can make the wall up to 50 feet long, 15 feet high, and 1 foot thick. You can shape the wall in any way you choose so long as it makes one continuous path along the ground. The wall lasts for the duration. When the wall appears, each creature in its area makes a Strength saving throw, taking 4d8 Bludgeoning damage on a failed save or half as much damage on a successful one. The strong wind keeps fog, smoke, and other gases at bay. Small or smaller flying creatures or objects can’t pass through the wall. Loose, lightweight materials brought into the wall fly upward. Arrows, bolts, and other ordinary projectiles launched at targets behind the wall are deflected upward and miss automatically. Boulders hurled by Giants or siege engines, and similar projectiles, are unaffected. Creatures in gaseous form can’t pass through it.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Wind_Wall',
      title: '风墙术｜Wind Wall',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 塑能（德鲁伊、游侠）',
      '施法时间：动作',
      '施法距离：120尺',
      '法术成分：V、S、M（一把扇子和一根羽毛）',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '你指定施法距离内地面上一点并从中升起了一道强风形成的墙壁。你可以造出长度至多 50 尺、高度至多15尺、厚度至多1尺的风墙。你可以自由塑造该墙的形状，不过它必须沿着地面形成一条连续的轨道。风墙持续存在至法术终止。 风墙出现时，所有位于风墙所占据区域内的生物必须进行一次力量豁免。豁免失败，受到4d8点钝击伤害。豁免成功，则只受一半伤害。 强风可以阻隔浓雾、烟尘和其他气体。体型为小型或更小的飞行生物或物件无法穿过风墙。重量轻的物质带进风墙中时将被向上吹飞。对墙后目标射出的箭、矢和其他普通飞行物会被朝上吹走而直接判为打失。巨人或攻城器械投出的巨石和类似的飞行物不受影响。处于气化形态的生物无法穿过风墙。',
    targets: [
      '你指定施法距离内地面上一点并从中升起了一道强风形成的墙壁。',
      '风墙出现时，所有位于风墙所占据区域内的生物必须进行一次力量豁免。',
      '豁免失败，受到4d8点钝击伤害。',
      '体型为小型或更小的飞行生物或物件无法穿过风墙。',
      '对墙后目标射出的箭、矢和其他普通飞行物会被朝上吹走而直接判为打失。',
      '处于气化形态的生物无法穿过风墙。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一把扇子和一根羽毛）'],
    savingThrows: [
      '风墙出现时，所有位于风墙所占据区域内的生物必须进行一次力量豁免。',
      '豁免失败，受到4d8点钝击伤害。',
      '豁免成功，则只受一半伤害。',
    ],
    immunity: ['巨人或攻城器械投出的巨石和类似的飞行物不受影响。'],
    repeatAndEnd: ['风墙持续存在至法术终止。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'zone-of-truth': {
    categories: ['non-damage'],
    catalogueText:
      'You create a magical zone that guards against deception in a 15-foot-radius Sphere centered on a point within range. Until the spell ends, a creature that enters the spell’s area for the first time on a turn or starts its turn there makes a Charisma saving throw. On a failed save, a creature can’t speak a deliberate lie while in the radius. You know whether a creature succeeds or fails on this save. An affected creature is aware of the spell and can avoid answering questions to which it would normally respond with a lie. Such a creature can be evasive yet must be truthful.',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Zone_of_Truth',
      title: '诚实之域｜Zone of Truth',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 惑控（吟游诗人、牧师、圣武士）',
      '施法时间：动作',
      '施法距离：60尺',
      '法术成分：V、S',
      '持续时间：10分钟',
    ],
    sourceText:
      '你创造一个抵御谎言的魔法区域，该区域以施法距离内一点为中心，覆盖以该点为中心15尺半径的球状区域。在法术终止前，生物在一回合中首次进入该区域，或在该区域内开始其回合时，必须进行一次魅力豁免。豁免失败者在该区域内不能故意说谎。而你可以知晓每个生物进行的此豁免成功与否。 受影响的生物可以意识到该效果的存在，因此它可以主动回避回答那些通常会以谎言答复的问题。该生物在回答问题时可以闪烁其词、避重就轻，但说的仍然需要是真话。',
    targets: [
      '你创造一个抵御谎言的魔法区域，该区域以施法距离内一点为中心，覆盖以该点为中心15尺半径的球状区域。',
      '在法术终止前，生物在一回合中首次进入该区域，或在该区域内开始其回合时，必须进行一次魅力豁免。',
      '豁免失败者在该区域内不能故意说谎。',
      '而你可以知晓每个生物进行的此豁免成功与否。',
      '受影响的生物可以意识到该效果的存在，因此它可以主动回避回答那些通常会以谎言答复的问题。',
      '该生物在回答问题时可以闪烁其词、避重就轻，但说的仍然需要是真话。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '在法术终止前，生物在一回合中首次进入该区域，或在该区域内开始其回合时，必须进行一次魅力豁免。',
      '豁免失败者在该区域内不能故意说谎。',
      '而你可以知晓每个生物进行的此豁免成功与否。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '在法术终止前，生物在一回合中首次进入该区域，或在该区域内开始其回合时，必须进行一次魅力豁免。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '而你可以知晓每个生物进行的此豁免成功与否。',
      '受影响的生物可以意识到该效果的存在，因此它可以主动回避回答那些通常会以谎言答复的问题。',
    ],
    contentWarnings: [],
  },
  'blade-ward': {
    categories: ['non-damage', 'support'],
    catalogueText:
      '专注期间，针对施法者的每次攻击检定减去 1d4。持续最多一分钟；每次攻击分别掷减值，不给予伤害抗性。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Blade_Ward',
      title: '剑刃防护｜Blade Ward',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '防护 戏法（吟游诗人、术士、魔契师、法师）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、S',
      '持续时间：专注，至多1分钟',
    ],
    sourceText: '在此法术结束前，每当有生物对你发动攻击检定，该生物的该次攻击检定都将承受1d4减值。',
    targets: ['在此法术结束前，每当有生物对你发动攻击检定，该生物的该次攻击检定都将承受1d4减值。'],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '在此法术结束前，每当有生物对你发动攻击检定，该生物的该次攻击检定都将承受1d4减值。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  friends: {
    categories: ['non-damage', 'condition'],
    catalogueText:
      '10 尺内可见目标作感知豁免，失败受你魅惑，最多专注一分钟。非类人、正在与你战斗、过去 24 小时已被你施放此法术的目标自动成功。目标受伤，或你攻击、造成伤害、迫使豁免时提前结束；结束后目标知晓魅惑。目标资格、社交影响和结束触发由 GM 核对。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Friends',
      title: '交友术｜Friends',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '惑控 戏法（吟游诗人、术士、魔契师、法师）',
      '施法时间：动作',
      '施法距离：10尺',
      '法术成分：S、M（一些化妆品）',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '你魔法性地向施法距离内的一名可见生物散发出友谊感。目标必须成功于一次感知豁免，否则其在法术持续时间内陷入魅惑状态。若目标并非类人生物，或者你正在与其战斗，又或者你在过去24小时内曾对其施展过这道法术，则其进行的此次豁免自动成功。 若目标受到伤害，或你进行一次攻击检定、造成伤害、迫使任何人进行一次豁免，则法术会提早结束。法术结束时，目标会知道他曾被你魅惑。',
    targets: [
      '你魔法性地向施法距离内的一名可见生物散发出友谊感。',
      '目标必须成功于一次感知豁免，否则其在法术持续时间内陷入魅惑状态。',
      '若目标并非类人生物，或者你正在与其战斗，又或者你在过去24小时内曾对其施展过这道法术，则其进行的此次豁免自动成功。',
      '若目标受到伤害，或你进行一次攻击检定、造成伤害、迫使任何人进行一次豁免，则法术会提早结束。',
      '法术结束时，目标会知道他曾被你魅惑。',
    ],
    resources: ['施法时间：动作', '法术成分：S、M（一些化妆品）'],
    savingThrows: [
      '目标必须成功于一次感知豁免，否则其在法术持续时间内陷入魅惑状态。',
      '若目标并非类人生物，或者你正在与其战斗，又或者你在过去24小时内曾对其施展过这道法术，则其进行的此次豁免自动成功。',
      '若目标受到伤害，或你进行一次攻击检定、造成伤害、迫使任何人进行一次豁免，则法术会提早结束。',
    ],
    immunity: [
      '若目标并非类人生物，或者你正在与其战斗，又或者你在过去24小时内曾对其施展过这道法术，则其进行的此次豁免自动成功。',
    ],
    repeatAndEnd: [
      '若目标受到伤害，或你进行一次攻击检定、造成伤害、迫使任何人进行一次豁免，则法术会提早结束。',
      '法术结束时，目标会知道他曾被你魅惑。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '你魔法性地向施法距离内的一名可见生物散发出友谊感。',
      '目标必须成功于一次感知豁免，否则其在法术持续时间内陷入魅惑状态。',
      '法术结束时，目标会知道他曾被你魅惑。',
    ],
    contentWarnings: [],
  },
  'mind-sliver': {
    categories: ['damage-with-rider'],
    catalogueText:
      '60 尺内可见生物作智力豁免，失败受 1d6 心灵伤害，并在你下回合结束前的下一次豁免减去 1d4。五级伤害变为 2d6；减值只用一次。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Mind_Sliver',
      title: '心灵之楔｜Mind Sliver',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '惑控 戏法（术士、魔契师、法师）',
      '施法时间：动作',
      '施法距离：60尺',
      '法术成分：V',
      '持续时间：1轮',
    ],
    sourceText:
      '指定施法距离内一个你可见的生物，你试图暂时刺入目标的心灵。目标必须通过一次智力豁免 。豁免失败将受到1d6点心灵伤害，并且其在你的下回合结束前，进行的下一次豁免检定将获得1d4减值。 戏法强化。 到达特定等级后，此戏法的伤害将增加1d6：5级（2d6）、11级（3d6）、17级（4d6）。',
    targets: [
      '指定施法距离内一个你可见的生物，你试图暂时刺入目标的心灵。',
      '目标必须通过一次智力豁免 。',
      '豁免失败将受到1d6点心灵伤害，并且其在你的下回合结束前，进行的下一次豁免检定将获得1d4减值。',
    ],
    resources: ['施法时间：动作', '法术成分：V'],
    savingThrows: [
      '目标必须通过一次智力豁免 。',
      '豁免失败将受到1d6点心灵伤害，并且其在你的下回合结束前，进行的下一次豁免检定将获得1d4减值。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '豁免失败将受到1d6点心灵伤害，并且其在你的下回合结束前，进行的下一次豁免检定将获得1d4减值。',
    ],
    upcasting: [
      '戏法强化。',
      '到达特定等级后，此戏法的伤害将增加1d6：5级（2d6）、11级（3d6）、17级（4d6）。',
    ],
    visibility: [
      '指定施法距离内一个你可见的生物，你试图暂时刺入目标的心灵。',
      '豁免失败将受到1d6点心灵伤害，并且其在你的下回合结束前，进行的下一次豁免检定将获得1d4减值。',
    ],
    contentWarnings: [],
  },
  'thorn-whip': {
    categories: ['damage-with-rider'],
    catalogueText:
      '对 30 尺内生物作近战法术攻击，命中造成 1d6 穿刺，可把大型或更小的目标向自己拉近至多 10 尺。五级伤害为 2d6；这是近战攻击，拉动位置由 GM 确认。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Thorn_Whip',
      title: '荆棘之鞭｜Thorn Whip',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '变化 戏法（德鲁伊、奇械师）',
      '施法时间：动作',
      '施法距离：30尺',
      '法术成分：V、S、M（一根带刺植物茎）',
      '持续时间：立即',
    ],
    sourceText:
      '你创造出一条藤蔓般的带刺长鞭，并猛抽向施法距离内一个你指定的生物。对目标进行一次近战法术攻击，命中时，目标将受到1d6点穿刺伤害，如果目标生物的体型不超过大型，则你还可以将其朝你所在位置拉近至多10尺。 戏法强化。到达特定等级后，此戏法的伤害将增加1d6：5级（2d6）、11级（3d6）、17级（4d6）。',
    targets: [
      '你创造出一条藤蔓般的带刺长鞭，并猛抽向施法距离内一个你指定的生物。',
      '对目标进行一次近战法术攻击，命中时，目标将受到1d6点穿刺伤害，如果目标生物的体型不超过大型，则你还可以将其朝你所在位置拉近至多10尺。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一根带刺植物茎）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '对目标进行一次近战法术攻击，命中时，目标将受到1d6点穿刺伤害，如果目标生物的体型不超过大型，则你还可以将其朝你所在位置拉近至多10尺。',
    ],
    upcasting: [
      '戏法强化。',
      '到达特定等级后，此戏法的伤害将增加1d6：5级（2d6）、11级（3d6）、17级（4d6）。',
    ],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  thunderclap: {
    categories: ['pure-damage'],
    catalogueText:
      '自身 5 尺发散区域内每名生物作体质豁免，失败受 1d6 雷鸣伤害。巨响可在 100 尺内听见；五级伤害为 2d6。GM 核对全部范围目标。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Thunderclap',
      title: '鸣雷破｜Thunderclap',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '塑能 戏法（吟游诗人、德鲁伊、术士、魔契师、法师、奇械师）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：S',
      '持续时间：立即',
    ],
    sourceText:
      '位于以你为原点5尺光环区域内的每名生物必须成功于一次体质豁免，否则受到1d6点雷鸣伤害。此法术会创造出在100尺内都能听见的巨大声响。 戏法强化。到达特定等级后，此戏法的伤害将增加1d6：5级（2d6）、11级（3d6）、17级（4d6）。',
    targets: [
      '位于以你为原点5尺光环区域内的每名生物必须成功于一次体质豁免，否则受到1d6点雷鸣伤害。',
    ],
    resources: ['施法时间：动作', '法术成分：S'],
    savingThrows: [
      '位于以你为原点5尺光环区域内的每名生物必须成功于一次体质豁免，否则受到1d6点雷鸣伤害。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: [
      '戏法强化。',
      '到达特定等级后，此戏法的伤害将增加1d6：5级（2d6）、11级（3d6）、17级（4d6）。',
    ],
    visibility: ['此法术会创造出在100尺内都能听见的巨大声响。'],
    contentWarnings: [],
  },
  'toll-the-dead': {
    categories: ['pure-damage'],
    catalogueText:
      '60 尺内可见生物作感知豁免，失败受 1d8 黯蚀；若目标已损失任何 HP，改用 1d12。五级伤害为 2d8 或 2d12；是否受伤在本次结算前核对。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Toll_the_Dead',
      title: '亡者丧钟｜Toll the Dead',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '死灵 戏法（牧师、魔契师、法师）',
      '施法时间：动作',
      '施法距离：60尺',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你对着施法距离内一名你可见的生物一指，随后目标10尺内响起一阵哀恸的钟鸣。目标必须通过一次感知豁免，否则将受到1d8点暗蚀伤害。若目标豁免失败时已损失任意数量生命值，则改为令其受到1d12点暗蚀伤害。 戏法强化。到达特定等级后，此戏法的伤害骰将增加一枚：5级（2d8或2d12）、11级（3d8或3d12）、17级（4d8或4d12）。',
    targets: [
      '你对着施法距离内一名你可见的生物一指，随后目标10尺内响起一阵哀恸的钟鸣。',
      '目标必须通过一次感知豁免，否则将受到1d8点暗蚀伤害。',
      '若目标豁免失败时已损失任意数量生命值，则改为令其受到1d12点暗蚀伤害。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '目标必须通过一次感知豁免，否则将受到1d8点暗蚀伤害。',
      '若目标豁免失败时已损失任意数量生命值，则改为令其受到1d12点暗蚀伤害。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: [
      '戏法强化。',
      '到达特定等级后，此戏法的伤害骰将增加一枚：5级（2d8或2d12）、11级（3d8或3d12）、17级（4d8或4d12）。',
    ],
    visibility: [
      '你对着施法距离内一名你可见的生物一指，随后目标10尺内响起一阵哀恸的钟鸣。',
      '目标必须通过一次感知豁免，否则将受到1d8点暗蚀伤害。',
    ],
    contentWarnings: [],
  },
  'word-of-radiance': {
    categories: ['pure-damage'],
    catalogueText:
      '选择自身 5 尺发散区域内可见的生物，各作体质豁免，失败受 1d6 光耀伤害。五级伤害为 2d6；可排除未选择的生物。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/0环.htm',
      anchor: 'Word_of_Radiance',
      title: '光耀祷词｜Word of Radiance',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '塑能 戏法（牧师）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、M（一枚艳阳标志）',
      '持续时间：立即',
    ],
    sourceText:
      '灼热的光辉喷薄而出，覆盖你周身5尺光环区域。每个区域中你可见且受你选择的生物必须通过一次体质豁免，否则受到1d6点光耀伤害。 戏法强化。到达特定等级后，此戏法的伤害将增加1d6：5级（2d6）、11级（3d6）、17级（4d6）。',
    targets: [
      '灼热的光辉喷薄而出，覆盖你周身5尺光环区域。',
      '每个区域中你可见且受你选择的生物必须通过一次体质豁免，否则受到1d6点光耀伤害。',
    ],
    resources: ['施法时间：动作', '法术成分：V、M（一枚艳阳标志）'],
    savingThrows: ['每个区域中你可见且受你选择的生物必须通过一次体质豁免，否则受到1d6点光耀伤害。'],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: [
      '戏法强化。',
      '到达特定等级后，此戏法的伤害将增加1d6：5级（2d6）、11级（3d6）、17级（4d6）。',
    ],
    visibility: ['每个区域中你可见且受你选择的生物必须通过一次体质豁免，否则受到1d6点光耀伤害。'],
    contentWarnings: [],
  },
  'armor-of-agathys': {
    categories: ['damage-with-rider', 'support'],
    catalogueText:
      '附赠动作给予自己 5 临时 HP，持续最多一小时。期间被近战攻击命中，攻击者受 5 寒冷伤害；自身没有临时 HP 时法术结束。每高一环，临时 HP 和寒冷伤害各增加 5。2024 版以是否仍有临时 HP 为条件，重新获得临时 HP 的选择不另建叠加池。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Armor_of_Agathys',
      title: '黯冰狱铠｜Armor of Agathys',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 防护（魔契师）',
      '施法时间：附赠动作',
      '施法距离：自身',
      '法术成分：V、S、M（一块蓝色玻璃碎片）',
      '持续时间：1 小时',
    ],
    sourceText:
      '防护性的魔法寒霜包裹着你。 你获得5临时生命值 。在法术结束之前，若有生物以近战攻击检定命中你，该生物将受到5寒冷伤害。此法术会在你不具有临时生命值时提前结束。 升环施法。 你使用的法术位每比一环高一环，临时生命和寒冷伤害就各提升5。',
    targets: ['在法术结束之前，若有生物以近战攻击检定命中你，该生物将受到5寒冷伤害。'],
    resources: ['施法时间：附赠动作', '法术成分：V、S、M（一块蓝色玻璃碎片）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '在法术结束之前，若有生物以近战攻击检定命中你，该生物将受到5寒冷伤害。',
      '此法术会在你不具有临时生命值时提前结束。',
    ],
    upcasting: ['升环施法。', '你使用的法术位每比一环高一环，临时生命和寒冷伤害就各提升5。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'arms-of-hadar': {
    categories: ['damage-with-rider'],
    catalogueText:
      '自身 10 尺发散区域内每名生物作力量豁免，失败受 2d6 黯蚀且至其下一回合前不能执行反应；成功只受半伤。每高一环伤害增加 1d6。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Arms_of_Hadar',
      title: '哈达之臂｜Arms of Hadar',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 咒法（魔契师）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你祈唤哈达的力量，让触须从你身上蔓延而出。源自你的10尺光环 区域内，每个生物都必须进行一次力量豁免。豁免失败的生物将受到2d6点暗蚀伤害，并其直到下一回合前都无法执行反应。豁免成功的生物仅受到一半伤害。 升环施法。 你使用的法术位每比一环高一环，法术的伤害就增加1d6点。',
    targets: [
      '源自你的10尺光环 区域内，每个生物都必须进行一次力量豁免。',
      '豁免失败的生物将受到2d6点暗蚀伤害，并其直到下一回合前都无法执行反应。',
      '豁免成功的生物仅受到一半伤害。',
      '你使用的法术位每比一环高一环，法术的伤害就增加1d6点。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '源自你的10尺光环 区域内，每个生物都必须进行一次力量豁免。',
      '豁免失败的生物将受到2d6点暗蚀伤害，并其直到下一回合前都无法执行反应。',
      '豁免成功的生物仅受到一半伤害。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['豁免失败的生物将受到2d6点暗蚀伤害，并其直到下一回合前都无法执行反应。'],
    upcasting: ['升环施法。', '你使用的法术位每比一环高一环，法术的伤害就增加1d6点。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'compelled-duel': {
    categories: ['non-damage', 'support', 'condition'],
    catalogueText:
      '附赠动作令 30 尺内可见生物作感知豁免。失败时，专注最多一分钟；它攻击其他生物有劣势，不能自愿移动到距你超过 30 尺。你攻击别人或对其他敌人施法、盟友伤害该目标或对其施放伤害法术、你距它超过 30 尺结束回合都会终止。GM 核对敌对关系、移动和提前结束。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Compelled_Duel',
      title: '强令对决｜Compelled Duel',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 惑控（圣武士）',
      '施法时间：附赠动作',
      '施法距离：30 尺',
      '法术成分：V',
      '持续时间：专注，至多 1 分钟',
    ],
    sourceText:
      '你尝试强令一名生物与你决斗。选择施法距离内一名你可见的生物，该生物必须成功通过一次感知豁免，豁免失败则，该生物对除你之外任何生物进行攻击检定时都具有劣势，且该生物不能自主移动到距离你超过30尺的位置。 当你攻击另一名生物时，当你对另一名敌对生物施展法术时，当一名你的盟友对该目标造成伤害或者对其施展伤害性法术时，又或者你在距离该目标超过 30 尺的位置结束你的回合时，该法术提前终止。',
    targets: [
      '你尝试强令一名生物与你决斗。',
      '选择施法距离内一名你可见的生物，该生物必须成功通过一次感知豁免，豁免失败则，该生物对除你之外任何生物进行攻击检定时都具有劣势，且该生物不能自主移动到距离你超过30尺的位置。',
      '当你攻击另一名生物时，当你对另一名敌对生物施展法术时，当一名你的盟友对该目标造成伤害或者对其施展伤害性法术时，又或者你在距离该目标超过 30 尺的位置结束你的回合时，该法术提前终止。',
    ],
    resources: ['施法时间：附赠动作', '法术成分：V'],
    savingThrows: [
      '选择施法距离内一名你可见的生物，该生物必须成功通过一次感知豁免，豁免失败则，该生物对除你之外任何生物进行攻击检定时都具有劣势，且该生物不能自主移动到距离你超过30尺的位置。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '当你攻击另一名生物时，当你对另一名敌对生物施展法术时，当一名你的盟友对该目标造成伤害或者对其施展伤害性法术时，又或者你在距离该目标超过 30 尺的位置结束你的回合时，该法术提前终止。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '选择施法距离内一名你可见的生物，该生物必须成功通过一次感知豁免，豁免失败则，该生物对除你之外任何生物进行攻击检定时都具有劣势，且该生物不能自主移动到距离你超过30尺的位置。',
    ],
    contentWarnings: [],
  },
  'hail-of-thorns': {
    categories: ['pure-damage'],
    catalogueText:
      '远程武器命中生物后立即用附赠动作施放。命中目标及其周围 5 尺内所有生物作敏捷豁免，失败受 1d10 穿刺，成功半伤；每高一环加 1d10。不需要专注；GM 核对触发命中和范围，不重复结算武器伤害。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Hail_of_Thorns',
      title: '荆棘之雨｜Hail of Thorns',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 咒法（游侠）',
      '施法时间：1附赠动作，在你使用远程武器命中一个生物时紧接可用',
      '施法距离：自身',
      '法术成分：V',
      '持续时间：立即',
    ],
    sourceText:
      '当你攻击命中生物时，法术会从你的远程武器或弹药中创造出棘刺，并形成一片棘刺之雨。目标和在目标周围5尺内每个生物必须进行一次敏捷豁免检定，豁免失败者将受到 1d10 点穿刺伤害，豁免成功则受到一半伤害。 升环施法。使用的法术位每比一环高一环，此法术的伤害就增加 1d10。',
    targets: [
      '当你攻击命中生物时，法术会从你的远程武器或弹药中创造出棘刺，并形成一片棘刺之雨。',
      '目标和在目标周围5尺内每个生物必须进行一次敏捷豁免检定，豁免失败者将受到 1d10 点穿刺伤害，豁免成功则受到一半伤害。',
    ],
    resources: ['施法时间：1附赠动作，在你使用远程武器命中一个生物时紧接可用', '法术成分：V'],
    savingThrows: [
      '目标和在目标周围5尺内每个生物必须进行一次敏捷豁免检定，豁免失败者将受到 1d10 点穿刺伤害，豁免成功则受到一半伤害。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '当你攻击命中生物时，法术会从你的远程武器或弹药中创造出棘刺，并形成一片棘刺之雨。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，此法术的伤害就增加 1d10。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'thunderous-smite': {
    categories: ['damage-with-rider', 'condition'],
    catalogueText:
      '近战武器或徒手命中后立即用附赠动作施放，原攻击增加 2d6 雷鸣伤害。生物目标另作力量豁免，失败向外推 10 尺并倒地。每高一环额外伤害加 1d6；推离由 GM 确认。无需专注。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Thunderous_Smite',
      title: '雷鸣斩｜Thunderous Smite',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 塑能（圣武士）',
      '施法时间：附赠动作，当你使用近战武器或徒手打击命中一个目标后立即执行',
      '施法距离：自身',
      '法术成分：V',
      '持续时间：立即',
    ],
    sourceText:
      '你的打击发出距你300尺内都能听见的雷鸣。被该次攻击检定命中的目标会在此次攻击中额外受到2d6点雷鸣伤害，如果目标是一名生物，则它必须成功于一次力量豁免，否则其被向着远离你的方向推离10尺并陷入倒地状态。 升环施法。使用的法术位每比一环高一环，伤害就提高1d6。',
    targets: [
      '被该次攻击检定命中的目标会在此次攻击中额外受到2d6点雷鸣伤害，如果目标是一名生物，则它必须成功于一次力量豁免，否则其被向着远离你的方向推离10尺并陷入倒地状态。',
    ],
    resources: [
      '施法时间：附赠动作，当你使用近战武器或徒手打击命中一个目标后立即执行',
      '法术成分：V',
    ],
    savingThrows: [
      '被该次攻击检定命中的目标会在此次攻击中额外受到2d6点雷鸣伤害，如果目标是一名生物，则它必须成功于一次力量豁免，否则其被向着远离你的方向推离10尺并陷入倒地状态。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '被该次攻击检定命中的目标会在此次攻击中额外受到2d6点雷鸣伤害，如果目标是一名生物，则它必须成功于一次力量豁免，否则其被向着远离你的方向推离10尺并陷入倒地状态。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，伤害就提高1d6。'],
    visibility: ['你的打击发出距你300尺内都能听见的雷鸣。'],
    contentWarnings: [],
  },
  'witch-bolt': {
    categories: ['damage-with-rider'],
    catalogueText:
      '对 60 尺内生物作远程法术攻击，命中造成 2d12 闪电；每高一环只为初始伤害加 1d12。无论初次是否命中，专注期间后续自己的回合可用附赠动作令原目标受 1d12 闪电，不重掷攻击。目标超过 60 尺或处于完全掩护时终止，最长一分钟。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Witch_Bolt',
      title: '巫术箭｜Witch Bolt',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 塑能（术士、魔契师、法师）',
      '施法时间：动作',
      '施法距离：60尺',
      '法术成分：V、S、M（一根被闪电击中的树枝）',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '一支缠绕着碎裂魔力的蓝色能量长矛射向施法距离内的一个生物，并在你与目标之间生成一道持久的闪电弧。对目标进行一次远程法术攻击。若命中，则目标受到2d12闪电伤害。 无论首次攻击是否命中，在你接下来的每个回合中，你都可以用附赠动作直接对目标造成1d12闪电伤害。 此外，如果目标与你之间的距离超出了法术的施法距离，或者目标相对你而言处于全身掩护状态，法术将提前终止。 升环施法。使用的法术位每比一环高一环，此法术的初始伤害就提高1d12。',
    targets: [
      '一支缠绕着碎裂魔力的蓝色能量长矛射向施法距离内的一个生物，并在你与目标之间生成一道持久的闪电弧。',
      '对目标进行一次远程法术攻击。',
      '若命中，则目标受到2d12闪电伤害。',
      '无论首次攻击是否命中，在你接下来的每个回合中，你都可以用附赠动作直接对目标造成1d12闪电伤害。',
      '此外，如果目标与你之间的距离超出了法术的施法距离，或者目标相对你而言处于全身掩护状态，法术将提前终止。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一根被闪电击中的树枝）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '无论首次攻击是否命中，在你接下来的每个回合中，你都可以用附赠动作直接对目标造成1d12闪电伤害。',
      '此外，如果目标与你之间的距离超出了法术的施法距离，或者目标相对你而言处于全身掩护状态，法术将提前终止。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，此法术的初始伤害就提高1d12。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'wrathful-smite': {
    categories: ['damage-with-rider', 'condition'],
    catalogueText:
      '近战武器或徒手命中生物后立即用附赠动作施放，原攻击增加 1d6 黯蚀。目标感知豁免失败则恐惧，最多一分钟，每次自己回合结束可再豁免，成功结束。每高一环加 1d6；无需专注。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/1环.htm',
      anchor: 'Wrathful_Smite',
      title: '激愤斩｜Wrathful Smite',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '一环 死灵（圣武士）',
      '施法时间：附赠动作，当你使用近战武器或徒手打击命中一个生物后立即执行',
      '施法距离：自身',
      '法术成分：V',
      '持续时间：1分钟',
    ],
    sourceText:
      '被该次攻击检定命中的目标会在此次攻击中额外受到1d6点暗蚀伤害，并且目标必须通过一次感知豁免检定，否则直到法术结束为止陷入恐慌状态。在自己的每回合结束时，被恐慌的目标可以重复此豁免，成功则结束该法术对自身的影响。 升环施法。使用的法术位每比一环高一环，伤害就提高1d6。',
    targets: [
      '被该次攻击检定命中的目标会在此次攻击中额外受到1d6点暗蚀伤害，并且目标必须通过一次感知豁免检定，否则直到法术结束为止陷入恐慌状态。',
      '在自己的每回合结束时，被恐慌的目标可以重复此豁免，成功则结束该法术对自身的影响。',
    ],
    resources: [
      '施法时间：附赠动作，当你使用近战武器或徒手打击命中一个生物后立即执行',
      '法术成分：V',
    ],
    savingThrows: [
      '被该次攻击检定命中的目标会在此次攻击中额外受到1d6点暗蚀伤害，并且目标必须通过一次感知豁免检定，否则直到法术结束为止陷入恐慌状态。',
      '在自己的每回合结束时，被恐慌的目标可以重复此豁免，成功则结束该法术对自身的影响。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '被该次攻击检定命中的目标会在此次攻击中额外受到1d6点暗蚀伤害，并且目标必须通过一次感知豁免检定，否则直到法术结束为止陷入恐慌状态。',
      '在自己的每回合结束时，被恐慌的目标可以重复此豁免，成功则结束该法术对自身的影响。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比一环高一环，伤害就提高1d6。'],
    visibility: [
      '被该次攻击检定命中的目标会在此次攻击中额外受到1d6点暗蚀伤害，并且目标必须通过一次感知豁免检定，否则直到法术结束为止陷入恐慌状态。',
    ],
    contentWarnings: [],
  },
  'arcane-vigor': {
    categories: ['non-damage', 'healing'],
    catalogueText:
      '附赠动作，选择消耗一枚或两枚尚未消耗的生命骰，恢复所掷骰总和加本次施法属性调整值的 HP。三环可最多用三枚；不加入体质调整值。法术位与生命骰在同笔执行中消耗，不能使用超过剩余数量的骰。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Arcane_Vigor',
      title: '复苏秘法｜Arcane Vigor',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 防护（术士、法师、奇械师）',
      '施法时间：附赠动作',
      '施法距离：自身',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '你利用自己的生命力来治愈自身。投一枚或两枚你还未消耗的生命骰，然后恢复等于结果加你的施法属性调整值的总和的生命值。随后，这些生命骰会被法术消耗。 升环施法。使用的法术位每比二环高一环，你就能多投掷一枚未使用的生命骰。',
    targets: ['你利用自己的生命力来治愈自身。'],
    resources: ['施法时间：附赠动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['升环施法。', '使用的法术位每比二环高一环，你就能多投掷一枚未使用的生命骰。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'beast-sense': {
    categories: ['non-damage', 'perception'],
    catalogueText:
      '接触自愿野兽，专注最多一小时，可借它的感官感知并使用其特殊感官。可仪式施放；2024 版不额外使施法者自身目盲或耳聋。目标与感知信息由 GM 确认。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Beast_Sense',
      title: '野兽感官｜Beast Sense',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 预言（德鲁伊、游侠）',
      '施法时间：动作或仪式',
      '施法距离：触碰',
      '法术成分：S',
      '持续时间：专注，至多一小时',
    ],
    sourceText:
      '你触碰一只自愿的野兽。在持续期间内，你可以借助该野兽的感官来感知周围事物，如同它们的感官是你的感官一般。以通过该野兽感官感知事物时，你同样会受益于它拥有的那些特殊感官。',
    targets: ['你触碰一只自愿的野兽。'],
    resources: ['施法时间：动作或仪式', '法术成分：S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '在持续期间内，你可以借助该野兽的感官来感知周围事物，如同它们的感官是你的感官一般。',
      '以通过该野兽感官感知事物时，你同样会受益于它拥有的那些特殊感官。',
    ],
    contentWarnings: [],
  },
  'cloud-of-daggers': {
    categories: ['damage-with-rider', 'environment'],
    catalogueText:
      '在 60 尺内创造边长 5 尺的立方区域，出现时其中每名生物受 4d4 挥砍。区域移到生物上、进入区域、在区域结束回合也触发；同一生物每个回合最多一次。后续魔法动作可把区域传送至多 30 尺；专注最多一分钟，三环伤害为 6d4。GM 确认空间及触发。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Cloud_of_Daggers',
      title: '匕首之云｜Cloud of Daggers',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 咒法（吟游诗人、术士、魔契师、法师）',
      '施法时间：动作',
      '施法距离：60 尺',
      '法术成分：V、S、M（一小片玻璃）',
      '持续时间：专注，至多 1 分钟',
    ],
    sourceText:
      '你指定施法距离内一点，在以该点为中心的5尺立方区域内咒唤出旋转的匕首。区域内的每名生物受到4d4点挥砍伤害。每当立方区域移动到一名生物区域内时、一名生物进入立方区域或是在该区域结束其回合时，该生物同样会受到此伤害。一名生物一回合中只会受到一次该伤害。 在你后续的回合中，你能够以一个魔法动作将立方区域传送至多30尺。 升环施法。 使用的法术位每比二环高一环，此法术的伤害就增加2d4。',
    targets: [
      '你指定施法距离内一点，在以该点为中心的5尺立方区域内咒唤出旋转的匕首。',
      '区域内的每名生物受到4d4点挥砍伤害。',
      '每当立方区域移动到一名生物区域内时、一名生物进入立方区域或是在该区域结束其回合时，该生物同样会受到此伤害。',
      '一名生物一回合中只会受到一次该伤害。',
      '在你后续的回合中，你能够以一个魔法动作将立方区域传送至多30尺。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一小片玻璃）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '每当立方区域移动到一名生物区域内时、一名生物进入立方区域或是在该区域结束其回合时，该生物同样会受到此伤害。',
      '一名生物一回合中只会受到一次该伤害。',
      '在你后续的回合中，你能够以一个魔法动作将立方区域传送至多30尺。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比二环高一环，此法术的伤害就增加2d4。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'cordon-of-arrows': {
    categories: ['damage-with-rider', 'environment'],
    catalogueText:
      '接触至多四枚非魔法箭或弩矢，把它们固定在自身空间地面，持续八小时。未排除的生物首次进入 30 尺内或在那里结束回合，一枚弹药触发敏捷豁免，失败受 2d4 穿刺，随后弹药销毁。施放时记录排除名单，弹药耗尽后结束；三环可放六枚。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Cordon_of_Arrows',
      title: '警戒箭阵｜Cordon of Arrows',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 变化（游侠）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S、M（一根装饰性穗带）',
      '持续时间：8小时',
    ],
    sourceText:
      '你触碰至多四根非魔法箭矢或弩矢，将其插在位于你所处空间的地面上。直到法术结束为止，这些弹药不能被物理方法拔起，且当除你之外的生物第一次进入距弹药30尺内空间或在距弹药30尺内空间结束回合时，一枚弹药便会飞起攻击此生物。那名生物必须成功于一次敏捷豁免，否则受到2d4点穿刺伤害。那枚弹药随之被摧毁。当所有弹药都没有插在地面上时，法术终止。 施展该法术时，你可以指定任意名你选择的生物，法术效应将无视他们。 升环施法。使用的法术位每比二环高一环，可被影响的弹药数量就增加两枚。',
    targets: [
      '你触碰至多四根非魔法箭矢或弩矢，将其插在位于你所处空间的地面上。',
      '直到法术结束为止，这些弹药不能被物理方法拔起，且当除你之外的生物第一次进入距弹药30尺内空间或在距弹药30尺内空间结束回合时，一枚弹药便会飞起攻击此生物。',
      '那名生物必须成功于一次敏捷豁免，否则受到2d4点穿刺伤害。',
      '施展该法术时，你可以指定任意名你选择的生物，法术效应将无视他们。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一根装饰性穗带）'],
    savingThrows: ['那名生物必须成功于一次敏捷豁免，否则受到2d4点穿刺伤害。'],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '直到法术结束为止，这些弹药不能被物理方法拔起，且当除你之外的生物第一次进入距弹药30尺内空间或在距弹药30尺内空间结束回合时，一枚弹药便会飞起攻击此生物。',
      '那枚弹药随之被摧毁。',
      '当所有弹药都没有插在地面上时，法术终止。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比二环高一环，可被影响的弹药数量就增加两枚。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'crown-of-madness': {
    categories: ['non-damage', 'condition'],
    catalogueText:
      '120 尺内可见类人生物感知豁免，失败受魅惑，专注最多一分钟。目标在移动前用动作近战攻击你选的另一目标；未选目标或触及内无人时可以正常行动。施法者后续每回合用魔法动作维持；目标回合结束再豁免，成功结束。资格、被迫行动与维持由 GM 管理。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Crown_of_Madness',
      title: '疯狂冠冕｜Crown of Madness',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 惑控（吟游诗人、术士、魔契师、法师）',
      '施法时间：动作',
      '施法距离：120尺',
      '法术成分：V、S',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '一名施法距离内你可见的生物必须成功于一次感知豁免，否则于法术持续时间内陷入魅惑状态。非类人生物自动成功于此豁免。 一顶虚体王冠出现在被魅惑目标的头顶，且目标每回合必须在移动之前使用其动作对除自身以外你精神性选择的目标发动一次近战攻击。若你并未选择任何生物，或目标触及内没有生物，则目标可在其回合正常行动。目标在其每回合结束时都可以重新豁免，豁免成功则结束其身上该法术的效应。 在施法后，你在每个自己回合里必须用一个魔法动作维持对目标的控制，否则法术将终止。',
    targets: [
      '一名施法距离内你可见的生物必须成功于一次感知豁免，否则于法术持续时间内陷入魅惑状态。',
      '非类人生物自动成功于此豁免。',
      '一顶虚体王冠出现在被魅惑目标的头顶，且目标每回合必须在移动之前使用其动作对除自身以外你精神性选择的目标发动一次近战攻击。',
      '若你并未选择任何生物，或目标触及内没有生物，则目标可在其回合正常行动。',
      '目标在其每回合结束时都可以重新豁免，豁免成功则结束其身上该法术的效应。',
      '在施法后，你在每个自己回合里必须用一个魔法动作维持对目标的控制，否则法术将终止。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '一名施法距离内你可见的生物必须成功于一次感知豁免，否则于法术持续时间内陷入魅惑状态。',
      '非类人生物自动成功于此豁免。',
      '目标在其每回合结束时都可以重新豁免，豁免成功则结束其身上该法术的效应。',
    ],
    immunity: ['非类人生物自动成功于此豁免。'],
    repeatAndEnd: [
      '一顶虚体王冠出现在被魅惑目标的头顶，且目标每回合必须在移动之前使用其动作对除自身以外你精神性选择的目标发动一次近战攻击。',
      '若你并未选择任何生物，或目标触及内没有生物，则目标可在其回合正常行动。',
      '目标在其每回合结束时都可以重新豁免，豁免成功则结束其身上该法术的效应。',
      '在施法后，你在每个自己回合里必须用一个魔法动作维持对目标的控制，否则法术将终止。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '一名施法距离内你可见的生物必须成功于一次感知豁免，否则于法术持续时间内陷入魅惑状态。',
      '一顶虚体王冠出现在被魅惑目标的头顶，且目标每回合必须在移动之前使用其动作对除自身以外你精神性选择的目标发动一次近战攻击。',
    ],
    contentWarnings: [],
  },
  'summon-beast': {
    categories: ['non-damage', 'summoning'],
    catalogueText:
      '在 90 尺内可见空位召唤天空、大地或海洋野兽灵魄；需价值至少 200 GP 的镀金橡果材料，专注最多一小时。AC 为 11＋环阶；天空 HP 20、其余 30，三环再加 5。攻击加值用你的法术攻击，撕裂 1d8＋4＋环阶，攻击次数为环阶一半向下取整。紧接你回合后行动，口头命令无需动作，无命令时回避；归零或法术结束消失。飞掠、集群战术及水下呼吸按形态和 GM 条件处理。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/2环.htm',
      anchor: 'Summon_Beast',
      title: '野兽召唤术｜Summon Beast',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '二环 咒法（德鲁伊、游侠）',
      '施法时间：动作',
      '施法距离：90 尺',
      '法术成分：V, S, M（一根羽毛、一簇毛皮和一条装在镀金橡果内的鱼尾、价值至少200GP）',
      '持续时间：专注，至多1小时',
    ],
    sourceText:
      '你唤来一个野兽灵魄。其使用下文野兽灵魄的数据，并会在施法距离内一处你可见的未占据空间中显现。当你施展法术时，从天空、大地和海洋中选择一个环境。该生物会显化符合为你所选的环境的形态，其数据中的部分特性也受此影响。该生物会在生命值降为0或是法术结束时消失。 该生物是你的盟友（对你的其他盟友亦是如此）。它在战斗中使用你的先攻，并在你回合结束后立即行动。它遵从于你的口头指令（无需任何动作）。如果你不发令，它将执行回避动作并用移动力远离危险。 升环施法。该生物的数据使用新的法术环阶。 野兽灵魄Bestial Spirit 小型野兽，中立 AC 11+法术环阶 HP 20（仅天空）或30（仅大地与海洋）+每比二环高一法术环阶5 速度 30尺；攀爬30尺（仅大地）；飞行60尺（仅天空）；游泳30尺（仅海洋） 调整豁免调整豁免调整豁免 力量18+4+4 敏捷11+0+0 体质16+3+3 智力4-3-3 感知14+2+2 魅力5-3-3 感官 黑暗视觉60尺，被动察觉12 语言 理解你的语言 CR 无（XP0；PB等于你的熟练加值） 特质Traits 飞掠Flyby（仅天空）。灵魄飞行离开敌人的触及范围时不会引发借机攻击。 集群战术Pack Tactics（仅大地与海洋）。若灵魄的攻击目标生物5尺内存在有至少一名灵魄未失能的盟友，则灵魄对该生物进行的攻击检定具有优势。 水下呼吸Water Breathing（仅海洋）。灵魄只能在水下呼吸。 动作Actions 多重攻击Multiattack。灵魄发动等于法术环阶一半次数的撕裂攻击（向下取整）。 撕裂Rend。近战攻击检定：加值等于你的法术攻击加值，触及5尺。命中：1d8+4+法术环阶的挥砍伤害。',
    targets: [
      '其使用下文野兽灵魄的数据，并会在施法距离内一处你可见的未占据空间中显现。',
      '当你施展法术时，从天空、大地和海洋中选择一个环境。',
      '该生物会显化符合为你所选的环境的形态，其数据中的部分特性也受此影响。',
      '该生物会在生命值降为0或是法术结束时消失。',
      '该生物是你的盟友（对你的其他盟友亦是如此）。',
      '该生物的数据使用新的法术环阶。',
      '灵魄飞行离开敌人的触及范围时不会引发借机攻击。',
      '若灵魄的攻击目标生物5尺内存在有至少一名灵魄未失能的盟友，则灵魄对该生物进行的攻击检定具有优势。',
    ],
    resources: [
      '施法时间：动作',
      '法术成分：V, S, M（一根羽毛、一簇毛皮和一条装在镀金橡果内的鱼尾、价值至少200GP）',
    ],
    savingThrows: [
      '野兽灵魄Bestial Spirit 小型野兽，中立 AC 11+法术环阶 HP 20（仅天空）或30（仅大地与海洋）+每比二环高一法术环阶5 速度 30尺；攀爬30尺（仅大地）；飞行60尺（仅天空）；游泳30尺（仅海洋） 调整豁免调整豁免调整豁免 力量18+4+4 敏捷11+0+0 体质16+3+3 智力4-3-3 感知14+2+2 魅力5-3-3 感官 黑暗视觉60尺，被动察觉12 语言 理解你的语言 CR 无（XP0；PB等于你的熟练加值） 特质Traits 飞掠Flyby（仅天空）。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '当你施展法术时，从天空、大地和海洋中选择一个环境。',
      '该生物会在生命值降为0或是法术结束时消失。',
      '它在战斗中使用你的先攻，并在你回合结束后立即行动。',
      '如果你不发令，它将执行回避动作并用移动力远离危险。',
    ],
    upcasting: [
      '升环施法。',
      '该生物的数据使用新的法术环阶。',
      '野兽灵魄Bestial Spirit 小型野兽，中立 AC 11+法术环阶 HP 20（仅天空）或30（仅大地与海洋）+每比二环高一法术环阶5 速度 30尺；攀爬30尺（仅大地）；飞行60尺（仅天空）；游泳30尺（仅海洋） 调整豁免调整豁免调整豁免 力量18+4+4 敏捷11+0+0 体质16+3+3 智力4-3-3 感知14+2+2 魅力5-3-3 感官 黑暗视觉60尺，被动察觉12 语言 理解你的语言 CR 无（XP0；PB等于你的熟练加值） 特质Traits 飞掠Flyby（仅天空）。',
      '灵魄发动等于法术环阶一半次数的撕裂攻击（向下取整）。',
      '命中：1d8+4+法术环阶的挥砍伤害。',
    ],
    visibility: [
      '其使用下文野兽灵魄的数据，并会在施法距离内一处你可见的未占据空间中显现。',
      '野兽灵魄Bestial Spirit 小型野兽，中立 AC 11+法术环阶 HP 20（仅天空）或30（仅大地与海洋）+每比二环高一法术环阶5 速度 30尺；攀爬30尺（仅大地）；飞行60尺（仅天空）；游泳30尺（仅海洋） 调整豁免调整豁免调整豁免 力量18+4+4 敏捷11+0+0 体质16+3+3 智力4-3-3 感知14+2+2 魅力5-3-3 感官 黑暗视觉60尺，被动察觉12 语言 理解你的语言 CR 无（XP0；PB等于你的熟练加值） 特质Traits 飞掠Flyby（仅天空）。',
    ],
    contentWarnings: [],
  },
  'aura-of-vitality': {
    categories: ['non-damage', 'healing'],
    catalogueText:
      '以自身为原点产生 30 尺发散灵光，专注最多一分钟。创造时及后续自己的回合开始，可使区域内一名生物恢复 2d6 HP。2024 版后续治疗不消耗附赠动作；GM 确认回合开始与范围，每个触发一次。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Aura_of_Vitality',
      title: '活力灵光｜Aura of Vitality',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 防护（牧师、德鲁伊、圣武士）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V',
      '持续时间：专注，至多 1 分钟',
    ],
    sourceText:
      '一道灵光自你身上发出并形成30尺半径的光环 。当你创造灵光时和它持续时你的每个回合开始，你可以为区域内的一名生物恢复2d6生命值。',
    targets: ['当你创造灵光时和它持续时你的每个回合开始，你可以为区域内的一名生物恢复2d6生命值。'],
    resources: ['施法时间：动作', '法术成分：V'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '当你创造灵光时和它持续时你的每个回合开始，你可以为区域内的一名生物恢复2d6生命值。',
    ],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'blinding-smite': {
    categories: ['damage-with-rider', 'condition'],
    catalogueText:
      '近战武器或徒手命中生物后立即用附赠动作施放，原攻击增加 3d8 光耀，目标立即目盲，最多一分钟。目标在自己回合结束作体质豁免，成功结束；不是先豁免再决定是否目盲。每高一环加 1d8，无需专注。普通五级圣武士尚无三环位，不能因目录存在就选取。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Blinding_Smite',
      title: '致盲斩｜Blinding Smite',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 塑能（圣武士）',
      '施法时间：附赠动作，当你使用近战武器或徒手打击命中一个生物后立即执行',
      '施法距离：自身',
      '法术成分：V',
      '持续时间：1分钟',
    ],
    sourceText:
      '被该次攻击检定命中的目标会在此次攻击中额外受到3d8点光耀伤害，并且目标陷入目盲状态直至法术结束。陷入目盲的目标在其每回合结束时可以进行一次体质豁免，豁免成功则终止其身上的法术。 升环施法。你使用的法术位每比三环高一环，此法术的额外伤害提升1d8。',
    targets: [
      '被该次攻击检定命中的目标会在此次攻击中额外受到3d8点光耀伤害，并且目标陷入目盲状态直至法术结束。',
      '陷入目盲的目标在其每回合结束时可以进行一次体质豁免，豁免成功则终止其身上的法术。',
    ],
    resources: [
      '施法时间：附赠动作，当你使用近战武器或徒手打击命中一个生物后立即执行',
      '法术成分：V',
    ],
    savingThrows: [
      '陷入目盲的目标在其每回合结束时可以进行一次体质豁免，豁免成功则终止其身上的法术。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '被该次攻击检定命中的目标会在此次攻击中额外受到3d8点光耀伤害，并且目标陷入目盲状态直至法术结束。',
      '陷入目盲的目标在其每回合结束时可以进行一次体质豁免，豁免成功则终止其身上的法术。',
    ],
    upcasting: ['升环施法。', '你使用的法术位每比三环高一环，此法术的额外伤害提升1d8。'],
    visibility: [
      '被该次攻击检定命中的目标会在此次攻击中额外受到3d8点光耀伤害，并且目标陷入目盲状态直至法术结束。',
      '陷入目盲的目标在其每回合结束时可以进行一次体质豁免，豁免成功则终止其身上的法术。',
    ],
    contentWarnings: [],
  },
  'conjure-barrage': {
    categories: ['pure-damage'],
    catalogueText:
      '使用至少值 1 CP 的近战或远程武器作材料，选择自身 60 尺锥形内可见生物。各作敏捷豁免，失败受 5d8 力场，成功半伤。每高一环加 1d8；目标名单和传播由 GM 核对。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Conjure_Barrage',
      title: '箭如雨下｜Conjure Barrage',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 咒法（游侠）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V、S、M（一把价值1+CP的近战或远程武器）',
      '持续时间：立即',
    ],
    sourceText:
      '你挥舞作为施法材料的武器，令无数外形相似的灵体武器（或是适合这把武器的弹药）显现，它们将向前射出并在之后消失。每名由你选择且你可见的位于60尺锥形区域内的生物进行一次敏捷豁免检定，豁免失败者将受到5d8点力场伤害，豁免成功则只受一半伤害。 升环施法。使用的法术位每比三环高一环，此法术的伤害就增加1d8。',
    targets: [
      '每名由你选择且你可见的位于60尺锥形区域内的生物进行一次敏捷豁免检定，豁免失败者将受到5d8点力场伤害，豁免成功则只受一半伤害。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一把价值1+CP的近战或远程武器）'],
    savingThrows: [
      '每名由你选择且你可见的位于60尺锥形区域内的生物进行一次敏捷豁免检定，豁免失败者将受到5d8点力场伤害，豁免成功则只受一半伤害。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '你挥舞作为施法材料的武器，令无数外形相似的灵体武器（或是适合这把武器的弹药）显现，它们将向前射出并在之后消失。',
    ],
    upcasting: ['升环施法。', '使用的法术位每比三环高一环，此法术的伤害就增加1d8。'],
    visibility: [
      '每名由你选择且你可见的位于60尺锥形区域内的生物进行一次敏捷豁免检定，豁免失败者将受到5d8点力场伤害，豁免成功则只受一半伤害。',
    ],
    contentWarnings: [],
  },
  'crusaders-mantle': {
    categories: ['non-damage', 'support'],
    catalogueText:
      '专注最多一分钟，自身 30 尺发散区域内你及盟友的武器或徒手命中增加 1d4 光耀。攻击时重新核对盟友和范围；不为所有法术攻击加伤，不叠加同名法术。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: "Crusader's_Mantle",
      title: "十字军披风｜Crusader's Mantle",
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 塑能（圣武士）',
      '施法时间：动作',
      '施法距离：自身',
      '法术成分：V',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '你在30尺光环区域内散发出魔法灵光。位于灵光范围期间，你和你盟友以一把武器或一次徒手打击命中时将额外造成1d4光耀伤害。',
    targets: [
      '你在30尺光环区域内散发出魔法灵光。',
      '位于灵光范围期间，你和你盟友以一把武器或一次徒手打击命中时将额外造成1d4光耀伤害。',
    ],
    resources: ['施法时间：动作', '法术成分：V'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'elemental-weapon': {
    categories: ['non-damage', 'support'],
    catalogueText:
      '接触一把非魔法武器，选择强酸、寒冷、火焰、闪电或雷鸣。专注最多一小时；该武器成为魔法武器，攻击＋1，命中额外 1d4 所选类型。五／六环改为＋2 和 2d4，七环以上＋3 和 3d4。本轮只开放实际可获得的环阶及来源，指定武器实例由 GM 核对。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Elemental_Weapon',
      title: '元素武器｜Elemental Weapon',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 变化（德鲁伊、圣武士、游侠、奇械师）',
      '施法时间：动作',
      '施法距离：触碰',
      '法术成分：V、S',
      '持续时间：专注，至多1小时',
    ],
    sourceText:
      '你触碰的一把非魔法武器变成魔法武器。选择下述伤害类型之一：强酸、寒冷、火焰、闪电、雷鸣。法术持续时间内，用那把武器发动的攻击检定具有+1加值，且在命中时造成额外1d4点你所选伤害类型的伤害。 升环施法。使用五环或六环法术位时，攻击检定的加值变为+2，额外伤害变为2d4。使用七环或更高法术位时，攻击检定的加值变为+3，额外伤害变为3d4。',
    targets: [
      '你触碰的一把非魔法武器变成魔法武器。',
      '选择下述伤害类型之一：强酸、寒冷、火焰、闪电、雷鸣。',
      '法术持续时间内，用那把武器发动的攻击检定具有+1加值，且在命中时造成额外1d4点你所选伤害类型的伤害。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['升环施法。', '使用七环或更高法术位时，攻击检定的加值变为+3，额外伤害变为3d4。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'feign-death': {
    categories: ['non-damage', 'support', 'condition'],
    catalogueText:
      '接触自愿生物，使其一小时内被检查为死亡。目标目盲、失能且速度 0；除心灵外所有伤害抗性，并免疫中毒状态。可仪式施放，不真的写入死亡标志，效果结束后恢复普通状态。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Feign_Death',
      title: '假死术｜Feign Death',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 死灵（吟游诗人、牧师、德鲁伊、法师）',
      '施法时间：动作或仪式',
      '施法距离：触碰',
      '法术成分：V、S、M（一撮墓土）',
      '持续时间：1小时',
    ],
    sourceText:
      '你触碰一名自愿生物并将其变得如死者般的僵直。 在法术持续时间内，对目标进行的任何肉体检查和法术检测都显示目标已死亡。该状况下的目标陷入目盲以及失能状态，且其速度降至0。 目标对除了心灵伤害外的所有伤害类型具有抗性，也免疫中毒状态。',
    targets: [
      '你触碰一名自愿生物并将其变得如死者般的僵直。',
      '在法术持续时间内，对目标进行的任何肉体检查和法术检测都显示目标已死亡。',
      '该状况下的目标陷入目盲以及失能状态，且其速度降至0。',
      '目标对除了心灵伤害外的所有伤害类型具有抗性，也免疫中毒状态。',
    ],
    resources: ['施法时间：动作或仪式', '法术成分：V、S、M（一撮墓土）'],
    savingThrows: [
      '正文未规定本术的豁免；检定若存在见完整正文，不把对抗法术豁免DC的技能检定当豁免。',
    ],
    immunity: ['目标对除了心灵伤害外的所有伤害类型具有抗性，也免疫中毒状态。'],
    repeatAndEnd: ['除表头期限与专注通则外，正文未列重复豁免或专属提前结束。'],
    upcasting: ['正文未规定升环增益；不能自行增加目标或效果。'],
    visibility: [
      '该状况下的目标陷入目盲以及失能状态，且其速度降至0。',
      '目标对除了心灵伤害外的所有伤害类型具有抗性，也免疫中毒状态。',
    ],
    contentWarnings: [],
  },
  'hunger-of-hadar': {
    categories: ['damage-with-rider', 'environment', 'condition'],
    catalogueText:
      '150 尺内创造半径 20 尺黑暗球，专注最多一分钟。区域为困难地形，任何光照都不能照亮，完全在其中的生物目盲。在区域开始回合受 2d6 寒冷；结束回合作敏捷豁免，失败受 2d6 强酸。每高一环只增加所选一种伤害 1d6，GM 管理空间与两个触发时机。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Hunger_of_Hadar',
      title: '哈达之欲｜Hunger of Hadar',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 咒法（魔契师）',
      '施法时间：动作',
      '施法距离：150尺',
      '法术成分：V、S、M（一条酸洗过的触须）',
      '持续时间：专注，至多1分钟',
    ],
    sourceText:
      '你打开了通往遥远国度的大门，展现其中难以名状的恐怖。以施法距离内一点为中心，一个半径 20 尺的黑暗球状区域显现并持续至该法术终止。这个球状区域是困难地形，并同时发散着能在30尺内听到的不谐耳语和啜嚼噪音。任何光照，无论是魔法光照还是其他光照都无法照亮这个区域，而完全进入该区域内的生物将陷入目盲状态。 任何在区域内开始其回合的生物将受到 2d6 点寒冷伤害。任何在区域内结束其回合的生物必须进行一次敏捷豁免，豁免失败者将因异界软体触手的触碰而受到2d6点强酸伤害。 升环施法。使用的法术位每比三环高一环，此法术造成的寒冷或者强酸伤害（由你选择）就增加1d6。',
    targets: [
      '以施法距离内一点为中心，一个半径 20 尺的黑暗球状区域显现并持续至该法术终止。',
      '这个球状区域是困难地形，并同时发散着能在30尺内听到的不谐耳语和啜嚼噪音。',
      '任何光照，无论是魔法光照还是其他光照都无法照亮这个区域，而完全进入该区域内的生物将陷入目盲状态。',
      '任何在区域内开始其回合的生物将受到 2d6 点寒冷伤害。',
      '任何在区域内结束其回合的生物必须进行一次敏捷豁免，豁免失败者将因异界软体触手的触碰而受到2d6点强酸伤害。',
      '使用的法术位每比三环高一环，此法术造成的寒冷或者强酸伤害（由你选择）就增加1d6。',
    ],
    resources: ['施法时间：动作', '法术成分：V、S、M（一条酸洗过的触须）'],
    savingThrows: [
      '任何在区域内结束其回合的生物必须进行一次敏捷豁免，豁免失败者将因异界软体触手的触碰而受到2d6点强酸伤害。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: [
      '以施法距离内一点为中心，一个半径 20 尺的黑暗球状区域显现并持续至该法术终止。',
      '任何在区域内开始其回合的生物将受到 2d6 点寒冷伤害。',
      '任何在区域内结束其回合的生物必须进行一次敏捷豁免，豁免失败者将因异界软体触手的触碰而受到2d6点强酸伤害。',
    ],
    upcasting: [
      '升环施法。',
      '使用的法术位每比三环高一环，此法术造成的寒冷或者强酸伤害（由你选择）就增加1d6。',
    ],
    visibility: [
      '以施法距离内一点为中心，一个半径 20 尺的黑暗球状区域显现并持续至该法术终止。',
      '这个球状区域是困难地形，并同时发散着能在30尺内听到的不谐耳语和啜嚼噪音。',
      '任何光照，无论是魔法光照还是其他光照都无法照亮这个区域，而完全进入该区域内的生物将陷入目盲状态。',
    ],
    contentWarnings: [],
  },
  'lightning-arrow': {
    categories: ['pure-damage'],
    catalogueText:
      '远程武器攻击命中或失手后立即用附赠动作施放。以 4d8 闪电替代原攻击的全部伤害及其他效果，失手也受半伤。无论命中与否，原目标周围 10 尺内生物各作敏捷豁免，失败受 2d8 闪电，成功半伤。每高一环两段各加 1d8；GM 必须核对替代攻击，避免先结算武器再额外叠加。无需专注。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Lightning_Arrows',
      title: '闪电箭矢｜Lightning Arrows',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 变化（游侠）',
      '施法时间：附赠动作，在你使用武器发动远程攻击命中一个目标或失手时紧接可用',
      '施法距离：自身',
      '法术成分：V、S',
      '持续时间：立即',
    ],
    sourceText:
      '当你的攻击命中一个目标或失手时，该武器的弹药或该武器本身变为一束闪电。作为目标从这次攻击中受到的任何伤害或其他效果的替代，若该攻击命中，则目标受到4d8点闪电伤害，若该攻击未命中，则受到一半伤害。无论你的攻击是否命中，目标周围10尺范围内的每个生物都必须进行一次敏捷豁免，豁免失败则受到2d8点闪电伤害，豁免成功则受到半数伤害。 在此之后，该弹药或武器变回其正常形态。 升环施法。使用的法术位每比三环高一环，上述两种效应的伤害都各增加1d8。',
    targets: [
      '当你的攻击命中一个目标或失手时，该武器的弹药或该武器本身变为一束闪电。',
      '作为目标从这次攻击中受到的任何伤害或其他效果的替代，若该攻击命中，则目标受到4d8点闪电伤害，若该攻击未命中，则受到一半伤害。',
      '无论你的攻击是否命中，目标周围10尺范围内的每个生物都必须进行一次敏捷豁免，豁免失败则受到2d8点闪电伤害，豁免成功则受到半数伤害。',
    ],
    resources: [
      '施法时间：附赠动作，在你使用武器发动远程攻击命中一个目标或失手时紧接可用',
      '法术成分：V、S',
    ],
    savingThrows: [
      '无论你的攻击是否命中，目标周围10尺范围内的每个生物都必须进行一次敏捷豁免，豁免失败则受到2d8点闪电伤害，豁免成功则受到半数伤害。',
    ],
    immunity: ['正文未列专属免疫；须另核目标已有免疫、抗性及法术通则。'],
    repeatAndEnd: ['当你的攻击命中一个目标或失手时，该武器的弹药或该武器本身变为一束闪电。'],
    upcasting: ['升环施法。', '使用的法术位每比三环高一环，上述两种效应的伤害都各增加1d8。'],
    visibility: ['正文未赋予受众额外知情；默认自身/GM完整，旁观者仅可感知及明确公开事实。'],
    contentWarnings: [],
  },
  'summon-fey': {
    categories: ['non-damage', 'summoning'],
    catalogueText:
      '在 90 尺内可见空位召唤妖精灵魄，需价值至少 300 GP 的镀金花，专注最多一小时。三环 AC 15、HP 30，步行与飞行 30 尺，免疫魅惑；妖精之剑用你的法术攻击，造成 2d6＋6 力场，每回合一次攻击。紧接你回合后行动，口头命令无需动作。附赠动作传送 30 尺，并按愤怒／欢欣／诡诈选择下一攻击优势、魅惑豁免或短暂黑暗；GM 确认位置、范围与分支。归零或专注结束消失。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Summon_Fey',
      title: '妖精召唤术｜Summon Fey',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 咒法（德鲁伊、游侠、魔契师、法师）',
      '施法时间：动作',
      '施法距离：90 尺',
      '法术成分：V, S, M（一朵价值300+GP的镀金花）',
      '持续时间：专注，至多1小时',
    ],
    sourceText:
      '你唤来一个妖精灵魄。其使用下文妖精灵魄的数据，并会在施法距离内一处你可见的未占据空间中显现。当你施展法术时，从愤怒、欢欣、诡诈中选择一种情绪，该生物会显现为一个受你所选情绪所影响的妖精生物，其数据中的部分特性也受此影响。该生物会在生命值降为0或是法术结束时消失。 该生物是你的盟友（对你的其他盟友亦是如此）。它在战斗中使用你的先攻，并在你回合结束后立即行动。它遵从于你的口头指令（无需任何动作）。如果你不发令，它将执行回避动作并用移动力远离危险。 升环施法。该生物的数据使用新的法术环阶。 妖精灵魄Fey Spirit 小型妖精，中立 AC 12+法术环阶 HP 30+每比三环高一法术环阶10 速度 30尺，飞行30尺 调整豁免调整豁免调整豁免 力量13+1+1 敏捷16+3+3 体质14+2+2 智力14+2+2 感知11+0+0 魅力16+3+3 免疫 魅惑 感官 黑暗视觉60尺，被动察觉10 语言 木族语，理解你的语言 CR 无（XP0；PB等于你的熟练加值） 动作Actions 多重攻击Multiattack。灵魄发动等于法术环阶一半次数的妖精之剑攻击（向下取整）。 妖精之剑Fey Blade。近战攻击检定：加值等于你的法术攻击加值，触及5尺。命中：2d6+3+法术环阶的力场伤害。 附赠动作Bonus Actions 妖精步伐Fey Step。灵魄魔法地传送至多30尺至一处它可见的未占据空间。随后根据所选情绪，灵魄触发以下效果之一： 愤怒Fuming。妖精在此回合结束前的下一次攻击检定具有优势。 欢欣Mirthful。感知豁免：DC等于你的法术豁免DC，单一灵魄10尺内它可见的生物。失败：目标受你和灵魄魅惑1分钟或在目标受到任意伤害时提前结束。 诡诈Tricksy。灵魄令魔法黑暗充斥于它5尺内的一处10尺立方区域，持续至灵魄的下个回合结束。',
    targets: [
      '其使用下文妖精灵魄的数据，并会在施法距离内一处你可见的未占据空间中显现。',
      '当你施展法术时，从愤怒、欢欣、诡诈中选择一种情绪，该生物会显现为一个受你所选情绪所影响的妖精生物，其数据中的部分特性也受此影响。',
      '该生物会在生命值降为0或是法术结束时消失。',
      '该生物是你的盟友（对你的其他盟友亦是如此）。',
      '该生物的数据使用新的法术环阶。',
      '感知豁免：DC等于你的法术豁免DC，单一灵魄10尺内它可见的生物。',
      '失败：目标受你和灵魄魅惑1分钟或在目标受到任意伤害时提前结束。',
      '灵魄令魔法黑暗充斥于它5尺内的一处10尺立方区域，持续至灵魄的下个回合结束。',
    ],
    resources: ['施法时间：动作', '法术成分：V, S, M（一朵价值300+GP的镀金花）'],
    savingThrows: [
      '妖精灵魄Fey Spirit 小型妖精，中立 AC 12+法术环阶 HP 30+每比三环高一法术环阶10 速度 30尺，飞行30尺 调整豁免调整豁免调整豁免 力量13+1+1 敏捷16+3+3 体质14+2+2 智力14+2+2 感知11+0+0 魅力16+3+3 免疫 魅惑 感官 黑暗视觉60尺，被动察觉10 语言 木族语，理解你的语言 CR 无（XP0；PB等于你的熟练加值） 动作Actions 多重攻击Multiattack。',
      '感知豁免：DC等于你的法术豁免DC，单一灵魄10尺内它可见的生物。',
    ],
    immunity: [
      '妖精灵魄Fey Spirit 小型妖精，中立 AC 12+法术环阶 HP 30+每比三环高一法术环阶10 速度 30尺，飞行30尺 调整豁免调整豁免调整豁免 力量13+1+1 敏捷16+3+3 体质14+2+2 智力14+2+2 感知11+0+0 魅力16+3+3 免疫 魅惑 感官 黑暗视觉60尺，被动察觉10 语言 木族语，理解你的语言 CR 无（XP0；PB等于你的熟练加值） 动作Actions 多重攻击Multiattack。',
    ],
    repeatAndEnd: [
      '当你施展法术时，从愤怒、欢欣、诡诈中选择一种情绪，该生物会显现为一个受你所选情绪所影响的妖精生物，其数据中的部分特性也受此影响。',
      '该生物会在生命值降为0或是法术结束时消失。',
      '它在战斗中使用你的先攻，并在你回合结束后立即行动。',
      '如果你不发令，它将执行回避动作并用移动力远离危险。',
      '妖精在此回合结束前的下一次攻击检定具有优势。',
      '失败：目标受你和灵魄魅惑1分钟或在目标受到任意伤害时提前结束。',
      '灵魄令魔法黑暗充斥于它5尺内的一处10尺立方区域，持续至灵魄的下个回合结束。',
    ],
    upcasting: [
      '升环施法。',
      '该生物的数据使用新的法术环阶。',
      '妖精灵魄Fey Spirit 小型妖精，中立 AC 12+法术环阶 HP 30+每比三环高一法术环阶10 速度 30尺，飞行30尺 调整豁免调整豁免调整豁免 力量13+1+1 敏捷16+3+3 体质14+2+2 智力14+2+2 感知11+0+0 魅力16+3+3 免疫 魅惑 感官 黑暗视觉60尺，被动察觉10 语言 木族语，理解你的语言 CR 无（XP0；PB等于你的熟练加值） 动作Actions 多重攻击Multiattack。',
      '灵魄发动等于法术环阶一半次数的妖精之剑攻击（向下取整）。',
      '命中：2d6+3+法术环阶的力场伤害。',
    ],
    visibility: [
      '其使用下文妖精灵魄的数据，并会在施法距离内一处你可见的未占据空间中显现。',
      '妖精灵魄Fey Spirit 小型妖精，中立 AC 12+法术环阶 HP 30+每比三环高一法术环阶10 速度 30尺，飞行30尺 调整豁免调整豁免调整豁免 力量13+1+1 敏捷16+3+3 体质14+2+2 智力14+2+2 感知11+0+0 魅力16+3+3 免疫 魅惑 感官 黑暗视觉60尺，被动察觉10 语言 木族语，理解你的语言 CR 无（XP0；PB等于你的熟练加值） 动作Actions 多重攻击Multiattack。',
      '灵魄魔法地传送至多30尺至一处它可见的未占据空间。',
      '感知豁免：DC等于你的法术豁免DC，单一灵魄10尺内它可见的生物。',
      '灵魄令魔法黑暗充斥于它5尺内的一处10尺立方区域，持续至灵魄的下个回合结束。',
    ],
    contentWarnings: [],
  },
  'summon-undead': {
    categories: ['non-damage', 'summoning'],
    catalogueText:
      '在 90 尺内可见空位召唤幽体、腐尸或骸骨灵魄；需价值至少 300 GP 的镀金头骨，专注最多一小时。三环 AC 14，幽体／腐尸 HP 30，骸骨 HP 20，免疫黯蚀、毒素及力竭、恐惧、麻痹、中毒。攻击使用你的法术攻击，各形态伤害和状态不同，三环攻击一次。紧接你回合后行动，口头命令无需动作；GM 确认灵光、虚体穿行及状态触发，归零或法术结束消失。',
    ruleSource: {
      edition: '2024',
      path: '.sources/phb2024-chm-20260806/玩家手册2024/法术详述/3环.htm',
      anchor: 'Summon_Undead',
      title: '亡灵召唤术｜Summon Undead',
      encoding: 'GB18030',
    },
    sourceHeader: [
      '三环 死灵（魔契师、法师）',
      '施法时间：动作',
      '施法距离：90 尺',
      '法术成分：V, S, M（一个价值300+GP的镀金头骨）',
      '持续时间：专注，至多1小时',
    ],
    sourceText:
      '你唤来一个亡灵灵魄。其使用下文亡灵灵魄的数据，并会在施法距离内一处你可见的未占据空间中显现。当你施展法术时，从幽体、腐尸、骸骨中选择一类，该生物会显现为你所选的那类形态的亡灵生物，其数据中的部分特性也受此影响。该生物会在生命值降为0或是法术结束时消失。 该生物是你的盟友（对你的其他盟友亦是如此）。它在战斗中使用你的先攻，并在你回合结束后立即行动。它遵从于你的口头指令（无需任何动作）。如果你不发令，它将执行回避动作并用移动力远离危险。 升环施法。该生物的数据使用新的法术环阶。 亡灵灵魄Undead Spirit 中型亡灵，中立 AC 11+法术环阶 HP 30（仅幽体和腐尸）或20（仅骸骨）+每比三环高一法术环阶10 速度 30尺；飞行40尺（悬浮；仅幽体） 调整豁免调整豁免调整豁免 力量12+1+1 敏捷16+3+3 体质15+2+2 智力4-3-3 感知10+0+0 魅力9-1-1 免疫 暗蚀，毒素；力竭，恐慌，麻痹，中毒 感官 黑暗视觉60尺，被动察觉10 语言 理解你说的语言 CR 无（XP0；PB等于你的熟练加值） 特质Traits 腐灭灵光Festering Aura（仅腐尸）。体质豁免：DC等于你的法术豁免DC，源自灵魄的5尺光环区域内开始其回合的每名生物（除你以外）。失败：该生物陷入中毒状态，直至其下个回合开始。 虚体通行Incorporeal Passage（仅幽体）。灵魄可以移动穿过其他生物或物件，如同穿过困难地形一般。在其回合结束时，若灵魄还处于物件内，则其被挪到距离最近的未占据空间，且每因此移动5尺便受到1d10力场伤害。 动作Actions 多重攻击Multiattack。灵魄发动等于法术环阶一半次数的攻击（向下取整）。 致死之触Deathly Touch（仅幽体）。近战攻击检定：加值等于你的法术攻击加值，触及5尺。命中：1d8+3+法术环阶的暗蚀伤害，且目标陷入恐慌状态直至其下个回合结束。 暗澹箭Grave Bolt（仅骸骨）。远程攻击检定：加值等于你的法术攻击加值，射程150尺。命中：2d4+3+法术环阶的暗蚀伤害。 腐灭爪击Rotting Claw（仅腐尸）。近战攻击检定：加值等于你的法术攻击加值，触及5尺。命中：1d6+3+法术环阶的挥砍伤害。若目标已陷入中毒状态，则其还会陷入麻痹状态，直至其下个回合结束。',
    targets: [
      '其使用下文亡灵灵魄的数据，并会在施法距离内一处你可见的未占据空间中显现。',
      '当你施展法术时，从幽体、腐尸、骸骨中选择一类，该生物会显现为你所选的那类形态的亡灵生物，其数据中的部分特性也受此影响。',
      '该生物会在生命值降为0或是法术结束时消失。',
      '该生物是你的盟友（对你的其他盟友亦是如此）。',
      '该生物的数据使用新的法术环阶。',
      '体质豁免：DC等于你的法术豁免DC，源自灵魄的5尺光环区域内开始其回合的每名生物（除你以外）。',
      '失败：该生物陷入中毒状态，直至其下个回合开始。',
      '灵魄可以移动穿过其他生物或物件，如同穿过困难地形一般。',
      '在其回合结束时，若灵魄还处于物件内，则其被挪到距离最近的未占据空间，且每因此移动5尺便受到1d10力场伤害。',
      '命中：1d8+3+法术环阶的暗蚀伤害，且目标陷入恐慌状态直至其下个回合结束。',
      '若目标已陷入中毒状态，则其还会陷入麻痹状态，直至其下个回合结束。',
    ],
    resources: ['施法时间：动作', '法术成分：V, S, M（一个价值300+GP的镀金头骨）'],
    savingThrows: [
      '亡灵灵魄Undead Spirit 中型亡灵，中立 AC 11+法术环阶 HP 30（仅幽体和腐尸）或20（仅骸骨）+每比三环高一法术环阶10 速度 30尺；飞行40尺（悬浮；仅幽体） 调整豁免调整豁免调整豁免 力量12+1+1 敏捷16+3+3 体质15+2+2 智力4-3-3 感知10+0+0 魅力9-1-1 免疫 暗蚀，毒素；力竭，恐慌，麻痹，中毒 感官 黑暗视觉60尺，被动察觉10 语言 理解你说的语言 CR 无（XP0；PB等于你的熟练加值） 特质Traits 腐灭灵光Festering Aura（仅腐尸）。',
      '体质豁免：DC等于你的法术豁免DC，源自灵魄的5尺光环区域内开始其回合的每名生物（除你以外）。',
    ],
    immunity: [
      '亡灵灵魄Undead Spirit 中型亡灵，中立 AC 11+法术环阶 HP 30（仅幽体和腐尸）或20（仅骸骨）+每比三环高一法术环阶10 速度 30尺；飞行40尺（悬浮；仅幽体） 调整豁免调整豁免调整豁免 力量12+1+1 敏捷16+3+3 体质15+2+2 智力4-3-3 感知10+0+0 魅力9-1-1 免疫 暗蚀，毒素；力竭，恐慌，麻痹，中毒 感官 黑暗视觉60尺，被动察觉10 语言 理解你说的语言 CR 无（XP0；PB等于你的熟练加值） 特质Traits 腐灭灵光Festering Aura（仅腐尸）。',
    ],
    repeatAndEnd: [
      '当你施展法术时，从幽体、腐尸、骸骨中选择一类，该生物会显现为你所选的那类形态的亡灵生物，其数据中的部分特性也受此影响。',
      '该生物会在生命值降为0或是法术结束时消失。',
      '它在战斗中使用你的先攻，并在你回合结束后立即行动。',
      '如果你不发令，它将执行回避动作并用移动力远离危险。',
      '体质豁免：DC等于你的法术豁免DC，源自灵魄的5尺光环区域内开始其回合的每名生物（除你以外）。',
      '失败：该生物陷入中毒状态，直至其下个回合开始。',
      '在其回合结束时，若灵魄还处于物件内，则其被挪到距离最近的未占据空间，且每因此移动5尺便受到1d10力场伤害。',
      '命中：1d8+3+法术环阶的暗蚀伤害，且目标陷入恐慌状态直至其下个回合结束。',
      '若目标已陷入中毒状态，则其还会陷入麻痹状态，直至其下个回合结束。',
    ],
    upcasting: [
      '升环施法。',
      '该生物的数据使用新的法术环阶。',
      '亡灵灵魄Undead Spirit 中型亡灵，中立 AC 11+法术环阶 HP 30（仅幽体和腐尸）或20（仅骸骨）+每比三环高一法术环阶10 速度 30尺；飞行40尺（悬浮；仅幽体） 调整豁免调整豁免调整豁免 力量12+1+1 敏捷16+3+3 体质15+2+2 智力4-3-3 感知10+0+0 魅力9-1-1 免疫 暗蚀，毒素；力竭，恐慌，麻痹，中毒 感官 黑暗视觉60尺，被动察觉10 语言 理解你说的语言 CR 无（XP0；PB等于你的熟练加值） 特质Traits 腐灭灵光Festering Aura（仅腐尸）。',
      '灵魄发动等于法术环阶一半次数的攻击（向下取整）。',
      '命中：1d8+3+法术环阶的暗蚀伤害，且目标陷入恐慌状态直至其下个回合结束。',
      '命中：2d4+3+法术环阶的暗蚀伤害。',
      '命中：1d6+3+法术环阶的挥砍伤害。',
    ],
    visibility: [
      '其使用下文亡灵灵魄的数据，并会在施法距离内一处你可见的未占据空间中显现。',
      '亡灵灵魄Undead Spirit 中型亡灵，中立 AC 11+法术环阶 HP 30（仅幽体和腐尸）或20（仅骸骨）+每比三环高一法术环阶10 速度 30尺；飞行40尺（悬浮；仅幽体） 调整豁免调整豁免调整豁免 力量12+1+1 敏捷16+3+3 体质15+2+2 智力4-3-3 感知10+0+0 魅力9-1-1 免疫 暗蚀，毒素；力竭，恐慌，麻痹，中毒 感官 黑暗视觉60尺，被动察觉10 语言 理解你说的语言 CR 无（XP0；PB等于你的熟练加值） 特质Traits 腐灭灵光Festering Aura（仅腐尸）。',
    ],
    contentWarnings: [],
  },
}
