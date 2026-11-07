/**
 * 项目长期记忆 —— 项目目录下的 memory.md 单文件
 *
 * 正文只有一份，人工编辑和 Qgent 的 write_project_memory 都写这个文件。
 */

export interface ProjectMemory {
  projectId: string
  content: string
  /** 内容版本（正文 SHA-256），保存时带回，用于检测并发修改 */
  version: string
  updatedAt: string
}

export interface SaveProjectMemoryPayload {
  content: string
  version: string
}
