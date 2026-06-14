import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import CostForm from '@/modules/cost/CostForm'

type Props = { params: { id: string } }

export default async function EditCostPage({
  params }: Props) {
    const [sheet, products] = await Promise.all([
    prisma.cOST_Sheet.findUnique({ where: { id: Number(params.id) } }),
    prisma.pRD_Product.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, sku: true, modelNo: true, unit: true,
        unitPerInner: true, unitPerCarton: true, cbm: true,
        grossWeight: true, netWeight: true, htsCode: true, countryOfOrigin: true,
      },
      orderBy: { name: 'asc' },
    }),
  ])

  if (!sheet) notFound()

  const n = (v: unknown) => v ? String(parseFloat(String(v))) : ''

  const initialData = {
    name: sheet.name,
    productId: String(sheet.productId),
    fobPrice: n(sheet.fobPrice),
    fobCurrency: sheet.fobCurrency,
    fobExRate: n(sheet.fobExRate),
    countryOfOrigin: sheet.countryOfOrigin ?? '',
    portOfLoading: sheet.portOfLoading ?? '',
    htsCode: sheet.htsCode ?? '',
    dutyRate: n(sheet.dutyRate),
    oceanFreight: n(sheet.oceanFreight),
    insurance: n(sheet.insurance),
    agentFee: n(sheet.agentFee),
    consolidation: n(sheet.consolidation),
    deconsolidation: n(sheet.deconsolidation),
    userFee: n(sheet.userFee),
    harborFee: n(sheet.harborFee),
    otherCharge: n(sheet.otherCharge),
    otherChargeNote: sheet.otherChargeNote ?? '',
    sellingPrice: n(sheet.sellingPrice),
    container40ftQty: sheet.container40ftQty ? String(sheet.container40ftQty) : '',
    container40ftPcs: sheet.container40ftPcs ? String(sheet.container40ftPcs) : '',
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">編輯試算表</h1>
      <CostForm products={products} initialData={initialData} sheetId={params.id} />
    </div>
  )
}
