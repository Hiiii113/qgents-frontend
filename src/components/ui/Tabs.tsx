interface TabItem {
  key: string
  label: string
}

interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (key: string) => void
  label: string
}

/** 页签：当前项 2px 朱砂下划线，切换状态由调用方放进 URL 或 state。 */
export function Tabs({ items, value, onChange, label }: TabsProps) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          className="tab"
          aria-selected={value === item.key}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
