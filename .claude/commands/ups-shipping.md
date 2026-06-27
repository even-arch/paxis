# UPS 出貨整合

## OAuth 2.0 Token
- Grant type：`client_credentials`（系統帳號，不需用戶授權）
- 環境變數：`UPS_CLIENT_ID`、`UPS_CLIENT_SECRET`
- Token 有效期 4 小時，module-level cache（`_cache`）在同一 serverless instance 共用
- 過期提前 5 分鐘偵測，自動重新換取
- Helper：`getUpsAccessToken()` → `src/lib/shipping/ups-auth.ts`

## Rating API（查費率）
- 端點：`POST https://onlinetools.ups.com/api/rating/v2403/Shop`
- 用 `/Shop` 一次取所有可用服務的報價（不需指定 service code）
- Helper：`src/lib/shipping/ups-rating.ts`

### Service Code 對照表
```
'07' UPS Worldwide Express（express）
'54' UPS Worldwide Express Plus（premium）
'65' UPS Worldwide Saver（standard）
'08' UPS Worldwide Expedited（economy）
'11' UPS Standard（economy）
'96' UPS Worldwide Express Freight（freight）
```

### 費率取得優先順序
若有 Negotiated Rates（帳號議價），優先用 `NegotiatedRateCharges`；否則用 `TotalCharges`。

## Shipment API（建提單）
- 端點：`POST https://onlinetools.ups.com/api/shipments/v2403/ship`
- Helper：`src/lib/shipping/ups-shipment.ts`

### 重量單位：一律 KGS
```json
"PackageWeight": { "UnitOfMeasurement": { "Code": "KGS" }, "Weight": "1.50" }
```
尺寸單位：`CM`。

### Label 格式
預設 `GIF`，可指定 `PNG` 或 `PDF`。Response 中 `GraphicImage` 是 base64 encoded。

### 包裝類型
- 一般包裹：`Code: "02"`（Customer Packaging）
- 文件：`Code: "01"`（UPS Letter）；文件不帶尺寸欄位

## UPS_ShipmentLog
每次建提單後寫入 `UPS_ShipmentLog`，記錄 tracking number、費用、label 等。查詢歷史出貨記錄從這裡找。

## 已知地雷
- `packages` 陣列的 `quantity` 欄位會被展開成多個 package 物件（`Array(quantity).fill(null).map(...)`）——不是傳 quantity 給 UPS，是傳多個 package
- UPS 地址欄位有長度限制（`AddressLine` 最多 35 字元），超過會被截斷或拒絕
- `RequestOption: 'nonvalidate'` 不驗證地址——若地址有誤，UPS 仍接受但運費可能異常
- 帳號號碼（`accountNumber`）在出貨時是 Shipper 的 ShipperNumber，必須與 OAuth 憑證帳號一致
