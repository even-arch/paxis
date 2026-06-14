'use client'

import { RefObject, useCallback, useEffect, useRef, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SavedSeal = { id: number; name: string; imageBase64: string }

export type PlacedSeal = {
  uid: string
  sealId: number
  imageBase64: string
  xPct: number       // 左邊緣，相對容器寬度 %
  yPct: number       // 上邊緣，相對容器高度 %（UI 操作時一律用 top）
  widthPct: number   // 寬度 %；高度固定 = widthPct × 0.75（4:3）
  anchor: 'top' | 'bottom'  // top=從上定位；bottom=從下定位（跟著內容底部）
}

// 存入 template 的精簡格式（不含 imageBase64，印時從 savedSeals 查）
export type PlacedSealDef = Omit<PlacedSeal, 'imageBase64'>

// ── 去白底工具函式 ─────────────────────────────────────────────────────────────

async function removeWhiteBackground(file: File, threshold = 240): Promise<string> {
  // Step 1: 用 FileReader 讀成 data URL（可靠，不依賴 blob URL）
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

  // Step 2: 用 Canvas 去白底；任何失敗都 fallback 回原始 data URL
  return new Promise<string>((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const MAX = 600
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(dataUrl); return }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2]
          if (r > threshold && g > threshold && b > threshold) {
            const brightness = Math.min(r, g, b)
            const alpha = Math.round((255 - brightness) / (255 - threshold) * 200)
            data[i + 3] = Math.min(data[i + 3], alpha)
          }
        }

        ctx.putImageData(imageData, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(dataUrl) // canvas 處理失敗，回傳原始圖片
      }
    }
    img.onerror = () => resolve(dataUrl) // 圖片載入失敗，回傳原始圖片
    img.src = dataUrl
  })
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSealManager() {
  const [savedSeals, setSavedSeals] = useState<SavedSeal[]>([])
  const [placedSeals, setPlacedSeals] = useState<PlacedSeal[]>([])
  const [armedSeal, setArmedSeal] = useState<SavedSeal | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadingMsg, setUploadingMsg] = useState('')
  const [savingToTemplate, setSavingToTemplate] = useState(false)
  const [savedToTemplateMsg, setSavedToTemplateMsg] = useState('')

  useEffect(() => {
    fetch('/api/seals').then(r => r.json()).then(setSavedSeals)
  }, [])

  const armSeal = useCallback((seal: SavedSeal) => {
    setArmedSeal(prev => prev?.id === seal.id ? null : seal)
  }, [])

  const disarm = useCallback(() => setArmedSeal(null), [])

  const placeSeal = useCallback((xPct: number, yPct: number) => {
    if (!armedSeal) return
    const uid = Math.random().toString(36).slice(2)
    setPlacedSeals(prev => [...prev, {
      uid,
      sealId: armedSeal.id,
      imageBase64: armedSeal.imageBase64,
      xPct: Math.max(0, xPct - 10),
      yPct: Math.max(0, yPct - 7.5),
      widthPct: 20,
      anchor: 'bottom', // 預設 bottom，章幾乎都放在下方
    }])
    setArmedSeal(null)
  }, [armedSeal])

  const updateSeal = useCallback((uid: string, updates: Partial<PlacedSeal>) => {
    setPlacedSeals(prev => prev.map(s => s.uid === uid ? { ...s, ...updates } : s))
  }, [])

  const removeSeal = useCallback((uid: string) => {
    setPlacedSeals(prev => prev.filter(s => s.uid !== uid))
  }, [])

  // 從模板帶入章的位置（切換模板時呼叫）
  const loadFromTemplate = useCallback((defs: PlacedSealDef[], seals: SavedSeal[]) => {
    const placed = defs.map(def => {
      const seal = seals.find(s => s.id === def.sealId)
      if (!seal) return null
      return { ...def, imageBase64: seal.imageBase64 }
    }).filter(Boolean) as PlacedSeal[]
    setPlacedSeals(placed)
  }, [])

  const clearSeals = useCallback(() => setPlacedSeals([]), [])

  // 把目前的章位置儲存回模板
  const saveToTemplate = useCallback(async (templateId: number) => {
    setSavingToTemplate(true)
    const defs: PlacedSealDef[] = placedSeals.map(({ imageBase64: _img, ...rest }) => rest)
    await fetch(`/api/print/templates/${templateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sealPlacements: defs }),
    })
    setSavingToTemplate(false)
    setSavedToTemplateMsg('已儲存')
    setTimeout(() => setSavedToTemplateMsg(''), 2000)
  }, [placedSeals])

  const uploadSeal = useCallback(async (file: File, name: string): Promise<boolean> => {
    setUploading(true)
    setUploadingMsg('處理圖片中…')
    try {
      const imageBase64 = await removeWhiteBackground(file)
      setUploadingMsg('上傳中…')
      const res = await fetch('/api/seals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, imageBase64 }),
      })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`HTTP ${res.status}: ${body}`)
      }
      const seal = await res.json() as SavedSeal
      setSavedSeals(prev => [...prev, seal])
      setUploadingMsg('')
      return true
    } catch (err) {
      console.error('[SealManager] upload error:', err)
      setUploadingMsg(err instanceof Error ? err.message : '上傳失敗，請重試')
      return false
    } finally {
      setUploading(false)
    }
  }, [])

  const deleteSavedSeal = useCallback(async (id: number) => {
    await fetch(`/api/seals/${id}`, { method: 'DELETE' })
    setSavedSeals(prev => prev.filter(s => s.id !== id))
    setPlacedSeals(prev => prev.filter(s => s.sealId !== id))
  }, [])

  return {
    savedSeals, placedSeals, armedSeal, uploading, uploadingMsg, savingToTemplate, savedToTemplateMsg,
    armSeal, disarm, placeSeal, updateSeal, removeSeal, uploadSeal, deleteSavedSeal,
    loadFromTemplate, clearSeals, saveToTemplate,
  }
}

export type SealManager = ReturnType<typeof useSealManager>

// ── Sidebar Section ───────────────────────────────────────────────────────────

export function SealSidebarSection({
  manager,
  selectedTemplateId,
}: {
  manager: SealManager
  selectedTemplateId: number | 'builtin'
}) {
  const [newName, setNewName] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [deleteHover, setDeleteHover] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const name = newName.trim() || file.name.replace(/\.[^.]+$/, '')
    setNewName('')
    if (fileRef.current) fileRef.current.value = ''
    const ok = await manager.uploadSeal(file, name)
    if (ok) setShowUpload(false)
    // 失敗時保持 panel 開著，讓使用者能看到錯誤訊息並重試
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">公司章</h3>
        <button onClick={() => setShowUpload(v => !v)} className="text-xs text-blue-500 hover:text-blue-700">
          + 上傳
        </button>
      </div>

      {showUpload && (
        <div className="mb-3 p-2 bg-blue-50 rounded text-xs space-y-1.5">
          {manager.uploading ? (
            <div className="flex items-center gap-2 py-2 px-1 bg-blue-100 rounded">
              <svg className="animate-spin h-4 w-4 text-blue-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
              <span className="text-blue-600">{manager.uploadingMsg || '處理中…'}</span>
            </div>
          ) : (
            <>
              {manager.uploadingMsg && (
                <p className="text-red-500 bg-red-50 px-2 py-1 rounded">{manager.uploadingMsg}</p>
              )}
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="章的名稱（可留空）"
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <p className="text-gray-400 leading-snug">建議上傳白底圖片，系統會自動去除白色背景，讓章蓋在文件上效果更佳。</p>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFile} className="w-full text-xs text-gray-500" />
            </>
          )}
        </div>
      )}

      {manager.savedSeals.length === 0 ? (
        <p className="text-xs text-gray-400">尚未上傳任何公司章</p>
      ) : (
        <div className="space-y-2">
          {manager.savedSeals.map(seal => {
            const isArmed = manager.armedSeal?.id === seal.id
            return (
              <div key={seal.id}
                className={`relative flex items-center gap-2 p-1.5 rounded cursor-pointer border transition-all ${
                  isArmed ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => manager.armSeal(seal)}
                onMouseEnter={() => setDeleteHover(seal.id)}
                onMouseLeave={() => setDeleteHover(null)}
              >
                <div className="w-12 h-9 flex-shrink-0 bg-white border border-gray-200 rounded overflow-hidden flex items-center justify-center">
                  <img src={seal.imageBase64} alt={seal.name} className="max-w-full max-h-full object-contain" />
                </div>
                <span className="text-xs text-gray-700 flex-1 min-w-0 truncate">{seal.name}</span>
                {deleteHover === seal.id && (
                  <button onClick={e => { e.stopPropagation(); manager.deleteSavedSeal(seal.id) }}
                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600">×</button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {manager.armedSeal ? (
        <p className="mt-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
          點擊文件預覽區放置「{manager.armedSeal.name}」
          <button onClick={manager.disarm} className="ml-1 text-blue-400 hover:text-blue-600">（取消）</button>
        </p>
      ) : manager.savedSeals.length > 0 ? (
        <p className="mt-2 text-xs text-gray-400">點擊章的縮圖後，再點文件放置</p>
      ) : null}

      {/* 儲存到模板按鈕（只有選了自訂模板才顯示） */}
      {manager.placedSeals.length > 0 && selectedTemplateId !== 'builtin' && (
        <div className="mt-3">
          {manager.savedToTemplateMsg ? (
            <span className="text-xs text-green-600">{manager.savedToTemplateMsg}</span>
          ) : (
            <button
              onClick={() => manager.saveToTemplate(selectedTemplateId as number)}
              disabled={manager.savingToTemplate}
              className="w-full text-xs border border-indigo-300 text-indigo-600 py-1.5 rounded hover:bg-indigo-50 disabled:opacity-50"
            >
              {manager.savingToTemplate ? '儲存中…' : '📌 儲存章位置到此模板'}
            </button>
          )}
          <p className="text-xs text-gray-400 mt-1">下次選用此模板會自動帶出章的位置</p>
        </div>
      )}
    </div>
  )
}

// ── Overlay Layer（螢幕預覽用）────────────────────────────────────────────────

export function SealOverlayLayer({
  manager,
  containerRef,
}: {
  manager: SealManager
  containerRef: RefObject<HTMLDivElement>
}) {
  if (manager.placedSeals.length === 0) return null

  return (
    <>
      {manager.placedSeals.map(seal => (
        <DraggableSealItem key={seal.uid} seal={seal} manager={manager} containerRef={containerRef} />
      ))}
    </>
  )
}

function DraggableSealItem({
  seal,
  manager,
  containerRef,
}: {
  seal: PlacedSeal
  manager: SealManager
  containerRef: RefObject<HTMLDivElement>
}) {
  const dragRef = useRef<{
    type: 'move' | 'resize'
    startMouseX: number
    startMouseY: number
    startXPct: number
    startYPct: number
    startWidthPct: number
  } | null>(null)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const dxPct = (e.clientX - dragRef.current.startMouseX) / rect.width * 100
      const dyPct = (e.clientY - dragRef.current.startMouseY) / rect.height * 100

      if (dragRef.current.type === 'move') {
        manager.updateSeal(seal.uid, {
          xPct: Math.max(0, Math.min(85, dragRef.current.startXPct + dxPct)),
          yPct: Math.max(0, Math.min(92, dragRef.current.startYPct + dyPct)),
        })
      } else {
        const newWidth = Math.max(5, Math.min(60, dragRef.current.startWidthPct + dxPct))
        manager.updateSeal(seal.uid, { widthPct: newWidth })
      }
    }
    const onUp = () => { dragRef.current = null }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [seal.uid, manager, containerRef])

  const heightPct = seal.widthPct * 0.75

  return (
    <div
      style={{
        position: 'absolute',
        left: `${seal.xPct}%`,
        top: `${seal.yPct}%`,
        width: `${seal.widthPct}%`,
        height: `${heightPct}%`,
        cursor: 'move',
        userSelect: 'none',
        zIndex: 10,
      }}
      onMouseDown={e => {
        e.stopPropagation()
        e.preventDefault()
        dragRef.current = {
          type: 'move',
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          startXPct: seal.xPct,
          startYPct: seal.yPct,
          startWidthPct: seal.widthPct,
        }
      }}
    >
      {/* 選取框 */}
      <div style={{ position: 'absolute', inset: 0, border: '1.5px dashed #6366f1', borderRadius: 2, pointerEvents: 'none' }} />

      <img src={seal.imageBase64} draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />

      {/* Anchor 切換按鈕（左上） */}
      <button
        title={seal.anchor === 'bottom' ? '目前：從下方定位（跟隨內容底部）\n點擊切換為從上方定位' : '目前：從上方定位\n點擊切換為從下方定位'}
        onClick={e => { e.stopPropagation(); manager.updateSeal(seal.uid, { anchor: seal.anchor === 'bottom' ? 'top' : 'bottom' }) }}
        style={{
          position: 'absolute', top: -9, left: 14,
          background: seal.anchor === 'bottom' ? '#6366f1' : '#9ca3af',
          color: '#fff', border: 'none', borderRadius: 3,
          cursor: 'pointer', fontSize: 9, padding: '1px 4px',
          whiteSpace: 'nowrap', zIndex: 12,
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {seal.anchor === 'bottom' ? '↑底部' : '↓頂部'}
      </button>

      {/* 刪除按鈕（左上角 ×） */}
      <button
        onClick={e => { e.stopPropagation(); manager.removeSeal(seal.uid) }}
        style={{
          position: 'absolute', top: -9, left: -9,
          width: 18, height: 18, background: '#ef4444', color: '#fff',
          border: 'none', borderRadius: '50%', cursor: 'pointer',
          fontSize: 13, lineHeight: '18px', textAlign: 'center', padding: 0, zIndex: 11,
        }}
        onMouseDown={e => e.stopPropagation()}
      >×</button>

      {/* 縮放控制點（右下） */}
      <div
        style={{
          position: 'absolute', bottom: -5, right: -5,
          width: 12, height: 12, background: '#6366f1',
          cursor: 'se-resize', borderRadius: 2, zIndex: 11,
        }}
        onMouseDown={e => {
          e.stopPropagation()
          e.preventDefault()
          dragRef.current = {
            type: 'resize',
            startMouseX: e.clientX,
            startMouseY: e.clientY,
            startXPct: seal.xPct,
            startYPct: seal.yPct,
            startWidthPct: seal.widthPct,
          }
        }}
      />
    </div>
  )
}

// ── Page Break Indicator（僅螢幕顯示，不列印）────────────────────────────────

export function PageBreakIndicator({ pages = 3 }: { pages?: number }) {
  return (
    <>
      {Array.from({ length: pages }, (_, i) => i + 1).map(n => (
        <div
          key={n}
          className="no-print"
          style={{
            position: 'absolute',
            top: `calc(${n} * (297mm - 24mm))`,
            left: -12,
            right: -12,
            borderTop: '1.5px dashed #ef4444',
            pointerEvents: 'none',
            zIndex: 20,
          }}
        >
          <span style={{
            position: 'absolute', right: 0, top: -13,
            background: '#ef4444', color: '#fff',
            fontSize: 9, padding: '1px 5px', borderRadius: 3,
            whiteSpace: 'nowrap', fontFamily: 'sans-serif',
          }}>
            第 {n} 頁結束
          </span>
        </div>
      ))}
    </>
  )
}

// ── Print Layer（列印用，依 anchor 決定定位方式）─────────────────────────────

export function SealPrintLayer({ manager }: { manager: SealManager }) {
  if (manager.placedSeals.length === 0) return null

  return (
    <>
      {manager.placedSeals.map(seal => {
        const heightPct = seal.widthPct * 0.75
        // bottom-anchor：從容器底部往上算距離
        // 使用者在螢幕拖曳時看到 top = yPct%，
        // 換算 bottom = 100 - yPct - heightPct（章的下緣距容器底部的距離）
        const bottomPct = 100 - seal.yPct - heightPct

        return (
          <img
            key={seal.uid}
            src={seal.imageBase64}
            style={{
              position: 'absolute',
              left: `${seal.xPct}%`,
              ...(seal.anchor === 'bottom'
                ? { bottom: `${Math.max(0, bottomPct)}%` }
                : { top: `${seal.yPct}%` }
              ),
              width: `${seal.widthPct}%`,
              height: `${heightPct}%`,
              objectFit: 'contain',
              zIndex: 5,
            }}
          />
        )
      })}
    </>
  )
}
