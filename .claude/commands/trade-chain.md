# 交易鏈（Trade Chain）PI-PO-SLS 關聯模型

## 貿易商三角結構
```
客戶 ──→ 我公司 ──→ 供應商
       PI (銷售)   PO (採購)
```
- **PI**（`model PI`）：我方對客戶發出的 Proforma Invoice
- **PO**（`model PO`）：我方對供應商發出的採購訂單
- 一張 PI 可對應一或多張 PO（拆單給不同供應商）

## PI → PO 連結（兩條路）
**主要路徑**（FK）：`PO.slsPiId → PI.id`
```typescript
const pi = await prisma.pI.findUnique({
  where: { id: piId },
  select: { poOrders: { select: { id: true } } }  // 反向關係
})
```

**Fallback 路徑**（號碼比對，Patisco sync 建立的舊資料常用這條）：
```typescript
const pos = await prisma.pO.findMany({ where: { poNo: pi.piNo } })
```
使用順序：先嘗試 `poOrders`（FK），若為空陣列，再用 `poNo = piNo` fallback。

## SLS（出貨單）與 PI 的連結

### SLS_PI_Link（多對多）
一張出貨單可含多張 PI 的品項，一張 PI 可被多張出貨單分批出貨。
```
SLS_PI_Link: shipmentId → SLS.id, piId → PI.id
```

### SLS_Item.piId（品項層級）
每個出貨品項直接帶 `piId`，是**出貨進度計算的依據**。
```typescript
// 計算某張 PI 的出貨進度
const shipped = SLS_Item.aggregate({ where: { piId }, _sum: { quantity } })
const total   = PI_Item.aggregate({ where: { piId }, _sum: { quantity } })
```
`SLS_PI_Link` 有連結但 `SLS_Item.piId` 沒設 → 出貨進度計算不到那批貨。

## 出貨進度（shipStatus）計算規則
```
piTotal = Σ PI_Item.quantity
shipped = Σ SLS_Item.quantity WHERE piId = pi.id

shipStatus:
  piTotal = 0         → 'none'（沒有品項，不顯示 badge）
  shipped >= piTotal  → 'full'
  shipped > 0         → 'partial'（顯示橘色「部分出貨」）
  shipped = 0         → 'none'（顯示紅色「未出貨」，但 piTotal > 0）
```
計算在 `src/app/[orgSlug]/(main)/sales/pi/page.tsx`，server side。

## PO 相關 PI 副本
- `PO_CustomerCopy`（model）= 客戶訂單副本，是 PI 的父級（`PI.orderId → PO_CustomerCopy.id`）
- `PI_SupplierCopy`（model）= 供應商 PI 副本，是 PO 的子級
- 這些「副本（Copy）」是 Patisco 文件類型，不是 PAXIS 原生建立的文件

## 已知地雷
- `PI.piNo` 是 `@unique`，若 Patisco 有兩個相同 piNo 的文件，後同步的會覆蓋先同步的（衝突偵測已移除）
- AP 應付帳款計算時，若 `PI.poOrders` 為空，會 fallback 到 `poNo = piNo`——這個 fallback 不保證正確，只是保底機制
- `SLS_Item` 沒有直接關聯到 PO，財務計算要透過 PI → PO 這條路
