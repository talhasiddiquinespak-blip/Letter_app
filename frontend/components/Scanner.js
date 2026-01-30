'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Webcam from 'react-webcam'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import toast from 'react-hot-toast'
import ImageEditor from './ImageEditor'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export default function Scanner({ onScanComplete }) {
  const [mode, setMode] = useState('upload')
  const [capturedImage, setCapturedImage] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const webcamRef = useRef(null)

  // Debug: Log API URL
  useEffect(() => {
    console.log('API URL:', API_URL)
  }, [])

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      const reader = new FileReader()
      reader.onload = () => {
        setCapturedImage({ data: reader.result, file })
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'] },
    maxFiles: 1,
    maxSize: 10485760
  })

  const capturePhoto = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot()
    if (imageSrc) {
      fetch(imageSrc)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' })
          setCapturedImage({ data: imageSrc, file })
          setMode('upload')
        })
    }
  }, [])

  const processImage = async (processedImage) => {
    setProcessing(true)
    setResult(null)

    try {
      console.log('Sending request to:', `${API_URL}/api/scan`)
      
      const formData = new FormData()
      
      if (processedImage) {
        const blob = await (await fetch(processedImage)).blob()
        formData.append('letter', blob, 'letter.jpg')
      } else {
        formData.append('letter', capturedImage.file)
      }

      const response = await axios.post(`${API_URL}/api/scan`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000 // 60 second timeout
      })

      console.log('Response:', response.data)
      setResult(response.data)
      toast.success('Letter processed!')
      if (onScanComplete) onScanComplete()
    } catch (error) {
      console.error('Full error:', error)
      console.error('Error response:', error.response)
      
      let errorMessage = 'Processing failed'
      if (error.response) {
        errorMessage = error.response.data?.message || `Server error: ${error.response.status}`
      } else if (error.request) {
        errorMessage = 'Cannot connect to server. Check your backend URL.'
      } else {
        errorMessage = error.message
      }
      
      toast.error(errorMessage)
    } finally {
      setProcessing(false)
    }
  }

  const reset = () => {
    setCapturedImage(null)
    setResult(null)
    setMode('upload')
  }

  return (
    <div className="max-w-4xl mx-auto">
      {!capturedImage && !result && (
        <div className="card mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setMode('upload')}
              className={`p-6 rounded-xl border-2 transition-all ${
                mode === 'upload' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <svg className="w-12 h-12 mx-auto mb-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <h3 className="font-semibold text-lg">Upload Image</h3>
              <p className="text-sm text-gray-600 mt-1">Choose from files</p>
            </button>
            <button
              onClick={() => setMode('camera')}
              className={`p-6 rounded-xl border-2 transition-all ${
                mode === 'camera' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <svg className="w-12 h-12 mx-auto mb-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
              <h3 className="font-semibold text-lg">Use Camera</h3>
              <p className="text-sm text-gray-600 mt-1">Take a photo</p>
            </button>
          </div>
        </div>
      )}

      {mode === 'upload' && !capturedImage && !result && (
        <div className="card">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
              isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'
            }`}
          >
            <input {...getInputProps()} />
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-lg font-medium text-gray-700 mb-2">
              {isDragActive ? 'Drop the image here' : 'Drag & drop an image'}
            </p>
            <p className="text-sm text-gray-500">or click to select a file</p>
            <p className="text-xs text-gray-400 mt-3">JPG, PNG (max 10MB)</p>
          </div>
        </div>
      )}

      {mode === 'camera' && !capturedImage && (
        <div className="card">
          <div className="relative rounded-xl overflow-hidden bg-black">
            <Webcam
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              className="w-full"
              videoConstraints={{ facingMode: 'environment' }}
            />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={capturePhoto} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
              Capture
            </button>
            <button onClick={() => setMode('upload')} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {capturedImage && !result && (
        <ImageEditor image={capturedImage.data} onProcess={processImage} onCancel={reset} processing={processing} />
      )}

      {result && (
        <div className="card">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-xl font-bold">Processing Complete</h3>
              <p className="text-gray-600">Letter registered in Excel</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="text-sm font-medium text-gray-600">From</label>
              <p className="text-lg font-semibold mt-1">{result.data.extractedFields.from || 'N/A'}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="text-sm font-medium text-gray-600">To</label>
              <p className="text-lg font-semibold mt-1">{result.data.extractedFields.to || 'N/A'}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="text-sm font-medium text-gray-600">Date</label>
              <p className="text-lg font-semibold mt-1">{result.data.extractedFields.date || 'N/A'}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="text-sm font-medium text-gray-600">Subject</label>
              <p className="text-lg font-semibold mt-1">{result.data.extractedFields.subject || 'N/A'}</p>
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-900">Confidence</span>
              <span className="text-lg font-bold text-blue-600">
                {(result.data.confidence.combined * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${result.data.confidence.combined * 100}%` }}
              />
            </div>
          </div>

          <div className="p-4 bg-green-50 rounded-lg mb-6">
            <div className="flex items-center gap-2 text-green-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">Excel Row #{result.data.excel.rowNumber}</span>
            </div>
          </div>

          <button onClick={reset} className="btn-primary w-full">Scan Another Letter</button>
        </div>
      )}
    </div>
  )
}
