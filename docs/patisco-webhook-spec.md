# Patisco → PAXIS Webhook 規格書

> 版本：v1.0  
> 日期：2026-05-31  
> 目的：定義 Patisco 後端在關鍵事件發生時，主動推送通知給 PAXIS 的格式與驗證機制。

---

## 概述

PAXIS 是 Point Asia 的內部進銷存系統，不直接與客戶或供應商通訊。  
Patisco 作為對外協作平台，在以下四個節點發生時，主動以 HTTP POST 通知 PAXIS：

| 事件 | Patisco 動作 | PAXIS 對應處理 |
|------|------------|--------------|
| `order.confirmed` | 買家確認訂單 | 建立 `SLS_Order`，記錄待出貨需求 |
| `pi.issued` | 賣家發出 PI 正本 | 建立 `SLS_PI`，預留庫存（reservedQty++） |
| `pi.cancelled` | PI 正本取消 | 釋放預留（reservedQty--） |
| `shipment.confirmed` | 賣家發出裝箱單確認出貨 | 建立 `SLS_Shipment`，扣減庫存（quantity--, reservedQty--） |

---

## Endpoint

```
POST https://paxis.tw/api/webhooks/patisco
```

---

## Request Headers

| Header | 必填 | 說明 |
|--------|------|------|
| `Content-Type` | 是 | `application/json` |
| `X-Patisco-Signature` | 是 | `sha256=<hex>`，見下方驗證說明 |

---

## 簽名驗證（HMAC-SHA256）

### Patisco 端（發送方）

1. 取得與 PAXIS 約定的 `webhookSecret`（由 PAXIS 管理員在設定頁產生）
2. 對 **raw request body**（未解析的原始 bytes）計算 HMAC-SHA256
3. 將結果以十六進位小寫字串填入 header：

```
X-Patisco-Signature: sha256=<hex_digest>
```

Java 範例（使用 `javax.crypto`）：

```java
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

public String sign(String rawBody, String secret) throws Exception {
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    byte[] digest = mac.doFinal(rawBody.getBytes(StandardCharsets.UTF_8));
    return "sha256=" + HexFormat.of().formatHex(digest);
}
```

### PAXIS 端（接收方，已實作）

PAXIS 收到 webhook 後會：
1. 讀取 raw body（不先解析 JSON）
2. 用相同方式計算簽名
3. 與 header 中的值做 constant-time 比對
4. 不符則回傳 `401 Unauthorized`，丟棄事件

---

## 標準 Request Body 結構

所有事件共用同一個外層結構：

```json
{
  "event": "<事件名稱>",
  "patiscoDocType": "<文件類型>",
  "patiscoDocId": 12345,
  "patiscoDocNo": "XXX-2026-00123",
  "occurredAt": "2026-05-31T08:30:00Z",
  "triggeredBy": {
    "userId": 99,
    "userName": "Eric Lu"
  },
  "payload": { ... }
}
```

| 欄位 | 型別 | 說明 |
|------|------|------|
| `event` | string | 事件名稱，見下方各節 |
| `patiscoDocType` | string | `ORDER` / `PI` / `SHIPMENT` |
| `patiscoDocId` | integer | Patisco 文件的主鍵 ID |
| `patiscoDocNo` | string | 文件編號（人讀用，供對帳） |
| `occurredAt` | string | ISO 8601 UTC，事件發生時間（非發送時間） |
| `triggeredBy.userId` | integer | 在 Patisco 按下確認的使用者 ID |
| `triggeredBy.userName` | string | 使用者顯示名稱（稽核用） |
| `payload` | object | 各事件專屬欄位，見下方 |

---

## 各事件 Payload 定義

### 1. `order.confirmed` — 客戶訂單確認

```json
{
  "event": "order.confirmed",
  "patiscoDocType": "ORDER",
  "patiscoDocId": 12345,
  "patiscoDocNo": "ORD-2026-00123",
  "occurredAt": "2026-05-31T08:30:00Z",
  "triggeredBy": { "userId": 99, "userName": "Eric Lu" },
  "payload": {
    "buyerCompanyId": 456,
    "buyerCompanyName": "ABC Trading Co.",
    "expectedShipDate": "2026-07-15",
    "items": [
      {
        "patiscoProductId": 11,
        "sku": "PA-001",
        "productName": "Widget A",
        "quantity": 100,
        "unitPrice": 12.50,
        "currency": "USD"
      }
    ]
  }
}
```

| payload 欄位 | 型別 | 說明 |
|------------|------|------|
| `buyerCompanyId` | integer | Patisco 買家公司 ID |
| `buyerCompanyName` | string | 買家公司名稱 |
| `expectedShipDate` | string? | 客戶期望出貨日（可能為 null） |
| `items[].patiscoProductId` | integer | Patisco 產品 ID |
| `items[].sku` | string? | SKU（用於與 PAXIS 產品比對） |
| `items[].productName` | string | 產品名稱 |
| `items[].quantity` | integer | 訂購數量 |
| `items[].unitPrice` | number | 單價 |
| `items[].currency` | string | 幣別（ISO 4217，如 USD） |

---

### 2. `pi.issued` — 賣家發出 PI 正本

```json
{
  "event": "pi.issued",
  "patiscoDocType": "PI",
  "patiscoDocId": 789,
  "patiscoDocNo": "PI-2026-00045",
  "occurredAt": "2026-06-01T10:00:00Z",
  "triggeredBy": { "userId": 99, "userName": "Eric Lu" },
  "payload": {
    "orderId": 12345,
    "orderNo": "ORD-2026-00123",
    "estimatedShipDate": "2026-07-20",
    "items": [
      {
        "patiscoProductId": 11,
        "sku": "PA-001",
        "quantity": 100
      }
    ]
  }
}
```

| payload 欄位 | 型別 | 說明 |
|------------|------|------|
| `orderId` | integer | 對應訂單 ID |
| `orderNo` | string | 對應訂單編號 |
| `estimatedShipDate` | string? | PI 上標註的預計出貨日 |
| `items[].patiscoProductId` | integer | Patisco 產品 ID |
| `items[].sku` | string? | SKU |
| `items[].quantity` | integer | 本次 PI 確認數量 |

---

### 3. `pi.cancelled` — PI 正本取消

```json
{
  "event": "pi.cancelled",
  "patiscoDocType": "PI",
  "patiscoDocId": 789,
  "patiscoDocNo": "PI-2026-00045",
  "occurredAt": "2026-06-05T09:15:00Z",
  "triggeredBy": { "userId": 99, "userName": "Eric Lu" },
  "payload": {
    "orderId": 12345,
    "orderNo": "ORD-2026-00123",
    "reason": "客戶取消訂單",
    "items": [
      {
        "patiscoProductId": 11,
        "sku": "PA-001",
        "quantity": 100
      }
    ]
  }
}
```

---

### 4. `shipment.confirmed` — 出貨確認（裝箱單發出）

```json
{
  "event": "shipment.confirmed",
  "patiscoDocType": "SHIPMENT",
  "patiscoDocId": 321,
  "patiscoDocNo": "SHP-2026-00012",
  "occurredAt": "2026-07-21T06:00:00Z",
  "triggeredBy": { "userId": 99, "userName": "Eric Lu" },
  "payload": {
    "piId": 789,
    "piNo": "PI-2026-00045",
    "orderId": 12345,
    "orderNo": "ORD-2026-00123",
    "actualShipDate": "2026-07-21",
    "shippingMethod": "SEA",
    "portOfLoading": "TWKHH",
    "portOfDischarge": "USLAX",
    "items": [
      {
        "patiscoProductId": 11,
        "sku": "PA-001",
        "quantity": 100
      }
    ]
  }
}
```

| payload 欄位 | 型別 | 說明 |
|------------|------|------|
| `piId` | integer | 對應 PI ID |
| `piNo` | string | 對應 PI 編號 |
| `orderId` | integer | 對應訂單 ID |
| `actualShipDate` | string | 實際離港日（YYYY-MM-DD），作為最終出倉日期 |
| `shippingMethod` | string? | `SEA` / `AIR` / `COURIER` |
| `portOfLoading` | string? | 裝運港（UN/LOCODE，如 `TWKHH`） |
| `portOfDischarge` | string? | 目的港 |
| `items[].quantity` | integer | 本次實際出貨數量（可能為部分出貨） |

---

## Response 規範

PAXIS 收到 webhook 後的回應：

| 狀況 | HTTP Status | 說明 |
|------|------------|------|
| 處理成功 | `200 OK` | Patisco 不需重試 |
| 簽名驗證失敗 | `401 Unauthorized` | Patisco 不需重試 |
| 格式錯誤 | `400 Bad Request` | Patisco 不需重試，需人工檢查 |
| PAXIS 內部錯誤 | `500 Internal Server Error` | **Patisco 應在 5 分鐘後重試，最多 3 次** |

PAXIS 保證**冪等處理**：同一個 `patiscoDocId` + `event` 組合重複送達，只會處理第一次，後續直接回 `200`。

---

## 重試建議（Patisco 端實作）

```
第 1 次失敗 → 等待 5 分鐘後重試
第 2 次失敗 → 等待 30 分鐘後重試
第 3 次失敗 → 停止重試，寫入錯誤日誌，發出告警通知管理員
```

---

## 測試

PAXIS 提供測試 endpoint（開發環境）：
```
POST https://paxis.tw/api/webhooks/patisco/test
```

此 endpoint 驗證簽名並解析 payload，但**不實際修改資料庫**，只回傳解析結果，供 Patisco 工程師驗證格式是否正確。
