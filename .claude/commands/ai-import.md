# AI 文件匯入系統

## 架構：兩段式（parse → apply）
1. **parse**：上傳檔案 → LLM 解析 → 回傳結構化 JSON 預覽（不寫 DB）
2. **apply**：用戶確認預覽 → 把 JSON 寫入 DB

對應 API：
```
parse:  /api/ai/parse-invoice       → /api/ai/apply-invoice
        /api/ai/parse-pi            → （apply 另有 endpoint）
        /api/ai/parse-customer-order → /api/ai/apply-customer
        /api/ai/parse-shipping      → apply-products 等
```

## LLM 呼叫（`callLLM`）
支援兩個 provider，設定存在 `SYS_KeyValue`（key: `ai_provider`, `ai_api_key`, `ai_model`）：
- `openai`：POST `https://api.openai.com/v1/chat/completions`，`temperature: 0.1`
- `anthropic`：POST `https://api.anthropic.com/v1/messages`，`anthropic-version: 2023-06-01`

訊息格式差異：
- OpenAI：system message 放在 `messages` 陣列裡，role = 'system'
- Anthropic：system message 是獨立的 top-level `system` 欄位，messages 陣列只含 user/assistant

## 檔案處理（`buildMessagesForFile`）
| 檔案類型 | 處理方式 |
|---------|---------|
| PDF | 用 mupdf（WASM）轉每頁為 PNG，送 Vision API（最多 8 頁）|
| 圖片 | 直接 base64 送 Vision API |
| Excel / XLSX | 用 `xlsx` 套件轉 TSV 文字，送 text message |
| CSV / TXT | 直接讀文字 |

PDF Vision 比文字解析準確得多——mupdf 在 Vercel 可用（純 WASM，無 native deps）。mupdf 失敗時 fallback 到 `pdf-parse` 文字模式。

## JSON 解析（`parseJsonResponse`）
LLM 常在 JSON 外包 markdown code block（```json）。`parseJsonResponse()` 自動清除 code block，再找最外層 `{...}` 提取。呼叫 LLM 後一律用此 helper，不直接 `JSON.parse()`。

## 文字截斷
Excel/CSV 超過 60,000 字元時自動截斷並加 `...[已截斷]`，避免超過 context window。

## AI 豐富化（product-enrich，不同流程）
**觸發條件**：`PRD_Product.name = PRD_Product.modelNo`（用 raw SQL，Prisma 不支援欄位間比較）
- 這是 Patisco 首次 sync 時的 placeholder 命名規則（用 modelNo 暫填 name）
- 不是 `name = '未命名商品'`（舊邏輯，已修正）
- API：`/api/admin/re-enrich`（GET 查待豐富化數量，POST 執行）
- 豐富化不觸碰已有正式名稱的產品——保護現有資料

## 已知地雷
- Anthropic API 不接受 `temperature` 參數（OpenAI 才有），`callLLM` 已處理此差異
- Vision API（PDF/圖片）token 消耗量遠高於文字模式，高解析度 PDF 可能超出 max_tokens
- `analyze-template` endpoint 是解析列印模板用的，不是文件匯入用的，勿混淆
