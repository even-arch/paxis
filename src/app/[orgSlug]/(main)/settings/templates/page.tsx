export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import TemplatesClient from './TemplatesClient'

export default async function TemplatesPage() {
  const [customerDefaults, templates] = await Promise.all([
    prisma.pRN_CustomerDefault.findMany({
      include: { customer: { select: { id: true, name: true, shortName: true } } },
      orderBy: [{ docType: 'asc' }, { customer: { name: 'asc' } }],
    }),
    prisma.pRN_Template.findMany({
      orderBy: [{ docType: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, name: true, docType: true, isDefault: true, isSystem: true, createdAt: true },
    }),
  ])

  const defaultRows = customerDefaults.map(d => ({
    id: d.id,
    customerId: d.customerId,
    customerName: d.customer.name,
    customerShortName: d.customer.shortName,
    docType: d.docType,
    freeFields: d.freeFields as Record<string, string>,
    updatedAt: d.updatedAt.toISOString(),
  }))

  const templateRows = templates.map(t => ({
    id: t.id,
    name: t.name,
    docType: t.docType,
    isDefault: t.isDefault,
    isSystem: t.isSystem,
    createdAt: t.createdAt.toISOString(),
  }))

  return <TemplatesClient customerDefaults={defaultRows} templates={templateRows} />
}
