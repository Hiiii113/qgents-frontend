import { identityHandlers } from './identity'
import { agentHandlers } from './agents'
import { agentRunHandlers } from './agentRuns'
import { projectChatHandlers } from './projectChat'
import { directMessageHandlers } from './directMessage'
import { memoryHandlers } from './memory'
import { capabilityHandlers } from './capabilities'
import { mcpHandlers } from './mcp'

export const handlers = [
  ...identityHandlers,
  ...agentHandlers,
  ...agentRunHandlers,
  ...directMessageHandlers,
  ...projectChatHandlers,
  ...memoryHandlers,
  ...capabilityHandlers,
  ...mcpHandlers,
]
