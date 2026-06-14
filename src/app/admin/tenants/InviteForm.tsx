'use client'

import { useState } from 'react'

export default function InviteForm() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    const data = await res.json()
    if (res.ok) {
      setMessage(`邀請已發送至 ${email}`)
      setEmail('')
      setTimeout(() => { setOpen(false); setMessage('') }, 2000)
    } else {
      setMessage(data.error ?? '發送失敗')
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-blue-600 text-white text-sm px-4 py-2 rounded-md hover:bg-blue-700"
      >
        + 發送邀請
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-800 mb-4">發送租戶邀請</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  收件人 Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="someone@company.com"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {message && (
                <p className={`text-sm ${message.includes('已發送') ? 'text-green-600' : 'text-red-600'}`}>
                  {message}
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setOpen(false); setMessage('') }}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white text-sm px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? '發送中...' : '發送邀請'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
