import type { ReactNode } from 'react'

type Layout = 'projects' | 'agents' | 'repos' | 'members' | 'team' | 'plain'

interface DataTableProps {
  layout?: Layout
  columns: ReactNode[]
  children: ReactNode
  className?: string
}

/** 表格：表头 12px 元信息，行间单条行界，主列更宽。 */
export function DataTable({ layout = 'plain', columns, children, className = '' }: DataTableProps) {
  return (
    <ul className={`table table--${layout} ${className}`.trim()}>
      <li className="table__row table__row--head" aria-hidden>
        {columns.map((column, index) => (
          <span key={index}>{column}</span>
        ))}
      </li>
      {children}
    </ul>
  )
}

export function TableRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <li className={`table__row ${className}`.trim()}>{children}</li>
}

export function TableCell({
  children,
  end,
  className = '',
}: {
  children: ReactNode
  end?: boolean
  className?: string
}) {
  return (
    <span className={`table__cell${end ? ' table__cell--end' : ''} ${className}`.trim()}>
      {children}
    </span>
  )
}
