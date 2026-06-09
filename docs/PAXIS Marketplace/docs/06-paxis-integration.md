# 06 — Paxis.tw 對接規格

## 對接原則

- 兩個系統**各自獨立**，Pacture 不強制依賴 Paxis
- 對接為**選配功能**，客戶可以只用 Pacture 而不用 Paxis
- 對接介面以 **REST API** 為主
- 認證方式：API Key（由 Paxis 發行給已授權的 Pacture 租戶）

---

## Pacture 需要從 Paxis 取得的資料

### 1. 查詢可用庫存

```
GET /api/v1/inventory/available

Request:
{
  "sku": "string",
  "quantity_needed": "integer"
}

Response:
{
  "sku": "string",
  "available_quantity": "integer",
  "can_fulfill": "boolean"
}
```

### 2. 預留庫存（訂單進來時鎖定）

```
POST /api/v1/inventory/reserve

Request:
{
  "pacture_order_id": "string",
  "items": [
    {
      "sku": "string",
      "quantity": "integer"
    }
  ]
}

Response:
{
  "reservation_id": "string",
  "status": "reserved|insufficient",
  "items": [
    {
      "sku": "string",
      "reserved_quantity": "integer",
      "available_quantity": "integer"
    }
  ]
}
```

### 3. 確認扣減庫存（出貨後）

```
POST /api/v1/inventory/deduct

Request:
{
  "reservation_id": "string",
  "pacture_shipment_id": "string"
}

Response:
{
  "status": "success|failed",
  "message": "string"
}
```

### 4. 取消預留（訂單取消時釋放）

```
DELETE /api/v1/inventory/reserve/{reservation_id}

Response:
{
  "status": "released"
}
```

### 5. 退貨入庫回補庫存

```
POST /api/v1/inventory/restock

Request:
{
  "pacture_return_id": "string",
  "items": [
    {
      "sku": "string",
      "quantity": "integer",
      "condition": "good|damaged"
      // 只有 good 才回補庫存
    }
  ]
}

Response:
{
  "status": "success|partial|failed",
  "restocked_items": [...]
}
```

---

## 資料同步方向

```
Pacture → Paxis：
  - 預留庫存
  - 確認扣減
  - 取消預留
  - 退貨回補

Paxis → Pacture：
  - 庫存查詢結果
  - 庫存不足警示（Webhook，選配）
```

---

## 不對接的部分

以下功能**不在 Pacture 與 Paxis 的對接範圍**：

- 商品主檔同步（由賣家各自維護）
- 採購單建立（Paxis 內部功能）
- 財務會計數字
- B2B 訂單資料

---

## 無 Paxis 時的運作方式

若賣家未使用 Paxis，Pacture 的行為：

- 不做庫存查詢，直接讓賣家自行判斷是否可出貨
- 不做庫存預留，超賣風險由賣家自行管理
- 可設定各商品的「安全庫存緩衝」數字（人工輸入），作為基本保護
