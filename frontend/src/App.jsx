// src/App.jsx
import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'

// Страницы
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Stats from './pages/Stats'
import ExportPage from './pages/ExportPage'
import DocsPage from './pages/DocsPage'  
import SettingsPage from './pages/SettingsPage'
import NotFound from './pages/NotFound'

// Защищённый роут
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/login" replace />
}

// Навигация (только для авторизованных)
const Navigation = () => {
  const location = useLocation()
  const token = localStorage.getItem('token')
  const isAuthPage = ['/login', '/'].includes(location.pathname)

  if (!token || isAuthPage) return null

  const navItems = [
    { to: '/dashboard', label: 'Лицензии', icon: '🔑' },
    { to: '/stats', label: 'Статистика', icon: '📊' },
    { to: '/export', label: 'Экспорт', icon: '📥' },
    { to: '/docs', label: 'Документы', icon: '🗎'},
    { to: '/settings', label: 'Настройки', icon: '⚙️' },
  ]

  return (
    <header className="bg-white shadow-xl sticky top-0 z-50 border-b-4 border-indigo-600">
      <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
        <Link to="/dashboard" className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg">
            LC
          </div>
          <span className="text-3xl font-black text-gray-800">LicenseCore</span>
        </Link>

        <nav className="flex items-center gap-8">
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 text-lg font-semibold transition ${
                location.pathname === item.to
                  ? 'text-indigo-600'
                  : 'text-gray-700 hover:text-indigo-600'
              }`}
            >
              <span className="text-2xl">{item.icon}</span>
              {item.label}
            </Link>
          ))}

          <button
            onClick={() => {
              localStorage.removeItem('token')
              window.location.href = '/login'
            }}
            className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold px-8 py-4 rounded-2xl shadow-lg transition flex items-center gap-3 text-lg"
          >
            Выйти
          </button>
        </nav>
      </div>
    </header>
  )
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />

          {/* Защищённые маршруты */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/stats" element={<ProtectedRoute><Stats /></ProtectedRoute>} />
          <Route path="/export" element={<ProtectedRoute><ExportPage /></ProtectedRoute>} />
          <Route path="/docs" element={<ProtectedRoute><DocsPage/></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App