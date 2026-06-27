# 多租戶資料庫架構

## 兩層資料庫
- **Master DB**：所有 org 的清單、databaseUrl、使用者帳號。用 `@/generated/master` 的 PrismaClient（獨立 schema generate）
- **Per-org DB**：每個 org 有自己的 Neon PostgreSQL，存業務資料（PO、PI、SLS...）。用 `@prisma/client`

## 取得 Prisma Client 的正確方式

### API Route（Server Action、Route Handler）
```typescript
import { getRequestPrisma } from '@/lib/request-db'
const prisma = await getRequestPrisma()
```
從 NextAuth session 取 `orgSlug`，查 master DB 找到 `databaseUrl`，回傳對應的 org Prisma client。

### Server Component Page / Layout
```typescript
import { getPagePrisma } from '@/lib/page-db'
const prisma = await getPagePrisma(params.orgSlug)
```
從路由參數取 `orgSlug`，不依賴 session（page 沒有 auth context）。

### 絕對不要用
```typescript
import { prisma } from '@/lib/db'  // ← 只有在未登入/fallback 才用
```
直接 import `prisma` 會走預設 DB，不是使用者的 org DB。

## 客戶端快取
`getOrgPrisma()` 用 module-level Map 快取（key = orgSlug）。同一 serverless instance 不重複建立連線。Vercel 冷啟動後 Map 清空，自動重建。

## React cache() 去重
`getRequestPrisma` 和 `getPagePrisma` 都用 `cache()` 包裹。同一個 request 無論呼叫幾次，只查一次 master DB。

## 已知地雷
- `masterPrisma` 用 `globalThis` singleton 避免 Next.js hot reload 重複建立連線（dev only）
- Master DB 的 PrismaClient 是 `@/generated/master`，不是 `@prisma/client`——兩者共用同一個 Neon adapter 但 schema 不同，不能混用
- `org.status !== 'active'` 時 fallback 到預設 DB，不拋錯——若查詢結果異常，先確認 org status
