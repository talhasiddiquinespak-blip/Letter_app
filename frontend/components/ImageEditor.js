'use client'

import { useState, useRef, useEffect } from 'react'

export default function ImageEditor({ image, onProcess, onCancel, processing }) {
  const [editedImage, setEditedImage] = useState(image)
  const [rotation, setRotation] = useState(0)
  const [enhanced, setEnhanced] = useState(false)
  const canvasRef = useRef(null)

  useEffect(() => {
    renderImage(image, rotation, enhanced)
  }, [image])

  const renderImage = (src, rot, enh) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      if (rot === 90 || rot === 270) {
        canvas.width = img.height
        canvas.height = img.width
      } else {
        canvas.width = img.width
        canvas.height = img.height
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((rot * Math.PI) / 180)
      ctx.drawImage(img, -img.width / 2, -img.height / 2)
      ctx.restore()

      if (enh) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        const contrast = 1.2
        const brightness = 10

        for (let i = 0; i < data.length; i += 4) {
          data[i] = ((data[i] - 128) * contrast + 128) + brightness
          data[i + 1] = ((data[i + 1] - 128) * contrast + 128) + brightness
          data[i + 2] = ((data[i + 2] - 128) * contrast + 128) + brightness
        }

        ctx.putImageData(imageData, 0, 0)
      }

      setEditedImage(canvas.toDataURL('image/jpeg', 0.95))
    }

    img.src = src
  }

  const handleRotate = () => {
    const newRotation = (rotation + 90) % 360
    setRotation(newRotation)
    renderImage(image, newRotation, enhanced)
  }

  const handleEnhance = () => {
    const newEnhanced = !enhanced
    setEnhanced(newEnhanced)
    renderImage(image, rotation, newEnhanced)
  }

  return (
    <div className="card">
      <h3 className="text-xl font-bold mb-4">Edit & Enhance</h3>

      <div className="relative mb-4 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center min-h-[300px]">
        <canvas ref={canvasRef} className="max-w-full max-h-[500px]" />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button onClick={handleRotate} disabled={processing} className="btn-secondary flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Rotate
        </button>
        <button
          onClick={handleEnhance}
          disabled={processing}
          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            enhanced ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-300'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          {enhanced ? 'Enhanced' : 'Enhance'}
        </button>
      </div>

      <div className="flex gap-3">
        <button onClick={() => onProcess(editedImage)} disabled={processing} className="btn-primary flex-1 flex items-center justify-center gap-2">
          {processing ? (
            <>
              <div className="processing-spinner" />
              Processing...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Process Letter
            </>
          )}
        </button>
        <button onClick={onCancel} disabled={processing} className="btn-secondary flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Cancel
        </button>
      </div>

      {processing && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800 text-center">
            <strong>Processing...</strong><br />Running OCR & AI extraction
          </p>
        </div>
      )}
    </div>
  )
}
