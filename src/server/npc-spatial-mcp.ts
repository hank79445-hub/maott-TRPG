import { runNpcSpatialTool, type NpcToolBinding, type NpcToolHost } from './npc-spatial-tools'
import { createSpatialToolServer } from './npc-spatial-mcp-server'

/** Trusted host supplies identity and transactional callbacks; models never supply GM credentials. */
export function createNpcMcpServer(binding: NpcToolBinding, host: NpcToolHost) {
  const identity = Object.freeze({ ...binding })
  return createSpatialToolServer((name, input) => runNpcSpatialTool(identity, host, name, input))
}
