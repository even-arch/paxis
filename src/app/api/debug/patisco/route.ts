// Debug endpoint 暫時停用，避免 patiscoLogin 互蓋 session
import { NextResponse } from 'next/server'
export async function GET() {
  return NextResponse.json({ disabled: true, reason: 'Patisco session conflict' })
}
