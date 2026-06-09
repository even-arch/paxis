# Pacture.tw

> 台灣電商多平台訂單履行服務

Pacture 是一個輕量化的電商 OMS（訂單管理系統），專門解決台灣賣家同時經營多個電商平台的訂單履行問題。

---

## 解決的問題

台灣電商賣家通常同時上架在蝦皮、momo、PChome、露天、酷澎等多個平台。每個平台的訂單格式、物流規格、狀態回寫方式都不同，賣家需要在多個後台之間切換處理，效率低落、容易出錯。

Pacture 把所有平台的訂單統一拉進來，統一安排出貨，自動回寫狀態，讓賣家只需要操作一個介面。

---

## 核心功能

- 多平台訂單彙整（蝦皮 / momo / PChome / 露天 / 酷澎）
- 消費者資料管理
- 出貨安排（黑貓 / 新竹物流 / 順豐 / 台灣宅配通 / 7-11 超取 / 全家超取）
- 物流追蹤號自動回寫電商平台
- 退換貨流程管理
- 金流對帳數字彙整

---

## 設計原則

**輕量化** — 不做重型 ERP，只做訂單到出貨這條主線。

**平台中立** — 每個電商平台一個 Connector，新平台可以獨立擴充。

**履行彈性** — 支援自有庫存出貨、調貨後出貨、供應商直發三種履行模式。

**可獨立運作** — 不強制依賴其他系統，但可與 Paxis.tw（進銷存）對接，形成完整履行鏈。

---

## 與 Paxis.tw 的關係

```
Paxis.tw          Pacture.tw
（進銷存）   ←→   （電商 OMS）

庫存查詢           訂單履行
出貨通知           物流安排
庫存扣減           狀態回寫
```

兩個系統各自獨立，各自可單獨使用。客戶同時使用時，透過 API 對接，Pacture 向 Paxis 查詢可用庫存，出貨後通知 Paxis 扣減。

---

## 文件目錄

| 文件 | 說明 |
|------|------|
| [docs/01-product.md](docs/01-product.md) | 產品定位與目標客戶 |
| [docs/02-features.md](docs/02-features.md) | 功能範圍詳細說明 |
| [docs/03-flow.md](docs/03-flow.md) | 核心業務流程 |
| [docs/04-data-model.md](docs/04-data-model.md) | 資料模型設計 |
| [docs/05-architecture.md](docs/05-architecture.md) | 技術架構 |
| [docs/06-paxis-integration.md](docs/06-paxis-integration.md) | Paxis 對接規格 |
| [connectors/shopee.md](connectors/shopee.md) | 蝦皮 API 規格 |
| [connectors/momo.md](connectors/momo.md) | momo API 規格 |
| [connectors/pchome.md](connectors/pchome.md) | PChome API 規格 |
| [connectors/ruten.md](connectors/ruten.md) | 露天 API 規格 |
| [connectors/coupang.md](connectors/coupang.md) | 酷澎 API 規格 |

---

## 開發狀態

目前進度：文件撰寫階段 → Prototype 驗證 → 真實 API 對接

Domain：pacture.tw
