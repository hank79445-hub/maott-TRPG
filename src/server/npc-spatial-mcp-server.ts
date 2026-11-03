import { McpServer } from '@modelcontextprotocol/server'
import { spatialToolSchemas, type SpatialToolName } from '../persistence/npc-spatial-tool-schema'
export function createSpatialToolServer(
  run: (name: SpatialToolName, input: unknown) => Promise<unknown>,
) {
  const server = new McpServer({ name: 'trpg-npc-spatial', version: '0.1.0' })
  for (const name of Object.keys(spatialToolSchemas) as SpatialToolName[]) {
    server.registerTool(
      'npc.' + name,
      {
        description: (
          {
            observe: '读取本NPC可感知及最后所见空间信息',
            capabilities: '读取本NPC能力摘要或单项规则',
            route: '程序查询有限移动路线',
            propose: '提议移动、互动或旅行，不能自行批准',
            task: '查看、暂停或取消自己的任务',
            events: '读取本NPC空间事件游标',
          } as const
        )[name],
        inputSchema: spatialToolSchemas[name],
        annotations: {
          readOnlyHint: !['propose', 'task'].includes(name),
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async (input: unknown) => {
        try {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(await run(name, input)) }],
          }
        } catch (e) {
          return {
            isError: true,
            content: [
              { type: 'text' as const, text: e instanceof Error ? e.message : '工具请求失败' },
            ],
          }
        }
      },
    )
  }
  return server
}
