export const NPC_CLASS_NAMES: Record<string, string> = {
  barbarian: '野蛮人',
  bard: '吟游诗人',
  cleric: '牧师',
  druid: '德鲁伊',
  fighter: '战士',
  monk: '武僧',
  paladin: '圣武士',
  ranger: '游侠',
  rogue: '游荡者',
  sorcerer: '术士',
  warlock: '邪术师',
  wizard: '法师',
}
export const NPC_CLASS_COVERAGE = Object.fromEntries(
  Object.keys(NPC_CLASS_NAMES).map((id) => [
    id,
    id === 'cleric' ? 'srd-priest' : id === 'wizard' ? 'srd-mage' : 'custom-class-' + id,
  ]),
)
