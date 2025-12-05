// src/pages/DocsPage.jsx
import { useState, useEffect } from 'react'

export default function DocsPage() {
  const [activeDoc, setActiveDoc] = useState('eula')
  const [refreshKey, setRefreshKey] = useState(Date.now())

  // Обновляем refreshKey при смене документа
  useEffect(() => {
    setRefreshKey(Date.now())
  }, [activeDoc])

  // Всегда свежий URL с текущим refreshKey
  const getUrl = (path) => `/api/docs/${path}?t=${refreshKey}`

  const docs = [
    { id: 'eula',     title: 'Лицензионное соглашение',     path: 'eula' },
    { id: 'privacy',  title: 'Политика конфиденциальности',path: 'privacy' },
    { id: 'offer',    title: 'Публичная оферта',           path: 'offer' },
    { id: 'payment',  title: 'Платёжное поручение',        path: 'payment' },
    { id: 'invoice',  title: 'Товарная накладная',         path: 'invoice' },
  ]

  const currentDoc = docs.find(d => d.id === activeDoc)
  const isEula = activeDoc === 'eula'

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-12 px-6">
      <div className="max-w-7xl mx-auto">

        <h1 className="text-6xl md:text-7xl font-black text-center mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Юридические документы
        </h1>
        <p className="text-center text-lg md:text-xl text-gray-600 mb-12">
          Все документы актуальны на {new Date().toLocaleDateString('ru-RU', { 
            day: '2-digit', month: 'long', year: 'numeric' 
          })}
        </p>

        {/* Кнопки */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {docs.map(doc => (
            <button
              key={doc.id}
              onClick={() => setActiveDoc(doc.id)}
              className={`p-8 rounded-3xl shadow-xl transition-all transform hover:scale-105 font-bold text-xl
                ${activeDoc === doc.id
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-2xl'
                  : 'bg-white text-gray-800 border-2 border-gray-200 hover:shadow-xl'
                }`}
            >
              {doc.title}
            </button>
          ))}
        </div>

        {/* Главный документ — всегда свежий URL */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border-4 border-gray-200 mb-12" style={{ height: '1000px' }}>
          <iframe
            key={refreshKey}  // ← КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: перерисовка iframe при обновлении
            src={getUrl(currentDoc.path)}
            className="w-full h-full border-0"
            title={currentDoc.title}
            sandbox="allow-same-origin allow-popups allow-scripts"
            loading="lazy"
          />
        </div>

        {/* Таблица только для EULA */}
        {isEula && (
          <div className="bg-white rounded-3xl shadow-2xl p-10 border-4 border-indigo-300">
            <h2 className="text-4xl font-black text-center mb-8 text-indigo-700">
              Активные лицензии (на момент формирования)
            </h2>
            <iframe
              key={`table-${refreshKey}`}  // ← И здесь тоже key, чтобы обновлялось
              src={getUrl('eula-table')}
              className="w-full border-0 rounded-2xl shadow-inner"
              style={{ height: '600px' }}
              title="Таблица активных рабочих мест"
              sandbox="allow-same-origin allow-scripts"
              loading="lazy"
            />
          </div>
        )}

        {/* Кнопка обновления */}
        <div className="text-center mt-16">
          <button
            onClick={() => setRefreshKey(Date.now())}
            className="px-12 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-xl rounded-full shadow-2xl hover:shadow-purple-500/50 transform hover:scale-110 transition duration-300"
          >
            Обновить документы и таблицу
          </button>
          <p className="text-gray-500 mt-4 text-sm">
            Используется при смене кабинета в настройках
          </p>
        </div>

      </div>
    </div>
  )
}