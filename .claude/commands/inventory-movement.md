# 庫存異動引擎

## 兩欄位模型
```
INV_Stock.quantity    = 實際庫存（倉庫裡真正有的數量）
INV_Stock.reservedQty = 預留量（已發 PI 正本給客戶、尚未出倉）
availableQty          = quantity - reservedQty（計算值，不存 DB，前端防超賣用）
```

## 五個觸發點
| type | 事件 | quantity | reservedQty |
|------|------|----------|-------------|
| 1 | PO_Receipt 確認入庫 | ++ | — |
| 2 | PI 正本發出 | — | ++ |
| 3 | PI 正本取消（status=1） | — | -- |
| 4 | SLS 確認出貨 | -- | -- |
| 5 | INV_Adjustment 庫存調整 | ±（依 delta）| — |
| 6 | 系統反轉（刪除出貨/入庫）| ++ | — |
| 8 | POS 銷售出庫 | -- | — |
| 9 | POS 退貨入庫 | ++ | — |

## INV_Movement 欄位正負號規則
- `qtyDelta` 正數 = 增加，負數 = 減少
- `reservedDelta` 同規則
- `quantityBefore` / `quantityAfter` 是快照，用於稽核

## INV_Stock 是 aggregate
沒有從 INV_Movement replay 的機制。直接在 `INV_Stock.quantity` 上加減（`increment`/`decrement`）。手動修改 `INV_Stock` 不會產生 INV_Movement——應透過 `INV_Adjustment` 走正常流程。

## 已知地雷
- Patisco sync 建立的 SLS 不會自動觸發 INV_Movement（sync 是從外部拉資料，不代表「現在才出貨」）。INV_Movement 只在 PAXIS 內手動確認出貨時觸發
- type=6（系統反轉）只給刪除出貨/入庫用，不需要 INV_Adjustment 單據
- `safetyStock` 存在 INV_Stock 但沒有自動警示邏輯，只是參考值
