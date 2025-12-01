import React, { useState, useEffect } from 'react'
import styles from './LicenseManager.module.css'

const LicenseManager = () => {
  const [licenses, setLicenses] = useState([])
  const [allLicenses, setAllLicenses] = useState([])
  const [search, setSearch] = useState('')
  const [activations, setActivations] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [form, setForm] = useState({ description: '', expiry_date: '', max_uses: 5 })
  const [validateKey, setValidateKey] = useState('')
  const [validationResult, setValidationResult] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ description: '', expiry_date: '', max_uses: 0 })

  // Загружаем последние активации из localStorage
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

  // Сохраняем активации при изменении
  useEffect(() => {
    localStorage.setItem('license-activations', JSON.stringify(activations))
  }, [activations])

  // Загрузка лицензий при старте
  useEffect(() => {
    fetchLicenses()
  }, [])

  // Поиск
  useEffect(() => {
    const lowerSearch = search.toLowerCase()
    const filtered = allLicenses.filter(l => 
      l.description.toLowerCase().includes(lowerSearch) ||
      l.key.toLowerCase().includes(lowerSearch)
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
  
    const minDuration = 3800 // ← 3.8 секунды — идеально для вау-эффекта
    const startTime = Date.now()
  
    try {
      await cb()
    } finally {
      const elapsed = Date.now() - startTime
      const remaining = minDuration - elapsed
  
      // Если операция закончилась быстро — ждём остаток времени
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
        body: JSON.stringify(form)
      })

      if (res.ok) {
        const { key } = await res.json()
        setForm({ description: '', expiry_date: '', max_uses: 5 })
        await fetchLicenses()
        navigator.clipboard.writeText(key)
        showToast(`Лицензия создана! Ключ скопирован в буфер: ${key}`)
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
        // ← ЭТО САМОЕ ВАЖНОЕ: обновляем список лицензий!
        await fetchLicenses()

        // Сохраняем активацию в localStorage (для красоты)
        const newActivation = {
          id: Date.now(),
          key: keyToSend,
          activated_at: new Date().toISOString(),
          device: navigator.userAgent.slice(0, 100) + '...'
        }
        setActivations(prev => [newActivation, ...prev].slice(0, 50))

        showToast('Ключ успешно активирован!')
        setValidateKey('') // очищаем поле
      } else {
        showToast(data.error || 'Ключ недействителен', 'error')
      }
    })
  }

  useEffect(() => {
    fetchLicenses()
  }, [])

  const startEdit = (l) => {
    setEditingId(l.id)
    setEditForm({
      description: l.description,
      expiry_date: l.expiry_date.split('T')[0],
      max_uses: l.max_uses
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
    const colors = {
      success: 'bg-green-600',
      error: 'bg-red-600'
    }

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
      {/* Загрузка */}
      {isLoading && (
        <div className={styles.loadingOverlay}>
          <img src="/cd-disk.gif" alt="loading" className={styles.loadingGif} />
          <div className={styles.loadingText}>Работаем...</div>
        </div>
      )}

      <div className={styles.wrapper}>
        <header className={styles.header}>
          <h1 className={styles.headerTitle}>Управление лицензиями</h1>
          <p className={styles.headerSubtitle}>
            Полные UUID-ключи • Неограниченные активации • Полный контроль
          </p>
        </header>

        <input
          type="text"
          placeholder="Поиск по описанию или ключу..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={styles.searchInput}
        />

        {/* Создание лицензии */}
        <div className={styles.createSection}>
          <h2 className={styles.sectionTitle}>Создать новую лицензию</h2>
          <form onSubmit={handleSubmit} className={styles.createForm}>
            <textarea
              required
              placeholder="Описание (например: Premium на 1 год для @username)"
              className={styles.textarea}
              rows="3"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
            <input
              required
              type="date"
              className={styles.input}
              value={form.expiry_date}
              onChange={e => setForm({ ...form, expiry_date: e.target.value })}
            />
            <input
              required
              type="number"
              min="1"
              placeholder="Макс. активаций (1-999)"
              className={styles.input}
              value={form.max_uses}
              onChange={e => setForm({ ...form, max_uses: +e.target.value })}
            />
            <button type="submit" className={styles.submitBtn}>
              Создать и скопировать ключ
            </button>
          </form>
        </div>

        {/* Проверка ключа + последние активации */}
        <div className={styles.gridTwoCols}>
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
                {validationResult.remaining_uses !== undefined && (
                  <div className="mt-3 text-gray-700">
                    Осталось активаций: <strong>{validationResult.remaining_uses}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={styles.validateSection}>
            <h2 className={styles.sectionTitle}>Последние активации</h2>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {activations.length === 0 ? (
                <p className="text-gray-500 text-center py-10 text-lg">Активаций пока нет</p>
              ) : (
                activations.map(a => (
                  <div key={a.id} className={styles.activationItem}>
                    <div className={styles.activationKey}>{a.key}</div>
                    <div className={styles.activationDate}>
                      {new Date(a.activated_at).toLocaleString('ru-RU')}
                    </div>
                    <div className={styles.activationDevice}>{a.device}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Таблица всех лицензий */}
        <div className={styles.tableSection}>
          <div className={styles.tableHeader}>
            <h2 className={styles.tableHeaderTitle}>Все лицензии ({licenses.length})</h2>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead className={styles.tableHead}>
                <tr>
                  <th className={styles.tableTh}>Ключ</th>
                  <th className={styles.tableTh}>Описание</th>
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
                      <td className={styles.tableTh}>
                        <div className={styles.keyCell}>
                          <span className={styles.keyBadge}>{l.key}</span>
                          <button onClick={() => copyToClipboard(l.key)} className={styles.copyBtn}>
                            Копировать
                          </button>
                        </div>
                      </td>
                      <td className={styles.tableTh}>{l.description || '—'}</td>
                      <td className={styles.tableTh}>{new Date(l.expiry_date).toLocaleDateString('ru-RU')}</td>
                      <td className={styles.tableTh}>
                        <span className={`${styles.statusBadge} ${statusClass}`}>
                          {status} ({l.current_uses}/{l.max_uses})
                        </span>
                      </td>
                      <td className={styles.tableTh}>
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
                  Сохранить изменения
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