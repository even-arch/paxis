import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import PatiscoConfigForm from './PatiscoConfigForm'

export default async function PatiscoSyncPage() {
    const config = await prisma.sYS_PatiscoConfig.findFirst({
    where: { isActive: true },
    orderBy: { id: 'desc' },
  })

  const logs = await prisma.sYS_PatiscoSync.findMany({
    orderBy: { syncedAt: 'desc' },
    take: 30,
  })

  const stats = {
    ok: logs.filter(l => l.status === 'ok').length,
    partial: logs.filter(l => l.status === 'partial').length,
    error: logs.filter(l => l.status === 'error').length,
    skipped: logs.filter(l => l.status === 'skipped').length,
  }

  const configData = config ? {
    mcpUrl: config.mcpUrl,
    username: config.username ?? '',
    passwordSet: !!config.encryptedPass,
    apiKey: config.apiKey ?? '',
    userId: config.userId ?? '',
    jwtSet: !!config.encryptedJwt,
    jwtExpiresAt: config.jwtExpiresAt?.toISOString() ?? null,
    jwtExpired: config.jwtExpiresAt ? config.jwtExpiresAt < new Date() : false,
    webhookSecretSet: !!config.webhookSecret,
    cronSecretSet: !!config.cronSecret,
    lastTestedAt: config.lastTestedAt?.toISOString() ?? null,
    lastTestStatus: config.lastTestStatus ?? null,
    lastTestMsg: config.lastTestMsg ?? null,
  } : null

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Patisco 連線設定</h1>
        <p className="text-sm text-gray-500 mt-1">設定後每 5 分鐘自動同步 Patisco 已確認 PI</p>
      </div>

      {/* 設定表單 */}
      <PatiscoConfigForm initialConfig={configData} />

      {/* 同步統計 */}
      {logs.length > 0 && (
        <>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '成功', value: stats.ok, cls: 'bg-green-100 text-green-700' },
              { label: '部分', value: stats.partial, cls: 'bg-yellow-100 text-yellow-700' },
              { label: '錯誤', value: stats.error, cls: 'bg-red-100 text-red-600' },
              { label: '已跳過', value: stats.skipped, cls: 'bg-gray-100 text-gray-600' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-lg shadow p-4 text-center">
                <p className="text-xs text-gray-500">{s.label}</p>
                <span className={`inline-block mt-1 px-3 py-1 rounded-full text-lg font-bold ${s.cls}`}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">最近 30 筆同步紀錄</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs">
                  <th className="text-left px-4 py-2">Patisco PI 號</th>
                  <th className="text-left px-4 py-2">來源</th>
                  <th className="text-center px-4 py-2">狀態</th>
                  <th className="text-left px-4 py-2">時間</th>
                  <th className="text-left px-4 py-2">備註</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map(log => {
                  const clsMap: Record<string, string> = {
                    ok: 'bg-green-100 text-green-700',
                    partial: 'bg-yellow-100 text-yellow-700',
                    error: 'bg-red-100 text-red-600',
                    skipped: 'bg-gray-100 text-gray-500',
                  }
                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-xs">{log.patiscoDocNo}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${log.source === 'cron' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                          {log.source === 'cron' ? '⏱ 自動' : '🔌 Webhook'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${clsMap[log.status] ?? ''}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-400 text-xs">{formatDate(log.syncedAt)}</td>
                      <td className="px-4 py-2 text-gray-400 text-xs">{log.errorMsg ?? '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
