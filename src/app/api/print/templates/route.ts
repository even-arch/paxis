import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

export async function GET(req: NextRequest) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const docType = req.nextUrl.searchParams.get('docType')
  const templates = await prisma.pRN_Template.findMany({
    where: docType ? { docType } : undefined,
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, name: true, docType: true, isDefault: true, isSystem: true, createdAt: true, freeFields: true },
  })
  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, docType, htmlBody, freeFields, setAsDefault, sealPlacements } = await req.json() as {
    name: string
    docType: string
    htmlBody: string
    freeFields: { key: string; label: string; defaultValue: string }[]
    setAsDefault?: boolean
    sealPlacements?: object[]
  }

  if (!name || !docType || !htmlBody) {
    return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
  }

  // 若設為預設，先把同 docType 的其他模板取消預設
  if (setAsDefault) {
    await prisma.pRN_Template.updateMany({
      where: { docType, isDefault: true },
      data: { isDefault: false },
    })
  }

  const template = await prisma.pRN_Template.create({
    data: {
      name,
      docType,
      htmlBody,
      fieldMap: {},
      freeFields,
      isDefault: setAsDefault ?? false,
      sealPlacements: sealPlacements ?? [],
    },
  })

  return NextResponse.json({ id: template.id })
}
