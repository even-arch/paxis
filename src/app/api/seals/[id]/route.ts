import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

type Ctx = { params: { id: string } }

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.sYS_Seal.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}
