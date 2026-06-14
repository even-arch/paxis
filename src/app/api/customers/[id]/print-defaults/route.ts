import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

type Ctx = { params: { id: string } }

export async function GET(req: NextRequest, { params }: Ctx) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const customerId = Number(params.id)
  const docType = req.nextUrl.searchParams.get('docType') ?? 'SLS_PI'

  const record = await prisma.pRN_CustomerDefault.findUnique({
    where: { customerId_docType: { customerId, docType } },
  })

  return NextResponse.json({ freeFields: record?.freeFields ?? null })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const customerId = Number(params.id)
  const { docType = 'SLS_PI', freeFields } = await req.json() as {
    docType?: string
    freeFields: Record<string, string>
  }

  const record = await prisma.pRN_CustomerDefault.upsert({
    where: { customerId_docType: { customerId, docType } },
    create: { customerId, docType, freeFields },
    update: { freeFields },
  })

  return NextResponse.json({ ok: true, id: record.id })
}
