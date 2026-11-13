/**
 * 项目长期记忆 —— 项目目录下的 memory.md 单文件。
 *
 * 写入只发生在聊天里：项目管理员确认后由 Qgent 的 memory 工具执行。前端只读。
 */
export interface ProjectMemory {
  projectId: string
  content: string
  /** 项目尚未写入时为空 */
  updatedAt: string | null
}
