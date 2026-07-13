export type ProductFormData = {
  name: string
  // 產品類型：'0'=成品/一般商品 '1'=半成品 '2'=原物料/零件
  productType: string
  sku: string
  modelNo: string
  description: string
  specification: string
  unit: string
  unitPerInner: string
  unitPerCarton: string
  cbm: string
  grossWeight: string
  netWeight: string
  length: string
  width: string
  height: string
  htsCode: string
  countryOfOrigin: string
  // 庫存行為
  isMadeToOrder: boolean
  safetyStock: string
}

export const emptyProductForm: ProductFormData = {
  name: '',
  productType: '0',
  sku: '',
  modelNo: '',
  description: '',
  specification: '',
  unit: '',
  unitPerInner: '',
  unitPerCarton: '',
  cbm: '',
  grossWeight: '',
  netWeight: '',
  length: '',
  width: '',
  height: '',
  htsCode: '',
  countryOfOrigin: '',
  isMadeToOrder: false,
  safetyStock: '0',
}

export function validateProduct(data: ProductFormData): string | null {
  if (!data.name.trim()) return '商品名稱為必填'
  return null
}
