import {i18n as controlI18n} from '../app/i18n'
const {t:controlText}=controlI18n.global
import type { RoomView } from '../online/protocol'
import type { RoomQqSummary } from '../online/room-status-types'
export interface PreparationItem {
  id: string
  title: string
  detail: string
  status: 'ready' | 'attention' | 'unavailable' | 'optional' | 'unknown'
  blocking: boolean
  target: string
}
export function roomPreparation(v: RoomView, qq: RoomQqSummary | null) {
  const items: PreparationItem[] = []
  const add = (
    id: string,
    title: string,
    detail: string,
    status: PreparationItem['status'],
    target: string,
    blocking = false,
  ) => items.push({ id, title, detail, status, target, blocking })
  if (v.self.role !== 'gm') {
    const placed = v.ownCharacters.some((c) => v.scene?.tokens.some((t) => t.characterId === c.id))
    add('identity', controlText('projection.myIdentity'), v.self.nickname, 'ready', 'members')
    add(
      'control',
      controlText('projection.myControlledCharacters'),
      controlText('projection.charactersAssignedByTheGmOrApprovedThrough', {p0:(v.ownCharacters.length)}),
      v.ownCharacters.length ? 'ready' : 'attention',
      'character',
      !v.ownCharacters.length,
    )
    add(
      'entry',
      controlText('projection.mySceneEntry'),
      placed ? controlText('projection.characterIsOnThePublicMapAndReady') : controlText('projection.waitingForGmPartySetupAndCharacterEntry'),
      placed ? 'ready' : 'attention',
      'map',
      !placed,
    )
    return { ready: placed, items }
  }
  const a = v.world?.adventures[0],
    players = v.members.filter((m) => m.role === 'player' && !m.revoked)
  const party = a?.party ?? []
  const missing = party.filter((id) => !v.scene?.tokens.some((t) => t.characterId === id))
  const unassigned = players.filter(
    (m) => !m.characterIds.some((id) => v.characters.some((c) => c.id === id)),
  )
  add(
    'roles',
    controlText('projection.scriptCharacterSlots'),
    a?.sourceScript
      ? controlText('projection.scriptSlotsWereCheckedAtGameStartContinue')
      : controlText('projection.ordinaryRoomsDoNotRequireScriptSlotBinding'),
    'ready',
    'members',
  )
  add(
    'characters',
    controlText('projection.roomCharacters'),
    controlText('projection.charactersImportLocalWorkshopCharactersFirstRoomProgress', {p0:(v.characters.length)}),
    v.characters.length ? 'ready' : 'attention',
    'members',
    !v.characters.length,
  )
  add(
    'players',
    controlText('projection.playersAndControl'),
    players.length
      ? controlText('projection.playersWithoutAnAssignedCharacterTheGmCan', {p0:(players.length),p1:(unassigned.length)})
      : controlText('projection.noPlayersJoinedYetTheGmCanHost'),
    unassigned.length ? 'attention' : 'ready',
    'members',
  )
  add(
    'party',
    controlText('projection.adventureParty'),
    controlText('projection.partyCharactersSaveThePartyInSceneAnd', {p0:(party.length)}),
    party.length ? 'ready' : 'attention',
    'map',
    !party.length,
  )
  const placed = !!v.scene && party.length > 0 && !missing.length
  add(
    'entry',
    controlText('projection.sceneEntry'),
    placed
      ? controlText('projection.allPartyTokensPlaced', {p0:(v.scene!.name)})
      : missing.length
        ? controlText('projection.partyCharactersMissingFromTheCurrentSceneVerify', {p0:(missing.length)})
        : controlText('projection.chooseASceneAndFormallyEnterWithThe'),
    placed ? 'ready' : 'attention',
    'map',
    !placed,
  )
  const npcs = (a?.ai?.npcs ?? []).filter(
    (n) =>
      n.enabled &&
      !n.hidden &&
      n.sceneId === v.scene?.id &&
      !(n.initiallyAbsent && !n.appeared) &&
      !n.body?.dead &&
      (n.body?.hp ?? 1) > 0,
  )
  const missingNpcs = npcs.filter(
    (n) =>
      !v.scene?.tokens.some(
        (t) =>
          t.npcId === n.id ||
          (!!n.actorId && t.actorId === n.actorId) ||
          (!!n.characterId && t.characterId === n.characterId),
      ),
  )
  add(
    'npcs',
    controlText('projection.currentSceneNpcTokens'),
    controlText('projection.enabledNpcsWithoutAMatchingTokenHiddenAnd', {p0:(npcs.length),p1:(missingNpcs.length)}),
    missingNpcs.length ? 'attention' : 'ready',
    'ai',
  )
  const cfg = v.ai.settings
  const available = (ref?: string) =>
    ref ? !!v.ai.modelProfiles?.some((m) => m.name === ref) : v.ai.model.configured
  const missingModels = (a?.ai?.npcs ?? []).filter(
    (n) =>
      n.enabled &&
      n.npcType === 'important' &&
      n.controller === 'model' &&
      !available(n.modelRef || cfg.npcModelRef),
  )
  const narrationMissing = cfg.enabled && !available(cfg.narrationModelRef)
  add(
    'models',
    controlText('projection.aiModelReferencesOptional'),
    missingModels.length || narrationMissing
      ? controlText('projection.unavailableImportantNpcModelReferencesHumanGmWeb', {p0:(missingModels.length),p1:(narrationMissing ? '；旁白模型不可用' : '')})
      : v.ai.model.configured || v.ai.modelProfiles?.length
        ? controlText('projection.modelsAreConfiguredThisChecksReferencesOnlyVerify')
        : controlText('projection.noModelConfiguredHumanGmWebOnlyPlay'),
    missingModels.length || narrationMissing
      ? 'unavailable'
      : v.ai.model.configured || v.ai.modelProfiles?.length
        ? 'ready'
        : 'optional',
    'ai',
  )
  const refs = [cfg.defaultNarrationSkill, ...Object.values(cfg.sceneNarrationSkills ?? {})].filter(
    (x): x is string => !!x,
  )
  const missingSkills = refs.filter((id) => !cfg.narrationSkills?.some((s) => s.id === id))
  add(
    'skill',
    controlText('projection.narrationSkillOptional'),
    missingSkills.length
      ? controlText('projection.missingNarrationSkillReferencesChooseThemAgain', {p0:(missingSkills.length)})
      : refs.length
        ? controlText('projection.referencedSkillsDescribesConfirmedFactsOnly', {p0:(new Set(refs).size)})
        : controlText('projection.noSkillSpecifiedExistingNarrationSettingsApplyConfigure'),
    missingSkills.length ? 'unavailable' : refs.length ? 'ready' : 'optional',
    'ai',
  )
  add(
    'qq',
    controlText('projection.qqGroupBindingOptional'),
    !qq
      ? controlText('projection.connectionStateNotReceivedYetWebOnlyGames')
      : !qq.enabled
        ? controlText('projection.qqConnectionIsNotEnabledLocallyWebOnly')
        : controlText('projection.requiredBotsBoundToThisRoomConnectedPush', {p0:(qq.expectedBots ?? qq.boundBots),p1:(qq.boundBots),p2:(qq.connectedBots),p3:(qq.pausedBots)}),
    !qq
      ? 'unknown'
      : !qq.boundBots
        ? 'optional'
        : qq.connectedBots < qq.boundBots || qq.boundBots < (qq.expectedBots ?? qq.boundBots)
          ? 'attention'
          : 'ready',
    'integration',
  )
  add(
    'pairing',
    controlText('projection.qqPlayerPairingOptional'),
    qq?.boundBots
      ? controlText('projection.playersConnectedToAtLeastOneRequiredBot', {p0:(qq.players),p1:(qq.pairedPlayers),p2:(qq.fullyPairedPlayers)})
      : controlText('projection.bindTheQqGroupFirstPairingIsUnnecessary'),
    qq?.boundBots ? (qq.fullyPairedPlayers < qq.players ? 'attention' : 'ready') : 'optional',
    'members',
  )
  return { ready: !items.some((i) => i.blocking), items }
}
