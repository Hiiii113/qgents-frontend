import { useId, useState } from 'react'
import { Icon } from './Icon'
import { Popover } from './Popover'

export interface MenuSelectOption<T extends string = string> {
  value: T
  label: string
  description?: string
}

interface MenuSelectProps<T extends string = string> {
  value: T
  options: readonly MenuSelectOption<T>[]
  onChange: (value: T) => void
  'aria-label': string
  /** ghost 用于表格行内对齐；pill 用于工具栏筛选；field 用于表单行内控件。 */
  variant?: 'ghost' | 'pill' | 'field'
  align?: 'start' | 'end'
  disabled?: boolean
  className?: string
}

/**
 * 自定义下拉菜单选择：替代原生 <select>，在表格行内可做到与纯文本像素级左对齐，
 * 弹出浮层支持选项说明与当前选中勾号。
 */
export function MenuSelect<T extends string = string>({
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
  variant = 'ghost',
  align = 'start',
  disabled = false,
  className = '',
}: MenuSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const current = options.find((option) => option.value === value) ?? options[0]

  return (
    <span className={`anchored menu-select menu-select--${variant} ${className}`.trim()}>
      <button
        type="button"
        className="menu-select__trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="menu-select__label">{current?.label ?? value}</span>
        <Icon name="chevron" size={13} className="menu-select__chevron" aria-hidden />
      </button>
      <Popover
        open={open && !disabled}
        onClose={() => setOpen(false)}
        label={ariaLabel}
        align={align}
        className="menu-select__popover"
      >
        <div id={listId} role="listbox" aria-label={ariaLabel} className="menu-select__list">
          {options.map((option) => {
            const selected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                className={`menu-select__option${selected ? ' is-selected' : ''}`}
                onClick={() => {
                  setOpen(false)
                  if (option.value !== value) onChange(option.value)
                }}
              >
                <span className="menu-select__option-body">
                  <span className="menu-select__option-label">{option.label}</span>
                  {option.description ? (
                    <span className="menu-select__option-desc">{option.description}</span>
                  ) : null}
                </span>
                {selected ? (
                  <Icon name="check" size={14} className="menu-select__check" aria-hidden />
                ) : null}
              </button>
            )
          })}
        </div>
      </Popover>
    </span>
  )
}
