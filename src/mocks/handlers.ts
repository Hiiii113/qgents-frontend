import { identityHandlers } from './identity'
import { agentHandlers } from './agents'
import { projectChatHandlers } from './projectChat'
import { memoryHandlers } from './memory'
import { capabilityHandlers } from './capabilities'

export const handlers = [...identityHandlers, ...agentHandlers, ...projectChatHandlers, ...memoryHandlers, ...capabilityHandlers]
