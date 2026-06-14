import { redirect } from 'next/navigation'

// 舊的無 orgSlug 路由，一律導到 pointasia
export default function MainLayout() {
  redirect('/pointasia/dashboard')
}
