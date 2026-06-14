import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

type Params = { params: { id: string; productRelId: string } }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.productRelId)
  const customerId = Number(params.id)

  const rel = await prisma.cUS_CustomerProduct.findUnique({ where: { id } })
  if (!rel || rel.customerId !== customerId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.cUS_CustomerProduct.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
