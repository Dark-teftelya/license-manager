package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gocarina/gocsv"
	"github.com/google/uuid"
	"github.com/xuri/excelize/v2" 
	_ "github.com/mattn/go-sqlite3"
)

type License struct {
    ID           int       `json:"id"`
    Key          string    `json:"key"`
    Description  string    `json:"description"`
    ExpiryDate   string    `json:"expiry_date"`
    MaxUses      int       `json:"max_uses"`
    CurrentUses  int       `json:"current_uses"`
    CreatedAt    time.Time `json:"created_at"`

    // ←←← НОВЫЕ ПОЛЯ
    Cost         float64   `json:"cost,omitempty"`
    Supplier     string    `json:"supplier,omitempty"`
    ActivatedOn  string    `json:"activated_on,omitempty"`  // например: "PC-IVANOV, НОУТ-БУХ, Сервер-01"
}

var db *sql.DB

func main() {
	var err error
	db, err = sql.Open("sqlite3", "./licenses.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// === Создание таблиц ===
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS licenses (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			key TEXT UNIQUE NOT NULL,
			description TEXT,
			expiry_date DATE,
			max_uses INTEGER DEFAULT 5,
			current_uses INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			cost REAL DEFAULT 0,
			supplier TEXT,
			activated_on TEXT
		);
	`)
	if err != nil {
		log.Fatal(err)
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS activation_log (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			license_key TEXT NOT NULL,
			activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			device_name TEXT,
			browser TEXT
		);
	`)
	if err != nil {
		log.Fatal("Не удалось создать activation_log:", err)
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT
		);
	`)
	if err != nil {
		log.Fatal("Ошибка создания settings:", err)
	}

	// === Добавляем недостающие колонки (если вдруг старый БД) ===
	db.Exec("ALTER TABLE licenses ADD COLUMN cost REAL DEFAULT 0")
	db.Exec("ALTER TABLE licenses ADD COLUMN supplier TEXT")
	db.Exec("ALTER TABLE licenses ADD COLUMN activated_on TEXT")

	// === Заполняем настройки компании ===
	_, err = db.Exec(`
		INSERT OR REPLACE INTO settings (key, value) VALUES
		('company_name', 'LicenseCore Inc.'),
		('legal_name', 'ООО «ЛицензКор»'),
		('inn', '7712345678'),
		('ogrn', '1234567890123'),
		('legal_address', 'г. Москва, ул. Примерная, д. 10, офис 501'),
		('support_email', 'support@licensecore.app'),
		('website', 'https://licensecore.app')
	`)
	if err != nil {
		log.Println("Ошибка базовых настроек:", err)
	}

	// === Тексты документов (с плейсхолдерами) ===
	docs := map[string]string{
		"eula_text": `ЛИЦЕНЗИОННОЕ СОГЛАШЕНИЕ (EULA)

		Настоящее Лицензионное соглашение заключается между {{company_name}} ({{legal_name}}, ИНН {{inn}}, ОГРН {{ogrn}}) и вами.

		1. Предоставление лицензии
		Правообладатель предоставляет неисключительную лицензию на использование ПО.

		2. Активация и рабочие места
		Лицензия активируется на конкретных рабочих местах. Перечень активных рабочих мест приведён в Приложении ниже.

		3. Ограничения
		• Запрещается передача ключа третьим лицам
		• Запрещается превышение лимита активаций

		4. Срок действия
		До даты истечения ключа или отзыва Правообладателем.

		5. Поддержка
		Email: {{support_email}}

		Настоящее соглашение вступает в силу с момента активации.
		{{company_name}}, {{year}} г.`,

				"privacy_policy": `ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ

		{{company_name}} уважает вашу конфиденциальность.

		1. Собираемые данные
		• Лицензионный ключ
		• MAC-адрес устройства
		• IP при активации

		2. Цели обработки
		• Проверка лицензии
		• Формирование отчётов
		• Защита от пиратства

		3. Хранение
		Данные хранятся 3 года на защищённых серверах в РФ.

		4. Контакты
		{{support_email}}

		Актуально на {{year}} год.`,

				"offer_text": `ПУБЛИЧНАЯ ОФЕРТА

		{{legal_name}}, в лице директора, публикует оферту.

		1. Предмет
		Предоставление неисключительных лицензий на ПО LicenseCore.

		2. Стоимость
		Указана на сайте {{website}}

		3. Акцепт
		С момента оплаты.

		Реквизиты:
		{{legal_name}}
		ИНН {{inn}} • ОГРН {{ogrn}}
		{{legal_address}}
		{{support_email}}`,

				"payment_text": `ПЛАТЁЖНОЕ ПОРУЧЕНИЕ № ___ от {{current_date}}

		Плательщик: {{company_name}}
		ИНН {{inn}}

		Получатель: {{legal_name}}
		ИНН {{inn}}

		Назначение платежа: Оплата лицензий LicenseCore
		Сумма: ____________________ руб.

		Директор ____________________ /Иванов И.И./`,

				"invoice_text": `ТОВАРНАЯ НАКЛАДНАЯ № ___ от {{current_date}}

		Поставщик: {{legal_name}}, ИНН {{inn}}, ОГРН {{ogrn}}
		Покупатель: {{company_name}}

		№ | Наименование                          | Кол-во | Цена     | Сумма
		--|---------------------------------------|--------|----------|----------
		1 | Неисключительная лицензия LicenseCore | 1      | ______   | ______

		Итого: ______ руб.

		Директор ____________________ /Иванов И.И./`,
	}

	for key, text := range docs {
		_, err = db.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", key, text)
		if err != nil {
			log.Printf("Ошибка сохранения %s: %v", key, err)
		}
	}

	// === Универсальный рендер документов ===
	renderDoc := func(w http.ResponseWriter, key, title string) {
		var data struct {
			CompanyName, LegalName, INN, OGRN, Address, Email, Website, Year, Date string
		}
		db.QueryRow("SELECT COALESCE(value,'LicenseCore Inc.') FROM settings WHERE key='company_name'").Scan(&data.CompanyName)
		db.QueryRow("SELECT COALESCE(value,'ООО «ЛицензКор»') FROM settings WHERE key='legal_name'").Scan(&data.LegalName)
		db.QueryRow("SELECT COALESCE(value,'7712345678') FROM settings WHERE key='inn'").Scan(&data.INN)
		db.QueryRow("SELECT COALESCE(value,'1234567890123') FROM settings WHERE key='ogrn'").Scan(&data.OGRN)
		db.QueryRow("SELECT COALESCE(value,'г. Москва...') FROM settings WHERE key='legal_address'").Scan(&data.Address)
		db.QueryRow("SELECT COALESCE(value,'support@licensecore.app') FROM settings WHERE key='support_email'").Scan(&data.Email)
		db.QueryRow("SELECT COALESCE(value,'https://licensecore.app') FROM settings WHERE key='website'").Scan(&data.Website)
		data.Year = strconv.Itoa(time.Now().Year())
		data.Date = time.Now().Format("02.01.2006")

		var raw string
		db.QueryRow("SELECT COALESCE(value,'') FROM settings WHERE key=?", key).Scan(&raw)

		replacer := strings.NewReplacer(
			"{{company_name}}", data.CompanyName,
			"{{legal_name}}", data.LegalName,
			"{{inn}}", data.INN,
			"{{ogrn}}", data.OGRN,
			"{{legal_address}}", data.Address,
			"{{support_email}}", data.Email,
			"{{website}}", data.Website,
			"{{year}}", data.Year,
			"{{current_date}}", data.Date,
		)
		content := replacer.Replace(raw)

		html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="ru"><head><head><meta charset="utf-8"><title>%s</title>
<style>body{font-family:system-ui,sans-serif;max-width:900px;margin:40px auto;line-height:1.8;color:#1f2937;}
h1{color:#4f46e5;text-align:center;} table{width:100%%;border-collapse:collapse;margin:40px 0;}
th,td{border:1px solid #ddd;padding:12px;} th{background:#4f46e5;color:white;}
.footer{margin-top:80px;text-align:center;color:#666;font-size:0.9em;}</style>
</head><body><h1>%s</h1><div style="white-space:pre-wrap">%s</div>
<div class="footer">© %s %s • ИНН %s • %s</div></body></html>`,
			title, title, content, data.Year, data.CompanyName, data.INN, data.Email)

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprint(w, html)
	}

	// === Маршруты ===
	mux := http.NewServeMux()
	mux.HandleFunc("/api/licenses", handleLicenses)
	mux.HandleFunc("/api/licenses/", handleLicenseByID)
	mux.HandleFunc("/api/licenses/validate", handleValidate)
	mux.HandleFunc("/api/stats", handleStats)
	mux.HandleFunc("/api/stats/chart", handleActivationsChart)
	mux.HandleFunc("/api/licenses/import", handleImport)
	mux.HandleFunc("/api/licenses/export", handleExport)
	mux.HandleFunc("/api/settings", handleSettings)
	mux.HandleFunc("/api/workplaces", handleWorkplaces)

	// Документы
	mux.HandleFunc("/api/docs/eula", func(w http.ResponseWriter, r *http.Request) { renderDoc(w, "eula_text", "Лицензионное соглашение (EULA)") })
	mux.HandleFunc("/api/docs/privacy", func(w http.ResponseWriter, r *http.Request) { renderDoc(w, "privacy_policy", "Политика конфиденциальности") })
	mux.HandleFunc("/api/docs/offer", func(w http.ResponseWriter, r *http.Request) { renderDoc(w, "offer_text", "Публичная оферта") })
	mux.HandleFunc("/api/docs/payment", func(w http.ResponseWriter, r *http.Request) { renderDoc(w, "payment_text", "Платёжное поручение") })
	mux.HandleFunc("/api/docs/invoice", func(w http.ResponseWriter, r *http.Request) { renderDoc(w, "invoice_text", "Товарная накладная") })

	// Живая таблица рабочих мест в EULA — с фильтром по выбранному кабинету
	mux.HandleFunc("/api/docs/eula-table", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
	
		// === Загружаем конфиг рабочих мест ===
		var config struct {
			Rooms   []string        `json:"rooms"`
			Devices []map[string]any `json:"devices"`
		}
	
		var jsonStr string
		if err := db.QueryRow("SELECT COALESCE(value, '') FROM settings WHERE key='workplaces_config'").Scan(&jsonStr); err == nil && jsonStr != "" {
			json.Unmarshal([]byte(jsonStr), &config)
		}
	
		// === Фильтр по выбранному кабинету (индекс) ===
		var roomFilter string
		db.QueryRow("SELECT COALESCE(value, '') FROM settings WHERE key='eula_room_filter'").Scan(&roomFilter)
	
		// === Функция: получаем название кабинета по индексу ===
		getRoomName := func(idx any) string {
			if idx == nil {
				return "Без кабинета"
			}
			// Приводим к строке
			var index int
			switch v := idx.(type) {
			case float64:
				index = int(v)
			case string:
				fmt.Sscanf(v, "%d", &index)
			default:
				return "Неизвестно"
			}
	
			if index >= 0 && index < len(config.Rooms) {
				return config.Rooms[index]
			}
			return fmt.Sprintf("Кабинет %d", index)
		}
	
		html := `<div style="margin:60px auto;padding:40px;background:#f8f9ff;border-radius:20px;border:3px solid #6366f1;font-family:system-ui,sans-serif;">
			<h2 style="text-align:center;color:#6366f1;font-size:28px;margin-bottom:30px;">
				Приложение: Активные рабочие места
			</h2>`
	
		var devicesToShow []map[string]any
	
		for _, dev := range config.Devices {
			roomIDRaw := dev["roomId"]
			var roomIDStr string
			switch v := roomIDRaw.(type) {
			case float64:
				roomIDStr = fmt.Sprintf("%.0f", v)
			case string:
				roomIDStr = v
			default:
				roomIDStr = ""
			}
	
			if roomFilter != "" && roomIDStr != roomFilter {
				continue
			}
	
			devicesToShow = append(devicesToShow, dev)
		}
	
		if len(devicesToShow) == 0 {
			msg := "Нет активных устройств"
			if roomFilter != "" && len(config.Rooms) > 0 {
				idx, _ := strconv.Atoi(roomFilter)
				if idx >= 0 && idx < len(config.Rooms) {
					msg = fmt.Sprintf("В кабинете <strong>%s</strong> нет активных устройств", config.Rooms[idx])
				}
			}
			html += `<p style="text-align:center;color:#64748b;font-size:18px;">` + msg + `</p></div>`
		} else {
			html += `<table style="width:100%;border-collapse:collapse;background:white;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.1);">
				<thead><tr style="background:#6366f1;color:white;">
					<th style="padding:16px;">Кабинет</th>
					<th style="padding:16px;">MAC-адрес</th>
					<th style="padding:16px;">Тип</th>
					<th style="padding:16px;">Статус</th>
				</tr></thead><tbody>`
	
			for _, d := range devicesToShow {
				mac := "—"
				if m, ok := d["mac"]; ok && m != nil {
					mac = fmt.Sprintf("%v", m)
					if mac == "" || mac == "<nil>" {
						mac = "—"
					}
				}
	
				status, color := "Не проверен", "#64748b"
				if s, ok := d["status"].(string); ok {
					if s == "active" {
						status, color = "Активен", "#22c55e"
					} else if s == "expired" {
						status, color = "Истёк", "#ef4444"
					}
				}
	
				typ := "Неизвестно"
				if t, ok := d["type"].(string); ok {
					switch t {
					case "desktop": typ = "ПК"
					case "laptop": typ = "Ноутбук"
					case "tablet": typ = "Планшет"
					case "server": typ = "Сервер"
					}
				}
	
				roomName := getRoomName(d["roomId"])
	
				html += fmt.Sprintf(`<tr>
					<td style="padding:14px;font-weight:bold;">%s</td>
					<td style="padding:14px;font-family:monospace;background:#f0e6ff;">%s</td>
					<td style="padding:14px;">%s</td>
					<td style="padding:14px;font-weight:bold;color:%s;">%s</td>
				</tr>`, roomName, mac, typ, color, status)
			}
	
			html += `</tbody></table>`
		}
	
		html += `<p style="text-align:center;margin-top:30px;color:#64748b;font-size:14px;">
			Сформировано: <strong>` + time.Now().Format("02.01.2006 в 15:04") + `</strong>
		</p></div>`
	
		fmt.Fprint(w, html)
	})

	fmt.Println("Сервер запущен → http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", corsMiddleware(mux)))
}

func handleWorkplaces(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.Header().Set("Access-Control-Allow-Origin", "*")

    if r.Method == "GET" {
        var config struct {
            Rooms   []string        `json:"rooms"`
            Devices []map[string]any `json:"devices"`
        }

        // Загружаем из settings
        var jsonStr string
        db.QueryRow("SELECT value FROM settings WHERE key = 'workplaces_config'").Scan(&jsonStr)
        if jsonStr != "" {
            json.Unmarshal([]byte(jsonStr), &config)
        }

        json.NewEncoder(w).Encode(config)
        return
    }

    if r.Method == "POST" {
        var input struct {
            Rooms   []string        `json:"rooms"`
            Devices []map[string]any `json:"devices"`
        }

        if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
            http.Error(w, "Invalid JSON", 400)
            return
        }

        jsonData, _ := json.Marshal(input)
        _, err := db.Exec(`INSERT OR REPLACE INTO settings (key, value) VALUES ('workplaces_config', ?)`, string(jsonData))
        if err != nil {
            http.Error(w, "Save error", 500)
            return
        }

        json.NewEncoder(w).Encode(map[string]bool{"success": true})
        return
    }

    http.Error(w, "Method not allowed", 405)
}

// CORS
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// === СПИСОК И СОЗДАНИЕ ЛИЦЕНЗИЙ ===
func handleLicenses(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case "GET":
		rows, err := db.Query(`SELECT 
			id, key, description, expiry_date, max_uses, current_uses, created_at,
			COALESCE(cost, 0) as cost,
			COALESCE(supplier, '') as supplier,
			COALESCE(activated_on, '') as activated_on
		FROM licenses ORDER BY created_at DESC`)
		if err != nil {
			http.Error(w, "DB error", 500)
			return
		}
		defer rows.Close()

		var licenses []License
		for rows.Next() {
			var l License
			err := rows.Scan(
				&l.ID,
				&l.Key,
				&l.Description,
				&l.ExpiryDate,
				&l.MaxUses,
				&l.CurrentUses,
				&l.CreatedAt,
				&l.Cost,
				&l.Supplier,
				&l.ActivatedOn,
			)
			if err != nil {
				continue
			}
			licenses = append(licenses, l)
		}
		json.NewEncoder(w).Encode(licenses)

	case "POST":
		var input struct {
			Description string  `json:"description"`
			ExpiryDate  string  `json:"expiry_date"`
			MaxUses     int     `json:"max_uses"`
			Cost        float64 `json:"cost"`
			Supplier    string  `json:"supplier"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, "Invalid JSON", 400)
			return
		}
	
		key := generateKey()
		_, err := db.Exec(`INSERT INTO licenses 
			(key, description, expiry_date, max_uses, cost, supplier) 
			VALUES (?, ?, ?, ?, ?, ?)`,
			key, input.Description, input.ExpiryDate, input.MaxUses, input.Cost, input.Supplier)
		if err != nil {
			http.Error(w, "Ошибка создания", 500)
			return
		}
	
		w.WriteHeader(201)
		json.NewEncoder(w).Encode(map[string]string{"key": key})

	default:
		http.Error(w, "Method not allowed", 405)
	}
}

// === РЕДАКТИРОВАНИЕ И УДАЛЕНИЕ ===
func handleLicenseByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/licenses/")
	if id == "" {
		http.Error(w, "ID required", 400)
		return
	}

	switch r.Method {
	case "PUT":
		var input struct {
			Description string `json:"description"`
			ExpiryDate  string `json:"expiry_date"`
			MaxUses     int    `json:"max_uses"`
		}
		json.NewDecoder(r.Body).Decode(&input)
		db.Exec("UPDATE licenses SET description = ?, expiry_date = ?, max_uses = ? WHERE id = ?",
			input.Description, input.ExpiryDate, input.MaxUses, id)
		w.WriteHeader(200)

	case "DELETE":
		db.Exec("DELETE FROM licenses WHERE id = ?", id)
		w.WriteHeader(200)

	default:
		http.Error(w, "Method not allowed", 405)
	}
}

// === ВАЛИДАЦИЯ КЛЮЧА ===
func handleValidate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != "POST" {
		http.Error(w, "Only POST", 405)
		return
	}

	var input struct{ Key string `json:"key"` }
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		json.NewEncoder(w).Encode(map[string]any{"valid": false, "error": "invalid json"})
		return
	}

	key := strings.ToUpper(strings.TrimSpace(input.Key))
	var l struct{ ID, MaxUses, CurrentUses int; ExpiryDate string }

	err := db.QueryRow("SELECT id, expiry_date, max_uses, current_uses FROM licenses WHERE UPPER(key) = ?", key).
		Scan(&l.ID, &l.ExpiryDate, &l.MaxUses, &l.CurrentUses)

	if err == sql.ErrNoRows {
		json.NewEncoder(w).Encode(map[string]any{"valid": false, "error": "Ключ не найден"})
		return
	}
	if err != nil {
		http.Error(w, "DB error", 500)
		return
	}

	// Обрезаем время, если есть
	expStr := l.ExpiryDate
	if len(expStr) > 10 {
		expStr = expStr[:10]
	}
	expiry, _ := time.Parse("2006-01-02", expStr)
	if time.Now().After(expiry.Add(24*time.Hour - time.Second)) {
		json.NewEncoder(w).Encode(map[string]any{"valid": false, "error": "Срок истёк"})
		return
	}
	if l.CurrentUses >= l.MaxUses {
		json.NewEncoder(w).Encode(map[string]any{"valid": false, "error": "Лимит исчерпан"})
		return
	}

	// Атомарная активация + лог
	tx, _ := db.Begin()
	tx.Exec("UPDATE licenses SET current_uses = current_uses + 1 WHERE id = ?", l.ID)
	tx.Exec("INSERT INTO activation_log (license_key) VALUES (?)", key)
	tx.Commit()

	newUses := l.CurrentUses + 1
	log.Printf("[SUCCESS] Активирован ключ %s (%d/%d)", key, newUses, l.MaxUses)

	json.NewEncoder(w).Encode(map[string]any{
		"valid":          true,
		"remaining_uses": l.MaxUses - newUses,
	})
}

func generateKey() string {
	return strings.ToUpper(uuid.NewString()[:12])
}

// === СТАТИСТИКА ===
func handleStats(w http.ResponseWriter, r *http.Request) {
    if r.Method != "GET" {
        http.Error(w, "Only GET", 405)
        return
    }
    w.Header().Set("Content-Type", "application/json")

    var s struct {
        Total              int `json:"total"`
        Active             int `json:"active"`
        TotalEverActivated int `json:"total_ever_activated"`
        ExpiringSoon       int `json:"expiring_soon"`
        ActivationsMonth   int `json:"activations_month"` // ←←← НОВОЕ ПОЛЕ!
    }

    db.QueryRow("SELECT COUNT(*) FROM licenses").Scan(&s.Total)

    today := time.Now().Format("2006-01-02")
    db.QueryRow("SELECT COUNT(*) FROM licenses WHERE expiry_date >= ? AND current_uses < max_uses", today).Scan(&s.Active)

    db.QueryRow("SELECT COALESCE(SUM(current_uses),0) FROM licenses").Scan(&s.TotalEverActivated)

    weekLater := time.Now().Add(7 * 24 * time.Hour).Format("2006-01-02")
    db.QueryRow("SELECT COUNT(*) FROM licenses WHERE expiry_date >= ? AND expiry_date <= ?", today, weekLater).Scan(&s.ExpiringSoon)

    // ←←← Активаций за последние 30 дней
    db.QueryRow("SELECT COUNT(*) FROM activation_log WHERE activated_at >= date('now', '-30 days')").Scan(&s.ActivationsMonth)

    json.NewEncoder(w).Encode(s)
}

// === ГРАФИК АКТИВАЦИЙ  ===
func handleActivationsChart(w http.ResponseWriter, r *http.Request) {
    if r.Method != "GET" {
        http.Error(w, "Only GET", 405)
        return
    }
    w.Header().Set("Content-Type", "application/json")

    rows, err := db.Query(`
        SELECT DATE(activated_at) as day, COUNT(*) as cnt
        FROM activation_log
        WHERE activated_at >= date('now', '-30 days')
        GROUP BY day ORDER BY day
    `)
    if err != nil {
        // Если таблицы нет — просто возвращаем пустой массив
        json.NewEncoder(w).Encode([]map[string]any{})
        return
    }
    defer rows.Close()

    type Day struct {
        Day   string `json:"day"`
        Count int    `json:"count"`
    }
    var data []Day
    for rows.Next() {
        var d Day
        if err := rows.Scan(&d.Day, &d.Count); err != nil {
            continue
        }
        data = append(data, d)
    }
    json.NewEncoder(w).Encode(data)
}

// === ИМПОРТ CSV + XLSX ===
func handleImport(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Only POST", 405)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Файл обязателен", 400)
		return
	}
	defer file.Close()

	format := r.FormValue("format")
	if format != "csv" && format != "xlsx" {
		http.Error(w, "format=csv или xlsx", 400)
		return
	}

	data, _ := io.ReadAll(file)
	var imported, skipped int
	if format == "csv" {
		imported, skipped = importCSV(data)
	} else {
		imported, skipped = importXLSX(data)
	}

	json.NewEncoder(w).Encode(map[string]any{
		"success":  true,
		"imported": imported,
		"skipped":  skipped,
		"message":  fmt.Sprintf("Добавлено: %d, пропущено: %d", imported, skipped),
	})
}

type ImportLicense struct {
	Description string `csv:"description"`
	ExpiryDate  string `csv:"expiry_date"`
	MaxUses     int    `csv:"max_uses"`
}

func importCSV(data []byte) (int, int) {
	var list []*ImportLicense
	if err := gocsv.UnmarshalBytes(data, &list); err != nil {
		log.Println("CSV error:", err)
		return 0, 0
	}
	return importLicenses(list)
}

func importXLSX(data []byte) (int, int) {
	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		log.Println("XLSX error:", err)
		return 0, 0
	}
	defer f.Close()

	rows, _ := f.GetRows(f.GetSheetName(0))
	var list []*ImportLicense
	for i, row := range rows {
		if i == 0 || len(row) < 3 { // пропуск заголовка и коротких строк
			continue
		}
		maxUses := 5
		if row[2] != "" {
			if n, err := strconv.Atoi(row[2]); err == nil && n > 0 {
				maxUses = n
			}
		}
		list = append(list, &ImportLicense{
			Description: strings.TrimSpace(row[0]),
			ExpiryDate:  strings.TrimSpace(row[1]),
			MaxUses:     maxUses,
		})
	}
	return importLicenses(list)
}

func importLicenses(items []*ImportLicense) (int, int) {
	imported, skipped := 0, 0
	for _, item := range items {
		if item.Description == "" || item.ExpiryDate == "" || item.MaxUses < 1 {
			skipped++
			continue
		}
		key := generateKey()
		_, err := db.Exec("INSERT INTO licenses (key, description, expiry_date, max_uses) VALUES (?, ?, ?, ?)",
			key, item.Description, item.ExpiryDate, item.MaxUses)
		if err != nil {
			skipped++
		} else {
			imported++
		}
	}
	return imported, skipped
}

// === ЭКСПОРТ ЛИЦЕНЗИЙ В CSV И XLSX ===
func handleExport(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	format := r.URL.Query().Get("format")
	if format != "csv" && format != "xlsx" {
		http.Error(w, "format=csv или xlsx", 400)
		return
	}

	rows, err := db.Query("SELECT key, description, expiry_date, max_uses, current_uses, created_at FROM licenses ORDER BY created_at DESC")
	if err != nil {
		http.Error(w, "DB error", 500)
		return
	}
	defer rows.Close()

	if format == "csv" {
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", "attachment;filename=licenses.csv")
		fmt.Fprintln(w, "key,description,expiry_date,max_uses,current_uses,created_at")
		for rows.Next() {
			var key, desc, exp string
			var max, cur int
			var created time.Time
			rows.Scan(&key, &desc, &exp, &max, &cur, &created)
			fmt.Fprintf(w, "%s,%s,%s,%d,%d,%s\n", key, desc, exp, max, cur, created.Format("2006-01-02 15:04:05"))
		}
		return
	}

	// === XLSX экспорт через excelize ===
	f := excelize.NewFile()
	sheet := "Licenses"
	f.SetSheetName("Sheet1", sheet)

	// Заголовки
	headers := []string{"Key", "Description", "Expiry Date", "Max Uses", "Current Uses", "Created At"}
	for i, h := range headers {
		cell := string(rune('A'+i)) + "1"
		f.SetCellValue(sheet, cell, h)
	}

	// Данные
	rowIdx := 2
	for rows.Next() {
		var key, desc, exp string
		var max, cur int
		var created time.Time
		rows.Scan(&key, &desc, &exp, &max, &cur, &created)

		f.SetCellValue(sheet, fmt.Sprintf("A%d", rowIdx), key)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", rowIdx), desc)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", rowIdx), exp)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", rowIdx), max)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", rowIdx), cur)
		f.SetCellValue(sheet, fmt.Sprintf("F%d", rowIdx), created.Format("2006-01-02 15:04:05"))
		rowIdx++
	}

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", "attachment;filename=licenses.xlsx")
	f.Write(w)
}

// === НАСТРОЙКИ — РАБОЧАЯ ВЕРСИЯ С POST ===
func handleSettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case "GET":
		rows, _ := db.Query("SELECT key, value FROM settings")
		defer rows.Close()
		data := map[string]string{}
		for rows.Next() {
			var k, v string
			rows.Scan(&k, &v)
			data[k] = v
		}
		json.NewEncoder(w).Encode(data)

	case "POST":
		var input map[string]string
		if val, ok := input["eula_table_title"]; ok && val == "" {
			delete(input, "eula_table_title") 
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, "Invalid JSON", 400)
			return
		}
		tx, _ := db.Begin()
		stmt, _ := tx.Prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
		defer stmt.Close()
		for k, v := range input {
			stmt.Exec(k, v)
		}
		tx.Commit()
		json.NewEncoder(w).Encode(map[string]bool{"success": true})

	default:
		http.Error(w, "Method not allowed", 405)
	}
}

// // === Универсальная функция рендера документов ===
// renderDoc := func(w http.ResponseWriter, key, title string) {
//     var data struct {
//         CompanyName, LegalName, INN, OGRN, Address, Email, Website, Year, Date string
//     }
//     db.QueryRow("SELECT COALESCE(value,'LicenseCore Inc.') FROM settings WHERE key='company_name'").Scan(&data.CompanyName)
//     db.QueryRow("SELECT COALESCE(value,'ООО «ЛицензКор»') FROM settings WHERE key='legal_name'").Scan(&data.LegalName)
//     db.QueryRow("SELECT COALESCE(value,'7712345678') FROM settings WHERE key='inn'").Scan(&data.INN)
//     db.QueryRow("SELECT COALESCE(value,'1234567890123') FROM settings WHERE key='ogrn'").Scan(&data.OGRN)
//     db.QueryRow("SELECT COALESCE(value,'г. Москва, ул. Примерная, д. 10') FROM settings WHERE key='legal_address'").Scan(&data.Address)
//     db.QueryRow("SELECT COALESCE(value,'support@licensecore.app') FROM settings WHERE key='support_email'").Scan(&data.Email)
//     db.QueryRow("SELECT COALESCE(value,'https://licensecore.app') FROM settings WHERE key='website'").Scan(&data.Website)
//     data.Year = strconv.Itoa(time.Now().Year())
//     data.Date = time.Now().Format("02.01.2006")

//     var raw string
//     db.QueryRow("SELECT COALESCE(value,'') FROM settings WHERE key=?", key).Scan(&raw)

//     replacer := strings.NewReplacer(
//         "{{company_name}}", data.CompanyName,
//         "{{legal_name}}", data.LegalName,
//         "{{inn}}", data.INN,
//         "{{ogrn}}", data.OGRN,
//         "{{legal_address}}", data.Address,
//         "{{support_email}}", data.Email,
//         "{{website}}", data.Website,
//         "{{year}}", data.Year,
//         "{{current_date}}", data.Date,
//     )
//     content := replacer.Replace(raw)

//     html := fmt.Sprintf(`<!DOCTYPE html>
// <html><head><meta charset="utf-8"><title>%s</title>
// <style>body{font-family:system-ui,sans-serif;max-width:900px;margin:40px auto;line-height:1.8;color:#1f2937;}
// h1{color:#4f46e5;text-align:center;margin-bottom:40px;} table{width:100%%;border-collapse:collapse;margin:30px 0;}
// th,td{border:1px solid #ddd;padding:12px;} th{background:#4f46e5;color:white;}
// .footer{margin-top:80px;text-align:center;color:#666;font-size:0.9em;}</style>
// </head><body><h1>%s</h1><div style="white-space:pre-wrap">%s</div>
// <div class="footer">© %s %s • ИНН %s • %s</div></body></html>`,
//         title, title, content, data.Year, data.CompanyName, data.INN, data.Email)

//     w.Header().Set("Content-Type", "text/html; charset=utf-8")
//     fmt.Fprint(w, html)
// }

