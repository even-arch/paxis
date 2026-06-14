import { notFound } from 'next/navigation'
import { masterPrisma } from '@/lib/master-db'

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string }
}) {
  const org = await masterPrisma.oRG.findUnique({
    where: { slug: params.orgSlug },
    select: { status: true },
  })

  if (!org || org.status === 'suspended') notFound()

  return <>{children}</>
}
