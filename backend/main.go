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

	// Создаём таблицы
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS licenses (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			key TEXT UNIQUE NOT NULL,
			description TEXT,
			expiry_date DATE,
			max_uses INTEGER DEFAULT 5,
			current_uses INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			
			-- ЭТО ТРИ НОВЫХ ПОЛЯ — ДОБАВЛЯЕМ, НИЧЕГО НЕ ЛОМАЯ
			cost REAL DEFAULT 0,                    -- Стоимость ключа
			supplier TEXT,                          -- Поставщик (например: ООО "СофтЛайн", Microsoft, 1С)
			activated_on TEXT                       -- На каких рабочих местах (через запятую или JSON)
		);
	`)

	
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
	log.Fatal("Не удалось создать таблицу activation_log:", err)
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT
		);

		-- Значения по умолчанию (один раз)
		INSERT OR IGNORE INTO settings (key, value) VALUES 
			('company_name', 'YourCompany LLC'),
			('legal_name', 'ООО «Ваша Компания»'),
			('support_email', 'support@yourcompany.com'),
			('website', 'https://yourcompany.com'),
			('eula_text', 'ЭТО КОНЕЧНОЕ ЛИЦЕНЗИОННОЕ СОГЛАШЕНИЕ...'),
			('privacy_policy', 'ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ...'),
			('offer_text', 'ПУБЛИЧНАЯ ОФЕРТА...');	
	`)
	if err != nil {
		log.Fatal("Ошибка создания таблиц:", err)
	}

	db.Exec("ALTER TABLE licenses ADD COLUMN cost REAL DEFAULT 0")
	db.Exec("ALTER TABLE licenses ADD COLUMN supplier TEXT")
	db.Exec("ALTER TABLE licenses ADD COLUMN activated_on TEXT")

	// === ЗАПОЛНЯЕМ НАСТРОЙКИ И ДОКУМЕНТЫ ПО УМОЛЧАНИЮ (БЕЗ ОШИБОК С КАВЫЧКАМИ) ===
	_, err = db.Exec(`
	INSERT OR REPLACE INTO settings (key, value) VALUES
	('company_name', 'LicenseCore Inc.'),
	('legal_name', 'ООО «ЛицензКор»'),
	('inn', '7712345678'),
	('ogrn', '1234567890123'),
	('legal_address', 'г. Москва, ул. Примерная, д. 10, офис 501'),
	('support_email', 'support@licensecore.app'),
	('website', 'https://licensecore.app'),

	('eula_text', 
	$ЕULA_TEXT$),

	('privacy_policy', 
	$PRIVACY_TEXT$),

	('offer_text', 
	$OFFER_TEXT$)
	`)

	// А теперь вставляем тексты через отдельные Exec — так Go не ломается на кавычках
	_, err =db.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", "eula_text",
	`ЛИЦЕНЗИОННОЕ СОГЛАШЕНИЕ (EULA)

	Настоящее Лицензионное соглашение (далее — «Соглашение») заключается между {{company}} (далее — «Правообладатель») в лице {{legal_name}}, ИНН {{inn}}, ОГРН {{ogrn}}, и вами (физическим или юридическим лицом).

	1. Предоставление лицензии
	Правообладатель предоставляет вам неисключительную, непередаваемую лицензию на использование программного обеспечения в соответствии с приобретённым типом лицензии.

	2. Ограничения
	Запрещается:
	• Декомпиляция, обратная разработка, модификация ПО
	• Передача лицензии третьим лицам без письменного согласия
	• Использование сверх лимита активаций

	3. Срок действия
	Лицензия действует до даты, указанной в вашем ключе, либо до отзыва Правообладателем.

	4. Поддержка
	Техническая поддержка осуществляется по email: {{support_email}}

	5. Заключительные положения
	Настоящее Соглашение регулируется законодательством Российской Федерации.

	Дата вступления в силу: {{year}} год
	{{company}}
	{{legal_name}}
	Адрес: {{legal_address}}
	Email: {{support_email}}`)

	_, err = db.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", "privacy_policy",
	`ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ

	{{company}} уважает вашу конфиденциальность.

	1. Какие данные мы собираем
	• Лицензионный ключ
	• IP-адрес при активации
	• Email (если указан)

	2. Для чего используем
	• Проверка валидности лицензии
	• Борьба с пиратством
	• Улучшение продукта

	3. Мы НЕ собираем
	• Личные данные пользователей ПО
	• Содержимое жёсткого диска
	• Пароли и платёжные данные

	4. Хранение
	Данные хранятся на защищённых серверах в ЕС и РФ. Срок хранения — 3 года.

	5. Контакты
	По всем вопросам: {{support_email}}

	Настоящая политика актуальна на {{year}} год.
	{{company}}, {{legal_name}}`)

	_, err = db.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", "offer_text",
	`ПУБЛИЧНАЯ ОФЕРТА

	{{legal_name}}, в лице генерального директора, действующего на основании Устава, именуемое в дальнейшем «Исполнитель», публикует настоящий Договор-оферту.

	1. Предмет оферты
	Исполнитель оказывает услуги по предоставлению неисключительных лицензий на программное обеспечение LicenseCore.

	2. Стоимость и порядок оплаты
	Оплата производится через платёжные системы. Все цены указаны на сайте {{website}}.

	3. Права и обязанности
	Исполнитель гарантирует работоспособность ПО в течение срока лицензии.
	Заказчик обязуется использовать ПО в соответствии с EULA.

	4. Ответственность
	Исполнитель не несёт ответственности за косвенные убытки.

	5. Реквизиты
	{{legal_name}}
	ИНН {{inn}}, ОГРН {{ogrn}}
	Юридический адрес: {{legal_address}}
	Email: {{support_email}}
	Сайт: {{website}}

	Настоящая оферта считается акцептованной с момента оплаты.`)
	if err != nil {
		log.Printf("Ошибка заполнения документов: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/licenses", handleLicenses)
	mux.HandleFunc("/api/licenses/", handleLicenseByID)
	mux.HandleFunc("/api/licenses/validate", handleValidate)
	mux.HandleFunc("/api/stats", handleStats)
	mux.HandleFunc("/api/stats/chart", handleActivationsChart)
	mux.HandleFunc("/api/licenses/import", handleImport)
	mux.HandleFunc("/api/licenses/export", handleExport)

	mux.HandleFunc("/api/settings", handleSettings)           // GET + POST
	mux.HandleFunc("/api/docs/eula", handleDocEULA)           // HTML документ
	mux.HandleFunc("/api/docs/privacy", handleDocPrivacy)     // HTML
	mux.HandleFunc("/api/docs/offer", handleDocOffer)         // HTML
	mux.HandleFunc("/api/workplaces", handleWorkplaces)

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

// === ГЕНЕРАЦИЯ ДОКУМЕНТОВ С ПОЛНЫМИ ДАННЫМИ ===
func renderDoc(w http.ResponseWriter, key, title string) {
	var tpl struct {
		Company, Legal, Email, Website, INN, OGRN, Address string
	}

	db.QueryRow("SELECT COALESCE(value,'LicenseCore Inc.') FROM settings WHERE key='company_name'").Scan(&tpl.Company)
	db.QueryRow("SELECT COALESCE(value,'ООО «ЛицензКор»') FROM settings WHERE key='legal_name'").Scan(&tpl.Legal)
	db.QueryRow("SELECT COALESCE(value,'support@licensecore.app') FROM settings WHERE key='support_email'").Scan(&tpl.Email)
	db.QueryRow("SELECT COALESCE(value,'https://licensecore.app') FROM settings WHERE key='website'").Scan(&tpl.Website)
	db.QueryRow("SELECT COALESCE(value,'7712345678') FROM settings WHERE key='inn'").Scan(&tpl.INN)
	db.QueryRow("SELECT COALESCE(value,'1234567890123') FROM settings WHERE key='ogrn'").Scan(&tpl.OGRN)
	db.QueryRow("SELECT COALESCE(value,'г. Москва, ул. Примерная, д. 10') FROM settings WHERE key='legal_address'").Scan(&tpl.Address)

	var text string
	db.QueryRow("SELECT COALESCE(value, 'Документ не настроен') FROM settings WHERE key=?", key).Scan(&text)

	replacer := strings.NewReplacer(
		"{{company}}", tpl.Company,
		"{{legal}}", tpl.Legal,
		"{{email}}", tpl.Email,
		"{{website}}", tpl.Website,
		"{{year}}", strconv.Itoa(time.Now().Year()),
		"{{inn}}", tpl.INN,
		"{{ogrn}}", tpl.OGRN,
		"{{legal_address}}", tpl.Address,
	)
	html := replacer.Replace(text)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><title>%s</title>
<style>body{font-family:system-ui,sans-serif;max-width:900px;margin:40px auto;padding:20px;line-height:1.8;color:#1f2937;}
h1{color:#4f46e5;text-align:center;} .footer{margin-top:80px;text-align:center;color:#6b7280;font-size:0.9em;}</style>
</head><body><h1>%s</h1><div style="white-space:pre-wrap">%s</div>
<div class="footer">© %d %s<br>ИНН %s • ОГРН %s<br>%s</div></body></html>`,
		title, title, html, time.Now().Year(), tpl.Company, tpl.INN, tpl.OGRN, tpl.Email)
}

// Эти 3 функции — ОБЯЗАТЕЛЬНО ДОБАВЬ!
func handleDocEULA(w http.ResponseWriter, r *http.Request)     { renderDoc(w, "eula_text", "Лицензионное соглашение (EULA)") }
func handleDocPrivacy(w http.ResponseWriter, r *http.Request)  { renderDoc(w, "privacy_policy", "Политика конфиденциальности") }
func handleDocOffer(w http.ResponseWriter, r *http.Request)    { renderDoc(w, "offer_text", "Публичная оферта") }