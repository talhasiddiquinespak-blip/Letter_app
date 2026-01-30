'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export default function History() {
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)

  useEffect(() => {
    fetchScans()
  }, [page])

  const fetchScans = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`${API_URL}/api/scan?page=${page}&limit=10`)
      setScans(response.data.data)
      setPagination(response.data.pagination)
    } catch (error) {
      toast.error('Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <div className="processing-spinner" />
          <span className="ml-3 text-gray-600">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="text-2xl font-bold mb-6">Scan History</h2>

      {scans.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500">No scans yet</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-6">
            {scans.map((scan) => (
              <div key={scan.id} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{scan.originalName}</h3>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                        {scan.processingStatus}
                      </span>
                    </div>
                    {scan.subject && <p className="text-gray-700 mb-2">{scan.subject}</p>}
                  </div>
                  {scan.aiConfidence && (
                    <div className="text-right ml-4">
                      <div className="text-2xl font-bold text-green-600">
                        {(scan.aiConfidence * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-500">confidence</div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600 mb-1 font-medium">From</div>
                    <p className="text-gray-800">{scan.fromField || 'N/A'}</p>
                  </div>
                  <div>
                    <div className="text-gray-600 mb-1 font-medium">To</div>
                    <p className="text-gray-800">{scan.toField || 'N/A'}</p>
                  </div>
                  <div>
                    <div className="text-gray-600 mb-1 font-medium">Date</div>
                    <p className="text-gray-800">{scan.dateField || 'N/A'}</p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
                  Scanned: {new Date(scan.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary px-4 py-2 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="btn-secondary px-4 py-2 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
