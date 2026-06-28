"use client"
import { useState, useCallback } from "react"
import Cropper from "react-easy-crop"

function getCroppedImg(imageSrc: string, pixelCrop: any): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image()
    image.src = imageSrc
    image.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = pixelCrop.width
      canvas.height = pixelCrop.height
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height)
      resolve(canvas.toDataURL("image/jpeg"))
    }
  })
}

export default function ImageCropper({ image, onCrop, onCancel, aspect = 16 / 9 }: {
  image: string
  onCrop: (cropped: string) => void
  onCancel: () => void
  aspect?: number
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [applying, setApplying] = useState(false)

  const onCropComplete = useCallback((_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  async function handleCrop() {
    setApplying(true)
    const cropped = await getCroppedImg(image, croppedAreaPixels)
    onCrop(cropped)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-50">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-md mx-4">
        <div className="relative h-72 bg-black">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={applying ? () => {} : setCrop}
            onZoomChange={applying ? () => {} : setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-gray-500">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              disabled={applying}
              onChange={e => setZoom(Number(e.target.value))}
              className="flex-1 disabled:opacity-40"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={onCancel} disabled={applying} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Cancel</button>
            <button
              onClick={handleCrop}
              disabled={applying}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition flex items-center justify-center gap-2 disabled:cursor-not-allowed ${applying ? "bg-gray-200 text-gray-400" : "bg-orange-500 text-white hover:bg-orange-600"}`}
            >
              {applying ? (
                <>
                  <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Applying...
                </>
              ) : "Apply crop"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}