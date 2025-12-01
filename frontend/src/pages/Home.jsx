// src/pages/Home.jsx
import { Link } from 'react-router-dom'

export default function Home() {
  const isAuth = !!localStorage.getItem('token')

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Hero */}
      <section className="px-6 py-24 text-center">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-6xl md:text-7xl font-black text-gray-800 mb-8">
            Управление лицензиями<br />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              без головной боли
            </span>
          </h1>
          <p className="text-2xl text-gray-600 mb-12 max-w-3xl mx-auto">
            Централизованная система для создания, отслеживания и контроля лицензий корпоративного ПО. 
            Полная прозрачность. Никаких «потерянных» ключей.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            {isAuth ? (
              <Link
                to="/dashboard"
                className="px-12 py-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xl rounded-2xl shadow-2xl transition"
              >
                Перейти в панель управления
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-12 py-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xl rounded-2xl shadow-2xl transition"
                >
                  Начать бесплатно
                </Link>
                <a
                  href="#features"
                  className="px-12 py-6 bg-white border-4 border-indigo-600 text-indigo-600 font-bold text-xl rounded-2xl hover:bg-indigo-50 transition"
                >
                  Узнать больше
                </a>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Фичи */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-12">
          {[
            { title: "Неограниченные ключи", desc: "Генерируйте UUID-ключи любой сложности" },
            { title: "Ограничение по времени и активациям", desc: "Полный контроль над сроком жизни лицензии" },
            { title: "История активаций", desc: "Кто, когда и с какого устройства активировал ключ" },
            { title: "Редактирование и отзыв", desc: "Меняйте условия или отзывайте лицензии в один клик" },
            { title: "Поиск и фильтры", desc: "Мгновенно находите нужную лицензию" },
            { title: "Безопасность", desc: "Данные хранятся зашифрованными, доступ только у вас" },
          ].map((f, i) => (
            <div key={i} className="text-center">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center text-5xl text-white font-black shadow-xl">
                {i + 1}
              </div>
              <h3 className="text-2xl font-bold mb-3">{f.title}</h3>
              <p className="text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 text-center text-gray-500">
        © 2025 LicenseCore • Система управления лицензиями предприятия
      </footer>
    </div>
  )
}