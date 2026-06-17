'use client'

import { useParams } from 'next/navigation'
import { orgPath } from './org-path'

export function useOrgPath() {
  const params = useParams<{ orgSlug?: string }>()
  const slug = typeof params?.orgSlug === 'string' ? params.orgSlug : ''

  return (path: string) => {
    if (!slug) return path
    return orgPath(slug, path)
  }
}
