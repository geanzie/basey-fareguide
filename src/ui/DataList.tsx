'use client'

import { memo, type ReactNode } from 'react'
import { FileText } from 'lucide-react'
import Card from './Card'
import EmptyState from './EmptyState'
import { ListSkeleton } from './Skeleton'

export interface DataListColumn<Row> {
  key: string
  label: string
  render?: (row: Row) => ReactNode
  className?: string
}

interface Props<Row> {
  columns: DataListColumn<Row>[]
  data: Row[]
  loading?: boolean
  emptyMessage?: string
  getRowKey?: (row: Row, index: number) => string
  className?: string
}

/** Responsive tabular data: stacked cards below lg, table on lg+. Replaces ResponsiveTable. */
function DataListInner<Row extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data available',
  getRowKey,
  className = '',
}: Props<Row>) {
  if (loading) return <ListSkeleton count={4} />

  if (!data || data.length === 0) {
    return <EmptyState icon={FileText} title={emptyMessage} />
  }

  const cell = (col: DataListColumn<Row>, row: Row) =>
    col.render ? col.render(row) : (row[col.key] as ReactNode)

  return (
    <div className={className}>
      {/* Desktop table */}
      <Card padded={false} className="hidden overflow-x-auto lg:block">
        <table className="min-w-full divide-y divide-surface-border">
          <thead className="bg-surface-alt">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted ${col.className ?? ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {data.map((row, i) => (
              <tr key={getRowKey ? getRowKey(row, i) : i} className="transition-colors hover:bg-surface-alt">
                {columns.map((col) => (
                  <td key={col.key} className={`whitespace-nowrap px-6 py-4 text-sm text-ink-body ${col.className ?? ''}`}>
                    {cell(col, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Stacked cards */}
      <div className="flex flex-col gap-2.5 lg:hidden">
        {data.map((row, i) => (
          <Card key={getRowKey ? getRowKey(row, i) : i}>
            {columns.map((col) => {
              const value = cell(col, row)
              if (value == null || value === '') return null
              return (
                <div
                  key={col.key}
                  className="flex items-start justify-between gap-3 border-b border-surface-alt py-2 last:border-b-0"
                >
                  <span className="w-1/3 shrink-0 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    {col.label}
                  </span>
                  <span className={`flex-1 text-right text-sm text-ink-strong ${col.className ?? ''}`}>{value}</span>
                </div>
              )
            })}
          </Card>
        ))}
      </div>
    </div>
  )
}

const DataList = memo(DataListInner) as typeof DataListInner
export default DataList
