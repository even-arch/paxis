export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'

export default async function DashboardPage() {
    const today = new Date()
  const in14Days = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  const [
    productCount,
    supplierCount,
    customerCount,
    lowStockItems,
    pendingPOs,
    ordersNeedingPI,
    upcomingShipments,
    recentReceipts,
    // 財務
    pendingPayables,
    pendingReceivables,
    thisMonthReceivables,
    // Patisco 同步
    lastSync,
    syncErrorCount,
  ] = await Promise.all([
    prisma.pRD_Product.count({ where: { isActive: true } }),
    prisma.sUP_Supplier.count({ where: { isActive: true } }),
    prisma.cUS_Customer.count({ where: { isActive: true } }),

    prisma.iNV_Stock.findMany({
      where: { quantity: { gt: 0 } },
      include: { product: { select: { id: true, name: true, sku: true, safetyStock: true } } },
      take: 100,
    }).then(stocks =>
      stocks.filter(s => s.product.safetyStock > 0 && (s.quantity - s.reservedQty) <= s.product.safetyStock)
    ),

    prisma.pO_Order.findMany({
      where: { status: { in: [1, 2] } },
      include: { supplier: { select: { name: true } } },
      orderBy: { expectedDate: 'asc' },
      take: 5,
    }),

    prisma.sLS_Order.findMany({
      where: { status: 1 },
      include: {
        customer: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { customerRequestedShipDate: 'asc' },
      take: 5,
    }),

    prisma.sLS_PI.findMany({
      where: { status: 0, estimatedShipDate: { lte: in14Days } },
      include: { order: { include: { customer: { select: { name: true } } } } },
      orderBy: { estimatedShipDate: 'asc' },
      take: 5,
    }),

    prisma.pO_Receipt.findMany({
      where: { performedAt: { gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000) } },
      include: {
        order: { include: { supplier: { select: { name: true } } } },
        items: { include: { poItem: { include: { product: { select: { name: true } } } } } },
      },
      orderBy: { performedAt: 'desc' },
      take: 5,
    }),

    // 待付帳款（status=0 or 1）
    prisma.fIN_Payable.aggregate({
      where: { status: { in: [0, 1] } },
      _sum: { amountTWD: true },
      _count: true,
    }),

    // 待收帳款（status=0 or 1）
    prisma.fIN_Receivable.aggregate({
      where: { status: { in: [0, 1] } },
      _sum: { amountForeign: true },
      _count: true,
    }),

    // 本月已收款的匯差
    prisma.fIN_Receivable.aggregate({
      where: {
        status: 2,
        collectedAt: { gte: thisMonthStart },
        fxGainLoss: { not: null },
      },
      _sum: { fxGainLoss: true },
    }),

    // 最近一筆同步
    prisma.sYS_PatiscoSync.findFirst({
      orderBy: { syncedAt: 'desc' },
    }),

    // 同步錯誤數（過去 7 天）
    prisma.sYS_PatiscoSync.count({
      where: {
        status: 'error',
        syncedAt: { gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ])

  const poStatusLabel = (s: number) => s === 1 ? '已送出' : '部分到貨'

  const pendingPayTWD = Number(pendingPayables._sum.amountTWD ?? 0)
  const pendingRecTWD = Number(pendingReceivables._sum.amountForeign ?? 0)
  const fxGainLoss = Number(thisMonthReceivables._sum.fxGainLoss ?? 0)

  const syncMinutesAgo = lastSync
    ? Math.floor((today.getTime() - new Date(lastSync.syncedAt).getTime()) / 60000)
    : null

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">總覽</h1>

      {/* Patisco 同步狀態列 */}
      <div className="bg-white rounded-lg shadow px-5 py-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 font-medium">Patisco 同步</span>
          {lastSync ? (
            <>
              <span className={`inline-block w-2 h-2 rounded-full ${lastSync.status === 'error' ? 'bg-red-400' : 'bg-green-400'}`} />
              <span className="text-xs text-gray-600">
                {syncMinutesAgo === 0 ? '剛剛' : syncMinutesAgo! < 60 ? `${syncMinutesAgo} 分鐘前` : `${Math.floor(syncMinutesAgo! / 60)} 小時前`}
                　{lastSync.docType} {lastSync.patiscoDocNo}
              </span>
              {syncErrorCount > 0 && (
                <span className="text-xs text-red-500 font-medium">⚠ 近 7 天 {syncErrorCount} 筆錯誤</span>
              )}
            </>
          ) : (
            <span className="text-xs text-gray-400">尚無同步紀錄</span>
          )}
        </div>
        <Link href="/settings" className="text-xs text-blue-600 hover:underline">手動同步</Link>
      </div>

      {/* 數字摘要 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Link href="/products" className="bg-white rounded-lg shadow p-5 hover:shadow-md">
          <p className="text-xs text-gray-500">商品</p>
          <p className="text-2xl font-semibold text-gray-800 mt-1">{productCount}</p>
        </Link>
        <Link href="/suppliers" className="bg-white rounded-lg shadow p-5 hover:shadow-md">
          <p className="text-xs text-gray-500">供應商</p>
          <p className="text-2xl font-semibold text-gray-800 mt-1">{supplierCount}</p>
        </Link>
        <Link href="/customers" className="bg-white rounded-lg shadow p-5 hover:shadow-md">
          <p className="text-xs text-gray-500">客戶</p>
          <p className="text-2xl font-semibold text-gray-800 mt-1">{customerCount}</p>
        </Link>
        <Link href="/inventory?filter=low"
          className={`bg-white rounded-lg shadow p-5 hover:shadow-md ${lowStockItems.length > 0 ? 'border-l-4 border-red-400' : ''}`}>
          <p className="text-xs text-gray-500">低庫存警示</p>
          <p className={`text-2xl font-semibold mt-1 ${lowStockItems.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {lowStockItems.length}
          </p>
        </Link>
      </div>

      {/* 財務快覽 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Link href="/finance?tab=payable" className="bg-white rounded-lg shadow p-5 hover:shadow-md">
          <p className="text-xs text-gray-500">待付帳款（{pendingPayables._count} 筆）</p>
          <p className="text-xl font-semibold text-gray-800 mt-1">
            {pendingPayTWD.toLocaleString('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 })}
          </p>
        </Link>
        <Link href="/finance?tab=receivable" className="bg-white rounded-lg shadow p-5 hover:shadow-md">
          <p className="text-xs text-gray-500">待收帳款（{pendingReceivables._count} 筆）</p>
          <p className="text-xl font-semibold text-gray-800 mt-1">
            {pendingRecTWD.toLocaleString('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 })}
          </p>
        </Link>
        <Link href="/finance" className="bg-white rounded-lg shadow p-5 hover:shadow-md">
          <p className="text-xs text-gray-500">本月匯差</p>
          <p className={`text-xl font-semibold mt-1 ${fxGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {fxGainLoss >= 0 ? '+' : ''}{fxGainLoss.toLocaleString('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 })}
          </p>
        </Link>
      </div>

      {/* 三條輸入管道 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Link href="/purchases/import"
          className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 hover:border-purple-400 hover:shadow-md transition-all">
          <div className="flex items-center gap-3">
            <span className="text-xl">📄</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 text-sm">AI 匯入供應商訂單</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">上傳供應商 PI，AI 自動建立</p>
            </div>
            <span className="text-gray-400">→</span>
          </div>
        </Link>
        <Link href="/sales/import"
          className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-lg p-4 hover:border-teal-400 hover:shadow-md transition-all">
          <div className="flex items-center gap-3">
            <span className="text-xl">📋</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 text-sm">AI 匯入客戶訂單</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">上傳客戶 PO，AI 自動識別</p>
            </div>
            <span className="text-gray-400">→</span>
          </div>
        </Link>
        <Link href="/settings"
          className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-4 hover:border-orange-400 hover:shadow-md transition-all">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔄</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 text-sm">Patisco 同步</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">從 Patisco 拉取最新訂單</p>
            </div>
            <span className="text-gray-400">→</span>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 待處理：客戶訂單待發 PI */}
        <Section
          title="客戶訂單待發 PI"
          count={ordersNeedingPI.length}
          href="/sales?status=1"
          accentColor="text-blue-600"
          emptyText="目前沒有待發 PI 的訂單"
        >
          {ordersNeedingPI.map(o => (
            <ActionRow
              key={o.id}
              href={`/sales/${o.id}`}
              primary={o.orderNo}
              secondary={o.customer?.name ?? o.patiscoBuyerName ?? '未知客戶'}
              tag={o.customerRequestedShipDate
                ? `希望出貨：${formatDate(o.customerRequestedShipDate)}`
                : `${o._count.items} 項商品`
              }
              tagColor={
                o.customerRequestedShipDate && new Date(o.customerRequestedShipDate) < today
                  ? 'text-red-500' : 'text-gray-400'
              }
            />
          ))}
        </Section>

        {/* 即將出貨的 PI（14天內） */}
        <Section
          title="PI 預計出貨（14天內）"
          count={upcomingShipments.length}
          href="/sales"
          accentColor="text-purple-600"
          emptyText="近 14 天內沒有預計出貨的 PI"
        >
          {upcomingShipments.map(pi => {
            const daysLeft = pi.estimatedShipDate
              ? Math.ceil((new Date(pi.estimatedShipDate).getTime() - today.getTime()) / 86400000)
              : null
            const isOverdue = daysLeft !== null && daysLeft < 0
            const isUrgent = daysLeft !== null && daysLeft <= 3
            return (
              <ActionRow
                key={pi.id}
                href={`/sales/${pi.orderId}`}
                primary={pi.piNo}
                secondary={pi.order.customer?.name ?? pi.order.patiscoBuyerName ?? '未知客戶'}
                tag={daysLeft === null ? '' : isOverdue ? `逾期 ${-daysLeft} 天` : daysLeft === 0 ? '今天出貨' : `${daysLeft} 天後`}
                tagColor={isOverdue ? 'text-red-600 font-medium' : isUrgent ? 'text-amber-600 font-medium' : 'text-gray-400'}
              />
            )
          })}
        </Section>

        {/* 採購在途 */}
        <Section
          title="採購在途"
          count={pendingPOs.length}
          href="/purchases"
          accentColor="text-teal-600"
          emptyText="目前沒有在途供應商訂單"
        >
          {pendingPOs.map(po => (
            <ActionRow
              key={po.id}
              href={`/purchases/${po.id}`}
              primary={po.poNo}
              secondary={po.supplier.name}
              tag={po.expectedDate ? `預計到貨：${formatDate(po.expectedDate)}` : poStatusLabel(po.status)}
              tagColor={
                po.expectedDate && new Date(po.expectedDate) < today
                  ? 'text-red-500' : 'text-gray-400'
              }
            />
          ))}
        </Section>

        {/* 近期入庫 */}
        <Section
          title="近 7 天入庫"
          count={recentReceipts.length}
          href="/purchases"
          accentColor="text-green-600"
          emptyText="近 7 天無入庫紀錄"
        >
          {recentReceipts.map(r => {
            const productNames = r.items.map(i => i.poItem.product.name).slice(0, 2).join('、')
            const more = r.items.length > 2 ? ` 等 ${r.items.length} 項` : ''
            return (
              <ActionRow
                key={r.id}
                href={`/purchases/${r.orderId}`}
                primary={r.receiptNo}
                secondary={r.order.supplier.name}
                tag={productNames + more}
                tagColor="text-gray-400"
              />
            )
          })}
        </Section>

      </div>

      {/* 低庫存警示 */}
      {lowStockItems.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-700">低庫存警示</h2>
            <Link href="/inventory?filter=low" className="text-xs text-blue-600 hover:underline">查看全部</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {lowStockItems.slice(0, 6).map(s => {
              const avail = s.quantity - s.reservedQty
              return (
                <div key={s.productId} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <Link href={`/inventory/${s.productId}`} className="text-sm font-medium text-blue-600 hover:underline">
                      {s.product.name}
                    </Link>
                    {s.product.sku && <span className="text-xs text-gray-400 ml-1.5 font-mono">{s.product.sku}</span>}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-400 text-xs">安全庫存 {s.product.safetyStock}</span>
                    <span className={`font-medium ${avail <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      可用 {avail}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Section({
  title, count, href, accentColor, emptyText, children
}: {
  title: string; count: number; href: string; accentColor: string; emptyText: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-700">{title}</h2>
          {count > 0 && (
            <span className={`text-sm font-semibold ${accentColor}`}>{count}</span>
          )}
        </div>
        <Link href={href} className="text-xs text-blue-600 hover:underline">查看全部</Link>
      </div>
      {count === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-gray-400">{emptyText}</p>
      ) : (
        <div className="divide-y divide-gray-50">{children}</div>
      )}
    </div>
  )
}

function ActionRow({
  href, primary, secondary, tag, tagColor
}: {
  href: string; primary: string; secondary: string; tag: string; tagColor: string
}) {
  return (
    <div className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
      <div>
        <Link href={href} className="text-sm font-mono font-medium text-blue-600 hover:underline">{primary}</Link>
        <p className="text-xs text-gray-500 mt-0.5">{secondary}</p>
      </div>
      <span className={`text-xs ${tagColor} shrink-0 ml-4`}>{tag}</span>
    </div>
  )
}
