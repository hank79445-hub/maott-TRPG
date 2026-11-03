/** User-confirmed utility-only exclusions. This is not a damage/control classifier. */
export const EXPLORATION_ONLY_OPENING_SPELLS = [
  'spare-the-dying','cure-wounds','healing-word','goodberry','aid','lesser-restoration',
  'arcane-vigor','mass-healing-word','aura-of-vitality','revivify','remove-curse','gentle-repose',
  'guidance','resistance','blade-ward','bless','heroism','false-life','mage-armor',
  'shield-of-faith','protection-from-evil-and-good','sanctuary','barkskin','warding-bond',
  'blur','mirror-image','beacon-of-hope','enhance-ability','protection-from-poison',
  'protection-from-energy','haste','darkvision','jump','longstrider','expeditious-retreat',
  'misty-step','spider-climb','fly','gaseous-form','blink','water-breathing','water-walk',
  'pass-without-trace','invisibility','meld-into-stone','rope-trick','detect-evil-and-good',
  'detect-magic','detect-poison-and-disease','comprehend-languages','find-traps',
  'locate-animals-or-plants','locate-object','see-invisibility','nondetection',
  'arcanist-s-magic-aura','beast-sense','message','speak-with-animals','sending','tongues',
  'speak-with-dead','light','dancing-lights','druidcraft','elementalism','prestidigitation',
  'thaumaturgy','mage-hand','unseen-servant','disguise-self','continual-flame',
  'purify-food-and-drink','create-food-and-water','create-or-destroy-water',
] as const
const excluded = new Set<string>(EXPLORATION_ONLY_OPENING_SPELLS)
export const excludesAutomaticOpening = (spellId: string) => excluded.has(spellId)
export const EXPLORATION_OPENING_HELP = '此法术属于已确认的探索辅助名单，请使用普通／专用探索施法；不会自动申请战斗开场。动作、材料、法术位和审核仍按原规则处理；GM仍可独立开启战斗。'
