// src/pages/SettingsPage.jsx — ФИНАЛЬНАЯ ВЕРСИЯ
import { useState, useEffect } from 'react'
import styles from '../components/Licensemanager.module.css'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('company')
  const [form, setForm] = useState({})
  const [rooms, setRooms] = useState([]) // [{index: 0, name: "Кабинет 101"}]
  const [isSaving, setIsSaving] = useState(false)

  // Загружаем ВСЁ при открытии
  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/workplaces').then(r => r.json())
    ]).then(([settings, wp]) => {
      setForm(settings)

      // Формируем список кабинетов с индексами
      const roomList = (wp.rooms || []).map((name, idx) => ({
        index: idx,
        name: name
      }))
      setRooms(roomList)
    })
  }, [])

  const save = () => {
    setIsSaving(true)
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    }).finally(() => setTimeout(() => {
      setIsSaving(false)
      alert('Настройки сохранены!')
    }, 3800))
  }

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <h1 className="text-6xl font-black text-center mb-12 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Настройки компании
        </h1>

        {/* Табы */}
        {/* <div className="flex justify-center gap-6 mb-12">
          <button onClick={() => setActiveTab('company')} className={activeTab === 'company' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-10 py-4 rounded-2xl font-bold shadow-2xl' : 'bg-gray-200 px-10 py-4 rounded-2xl'}>
            Компания
          </button>
          <button onClick={() => setActiveTab('eula')} className={activeTab === 'eula' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-10 py-4 rounded-2xl font-bold shadow-2xl' : 'bg-gray-200 px-10 py-4 rounded-2xl'}>
            EULA
          </button>
        </div> */}

        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-4xl mx-auto space-y-10">

          {/* === КОМПАНИЯ === */}
          {activeTab === 'company' && (
            <>
              {[
                { k: 'company_name', l: 'Название компании' },
                { k: 'legal_name', l: 'Юридическое лицо' },
                { k: 'inn', l: 'ИНН' },
                { k: 'ogrn', l: 'ОГРН' },
                { k: 'legal_address', l: 'Юридический адрес' },
                { k: 'support_email', l: 'Email поддержки' },
                { k: 'website', l: 'Сайт' },
              ].map(f => (
                <div key={f.k}>
                  <label className="block text-lg font-bold text-gray-700 mb-3">{f.l}</label>
                  <input value={form[f.k] || ''} onChange={e => update(f.k, e.target.value)}
                    className="w-full px-6 py-5 rounded-2xl border-2 border-gray-300 focus:border-indigo-600 outline-none text-lg" />
                </div>
              ))}

              {/* ВЫБОР КАБИНЕТА ДЛЯ EULA */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-10 rounded-3xl border-4 border-indigo-300">
                <label className="block text-2xl font-black text-indigo-900 mb-6">
                  Кабинет для таблицы в Лицензионном соглашении
                </label>
                <select
                  value={form.eula_room_filter || ''}
                  onChange={e => update('eula_room_filter', e.target.value)}
                  className="w-full px-8 py-6 rounded-2xl border-4 border-indigo-700 bg-white text-xl font-bold"
                >
                  <option value="">Все кабинеты</option>
                  {rooms.map(room => (
                    <option key={room.index} value={room.index}>
                      {room.name}
                    </option>
                  ))}
                </select>
                <p className="text-lg text-indigo-800 mt-4">
                  Сейчас: <strong>
                    {form.eula_room_filter === '' ? 'Все кабинеты' : rooms.find(r => r.index == form.eula_room_filter)?.name || '—'}
                  </strong>
                </p>
              </div>
            </>
          )}

          {/* === EULA (текст) ===
          {activeTab === 'eula' && (
            <textarea
              rows={25}
              value={form.eula_text || ''}
              onChange={e => update('eula_text', e.target.value)}
              className="w-full px-6 py-5 rounded-2xl border-2 border-gray-300 focus:border-indigo-600 outline-none text-lg font-mono text-sm"
            />
          )} */}

          <button onClick={save} disabled={isSaving}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-3xl py-8 rounded-3xl shadow-2xl hover:scale-105 transition">
            {isSaving ? 'Сохраняем...' : 'Сохранить всё'}
          </button>
        </div>
      </div>

      {isSaving && (
        <div className={styles.saveOverlay}>
          <img src="/cd-disk.gif" alt="Сохранение..." className={styles.saveGif} />
          <div className={styles.saveText}>Сохраняем...</div>
        </div>
      )}
    </div>
  )
}