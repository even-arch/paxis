# 04 — 資料模型

## 核心資料實體

### Order（訂單）

```json
{
  "order_id": "string",              // Pacture 內部訂單 ID
  "platform": "shopee|momo|pchome|ruten|coupang",
  "platform_order_id": "string",     // 各平台原始訂單號
  "platform_account_id": "string",   // 賣家在該平台的帳號 ID

  "status": "pending|processing|shipped|completed|return_requested|returned|exchanged|cancelled",

  "consumer_id": "string",           // 關聯消費者 ID
  "shipping_address": {
    "name": "string",
    "phone": "string",
    "zip_code": "string",
    "city": "string",
    "district": "string",
    "address": "string",
    "delivery_type": "home|711|family"  // 宅配或超取
  },

  "items": [
    {
      "platform_item_id": "string",
      "sku": "string",
      "name": "string",
      "quantity": "integer",
      "unit_price": "decimal",
      "subtotal": "decimal"
    }
  ],

  "order_total": "decimal",
  "platform_fee": "decimal",         // 平台手續費（對帳用）
  "shipping_fee": "decimal",

  "fulfillment_mode": "own_stock|purchase_first|dropship",

  "shipment_id": "string",           // 關聯出貨單 ID（出貨後）
  "return_id": "string",             // 關聯退換貨單 ID（若有）

  "platform_ship_by": "datetime",    // 平台要求的出貨截止時間
  "ship_by_alert_sent": "boolean",

  "ordered_at": "datetime",          // 消費者下單時間
  "created_at": "datetime",          // Pacture 建立時間
  "updated_at": "datetime"
}
```

---

### Consumer（消費者）

```json
{
  "consumer_id": "string",
  "name": "string",
  "phone": "string",
  "email": "string",

  "addresses": [
    {
      "address_id": "string",
      "name": "string",             // 收件人姓名（可與帳號不同）
      "phone": "string",
      "zip_code": "string",
      "city": "string",
      "district": "string",
      "address": "string",
      "is_default": "boolean"
    }
  ],

  "notes": "string",               // 賣家備註
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

> 消費者識別：同一消費者可能在不同平台下單，以電話號碼做模糊比對，讓賣家手動確認是否合併。

---

### Shipment（出貨單）

```json
{
  "shipment_id": "string",
  "order_ids": ["string"],          // 可一次出多筆訂單（批次出貨）

  "carrier": "blackcat|hsinchu|sfexpress|tcat|711|family|post",
  "tracking_number": "string",
  "label_url": "string",            // 出貨標籤 PDF URL

  "status": "pending|picked_up|in_transit|delivered|failed|returned",

  "shipped_at": "datetime",
  "estimated_delivery": "datetime",
  "delivered_at": "datetime",

  "created_by": "string",           // 操作人員 ID
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

---

### Return（退換貨單）

```json
{
  "return_id": "string",
  "order_id": "string",
  "type": "return|exchange",

  "status": "requested|approved|in_transit|received|completed|rejected",

  "reason": "string",              // 退換貨原因（平台提供）
  "consumer_note": "string",
  "seller_note": "string",

  "return_items": [
    {
      "sku": "string",
      "quantity": "integer",
      "condition": "good|damaged",   // 入庫後確認狀況
      "restock": "boolean"           // 是否回補庫存
    }
  ],

  // 換貨用
  "exchange_shipment_id": "string",  // 換貨出貨單 ID

  "requested_at": "datetime",
  "received_at": "datetime",
  "completed_at": "datetime",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

---

### PlatformAccount（平台帳號）

```json
{
  "account_id": "string",
  "tenant_id": "string",            // 賣家（租戶）ID
  "platform": "shopee|momo|pchome|ruten|coupang",
  "account_name": "string",         // 賣家在平台的店名

  "credentials": {
    // 依平台不同，存放對應的 Key / Token
    // 加密儲存，不明文
  },

  "is_active": "boolean",
  "last_synced_at": "datetime",
  "created_at": "datetime"
}
```

---

### PayoutRecord（撥款記錄）

```json
{
  "payout_id": "string",
  "platform_account_id": "string",
  "platform": "string",

  "period_start": "date",
  "period_end": "date",
  "payout_date": "date",

  "gross_amount": "decimal",        // 銷售總額
  "platform_fee": "decimal",        // 平台手續費
  "refund_deduction": "decimal",    // 退款扣除
  "net_amount": "decimal",          // 實際撥款金額

  "order_count": "integer",
  "notes": "string",
  "created_at": "datetime"
}
```

---

## 資料關係圖

```
Tenant（租戶/賣家）
  │
  ├─── PlatformAccount（平台帳號，可多個）
  │
  ├─── Order（訂單）
  │       │
  │       ├─── Consumer（消費者）
  │       ├─── Shipment（出貨單）
  │       └─── Return（退換貨單）
  │               └─── Shipment（換貨出貨單）
  │
  └─── PayoutRecord（撥款記錄）
```
