export const PRODUCT_COLUMNS = [
  { key: 'sku',             label: 'SKU / 料號',       required: true },
  { key: 'name',            label: '產品名稱',           required: true },
  { key: 'modelNo',         label: '型號',               required: false },
  { key: 'specification',   label: '規格說明',           required: false },
  { key: 'unit',            label: '單位',               required: true },
  { key: 'unitPerInner',    label: '每內箱數量',         required: false },
  { key: 'unitPerCarton',   label: '每外箱數量',         required: false },
  { key: 'cbm',             label: 'CBM（材積）',        required: false },
  { key: 'grossWeight',     label: '毛重 KGS',           required: false },
  { key: 'netWeight',       label: '淨重 KGS',           required: false },
  { key: 'length',          label: '長度 CM',            required: false },
  { key: 'width',           label: '寬度 CM',            required: false },
  { key: 'height',          label: '高度 CM',            required: false },
  { key: 'htsCode',         label: 'HTS / HS 編碼',     required: false },
  { key: 'countryOfOrigin', label: '原產地',             required: false },
  { key: 'isMadeToOrder',   label: '接單後採購 (Y/N)',   required: false },
  { key: 'safetyStock',     label: '安全庫存量',         required: false },
  { key: 'sellingPrice',    label: '建議售價',           required: false },
  { key: 'isAvailableForPos', label: 'POS 販售 (Y/N)',  required: false },
  { key: 'posProductId',    label: 'POS 產品 ID',        required: false },
] as const

export type ProductColumnKey = typeof PRODUCT_COLUMNS[number]['key']
