type Props = {
  label: string
  field: string
  sort: string
  dir: 'asc' | 'desc'
  buildUrl: (sort: string, dir: 'asc' | 'desc') => string
  align?: 'left' | 'right' | 'center'
  className?: string
}

export default function SortableHeader({ label, field, sort, dir, buildUrl, align = 'left', className = '' }: Props) {
  const isActive = sort === field
  const nextDir = isActive && dir === 'asc' ? 'desc' : 'asc'
  const href = buildUrl(field, nextDir)

  const indicator = isActive ? (dir === 'asc' ? ' ↑' : ' ↓') : ''
  const textAlign = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'

  return (
    <th className={`px-4 py-3 font-medium ${textAlign} ${className}`}>
      <a href={href} className={`inline-flex items-center gap-0.5 hover:text-blue-600 select-none whitespace-nowrap ${isActive ? 'text-blue-600' : 'text-gray-600'}`}>
        {label}{indicator && <span className="text-xs">{indicator}</span>}
        {!isActive && <span className="text-gray-300 text-xs ml-0.5">↕</span>}
      </a>
    </th>
  )
}
