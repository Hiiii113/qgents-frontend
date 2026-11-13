import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { App, Button } from 'antd'
import { PATHS } from '@/routes/paths'
import { useAuth } from '@/context/AuthContext'
import { teamApi } from '@/api'
import { formatApiError } from '@/utils/formatApiError'
import { WorkspacePage } from '@/components/WorkspacePage'
import './CreateTeamPage.css'

/**
 * 创建团队：先创建团队，再按返回的 teamId 上传头像。
 * 创建者是团队所有者；成员邀请在团队设置里继续。
 */
export default function CreateTeamPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const client = useQueryClient()
  const { setHasTeam } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAvatarPick(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('头像必须是图片文件')
      return false
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('头像大小不能超过 5MB')
      return false
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setError(null)
    return false
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setSubmitting(true)

    try {
      const team = await teamApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
      })
      // 选了头像：创建成功后用返回的 teamId 上传，确认接口直接写入团队头像
      if (avatarFile) {
        setAvatarUploading(true)
        try {
          const credential = await teamApi.avatarCredential(team.id, {
            mediaType: avatarFile.type,
            sizeBytes: avatarFile.size,
          })
          const putRes = await fetch(credential.uploadUrl, {
            method: 'PUT',
            body: await avatarFile.arrayBuffer(),
          })
          if (!putRes.ok) throw new Error(`头像上传失败（${putRes.status}）`)
          await teamApi.avatarConfirm(team.id, credential.objectKey)
        } catch {
          // 消息提示由应用层显示，跳转到团队后仍可看到上传失败。
          void message.warning('团队已创建，但头像未能上传。请在团队设置中重新上传。')
        } finally {
          setAvatarUploading(false)
        }
      }
      void client.invalidateQueries({ queryKey: ['teams', 'mine'] })
      setHasTeam(true)
      navigate(PATHS.teamDetail(team.id), { replace: true })
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <WorkspacePage title="创建新团队" description="创建后你是团队所有者，可以创建项目并邀请成员。">
      <form className="create-team__form" onSubmit={handleSubmit}>
        {/* 头像 —— 创建成功后回写；本地先预览 */}
        <div className="create-team__avatar-row">
          <label
            className="create-team__avatar"
            title={avatarPreview ? '点击更换头像' : '上传头像'}
          >
            {avatarPreview ? (
              <img className="create-team__avatar-preview" src={avatarPreview} alt="团队头像预览" />
            ) : (
              <CameraIcon />
            )}
            <input
              type="file"
              aria-label={avatarPreview ? '更换团队头像' : '上传团队头像'}
              accept="image/*"
              hidden
              disabled={avatarUploading}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleAvatarPick(file)
                e.target.value = ''
              }}
            />
          </label>
          <div className="create-team__avatar-hint">
            <span className="create-team__label">团队头像</span>
            <p>可选，不超过 5MB；上传失败不影响创建。</p>
          </div>
        </div>

        {error && (
          <p className="create-team__error" role="alert">
            {error}
          </p>
        )}

        <div className="create-team__field">
          <label className="create-team__label" htmlFor="create-team-name">
            团队名称 <em>*</em>
          </label>
          <input
            id="create-team-name"
            className="create-team__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：前端攻坚小组"
            required
          />
        </div>

        <div className="create-team__field">
          <label className="create-team__label" htmlFor="create-team-description">
            团队简介
          </label>
          <textarea
            id="create-team-description"
            className="create-team__input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="描述团队用途、协作方向"
            rows={3}
          />
        </div>

        <div className="create-team__actions">
          <Button autoInsertSpace={false} onClick={() => navigate(PATHS.APP)}>
            取消
          </Button>
          <Button type="primary" htmlType="submit" disabled={submitting || !name.trim()}>
            {submitting ? '创建中…' : '创建团队'}
          </Button>
        </div>
      </form>
    </WorkspacePage>
  )
}

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.2-1.8A1 1 0 0 1 10.5 4h3a1 1 0 0 1 .8.4L15.5 6h2A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-9z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
