import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'

type Params = { params: { id: string; docId: string } }

// GET：下載/檢視原始檔案
export async function GET(_req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const docId = Number(params.docId)
  if (isNaN(docId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const doc = await prisma.sLS_CustomsDoc.findUnique({
    where: { id: docId },
    select: { fileName: true, mimeType: true, fileBase64: true, shipmentId: true },
  })
  if (!doc || doc.shipmentId !== Number(params.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const buffer = Buffer.from(doc.fileBase64, 'base64')
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': doc.mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(doc.fileName)}"`,
    },
  })
}

// DELETE：移除歸檔文件（不影響已套用過的業務資料，如已建立的費用項目/已回填的 HTS Code）
export async function DELETE(_req: NextRequest, { params }: Params) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const docId = Number(params.docId)
  if (isNaN(docId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const doc = await prisma.sLS_CustomsDoc.findUnique({ where: { id: docId }, select: { shipmentId: true } })
  if (!doc || doc.shipmentId !== Number(params.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.sLS_CustomsDoc.delete({ where: { id: docId } })
  return NextResponse.json({ ok: true })
}
