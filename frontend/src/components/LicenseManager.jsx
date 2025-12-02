import React, { useState, useEffect } from 'react'
import styles from './LicenseManager.module.css'

const LicenseManager = () => {
  const [licenses, setLicenses] = useState([])
  const [allLicenses, setAllLicenses] = useState([])
  const [search, setSearch] = useState('')
  const [activations, setActivations] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  
  const [form, setForm] = useState({ 
    description: '', 
    expiry_date: '', 
    max_uses: 5,
    cost: '', 
    supplier: '' 
  })

  const [validateKey, setValidateKey] = useState('')
  const [validationResult, setValidationResult] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ 
    description: '', 
    expiry_date: '', 
    max_uses: 0, 
    cost: 0, 
    supplier: '' 
  })

  // Определяем браузер один раз
  const getBrowserInfo = () => {
    const ua = navigator.userAgent
    let browser = 'Неизвестно'
    if (ua.includes('Chrome')) browser = 'Google Chrome'
    else if (ua.includes('Firefox')) browser = 'Mozilla Firefox'
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari'
    else if (ua.includes('Edg')) browser = 'Microsoft Edge'
    return browser
  }

  useEffect(() => {
    const saved = localStorage.getItem('license-activations')
    if (saved) {
      try {
        setActivations(JSON.parse(saved))
      } catch {
        setActivations([])
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('license-activations', JSON.stringify(activations))
  }, [activations])

  useEffect(() => {
    fetchLicenses()
  }, [])

  useEffect(() => {
    const lowerSearch = search.toLowerCase()
    const filtered = allLicenses.filter(l => 
      l.description?.toLowerCase().includes(lowerSearch) ||
      l.key?.toLowerCase().includes(lowerSearch) ||
      l.supplier?.toLowerCase().includes(lowerSearch)
    )
    setLicenses(filtered)
  }, [search, allLicenses])

  const fetchLicenses = async () => {
    try {
      const res = await fetch('/api/licenses')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAllLicenses(data || [])
    } catch (err) {
      showToast('Ошибка подключения к серверу', 'error')
    }
  }

  const withLoading = async (cb) => {
    setIsLoading(true)
    const minDuration = 3800
    const startTime = Date.now()

    try {
      await cb()
    } finally {
      const elapsed = Date.now() - startTime
      const remaining = minDuration - elapsed
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining))
      }
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    await withLoading(async () => {
      const res = await fetch('/api/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: form.description,
          expiry_date: form.expiry_date,
          max_uses: parseInt(form.max_uses) || 5,
          cost: parseFloat(form.cost) || 0,
          supplier: form.supplier || 'Не указан'
        })
      })

      if (res.ok) {
        const { key } = await res.json()
        setForm({ description: '', expiry_date: '', max_uses: 5, cost: '', supplier: '' })
        await fetchLicenses()
        navigator.clipboard.writeText(key)
        showToast(`Лицензия создана! Ключ скопирован: ${key}`)
      } else {
        showToast('Ошибка создания лицензии', 'error')
      }
    })
  }

  const handleDelete = async (id) => {
    if (!confirm('Удалить лицензию навсегда?')) return
    await withLoading(async () => {
      const res = await fetch(`/api/licenses/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchLicenses()
        showToast('Лицензия удалена')
      }
    })
  }

  const handleValidate = async () => {
    if (!validateKey.trim()) return

    const keyToSend = validateKey.trim().toUpperCase()
    setValidateKey(keyToSend)

    await withLoading(async () => {
      const res = await fetch('/api/licenses/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: keyToSend })
      })

      const data = await res.json()
      setValidationResult(data)

      if (data.valid) {
        await fetchLicenses()

        const deviceName = prompt('На каком компьютере активирован ключ?', 'PC-ИВАНОВ') || 'Неизвестное устройство'

        const newActivation = {
          id: Date.now(),
          key: keyToSend,
          activated_at: new Date().toISOString(),
          activated_on: deviceName,
          browser: getBrowserInfo()
        }
        setActivations(prev => [newActivation, ...prev].slice(0, 50))

        showToast(`Активировано на: ${deviceName} (${getBrowserInfo()})`)
        setValidateKey('')
      } else {
        showToast(data.error || 'Ключ недействителен', 'error')
      }
    })
  }

  const startEdit = (l) => {
    setEditingId(l.id)
    setEditForm({
      description: l.description || '',
      expiry_date: l.expiry_date?.split('T')[0] || '',
      max_uses: l.max_uses || 5,
      cost: l.cost || 0,
      supplier: l.supplier || ''
    })
  }

  const saveEdit = async () => {
    await withLoading(async () => {
      const res = await fetch(`/api/licenses/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })
      if (res.ok) {
        setEditingId(null)
        await fetchLicenses()
        showToast('Лицензия обновлена')
      }
    })
  }

  const showToast = (msg, type = 'success') => {
    const colors = { success: 'bg-green-600', error: 'bg-red-600' }
    const t = document.createElement('div')
    t.textContent = msg
    t.className = `fixed bottom-24 right-8 ${colors[type]} text-white px-8 py-5 rounded-2xl shadow-2xl z-50 font-semibold text-lg animate-bounce`
    document.body.appendChild(t)
    setTimeout(() => t.remove(), 3500)
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    showToast('Ключ скопирован!')
  }

  return (
    <div className={styles.container}>
      {isLoading && (
        <div className={styles.loadingOverlay}>
          <img src="/cd-disk.gif" alt="loading" className={styles.loadingGif} />
          <div className={styles.loadingText}>Работаем...</div>
        </div>
      )}

      <div className={styles.wrapper}>
        <header className={styles.header}>
          <h1 className={styles.headerTitle}>Лицензионное программное обеспечение</h1>
          <p className={styles.headerSubtitle}>
            Полный контроль • Стоимость • Поставщики • Рабочие места • Браузер
          </p>
        </header>

        <input
          type="text"
          placeholder="Поиск по описанию, ключу или поставщику..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={styles.searchInput}
        />

        {/* Создание лицензии — ПОЛЯ НОРМАЛЬНОГО РАЗМЕРА */}
        <div className={styles.createSection}>
          <h2 className={styles.sectionTitle}>Создать новую лицензию</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <textarea
              required
              placeholder="Описание лицензии (например: Windows 11 Pro для бухгалтерии)"
              className="w-full px-5 py-4 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-purple-500"
              rows="4"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <input
                type="text"
                placeholder="Поставщик (например: Microsoft, 1С, ООО «СофтЛайн»)"
                className="w-full px-5 py-4 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-indigo-500"
                value={form.supplier}
                onChange={e => setForm({ ...form, supplier: e.target.value })}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Стоимость ключа (₽)"
                className="w-full px-5 py-4 border border-gray-300 rounded-xl text-base font-bold text-green-700 focus:ring-2 focus:ring-green-500"
                value={form.cost}
                onChange={e => setForm({ ...form, cost: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <input
                required
                type="date"
                className="w-full px-5 py-4 border border-gray-300 rounded-xl text-base"
                value={form.expiry_date}
                onChange={e => setForm({ ...form, expiry_date: e.target.value })}
              />
              <input
                required
                type="number"
                min="1"
                placeholder="Макс. активаций"
                className="w-full px-5 py-4 border border-gray-300 rounded-xl text-base"
                value={form.max_uses}
                onChange={e => setForm({ ...form, max_uses: +e.target.value })}
              />
              <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 rounded-xl hover:from-purple-700 hover:to-pink-700 transition shadow-lg">
                Создать и скопировать ключ
              </button>
            </div>
          </form>
        </div>

        {/* Проверка ключа + последние активации */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">
          <div className={styles.validateSection}>
            <h2 className={styles.sectionTitle}>Проверить ключ</h2>
            <div className={styles.validateInputWrapper}>
              <input
                placeholder="Вставьте ключ сюда..."
                className={styles.validateInput}
                value={validateKey}
                onChange={e => setValidateKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleValidate()}
              />
              <button onClick={handleValidate} className={styles.validateBtn}>
                Активировать
              </button>
            </div>

            {validationResult && (
              <div className={`${styles.validationResult} ${validationResult.valid ? styles.validationSuccess : styles.validationError}`}>
                {validationResult.valid ? 'КЛЮЧ УСПЕШНО АКТИВИРОВАН!' : 'ОШИБКА: ' + (validationResult.error || 'неизвестно')}
              </div>
            )}
          </div>

          <div className={styles.validateSection}>
            <h2 className={styles.sectionTitle}>Последние активации</h2>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {activations.length === 0 ? (
                <p className="text-gray-500 text-center py-12 text-lg">Активаций пока нет</p>
              ) : (
                activations.map(a => (
                  <div key={a.id} className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200 shadow-md">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-mono text-lg font-bold text-indigo-700">{a.key}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {new Date(a.activated_at).toLocaleString('ru-RU')}
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <div className="text-xs text-gray-500">Рабочее место:</div>
                        <div className="font-bold text-purple-700 bg-white px-4 py-2 rounded-lg shadow">
                          {a.activated_on}
                        </div>
                        <div className="text-xs text-gray-500 mt-3">Браузер:</div>
                        <div className="text-sm font-medium text-blue-600">
                          {a.browser}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Таблица всех лицензий */}
        <div className={styles.tableSection + " mt-12"}>
          <div className={styles.tableHeader}>
            <h2 className={styles.tableHeaderTitle}>Все лицензии ({licenses.length})</h2>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead className={styles.tableHead}>
                <tr>
                  <th className={styles.tableTh}>Ключ</th>
                  <th className={styles.tableTh}>Описание</th>
                  <th className={styles.tableTh}>Поставщик</th>
                  <th className={styles.tableTh}>Стоимость</th>
                  <th className={styles.tableTh}>Действует до</th>
                  <th className={styles.tableTh}>Использовано</th>
                  <th className={styles.tableTh}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {licenses.map(l => {
                  const expired = new Date(l.expiry_date) < new Date()
                  const exhausted = l.current_uses >= l.max_uses
                  const status = expired ? 'Истекла' : exhausted ? 'Исчерпана' : 'Активна'
                  const statusClass = expired ? styles.statusExpired : exhausted ? styles.statusExhausted : styles.statusActive

                  return (
                    <tr key={l.id} className={styles.tableRow}>
                      <td className={styles.tableTd}>
                        <div className={styles.keyCell}>
                          <span className={styles.keyBadge}>{l.key}</span>
                          <button onClick={() => copyToClipboard(l.key)} className={styles.copyBtn}>
                            Копировать
                          </button>
                        </div>
                      </td>
                      <td className={styles.tableTd}>{l.description || '—'}</td>
                      <td className={styles.tableTd}>
                        <span className="font-medium text-indigo-600">
                          {l.supplier || '—'}
                        </span>
                      </td>
                      <td className={styles.tableTd}>
                        {l.cost > 0 ? (
                          <span className="font-bold text-green-600">
                            {Number(l.cost).toLocaleString('ru-RU')} ₽
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className={styles.tableTd}>{new Date(l.expiry_date).toLocaleDateString('ru-RU')}</td>
                      <td className={styles.tableTd}>
                        <span className={`${styles.statusBadge} ${statusClass}`}>
                          {status} ({l.current_uses}/{l.max_uses})
                        </span>
                      </td>
                      <td className={styles.tableTd}>
                        <button onClick={() => startEdit(l)} className={styles.editBtn}>Изменить</button>
                        <button onClick={() => handleDelete(l.id)} className={styles.deleteBtn}>Удалить</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Модалка редактирования */}
        {editingId && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <h3 className={styles.modalTitle}>Редактировать лицензию</h3>
              <div className="space-y-6">
                <textarea
                  className={styles.modalTextarea}
                  rows="4"
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Поставщик"
                  className={styles.input}
                  value={editForm.supplier}
                  onChange={e => setEditForm({ ...editForm, supplier: e.target.value })}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Стоимость (₽)"
                  className={styles.input}
                  value={editForm.cost}
                  onChange={e => setEditForm({ ...editForm, cost: +e.target.value })}
                />
                <div className={styles.modalInputsGrid}>
                  <input
                    type="date"
                    className={styles.input}
                    value={editForm.expiry_date}
                    onChange={e => setEditForm({ ...editForm, expiry_date: e.target.value })}
                  />
                  <input
                    type="number"
                    min="1"
                    className={styles.input}
                    value={editForm.max_uses}
                    onChange={e => setEditForm({ ...editForm, max_uses: +e.target.value })}
                  />
                </div>
              </div>
              <div className={styles.modalBtnGroup}>
                <button onClick={saveEdit} className={styles.modalSaveBtn}>
                  Сохранить
                </button>
                <button onClick={() => setEditingId(null)} className={styles.modalCancelBtn}>
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LicenseManager