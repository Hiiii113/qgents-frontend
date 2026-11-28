import type { ReactNode } from 'react'

type Layout = 'projects' | 'agents' | 'repos' | 'items' | 'members' | 'team' | 'plain'

interface DataTableProps {
  layout?: Layout
  columns: ReactNode[]
  children: ReactNode
  className?: string
}

/** 表格：表头 12px 元信息，行间单条行界，主列更宽。 */
export function DataTable({ layout = 'plain', columns, children, className = '' }: DataTableProps) {
  return (
    <ul className={`table table--${layout} ${className}`.trim()} role="table">
      <li className="table__row table__row--head" role="row">
        {columns.map((column, index) => (
          <span key={index} role="columnheader">
            {column}
          </span>
        ))}
      </li>
      {children}
    </ul>
  )
}

export function TableRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <li className={`table__row ${className}`.trim()} role="row">
      {children}
    </li>
  )
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
    <span
      className={`table__cell${end ? ' table__cell--end' : ''} ${className}`.trim()}
      role="cell"
    >
      {children}
    </span>
  )
}
