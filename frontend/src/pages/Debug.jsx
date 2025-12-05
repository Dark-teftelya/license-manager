// src/pages/Debug.jsx — временная страница для отладки
import { useState, useEffect } from 'react'

export default function Debug() {
  const [data, setData] = useState({})

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/workplaces').then(r => r.json())
    ]).then(([settings, workplaces]) => {
      setData({ settings, workplaces })
    })
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white p-10 font-mono text-sm">
      <h1 className="text-4xl mb-8 text-green-400">ОТЛАДКА — что у нас в БД</h1>
      
      <div className="grid md:grid-cols-2 gap-10">
        <div>
          <h2 className="text-2xl text-yellow-400 mb-4">1. Настройки (settings)</h2>
          <pre className="bg-black p-6 rounded-lg overflow-auto">
            {JSON.stringify(data.settings, null, 2)}
          </pre>
          <p className="mt-4 text-cyan-400">
            Ищи здесь: <strong>eula_room_filter</strong> — должен быть ID кабинета (например "1", "203")
          </p>
        </div>

        <div>
          <h2 className="text-2xl text-yellow-400 mb-4">2. Рабочие места (workplaces_config)</h2>
          <pre className="bg-black p-6 rounded-lg overflow-auto max-h-96">
            {JSON.stringify(data.workplaces, null, 2)}
          </pre>
          <p className="mt-4 text-cyan-400">
            Проверь: <br/>
            • Есть ли <strong>rooms</strong> с форматом "ID:Название"? <br/>
            • У устройств <strong>roomId</strong> — число или строка?
          </p>
        </div>
      </div>

      <div className="mt-10 text-pink-400">
        <p>Открой эту страницу: <strong>/debug</strong></p>
        <p>Добавь в роуты: {'<Route path="/debug" element={<Debug />} />'}</p>
      </div>
    </div>
  )
}