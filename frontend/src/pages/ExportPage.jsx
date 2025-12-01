// src/pages/ExportPage.jsx
import { useState, useRef } from 'react'

export default function ExportPage() {
  const [showModal, setShowModal] = useState(false)
  const [importType, setImportType] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [uploading, setUploading] = useState(false)

  const fileInputRef = useRef(null)

  const openImport = (type) => {
    setImportType(type)
    setShowModal(true)
    setAgreed(false)
  }

  const handleImport = async () => {
    if (!agreed || !fileInputRef.current?.files[0]) return

    setUploading(true)
    const file = fileInputRef.current.files[0]
    const formData = new FormData()
    formData.append('file', file)
    formData.append('format', importType)

    try {
      const res = await fetch('/api/licenses/import', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      alert(data.message || 'Импорт завершён!')
      setShowModal(false)
    } catch (err) {
      alert('Ошибка импорта')
    } finally {
      setUploading(false)
    }
  }

  const download = (format) => {
    window.location.href = `/api/licenses/export?format=${format}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-7xl font-black text-center mb-16 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Импорт и Экспорт лицензий
        </h1>

        <div className="grid md:grid-cols-2 gap-12">
          {/* ЭКСПОРТ */}
          <div className="bg-white rounded-3xl shadow-2xl p-16 text-center">
            <h2 className="text-4xl font-bold mb-10 text-gray-800">Экспорт</h2>
            <div className="space-y-8">
              <button onClick={() => download('csv')} className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-3xl py-12 rounded-3xl shadow-2xl transition transform hover:scale-105">
                Скачать CSV
              </button>
              <button onClick={() => download('xlsx')} className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold text-3xl py-12 rounded-3xl shadow-2xl transition transform hover:scale-105">
                Скачать Excel (.xlsx)
              </button>
            </div>
          </div>

          {/* ИМПОРТ */}
          <div className="bg-white rounded-3xl shadow-2xl p-16 text-center">
            <h2 className="text-4xl font-bold mb-10 text-gray-800">Импорт</h2>
            <div className="space-y-8">
              <button onClick={() => openImport('csv')} className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-bold text-3xl py-12 rounded-3xl shadow-2xl transition transform hover:scale-105">
                Импорт из CSV
              </button>
              <button onClick={() => openImport('xlsx')} className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-bold text-3xl py-12 rounded-3xl shadow-2xl transition transform hover:scale-105">
                Импорт из Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* МОДАЛЬНОЕ ОКНО */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl shadow-3xl p-12 max-w-2xl w-full">
            <h3 className="text-4xl font-black text-gray-800 mb-8">Подтверждение импорта</h3>
            <p className="text-xl text-gray-700 leading-relaxed mb-10">
              Я подтверждаю, что импортируемые лицензии созданы мной или я имею полное право на их использование. 
              Я понимаю, что импорт создаст новые лицензионные ключи в системе.
            </p>

            <label className="flex items-center gap-6 cursor-pointer mb-10">
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="w-10 h-10 rounded-lg accent-indigo-600" />
              <span className="text-2xl font-semibold text-gray-800">Я подтверждаю и принимаю условия</span>
            </label>

            <input type="file" ref={fileInputRef} accept={importType === 'csv' ? '.csv' : '.xlsx,.xls'} className="block w-full text-lg mb-10 file:mr-6 file:py-6 file:px-10 file:rounded-2xl file:border-0 file:bg-indigo-600 file:text-white hover:file:bg-indigo-700" />

            <div className="flex gap-6">
              <button onClick={handleImport} disabled={!agreed || uploading} className={`flex-1 py-8 rounded-3xl font-bold text-2xl transition ${agreed && !uploading ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-2xl' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>
                {uploading ? 'Импортируем...' : 'Импортировать'}
              </button>
              <button onClick={() => setShowModal(false)} className="flex-1 py-8 bg-gray-500 hover:bg-gray-600 text-white rounded-3xl font-bold text-2xl transition">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}