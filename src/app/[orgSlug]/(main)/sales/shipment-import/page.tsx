import { redirect } from 'next/navigation'

export default function LegacyShipmentImportRedirect() {
  redirect('/shipments/import')
}
