# Connector — 蝦皮（Shopee）

## 基本資訊

- **平台**：Shopee Taiwan
- **API 版本**：Open Platform v2.0
- **開發者文件**：https://open.shopee.com/documents
- **申請資格**：商城賣家或第三方系統供應商（ERP 廠商）
- **開發者類型**：Enterprise（企業開發者）

---

## 憑證資訊

賣家需提供（從 Shopee Open Platform 後台取得）：

| 欄位 | 說明 |
|------|------|
| `partner_id` | 開發者 ID（Pacture 統一申請，一組） |
| `partner_key` | 開發者金鑰（Pacture 統一申請，一組） |
| `shop_id` | 賣家的店鋪 ID |
| `access_token` | 賣家授權後取得，有效期 4 小時 |
| `refresh_token` | 用於更新 access_token，有效期 30 天 |

> 注意：`partner_id` 和 `partner_key` 是 Pacture 作為系統商的憑證，由 Pacture 統一申請並管理。`shop_id`、`access_token`、`refresh_token` 是各賣家個別的，由賣家完成授權流程後取得。

---

## 授權流程

蝦皮採用 OAuth 2.0 授權流程：

```
1. Pacture 產生授權連結
   https://partner.shopeemobile.com/api/v2/shop/auth_partner
   ?partner_id={partner_id}
   &timestamp={timestamp}
   &sign={sign}
   &redirect={callback_url}

2. 賣家點擊連結，登入蝦皮帳號，完成授權

3. 蝦皮 callback 回 Pacture，帶回 code

4. Pacture 用 code 換取 access_token 和 refresh_token

5. 儲存 tokens，後續 API 呼叫使用
```

---

## API 簽名方式

蝦皮 v2 所有 API 需要簽名：

```
sign = HMAC-SHA256(
  partner_key,
  "{partner_id}{api_path}{timestamp}{access_token}{shop_id}"
)
```

---

## 主要 API 對應

### 拉取新訂單

```
GET /api/v2/order/get_order_list
  ?time_range_field=create_time
  &time_from={unix_timestamp}
  &time_to={unix_timestamp}
  &order_status=READY_TO_SHIP
  &page_size=50
  &cursor={cursor}
```

### 取得訂單詳情

```
GET /api/v2/order/get_order_detail
  ?order_sn_list={order_sn1,order_sn2}
```

### 回寫出貨資訊

```
POST /api/v2/logistics/ship_order
Body:
{
  "order_sn": "string",
  "pickup": {
    "address_id": "integer"
  }
}

// 取得追蹤號後
POST /api/v2/logistics/update_shipping_order
Body:
{
  "order_sn": "string",
  "tracking_number": "string"
}
```

### 取得退換貨申請

```
GET /api/v2/returns/get_return_list
  ?page_no=1
  &page_size=50
  &create_time_from={unix_timestamp}
  &create_time_to={unix_timestamp}
```

---

## 出貨時限

- 一般商品：2 個工作天
- 超時未出貨：訂單可能被系統自動取消
- Pacture 需在截止前 6 小時發出警示

---

## 已知限制

- 每個 API 有 Rate Limit，需注意呼叫頻率
- access_token 4 小時過期，需實作自動 refresh
- Webhook 需在開發者後台設定回調 URL
