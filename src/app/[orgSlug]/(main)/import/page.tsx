import { redirect } from 'next/navigation'

// 舊路徑 /import 已移至 /purchases/import
export default function LegacyImportPage() {
  redirect('/purchases/import')
}
