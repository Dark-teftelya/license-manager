// src/pages/Workplaces.jsx
import React, { useState, useEffect, useRef } from 'react'

export default function Workplaces() {
  const [devices, setDevices] = useState([])
  const [rooms, setRooms] = useState([])
  const [selectedRoomId, setSelectedRoomId] = useState(null)
  const [newRoomName, setNewRoomName] = useState('')
  const [scale, setScale] = useState(1)
  const containerRef = useRef(null)

  // Загрузка с бэкенда
  useEffect(() => {
    fetch('/api/workplaces')
      .then(r => r.json())
      .then(data => {
        setRooms((data.rooms || []).map((name, i) => ({ id: i + 1, name })))
        const safeDevices = (data.devices || []).map(d => ({
          ...d,
          mac: d.mac || '',
          status: d.status || null,
          x: d.x || 100,
          y: d.y || 100,
          roomId: d.roomId || null,
          icon: d.icon || 'Desktop',
          type: d.type || 'desktop'
        }))
        setDevices(safeDevices)
      })
      .catch(() => {})
  }, [])

  const visibleDevices = selectedRoomId === null
    ? devices
    : devices.filter(d => d.roomId === selectedRoomId)

  const createRoom = () => {
    if (!newRoomName.trim()) return
    const room = { id: Date.now(), name: newRoomName.trim() }
    setRooms(prev => [...prev, room])
    setSelectedRoomId(room.id)
    setNewRoomName('')
  }

  const handleDropNew = (e) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('deviceType')
    if (!type) return

    const rect = containerRef.current.getBoundingClientRect()
    let x = (e.clientX - rect.left) / scale
    let y = (e.clientY - rect.top) / scale
    x = Math.round(x / 100) * 100
    y = Math.round(y / 100) * 100

    const mac = prompt('Введите MAC-адрес устройства:\n(например: 00:1A:2B:3C:4D:5E)', '00:1A:2B:3C:4D:5E')
    if (!mac) return
    if (!/^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/i.test(mac.trim())) {
      alert('Неверный формат MAC-адреса!')
      return
    }

    setDevices(prev => [...prev, {
      id: Date.now(),
      mac: mac.trim().toUpperCase(),
      icon: type === 'desktop' ? 'Desktop' : type === 'laptop' ? 'Laptop' : type === 'tablet' ? 'Tablet' : 'Server',
      type,
      x, y,
      roomId: selectedRoomId,
      status: null
    }])
  }

  const handleDeviceMove = (id, e) => {
    const rect = containerRef.current.getBoundingClientRect()
    let x = (e.clientX - rect.left) / scale
    let y = (e.clientY - rect.top) / scale
    x = Math.round(x / 100) * 100
    y = Math.round(y / 100) * 100

    setDevices(prev => prev.map(d =>
      d.id === id ? { ...d, x, y } : d
    ))
  }

  const editMac = (id) => {
    const device = devices.find(d => d.id === id)
    const newMac = prompt('Изменить MAC-адрес:', device.mac)
    if (!newMac) return
    if (!/^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/i.test(newMac.trim())) {
      alert('Неверный формат MAC-адреса!')
      return
    }
    setDevices(prev => prev.map(d =>
      d.id === id ? { ...d, mac: newMac.trim().toUpperCase() } : d
    ))
  }

  const deleteDevice = (id) => {
    if (confirm('Удалить устройство навсегда?')) {
      setDevices(prev => prev.filter(d => d.id !== id))
    }
  }

  const checkKey = (id) => {
    const key = prompt('Вставьте лицензионный ключ:')
    if (!key) return

    fetch('/api/licenses/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key.trim().toUpperCase() })
    })
      .then(r => r.json())
      .then(res => {
        setDevices(prev => prev.map(d =>
          d.id === id ? { ...d, status: res.valid ? 'active' : 'expired' } : d
        ))
        alert(res.valid ? 'Ключ активен!' : 'Ключ недействителен или истёк')
      })
      .catch(() => alert('Ошибка сервера'))
  }

  const save = () => {
    fetch('/api/workplaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rooms: rooms.map(r => r.name),
        devices: devices
      })
    })
      .then(() => alert('Схема сохранена навсегда!'))
      .catch(() => alert('Ошибка сохранения'))
  }

  const handleWheel = (e) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale(prev => Math.max(0.3, Math.min(2, prev * delta)))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-screen-2xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-black text-center mb-8 md:mb-12 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Конструктор рабочих мест
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
          {/* Левый блок */}
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-2xl p-6 md:p-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-indigo-700">Добавить устройство</h2>
            <div className="space-y-6 md:space-y-8">
              {[
                { type: 'desktop', label: 'Компьютер', img: '/desktop.png' },
                { type: 'laptop',  label: 'Ноутбук',   img: '/laptop.png'  },
                { type: 'tablet',  label: 'Планшет',   img: '/tablet.png'  },
                { type: 'server',  label: 'Сервер',    img: '/server.png'  },
              ].map(t => (
                <div
                  key={t.type}
                  draggable
                  onDragStart={e => e.dataTransfer.setData('deviceType', t.type)}
                  className="bg-gradient-to-br from-purple-100 via-pink-100 to-purple-100 
                             p-8 md:p-10 rounded-3xl text-center cursor-grab active:cursor-grabbing 
                             hover:scale-110 transition-all shadow-xl border-4 border-purple-200 
                             hover:border-purple-500 hover:shadow-2xl"
                >
                  <img 
                    src={t.img} 
                    alt={t.label} 
                    className="w-28 h-28 md:w-32 md:h-32 mx-auto mb-4 object-contain drop-shadow-2xl"
                    draggable={false}
                  />
                  <div className="font-bold text-purple-800 text-lg md:text-xl tracking-wide">
                    {t.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

         {/* Центральный блок — с идеальной сеткой и зумом */}
        <div className="lg:col-span-7">
        <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden border-8 border-gray-200" style={{ minHeight: '148vh' }}>
            
            {/* Обёртка с зумом */}
            <div
            ref={containerRef}
            className="absolute inset-0"
            onWheel={handleWheel}
            onDrop={handleDropNew}
            onDragOver={e => e.preventDefault()}
            style={{ cursor: scale > 1 ? 'grab' : 'default' }}
            >
            <div
                className="absolute inset-0 origin-top-left"
                style={{
                transform: `scale(${scale})`,
                width: `${100 / scale}%`,
                height: `${100 / scale}%`,
                }}
            >
                {/* Сетка — всегда чёткая */}
                <div
                className="absolute inset-0 opacity-30"
                style={{
                    backgroundImage: `
                    linear-gradient(to right, #cbd5e1 1px, transparent 1px),
                    linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)
                    `,
                    backgroundSize: `${100 * scale}px ${100 * scale}px`,
                }}
                />

                {/* Устройства */}
                {visibleDevices.map(d => {
                const iconPath = 
                    d.type === 'desktop' || d.icon === 'Desktop' ? '/desktop.png' :
                    d.type === 'laptop'  || d.icon === 'Laptop'  ? '/laptop.png'  :
                    d.type === 'tablet'  || d.icon === 'Tablet'  ? '/tablet.png'  : '/server.png'

                return (
                    <div
                    key={d.id}
                    draggable
                    onDragEnd={e => handleDeviceMove(d.id, e)}
                    className={`absolute w-80 p-8 bg-white rounded-3xl shadow-2xl border-4 cursor-move select-none transition-all hover:scale-105 hover:shadow-3xl z-10 ${
                        d.status === 'active' ? 'border-green-500 bg-green-50' : 
                        d.status === 'expired' ? 'border-red-500 bg-red-50' : 
                        'border-purple-400 bg-purple-50'
                    }`}
                    style={{
                        left: d.x,
                        top: d.y,
                        transform: 'translate(-50%, -50%)'
                    }}
                    >
                    <div className="flex justify-center mb-4">
                        <img src={iconPath} alt="device" className="w-32 h-32 object-contain drop-shadow-2xl" draggable={false} />
                    </div>

                    <div className="font-mono text-center text-purple-800 text-xl font-black tracking-wider break-all bg-gray-100 py-3 px-4 rounded-xl">
                        {d.mac || 'MAC не задан'}
                    </div>

                    {d.status && (
                        <div className={`text-center mt-4 font-bold text-xl px-6 py-3 rounded-xl ${
                        d.status === 'active' 
                            ? 'bg-green-100 text-green-700 border-2 border-green-500' 
                            : 'bg-red-100 text-red-700 border-2 border-red-500'
                        }`}>
                        {d.status === 'active' ? 'Ключ активен' : 'Ключ истёк'}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 mt-6">
                        <button onClick={() => editMac(d.id)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl text-lg">
                        Изменить
                        </button>
                        <button onClick={() => deleteDevice(d.id)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-2xl text-lg">
                        Удалить
                        </button>
                    </div>

                    <button
                        onClick={() => checkKey(d.id)}
                        className="mt-4 w-full bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-black py-4 rounded-2xl text-xl"
                    >
                        Проверить ключ
                    </button>
                    </div>
                )
                })}

                {/* Плейсхолдер */}
                {visibleDevices.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-5xl text-gray-300 pointer-events-none font-light">
                    {selectedRoomId ? 'Перетащите устройства сюда' : 'Выберите или создайте кабинет'}
                </div>
                )}
            </div>
            </div>

            {/* Индикатор масштаба */}
            <div className="absolute bottom-4 right-4 z-20 bg-black/75 text-white px-5 py-3 rounded-full font-bold text-sm backdrop-blur-sm shadow-lg">
            {Math.round(scale * 100)}%
            </div>

            {/* Подсказка */}
            <div className="absolute top-4 left-4 z-20 bg-black/70 text-white px-4 py-2 rounded-lg text-xs backdrop-blur-sm">
            Ctrl + колёсико = масштаб
            </div>
        </div>
        </div>

          {/* Правый блок */}
          <div className="lg:col-span-3 bg-white rounded-3xl shadow-2xl p-6 md:p-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 text-purple-700">Кабинеты</h2>

            <div className="mb-6">
              <input
                type="text"
                placeholder="Например: Кабинет 305"
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createRoom()}
                className="w-full px-5 py-4 border-2 border-purple-300 rounded-xl focus:border-purple-600 outline-none text-lg"
              />
              <button onClick={createRoom} className="mt-4 w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 rounded-xl text-lg">
                + Создать кабинет
              </button>
            </div>

            <div className="space-y-4">
              {rooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoomId(room.id)}
                  className={`w-full text-left p-6 rounded-2xl border-4 transition-all ${
                    selectedRoomId === room.id
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-800 shadow-2xl'
                      : 'bg-purple-50 border-purple-300 hover:border-purple-500'
                  }`}
                >
                  <div className="font-bold text-xl">{room.name}</div>
                  <div className="text-sm opacity-80 mt-1">
                    {devices.filter(d => d.roomId === room.id).length} устройств
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center mt-12">
          <button onClick={save} className="px-16 md:px-24 py-6 md:py-8 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-3xl md:text-4xl font-black rounded-full shadow-3xl hover:shadow-4xl transform hover:scale-110 transition-all">
            Сохранить схему навсегда
          </button>
        </div>
      </div>
    </div>
  )
}