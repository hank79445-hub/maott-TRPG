// Configuration totals are independent from per-action batches and active token counts.
export const NPC_LIMIT = 100
export const BROADCAST_LIMIT = 1000
export const AUTHORING_BYTES = 2 * 1024 * 1024
export const AUTHORING_BRIEF_CHARACTERS = 30000
export const AUTHORING_LIMITS = {
  scenes: 30,
  points: 60,
  ground: 60,
  floors: 24,
  walls: 200,
  arrivals: 50,
  battles: 100,
  battleMembers: 40,
  manualBroadcasts: 200,
} as const
export const SCENE_CAPACITY = { tokens: 100, walls: 400 } as const
export function assertCapacity(path: string, current: number, maximum: number) {
  if (current > maximum)
    throw Error(`${path}：当前 ${current}，上限 ${maximum}；请精简配置，不会自动截断内容`)
}
export function assertAuthoringBytes(text: string) {
  if (new TextEncoder().encode(text).length > AUTHORING_BYTES)
    throw Error(`创作JSON超过2MiB（${AUTHORING_BYTES}字节），请精简或分章生成`)
}
