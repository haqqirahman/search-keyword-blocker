# Chromium Search Keyword Blocker Extension

**Versi:** 1.1.0  
**Standar:** Manifest V3 (MV3)  
**Platform:** Google Chrome, Brave Browser, Microsoft Edge, dan browser berbasis Chromium lainnya.

Extension ini berfungsi untuk mendeteksi dan memblokir hasil pencarian kata kunci tertentu (seperti `vpn`, `proxy`, dll.) di berbagai mesin pencari utama sebelum halaman sempat ditampilkan ke pengguna (dengan teknologi Anti-Flash zero-latency). Dilengkapi sistem keamanan **Admin Password** berbasis **Web Crypto API (PBKDF2-SHA256)**, session auto-lockout, dan perlindungan penghapusan keyword berjenjang.

---

## Fitur Utama

- **Mesin Pencari yang Didukung:**
  - Google (`google.com`, `google.co.id`, dan subkategori Google Images/Videos/News)
  - Brave Search (`search.brave.com`)
  - Microsoft Bing (`bing.com`)
  - DuckDuckGo (`duckduckgo.com`)
  - Yahoo Search (`search.yahoo.com` dengan parameter `p`)
- **Anti-Flash Pre-Render Protection:** Menyembunyikan tampilan seketika pada `document_start` sebelum search engine merender hasil, mencegah hasil terlihat sesaat (no visual leak).
- **Strategi Pemblokiran Fleksibel:**
  - **Mode A (Default):** Halaman kosong murni (*blank page*).
  - **Mode B:** Kartu peringatan modern elegan (*blocked notice card*).
- **Tiga Metode Pencocokan Keyword:**
  - `contains` (Default: memblokir setiap query yang memuat kata kunci)
  - `exact` (Hanya memblokir query yang sama persis)
  - `word_boundary` (Memblokir kata kunci sebagai kata mandiri)
- **Tingkat Proteksi Keyword Berjenjang:**
  - **Level 1 (Normal):** Dapat dikelola administrator.
  - **Level 2 (Protected 🔒):** Mengharuskan password admin dan konfirmasi penghapusan.
  - **Level 3 (Mandatory 🛡️):** Keyword wajib yang terkunci dan tidak dapat dihapus melalui antarmuka biasa.
- **Sistem Keamanan Administrator Tingkat Lanjut:**
  - **Non-Plaintext Storage:** Enkripsi password menggunakan PBKDF2-SHA256 dengan 310.000 iterasi dan random salt 16-byte kriptografis.
  - **Sesi Admin Sementara:** Disimpan di `chrome.storage.session` (otomatis terkunci setelah 5 menit atau ketika browser ditutup).
  - **Anti Brute-Force Lockout:** Progressive backoff (5 percobaan salah mengunci akses selama 30s, 60s, 120s, 300s).
  - **Sanitized Export/Import:** Ekspor konfigurasi JSON aman tanpa menyertakan hash password atau data sesi.
  - **Reset Guard:** Mengembalikan ke setelan pabrik mewajibkan password admin dan pengetikan kata konfirmasi `RESET`.

---

## Struktur Direktori

```text
search-keyword-blocker/
├── manifest.json                  # Konfigurasi Manifest V3
├── package.json                   # Metadata & script test
├── README.md                      # Dokumentasi teknis & panduan instalasi
│
├── background/
│   └── service-worker.js         # Service worker webNavigation & redirection engine
│
├── content/
│   ├── search-filter.js          # Content script anti-flash & DOM monitor
│   └── anti-flash.css            # Concealment stylesheet saat evaluasi query
│
├── core/
│   ├── normalizer.js             # Normalisasi URL decoding, lowercase, unicode & space
│   ├── keyword-matcher.js        # Algoritma pencocokan (contains, exact, word_boundary)
│   ├── search-engine-parser.js   # Ekstraksi query multi-engine & loop protection
│   └── auth.js                   # Web Crypto PBKDF2, salt, secure compare & rate-limiting
│
├── storage/
│   └── storage.js                # Wrapper chrome.storage.local & chrome.storage.session
│
├── pages/
│   ├── blocked.html              # Halaman redirect internal (blank / notice)
│   ├── blocked.css               # Styling halaman blocked
│   └── blocked.js                # Logika pemilihan tampilan blank vs blocked
│
├── popup/
│   ├── popup.html                # Popup status, counter, & quick admin link
│   ├── popup.css                 # Desain glassmorphic modern
│   └── popup.js                  # Logika status & auth modal toggle off
│
├── options/
│   ├── options.html              # Dashboard lengkap administrator
│   ├── options.css               # Styling dashboard responsif
│   └── options.js                # Keyword CRUD, bulk import, export & reset
│
├── assets/
│   └── icons/                    # Ikon tameng resolusi tinggi (16, 32, 48, 128 px)
│
└── tests/
    ├── normalizer.test.js        # Pengujian canonical normalization
    ├── keyword-matcher.test.js   # Pengujian AC-01 hingga AC-05
    ├── search-engine-parser.test.js # Pengujian AC-06 hingga AC-09
    ├── auth.test.js              # Pengujian PBKDF2, verification, & lockout
    └── runner.js                 # Runner pengujian otomatis
```

---

## Cara Instalasi di Browser Chromium (Chrome / Brave / Edge)

### 1. Buka Menu Ekstensi
1. Buka Google Chrome, Brave Browser, atau Microsoft Edge.
2. Pada address bar, buka:
   ```text
   chrome://extensions
   ```
   *(atau `brave://extensions` jika menggunakan Brave).*

### 2. Aktifkan Developer Mode
Aktifkan toggle **Developer mode** di sudut kanan atas halaman ekstensi.

### 3. Muat Ekstensi (*Load unpacked*)
1. Klik tombol **Load unpacked** (Muat yang belum dibongkar) di pojok kiri atas.
2. Masukkan path folder ekstensi:
   - **Dari Windows:**
     ```text
     C:\Users\Rahman\.gemini\antigravity-ide\scratch\search-keyword-blocker
     ```
   - **Atau melalui path WSL UNC:**
     ```text
     \\wsl.localhost\Ubuntu-24.04\home\rahman\search-keyword-blocker
     ```
3. Klik **Select Folder**.
4. Ekstensi **Chromium Search Keyword Blocker** akan langsung aktif di browser!

---

## Menjalankan Pengujian Otomatis

Ekstensi dilengkapi dengan unit test suite komprehensif yang menguji seluruh modul core dan kriteria penerimaan (Acceptance Criteria AC-01 s/d AC-16).

### Menjalankan dari WSL:
```bash
cd /home/rahman/search-keyword-blocker
node.exe tests/runner.js
```
*(atau `npm test`).*

### Menjalankan dari Windows PowerShell:
```powershell
cd C:\Users\Rahman\.gemini\antigravity-ide\scratch\search-keyword-blocker
node tests/runner.js
```

---

## Lisensi
MIT License
