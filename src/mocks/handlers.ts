import { identityHandlers } from './identity'
import { projectChatHandlers } from './projectChat'
import { memoryHandlers } from './memory'
import { capabilityHandlers } from './capabilities'

export const handlers = [...identityHandlers, ...projectChatHandlers, ...memoryHandlers, ...capabilityHandlers]
