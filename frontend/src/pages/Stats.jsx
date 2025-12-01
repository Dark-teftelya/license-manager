// src/pages/Stats.jsx — ШИРОКИЕ БЛОКИ + РЕАЛЬНЫЙ ГРАФИК
import { useState, useEffect } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

export default function Stats() {
  const [stats, setStats] = useState(null)
  const [chartData, setChartData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/stats').then(r => r.json()),
      fetch('/api/stats/chart').then(r => r.json())
    ])
      .then(([statsData, chartRaw]) => {
        setStats(statsData)

        // Заполняем все 30 дней (даже если активаций не было — будет 0)
        const days = []
        const counts = []
        const today = new Date()
        const dayMap = new Map(chartRaw.map(d => [d.day, d.count]))

        for (let i = 29; i >= 0; i--) {
          const date = new Date(today)
          date.setDate(today.getDate() - i)
          const dayStr = date.toISOString().split('T')[0]
          days.push(date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }))
          counts.push(dayMap.get(dayStr) || 0)
        }

        setChartData({ labels: days, datasets: [{ data: counts }] })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-6xl font-black text-indigo-600 animate-pulse">Загрузка...</div>
      </div>
    )
  }

  const cards = [
    { label: 'Всего лицензий', value: stats.total, color: 'from-indigo-500 to-purple-700' },
    { label: 'Активных сейчас', value: stats.active, color: 'from-emerald-500 to-teal-600' },
    { label: 'Всего активаций', value: stats.total_ever_activated, color: 'from-pink-500 to-rose-600' },
    { label: 'Истекает на этой неделе', value: stats.expiring_soon, color: 'from-orange-500 to-red-600' },
    { label: 'Активаций за 30 дней', value: stats.activations_month || 0, color: 'from-cyan-500 to-blue-600' },
  ]

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Активации за последние 30 дней', font: { size: 24, weight: 'bold' } }
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } }
    }
  }

  const chartFinalData = chartData ? {
    labels: chartData.labels,
    datasets: [{
      label: 'Активации',
      data: chartData.datasets[0].data,
      fill: true,
      backgroundColor: 'rgba(99, 102, 241, 0.15)',
      borderColor: '#6366f1',
      tension: 0.4,
      pointBackgroundColor: '#6366f1',
      pointRadius: 6,
      pointHoverRadius: 10
    }]
  } : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 py-16 px-6">
      <div className="max-w-screen-2xl mx-auto">

        {/* Заголовок */}
        <div className="text-center mb-20">
          <h1 className="text-7xl md:text-8xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Аналитика системы
          </h1>
          <p className="text-2xl text-gray-600 mt-6 font-medium">
            {new Date().toLocaleString('ru-RU')}
          </p>
        </div>

        {/* СУПЕР-ШИРОКИЕ карточки */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-12 mb-20">
          {cards.map((card, i) => (
            <div
              key={i}
              className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-12 text-center transform hover:scale-105 transition-all duration-500 border border-gray-100"
            >
              <div className={`h-40 bg-gradient-to-br ${card.color} rounded-3xl mb-8 shadow-xl`} />
              <h3 className="text-2xl font-bold text-gray-700 mb-6 leading-tight px-4">
                {card.label}
              </h3>
              <p className="text-8xl font-black text-gray-800">
                {typeof card.value === 'number' ? card.value.toLocaleString('ru-RU') : card.value}
              </p>
            </div>
          ))}
        </div>

        {/* ГРАФИК — ПОЛНОСТЬЮ РАБОЧИЙ */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-12 border border-gray-100">
          <div className="h-96">
            {chartFinalData ? (
              <Line data={chartFinalData} options={chartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-4xl text-gray-400">
                Активаций пока нет
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}