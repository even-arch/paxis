import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import ManualSyncButton from './ManualSyncButton'

export default async function PatiscoSyncPage() {
  const logs = await prisma.sYS_PatiscoSync.findMany({
    orderBy: { syncedAt: 'desc' },
    take: 30,
  })

  const stats = {
    total: logs.length,
    ok: logs.filter(l => l.status === 'ok').length,
    partial: logs.filter(l => l.status === 'partial').length,
    error: logs.filter(l => l.status === 'error').length,
    skipped: logs.filter(l => l.status === 'skipped').length,
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Patisco 同步狀態</h1>
          <p className="text-sm text-gray-500 mt-1">每 5 分鐘自動同步一次 Patisco 已確認 PI</p>
        </div>
        <ManualSyncButton />
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: '成功', value: stats.ok, color: 'bg-green-100 text-green-700' },
          { label: '部分', value: stats.partial, color: 'bg-yellow-100 text-yellow-700' },
          { label: '錯誤', value: stats.error, color: 'bg-red-100 text-red-700' },
          { label: '已跳過', value: stats.skipped, color: 'bg-gray-100 text-gray-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-xs text-gray-500">{s.label}</p>
            <span className={`inline-block mt-1 px-3 py-1 rounded-full text-lg font-bold ${s.color}`}>
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* 同步紀錄 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">最近 30 筆同步紀錄</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs">
              <th className="text-left px-4 py-2">Patisco PI 號</th>
              <th className="text-left px-4 py-2">觸發來源</th>
              <th className="text-center px-4 py-2">狀態</th>
              <th className="text-left px-4 py-2">時間</th>
              <th className="text-left px-4 py-2">備註</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {logs.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">尚無同步紀錄</td></tr>
            )}
            {logs.map(log => {
              const statusMap: Record<string, string> = {
                ok: 'bg-green-100 text-green-700',
                partial: 'bg-yellow-100 text-yellow-700',
                error: 'bg-red-100 text-red-600',
                skipped: 'bg-gray-100 text-gray-500',
              }
              return (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">{log.patiscoDocNo}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      log.source === 'cron' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                    }`}>
                      {log.source === 'cron' ? '⏱ 自動' : '🔌 Webhook'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusMap[log.status] ?? ''}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{formatDate(log.syncedAt)}</td>
                  <td className="px-4 py-2 text-gray-400 text-xs truncate max-w-xs">
                    {log.errorMsg ?? (
                      Array.isArray((log.result as {length?: number} | null)?.length) ? `${(log.result as unknown[]).length} 項` : '-'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 設定說明 */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-semibold mb-2">環境變數設定（Vercel Dashboard → Environment Variables）</p>
        <div className="space-y-1 font-mono text-xs">
          <p>PATISCO_USERNAME = your-login-id</p>
          <p>PATISCO_PASSWORD = your-password</p>
          <p>PATISCO_MCP_URL = https://mcp.patisco.com:9443</p>
          <p>PATISCO_WEBHOOK_SECRET = （選用，Webhook 簽名驗證）</p>
          <p>CRON_SECRET = （選用，Cron 安全驗證）</p>
        </div>
      </div>
    </div>
  )
}
