// src/pages/DocsPage.jsx
import { useState, useEffect } from 'react'

export default function DocsPage() {
  const [activeDoc, setActiveDoc] = useState('eula')
  
  // ← ЭТО ГЛАВНОЕ: добавляем timestamp, чтобы iframe не кэшировался
  const [refreshKey, setRefreshKey] = useState(Date.now())

  // При смене документа — обновляем ключ
  useEffect(() => {
    setRefreshKey(Date.now())
  }, [activeDoc])

  const docs = [
    { id: 'eula',    title: 'Лицензионное соглашение',     url: `/api/docs/eula?t=${refreshKey}` },
    { id: 'privacy', title: 'Политика конфиденциальности',url: `/api/docs/privacy?t=${refreshKey}` },
    { id: 'offer',   title: 'Публичная оферта',           url: `/api/docs/offer?t=${refreshKey}` },
  ]

  const currentUrl = docs.find(d => d.id === activeDoc).url

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-7xl font-black text-center mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Юридические документы
        </h1>
        <p className="text-center text-xl text-gray-600 mb-16">
          Все документы актуальны на {new Date().toLocaleDateString('ru-RU')}
        </p>

        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {docs.map(doc => (
            <button
              key={doc.id}
              onClick={() => setActiveDoc(doc.id)}
              className={`p-10 rounded-3xl shadow-xl transition-all transform hover:scale-105 ${
                activeDoc === doc.id
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                  : 'bg-white text-gray-800 hover:shadow-2xl'
              }`}
            >
              <h3 className="text-3xl font-bold">{doc.title}</h3>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden" style={{ height: '900px' }}>
          <iframe
            key={currentUrl}  // ← ЭТО ВТОРОЕ ГЛАВНОЕ — при смене key React пересоздаёт iframe
            src={currentUrl}
            className="w-full h-full border-0"
            title="Юридический документ"
            sandbox="allow-same-origin"
          />
        </div>

        {/* Кнопка принудительного обновления (на всякий случай) */}
        <div className="text-center mt-8">
          <button
            onClick={() => setRefreshKey(Date.now())}
            className="text-indigo-600 hover:text-indigo-800 font-semibold underline"
          >
            Обновить документы
          </button>
        </div>
      </div>
    </div>
  )
}