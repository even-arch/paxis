# Patisco MCP Client 協定

## 協定基礎
- JSON-RPC 2.0 over HTTP POST
- 端點：`https://mcp.patisco.com/mcp`（環境變數 `PATISCO_MCP_URL` 可覆蓋）
- 每次通話前須先 `initialize` 取得 `mcp-session-id`，後續 request 帶此 Header

## Session 初始化流程
1. POST `initialize`，帶 `Authorization: Bearer {jwt}` 和 `X-API-Key: {apiKey}`
2. 從 response Header 取 `mcp-session-id`
3. 後續所有 `tools/call` 都帶 `mcp-session-id` Header
4. Session 快取在 module-level `_sessions` Map（key = mcpUrl）。同一 sync run 只初始化一次
5. `clearMcpSessions()` 清快取（換帳號或 JWT 過期時呼叫）

## 目前有效工具清單
```
listProformaInvoices        我方 PI 正本列表（分頁）
listProformaInvoiceCopies   供應商 PI 副本列表（分頁）
listPurchaseOrders          採購單列表（分頁）
listPurchaseOrderCopies     客戶訂單副本列表（分頁）
listDeliveryOrders          出貨單列表（分頁）
getOrderDetail              PI/PO 正本詳情（orderId 參數）
getOrderProducts            PI/PO 品項（orderId 參數，分頁）
getDeliveryOrderDetail      出貨單詳情（id + documentType: "packingList"|"commercialInvoice"）
getOrderCopyDetail          副本詳情（copyId 參數）
getOrderCopyProducts        副本品項（copyId 參數，分頁）
health                      連線健康檢查
```

## 已廢棄工具（保留 stub，勿呼叫）
```
getPIs               → 改用 listProformaInvoices
getShipments         → 改用 listDeliveryOrders
getShipmentDetail    → 改用 getDeliveryOrderDetail
listOrderCopies      → 改用 listProformaInvoiceCopies / listPurchaseOrderCopies
getBuyers            → 公司資料改從 order detail 中提取
getSellers           → 同上
```

## 分頁規則
- 所有 list 工具都接受 `page` 參數（從 1 開始）
- Response 有 `hasNextPage: boolean`，`false` 代表已拿完
- `fetchAllPages()` helper 自動翻頁直到 `hasNextPage = false`

## JWT 驗證
- `MCP_AUTH_EXPIRED`：`mcpCall` 回傳此 error code 代表 JWT/session 已失效
- 上層應清除 session 快取（`clearMcpSessions()`）、重新 `patiscoLogin()` 後重試
- Patisco 帳密加密存在 `SYS_PatiscoConfig`，用 `decrypt()` 解密後才能登入

## 已知地雷
- `getDeliveryOrderDetail` 需呼叫兩次（packingList 和 commercialInvoice 各一次），用 `Promise.all` 並發
- `getOrderDetail` 回傳的 response 結構是 `{ detail: {...}, products: [...], price: {...} }`，不是直接的 order 物件
- `extractOrderDetail()` 是標準化 helper，負責從 raw API response 萃取 buyer/seller/dates 等欄位
