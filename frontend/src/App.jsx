import { useState, useCallback, useRef, useEffect } from 'react'
import { ReactSortable } from 'react-sortablejs'
import { Upload, FileImage, Download, Trash2, Move, FileText, Expand, X, ChevronLeft, ChevronRight } from 'lucide-react'

function App() {
  const [images, setImages] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState(null)
  const [autoDownload, setAutoDownload] = useState(false)
  const [enlargedImageIndex, setEnlargedImageIndex] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileSelect = useCallback(async (files) => {
    const fileArray = Array.from(files).filter(file => 
      file.type.startsWith('image/jpeg') || file.type.startsWith('image/jpg')
    )
    
    const newImages = []
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i]
      const preview = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target.result)
        reader.readAsDataURL(file)
      })
      
      newImages.push({
        id: Date.now() + Math.random() + i,
        file: file,
        preview: preview,
        name: file.name
      })
    }
    
    setImages(prev => [...prev, ...newImages])
  }, [])

  // Generate base filename from image names
  const generateBaseFilename = useCallback((imageList) => {
    if (imageList.length === 0) return 'generated.pdf'
    if (imageList.length === 1) {
      const name = imageList[0].name
      return name.replace(/\.[^/.]+$/, '') + '.pdf'
    }
    
    // Find common base name
    const names = imageList.map(img => img.name.replace(/\.[^/.]+$/, ''))
    let commonBase = ''
    
    // Find common prefix
    for (let i = 0; i < names[0].length; i++) {
      const char = names[0][i]
      if (names.every(name => name[i] === char)) {
        commonBase += char
      } else {
        break
      }
    }
    
    // Remove trailing numbers, dashes, spaces
    commonBase = commonBase.replace(/[-\s\d]+$/, '')
    
    return commonBase ? commonBase + '.pdf' : 'generated.pdf'
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    const files = e.dataTransfer.files
    handleFileSelect(files)
  }, [handleFileSelect])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const removeImage = useCallback((id) => {
    setImages(prev => prev.filter(img => img.id !== id))
  }, [])

  const generatePdf = async () => {
    if (images.length === 0) return

    setIsGenerating(true)
    setProgress(0)
    setGeneratedPdfUrl(null)

    try {
      const formData = new FormData()
      // Add images in the exact order they appear in the array
      images.forEach((image) => {
        formData.append('images', image.file)
      })

      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev
          return prev + Math.random() * 15
        })
      }, 200)

      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        body: formData
      })

      clearInterval(progressInterval)
      setProgress(100)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate PDF')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      setGeneratedPdfUrl(url)

      // Auto download if checkbox is checked
      if (autoDownload) {
        const filename = generateBaseFilename(images)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }

    } catch (error) {
      alert(`Error generating PDF: ${error.message}`)
    } finally {
      setIsGenerating(false)
      setTimeout(() => setProgress(0), 2000)
    }
  }

  const downloadPdf = () => {
    if (generatedPdfUrl) {
      const filename = generateBaseFilename(images)
      const a = document.createElement('a')
      a.href = generatedPdfUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  const handleEnlargeImage = useCallback((image) => {
    const index = images.findIndex(img => img.id === image.id)
    setEnlargedImageIndex(index)
  }, [images])

  const handleCloseModal = useCallback(() => {
    setEnlargedImageIndex(null)
  }, [])

  const handlePrevImage = useCallback(() => {
    setEnlargedImageIndex(prev => {
      if (prev === null) return null
      return prev > 0 ? prev - 1 : images.length - 1 // Loop to last image
    })
  }, [images.length])

  const handleNextImage = useCallback(() => {
    setEnlargedImageIndex(prev => {
      if (prev === null) return null
      return prev < images.length - 1 ? prev + 1 : 0 // Loop to first image
    })
  }, [images.length])

  const handleThumbnailClick = useCallback((index) => {
    setEnlargedImageIndex(index)
  }, [])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (enlargedImageIndex !== null) {
        switch (e.key) {
          case 'Escape':
            setEnlargedImageIndex(null)
            break
          case 'ArrowLeft':
            handlePrevImage()
            break
          case 'ArrowRight':
            handleNextImage()
            break
        }
      }
    }

    if (enlargedImageIndex !== null) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [enlargedImageIndex, handlePrevImage, handleNextImage])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            JPG to PDF Converter
          </h1>
          <p className="text-gray-600 text-lg">
            Upload your JPG images and convert them to a single PDF file
          </p>
        </div>

        {/* Upload Area */}
        <div 
          className="bg-white rounded-lg shadow-lg p-8 mb-8 border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-xl font-medium text-gray-900 mb-2">
              Drop your JPG files here
            </p>
            <p className="text-gray-500 mb-4">
              or click to select files
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Select Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,image/jpeg"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
          </div>
        </div>

        {/* Images Preview */}
        {images.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <FileImage className="mr-2 h-5 w-5" />
                Images ({images.length})
              </h2>
              <p className="text-sm text-gray-500 flex items-center">
                <Move className="mr-1 h-4 w-4" />
                Drag to reorder
              </p>
            </div>
            
            <ReactSortable 
              list={images} 
              setList={setImages}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4"
              animation={150}
              ghostClass="opacity-50"
            >
              {images.map((image, index) => (
                <div key={image.id} className="relative group cursor-move">
                  <div className="bg-gray-100 rounded-lg overflow-hidden aspect-square">
                    <img 
                      src={image.preview} 
                      alt={image.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute top-2 left-2 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <button
                    onClick={() => handleEnlargeImage(image)}
                    className="absolute top-2 right-8 bg-green-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-green-600"
                    title="Enlarge image"
                  >
                    <Expand className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => removeImage(image.id)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove image"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <p className="mt-2 text-xs text-gray-600 truncate">
                    {image.name}
                  </p>
                </div>
              ))}
            </ReactSortable>
          </div>
        )}

        {/* Generate PDF Section */}
        {images.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-center">
              {/* Auto Download Checkbox */}
              <div className="mb-6">
                <label className="flex items-center justify-center text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={autoDownload}
                    onChange={(e) => setAutoDownload(e.target.checked)}
                    className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  Download Automatically
                </label>
              </div>

              {!isGenerating && (
                <button
                  onClick={generatePdf}
                  className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-lg font-medium text-lg transition-colors flex items-center mx-auto mb-4"
                >
                  <FileText className="mr-2 h-5 w-5" />
                  Generate PDF ({images.length} pages)
                </button>
              )}

              {isGenerating && (
                <div className="mb-4">
                  <p className="text-gray-700 mb-2">Generating PDF...</p>
                  <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
                    <div 
                      className="bg-blue-500 h-4 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-500">{Math.round(progress)}% complete</p>
                </div>
              )}

              {generatedPdfUrl && !autoDownload && (
                <div className="text-center">
                  <p className="text-green-600 font-medium mb-4">
                    ✅ PDF generated successfully!
                  </p>
                  <button
                    onClick={downloadPdf}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 rounded-lg font-medium text-lg transition-colors flex items-center mx-auto"
                  >
                    <Download className="mr-2 h-5 w-5" />
                    Download PDF
                  </button>
                </div>
              )}

              {generatedPdfUrl && autoDownload && (
                <div className="text-center">
                  <p className="text-green-600 font-medium mb-4">
                    ✅ PDF generated and downloaded automatically!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {images.length === 0 && (
          <div className="text-center text-gray-500 mt-12">
            <FileImage className="mx-auto h-16 w-16 text-gray-300 mb-4" />
            <p className="text-xl">No images selected</p>
            <p>Upload some JPG files to get started</p>
          </div>
        )}
      </div>

      {/* Image Carousel Modal */}
      {enlargedImageIndex !== null && images[enlargedImageIndex] && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50"
          onClick={(e) => {
            // Close modal when clicking on overlay 
            if (e.target === e.currentTarget) {
              handleCloseModal()
            }
          }}
        >
          {/* Close button */}
          <button
            onClick={handleCloseModal}
            className="absolute top-4 right-4 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full p-2 transition-all z-60"
            title="Close (Esc)"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Navigation arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={handlePrevImage}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full p-3 transition-all"
                title="Previous image (←)"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              
              <button
                onClick={handleNextImage}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full p-3 transition-all"
                title="Next image (→)"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Main image container */}
          <div className="flex items-center justify-center h-full pb-32 pt-16">
            <img 
              src={images[enlargedImageIndex].preview}
              alt={images[enlargedImageIndex].name}
              className="max-h-full max-w-full object-contain select-none"
              draggable={false}
            />
          </div>

          {/* Bottom panel with thumbnails */}
          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 p-4">
            {/* Image info */}
            <div className="text-center mb-4">
              <p className="text-white text-sm">
                {images[enlargedImageIndex].name} ({enlargedImageIndex + 1} of {images.length})
              </p>
            </div>

            {/* Thumbnail carousel */}
            {images.length > 1 && (
              <div className="flex justify-center gap-2 overflow-x-auto pb-2">
                {images.map((image, index) => (
                  <div
                    key={image.id}
                    className={`relative cursor-pointer flex-shrink-0 ${
                      index === enlargedImageIndex 
                        ? 'ring-2 ring-blue-400' 
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    onClick={() => handleThumbnailClick(index)}
                  >
                    <img
                      src={image.preview}
                      alt={image.name}
                      className="w-16 h-16 object-cover rounded"
                      draggable={false}
                    />
                    {/* Page number overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="bg-black bg-opacity-70 text-white text-xs font-bold px-1 rounded">
                        {index + 1}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App