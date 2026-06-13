import { redirect } from 'next/navigation'

export default function DeliveryNotePrintPage({ params }: { params: { id: string } }) {
  redirect(`/api/delivery-notes/${params.id}/print`)
}
