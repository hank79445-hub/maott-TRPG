/** Ownership of open interpretation; this never bypasses concrete spell rules. */
export const GM_SPELL_IDS = [
  'druidcraft', 'elementalism', 'mage-hand', 'mending', 'message', 'minor-illusion',
  'prestidigitation', 'thaumaturgy', 'comprehend-languages', 'detect-evil-and-good',
  'detect-magic', 'detect-poison-and-disease', 'disguise-self', 'identify',
  'illusory-script', 'silent-image', 'speak-with-animals', 'animal-messenger',
  'augury', 'beast-sense', 'detect-thoughts', 'find-traps', 'locate-animals-or-plants',
  'locate-object', 'clairvoyance', 'major-image', 'sending', 'speak-with-dead',
  'speak-with-plants', 'tongues',
] as const
export function spellWorkflowPolicy(id: string) {
  if (!(GM_SPELL_IDS as readonly string[]).includes(id)) return undefined
  return {
    kind: 'gm' as const,
    maxQuestions: id === 'speak-with-dead' ? 5 : 1,
    instruction: id === 'augury'
      ? '仅由GM确认未来30分钟计划的吉／凶／吉凶并存／无；重复施法概率由程序记录。'
      : id === 'speak-with-dead'
        ? '最多5问；仅回答生前知识，敌对尸体可含糊或说谎；同一尸体10日内不可再次施法。'
        : ['minor-illusion', 'silent-image', 'major-image', 'disguise-self', 'illusory-script'].includes(id)
          ? '幻象与识破结果按观察者分别记录；不自动让所有人识破，也不自动造成真实伤害。'
          : '由GM确认可获知信息或实际叙事结果；不自动揭露秘密，不授权NPC行为。',
  }
}
