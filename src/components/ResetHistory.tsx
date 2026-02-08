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


  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl max-h-[80vh] rounded-card bg-white shadow-xl flex flex-col border border-gray-200">
        <div className="flex items-center justify-between border-b border-gray-200 p-5">
          <h2 className="text-xl font-bold text-gray-900">Reset History</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-button bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-neobank-lime"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-500 font-medium">No reset history found.</p>
              <p className="text-sm text-gray-400 mt-1">Tournament has not been reset yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((record) => (
                <div
                  key={record.id}
                  className="rounded-card border border-gray-200 bg-white p-4 shadow-card hover:shadow-card-hover transition-shadow"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="mb-2 text-sm font-semibold text-gray-900">
                        {formatDate(record.reset_at)}
                      </div>
                      {record.city_name ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Location:</span>
                          <span className="text-sm font-medium text-gray-700">{record.city_name}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400">Location not available</div>
                      )}
                    </div>
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
