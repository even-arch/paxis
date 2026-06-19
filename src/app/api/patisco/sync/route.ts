import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRequestPrisma } from '@/lib/request-db'
import {
  runPatiscoSync,
  rollbackSyncJob,
  phase1FetchAll,
  phase2ParseAll,
  phase2RunNextStep,
} from '@/api/patisco/sync'
import { patiscoLogin } from '@/api/patisco/client'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const prisma = await getRequestPrisma()
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { type?: string; jobId?: number; step?: string }
  const type = body.type ?? 'all'
  const start = Date.now()

  try {
    const creds = await patiscoLogin(prisma)

    // ── 完整兩階段 sync ────────────────────────────────────────────────────
    if (type === 'all') {
      const result = await runPatiscoSync('manual', prisma, creds ?? undefined)
      return NextResponse.json({ ok: true, durationMs: Date.now() - start, ...result })
    }

    // ── 單獨跑 Phase 1（只拉 raw data）───────────────────────────────────
    if (type === 'phase1') {
      if (!creds) return NextResponse.json({ ok: false, error: 'Patisco 登入失敗' }, { status: 500 })
      const job = await prisma.sYS_SyncJob.create({
        data: { status: 'phase1', trigger: 'manual', performedBy: 1 },
      })
      const result = await phase1FetchAll(prisma, creds, job.id)
      await prisma.sYS_SyncJob.update({
        where: { id: job.id },
        data: { status: 'completed', completedAt: new Date(), result: result as object },
      })
      return NextResponse.json({ ok: true, durationMs: Date.now() - start, jobId: job.id, ...result })
    }

    // ── 單獨跑 Phase 2（逐步模式：每次呼叫跑一個 step）───────────────
    if (type === 'phase2') {
      const jobId = body.jobId
      if (!jobId) return NextResponse.json({ ok: false, error: 'jobId 必填' }, { status: 400 })

      // step=next（預設）：只跑下一個未完成的 step
      // step=all：一次跑完全部（舊行為，保留相容）
      if (!body.step || body.step === 'next') {
        const r = await phase2RunNextStep(prisma, jobId)
        if (r.done) {
          await prisma.sYS_SyncJob.update({
            where: { id: jobId },
            data: { status: 'completed', completedAt: new Date() },
          })
        }
        return NextResponse.json({ ok: true, durationMs: Date.now() - start, jobId, ...r })
      }

      // 舊版 all-in-one（給 cron 或 manual runPatiscoSync 用）
      const result = await phase2ParseAll(prisma, jobId)
      await prisma.sYS_SyncJob.update({
        where: { id: jobId },
        data: { status: 'completed', completedAt: new Date(), result: result as object },
      })
      return NextResponse.json({ ok: true, durationMs: Date.now() - start, jobId, phase2: result })
    }

    // ── 回滾（取消 sync job）─────────────────────────────────────────────
    if (type === 'rollback') {
      const jobId = body.jobId
      if (!jobId) return NextResponse.json({ ok: false, error: 'jobId 必填' }, { status: 400 })
      await rollbackSyncJob(prisma, jobId)
      return NextResponse.json({ ok: true, durationMs: Date.now() - start, message: `Job ${jobId} 已回滾` })
    }

    // ── 查詢 sync job 狀態 ────────────────────────────────────────────────
    if (type === 'status') {
      const jobs = await prisma.sYS_SyncJob.findMany({
        orderBy: { startedAt: 'desc' },
        take: 10,
        select: {
          id: true, status: true, trigger: true,
          phase1Total: true, phase1Done: true, phase2Step: true,
          startedAt: true, completedAt: true, errorMsg: true,
        },
      })
      return NextResponse.json({ ok: true, jobs })
    }

    return NextResponse.json({ ok: false, error: `未知 type: ${type}` }, { status: 400 })
  } catch (err) {
    console.error('[patisco/sync]', err)
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    }, { status: 500 })
  }
}
