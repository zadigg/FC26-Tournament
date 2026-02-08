import { useEffect, useState } from 'react'
import { getResetHistory } from '../lib/supabaseService'
import type { DatabaseResetHistory } from '../lib/supabase'

interface ResetHistoryProps {
  isOpen: boolean
  onClose: () => void
}

export function ResetHistory({ isOpen, onClose }: ResetHistoryProps) {
  const [history, setHistory] = useState<DatabaseResetHistory[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadHistory()
    }
  }, [isOpen])

  const loadHistory = async () => {
    setIsLoading(true)
    try {
      const data = await getResetHistory()
      setHistory(data)
    } catch (error) {
      console.error('Failed to load reset history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatLocation = (lat: number | null, lng: number | null) => {
    if (lat === null || lng === null) return 'Location not available'
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[80vh] rounded-lg border border-slate-600 bg-slate-800 shadow-xl flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-700 p-4">
          <h2 className="text-xl font-bold text-slate-200">Reset History</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-500"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-violet-600"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              No reset history found. Tournament has not been reset yet.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((record) => (
                <div
                  key={record.id}
                  className="rounded-lg border border-slate-600 bg-slate-700/50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="mb-1 text-sm font-medium text-slate-300">
                        Reset at: {formatDate(record.reset_at)}
                      </div>
                      {record.latitude !== null && record.longitude !== null ? (
                        <div className="text-xs text-slate-400">
                          <div>Location: {formatLocation(record.latitude, record.longitude)}</div>
                          {record.location_accuracy && (
                            <div>Accuracy: ±{Math.round(record.location_accuracy)}m</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">Location not available</div>
                      )}
                    </div>
                    {record.latitude !== null && record.longitude !== null && (
                      <a
                        href={`https://www.google.com/maps?q=${record.latitude},${record.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
                      >
                        View on Map
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
