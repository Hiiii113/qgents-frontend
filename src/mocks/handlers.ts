import { identityHandlers } from './identity'
import { agentHandlers } from './agents'
import { agentRunHandlers } from './agentRuns'
import { projectChatHandlers } from './projectChat'
import { memoryHandlers } from './memory'
import { capabilityHandlers } from './capabilities'

export const handlers = [
  ...identityHandlers,
  ...agentHandlers,
  ...agentRunHandlers,
  ...projectChatHandlers,
  ...memoryHandlers,
  ...capabilityHandlers,
]
