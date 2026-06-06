import { NextResponse } from 'next/server'
export async function GET() { return NextResponse.json({ error: 'SaaS disabled' }, { status: 503 }) }
export async function POST() { return NextResponse.json({ error: 'SaaS disabled' }, { status: 503 }) }
export async function DELETE() { return NextResponse.json({ error: 'SaaS disabled' }, { status: 503 }) }
