// src/pages/SettingsPage.jsx
import { useState, useEffect } from 'react'
import styles from '../components/Licensemanager.module.css'  

export default function SettingsPage() {
  const [form, setForm] = useState({})
  const [isSaving, setIsSaving] = useState(false)  

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => setForm(data))
  }, [])

  const handleSave = () => {
    setIsSaving(true)  

    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
      .then(() => {
        // Держим анимацию минимум 3.8 секунды — даже если сервер ответил мгновенно
        setTimeout(() => {
          setIsSaving(false)
          alert('Настройки сохранены!')
        }, 3800)
      })
      .catch(() => {
        setTimeout(() => {
          setIsSaving(false)
          alert('Ошибка сохранения')
        }, 3800)
      })
  }

  const fields = [
    { key: 'company_name', label: 'Название компании' },
    { key: 'legal_name', label: 'Юридическое лицо' },
    { key: 'inn', label: 'ИНН' },
    { key: 'ogrn', label: 'ОГРН' },
    { key: 'legal_address', label: 'Юридический адрес' },
    { key: 'support_email', label: 'Email поддержки' },
    { key: 'website', label: 'Сайт' },
  ]

  return (
    <div className={styles.container}>
      {/* ТВОЯ СТРАНИЦА КАК БЫЛА */}
      <div className={styles.wrapper}>
        <h1 className="text-6xl font-black text-center mb-12 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Настройки компании
        </h1>

        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-4xl mx-auto space-y-8">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-lg font-bold text-gray-700 mb-3">{f.label}</label>
              <input
                type="text"
                value={form[f.key] || ''}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                className="w-full px-6 py-5 rounded-2xl border-2 border-gray-300 focus:border-indigo-600 outline-none text-lg"
              />
            </div>
          ))}

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-2xl py-6 rounded-3xl shadow-2xl transition transform hover:scale-105 disabled:opacity-70"
          >
            {isSaving ? 'Сохраняем...' : 'Сохранить изменения'}
          </button>
        </div>
      </div>

      {/* === КРАСИВАЯ ДОЛГАЯ АНИМАЦИЯ ПРИ СОХРАНЕНИИ === */}
      {isSaving && (
        <div className={styles.saveOverlay}>
          <img 
            src="/cd-disk.gif" 
            alt="Сохранение..." 
            className={styles.saveGif}
          />
          <div className={styles.saveText}>
            Сохраняем настройки...
          </div>
        </div>
      )}
    </div>
  )
}