// src/pages/Login.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function Login() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [company, setCompany] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    // Здесь будет твой fetch('/api/auth/login') или /register
    // Пока просто имитация
    localStorage.setItem('token', 'fake-jwt-token')
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-gray-800 mb-2">
            {isLogin ? 'Добро пожаловать' : 'Создать аккаунт'}
          </h1>
          <p className="text-gray-600">
            {isLogin ? 'Войдите в систему управления лицензиями' : 'Начните управлять лицензиями прямо сейчас'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <input
              type="text"
              placeholder="Название компании"
              className="w-full p-5 rounded-2xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none text-lg"
              value={company}
              onChange={e => setCompany(e.target.value)}
              required={!isLogin}
            />
          )}

          <input
            type="email"
            placeholder="Email"
            className="w-full p-5 rounded-2xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none text-lg"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Пароль"
            className="w-full p-5 rounded-2xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none text-lg"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-6 rounded-2xl text-xl shadow-lg transition"
          >
            {isLogin ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="text-center mt-8">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-purple-600 font-semibold hover:underline"
          >
            {isLogin ? 'Нет аккаунта? Зарегистрируйтесь' : 'Уже есть аккаунт? Войти'}
          </button>
        </div>

        {isLogin && (
          <div className="text-center mt-6">
            <Link to="/" className="text-gray-500 hover:text-gray-700 text-sm">
              ← Вернуться на главную
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}