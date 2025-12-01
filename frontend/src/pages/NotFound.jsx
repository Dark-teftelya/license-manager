import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-9xl font-black text-gray-300">404</h1>
        <p className="text-3xl font-bold text-gray-700 mt-8">Страница не найдена</p>
        <Link to="/" className="mt-10 inline-block px-10 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl transition">
          На главную
        </Link>
      </div>
    </div>
  )
}