'use client'

import { useState, useRef, useEffect } from 'react'

export default function ImageEditor({ image, onProcess, onCancel, processing }) {
  const [editedImage, setEditedImage] = useState(image)
  const [rotation, setRotation] = useState(0)
  const [brightness, setBrightness] = useState(0)
  const [contrast, setContrast] = useState(0)
  const [mode, setMode] = useState('normal') // normal, blackwhite, grayscale
  const canvasRef = useRef(null)

  useEffect(() => {
    renderImage(image, rotation, brightness, contrast, mode)
  }, [image])

  const renderImage = (src, rot, bright, contr, filterMode) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      // Set canvas size based on rotation
      if (rot === 90 || rot === 270) {
        canvas.width = img.height
        canvas.height = img.width
      } else {
        canvas.width = img.width
        canvas.height = img.height
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Apply rotation
      ctx.save()
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((rot * Math.PI) / 180)
      ctx.drawImage(img, -img.width / 2, -img.height / 2)
      ctx.restore()

      // Get image data for processing
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      // CamScanner-style filters
      if (filterMode === 'blackwhite') {
        // High contrast black & white (like CamScanner)
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
          const threshold = 140 + bright
          const value = avg > threshold ? 255 : 0
          data[i] = data[i + 1] = data[i + 2] = value
        }
      } else if (filterMode === 'grayscale') {
        // Grayscale with enhancement
        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
          const enhanced = gray + bright
          data[i] = data[i + 1] = data[i + 2] = enhanced
        }
      }

      // Apply brightness and contrast
      const contrastFactor = (259 * (contr + 255)) / (255 * (259 - contr))
      for (let i = 0; i < data.length; i += 4) {
        data[i] = contrastFactor * (data[i] - 128) + 128 + bright
        data[i + 1] = contrastFactor * (data[i + 1] - 128) + 128 + bright
        data[i + 2] = contrastFactor * (data[i + 2] - 128) + 128 + bright
        
        // Clamp values
        data[i] = Math.max(0, Math.min(255, data[i]))
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1]))
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2]))
      }

      ctx.putImageData(imageData, 0, 0)
      setEditedImage(canvas.toDataURL('image/jpeg', 0.95))
    }

    img.src = src
  }

  const handleRotate = () => {
    const newRotation = (rotation + 90) % 360
    setRotation(newRotation)
    renderImage(image, newRotation, brightness, contrast, mode)
  }

  const handleModeChange = (newMode) => {
    setMode(newMode)
    renderImage(image, rotation, brightness, contrast, newMode)
  }

  const handleBrightness = (value) => {
    setBrightness(value)
    renderImage(image, rotation, value, contrast, mode)
  }

  const handleContrast = (value) => {
    setContrast(value)
    renderImage(image, rotation, brightness, value, mode)
  }

  const autoEnhance = () => {
    // CamScanner-style auto enhancement
    setMode('blackwhite')
    setBrightness(10)
    setContrast(30)
    renderImage(image, rotation, 10, 30, 'blackwhite')
  }

  return (
    <div className="card">
      <h3 className="text-xl font-bold mb-4">Enhance Document</h3>

      <div className="relative mb-4 rounded-xl overflow-hidden bg-gray-900 flex items-center justify-center min-h-[300px]">
        <canvas ref={canvasRef} className="max-w-full max-h-[500px]" />
      </div>

      {/* CamScanner-style mode buttons */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <button
          onClick={() => handleModeChange('normal')}
          className={`p-3 rounded-lg text-sm font-medium transition-all ${
            mode === 'normal' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Original
        </button>
        <button
          onClick={() => handleModeChange('grayscale')}
          className={`p-3 rounded-lg text-sm font-medium transition-all ${
            mode === 'grayscale' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Grayscale
        </button>
        <button
          onClick={() => handleModeChange('blackwhite')}
          className={`p-3 rounded-lg text-sm font-medium transition-all ${
            mode === 'blackwhite' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          B&W
        </button>
        <button
          onClick={autoEnhance}
          className="p-3 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-all"
        >
          ✨ Auto
        </button>
      </div>

      {/* Brightness and Contrast sliders */}
      <div className="space-y-3 mb-6">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Brightness: {brightness}
          </label>
          <input
            type="range"
            min="-50"
            max="50"
            value={brightness}
            onChange={(e) => handleBrightness(parseInt(e.target.value))}
            className="w-full"
            disabled={processing}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Contrast: {contrast}
          </label>
          <input
            type="range"
            min="-50"
            max="50"
            value={contrast}
            onChange={(e) => handleContrast(parseInt(e.target.value))}
            className="w-full"
            disabled={processing}
          />
        </div>
      </div>

      {/* Control buttons */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <button onClick={handleRotate} disabled={processing} className="btn-secondary flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Rotate
        </button>
        <button
          onClick={() => {
            setBrightness(0)
            setContrast(0)
            setMode('normal')
            renderImage(image, rotation, 0, 0, 'normal')
          }}
          disabled={processing}
          className="btn-secondary flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reset
        </button>
        <button
          onClick={autoEnhance}
          disabled={processing}
          className="btn-secondary flex items-center justify-center gap-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          Magic
        </button>
      </div>

      {/* Action buttons */}
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
              Scan Document
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
            <strong>Scanning document...</strong><br />
            Running OCR and AI extraction
          </p>
        </div>
      )}
    </div>
  )
}
