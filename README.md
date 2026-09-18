# Chromium Search Keyword Blocker 🛡️

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-brightgreen.svg?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Version](https://img.shields.io/badge/Version-1.1.0-blue.svg?style=flat-square)](package.json)
[![Tests](https://img.shields.io/badge/Tests-Passing-success.svg?style=flat-square)](tests/)
[![License](https://img.shields.io/badge/License-MIT-orange.svg?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Chromium%20%7C%20Chrome%20%7C%20Brave%20%7C%20Edge-informational.svg?style=flat-square)](https://www.chromium.org/)

Ekstensi browser berbasis **Manifest V3** untuk mendeteksi dan memblokir pencarian kata kunci tertentu (misal: `vpn`, `proxy`, kata kunci berbahaya, atau distraksi lainnya) secara otomatis di berbagai mesin pencari utama. 

Dilengkapi dengan teknologi **Anti-Flash Pre-Render Protection (Zero-Latency)** agar hasil pencarian tidak sempat berkedip di layar, serta sistem proteksi kata kunci berbasis **Web Crypto API (PBKDF2-SHA256)** dan auto-lockout anti brute-force.

---

## 🌟 Fitur Utama

- 🔍 **Dukungan Multi Search Engine:**
  - **Google** (`google.com`, `google.co.id`, Google Images, Videos, News)
  - **Brave Search** (`search.brave.com`)
  - **Microsoft Bing** (`bing.com`)
  - **DuckDuckGo** (`duckduckgo.com`)
  - **Yahoo Search** (`search.yahoo.com`)
- ⚡ **Anti-Flash Pre-Render Protection:** Menyembunyikan tampilan pencarian seketika pada event `document_start` sebelum halaman sempat dirender oleh browser (mencegah *visual leak*).
- 🚫 **2 Mode Tampilan Pemblokiran:**
  - **Mode A (Blank Page):** Tampilan putih/kosong murni untuk efisiensi dan kerahasiaan penuh.
  - **Mode B (Blocked Card):** Kartu pemberitahuan elegan berdesain modern dengan informasi pencarian yang diblokir.
- 🎯 **3 Metode Pencocokan Kata Kunci:**
  - `contains`: Memblokir setiap query pencarian yang mengandung kata kunci (default).
  - `exact`: Hanya memblokir query yang sama persis dengan kata kunci.
  - `word_boundary`: Memblokir kata kunci sebagai kata mandiri (*whole word*).
- 🔒 **Tingkat Proteksi Keyword Berjenjang:**
  - **Level 1 (Normal):** Dapat ditambahkan dan dihapus secara bebas oleh administrator.
  - **Level 2 (Protected):** Mengharuskan otentikasi password admin untuk melakukan perubahan atau penghapusan.
  - **Level 3 (Mandatory):** Kata kunci wajib yang terkunci secara permanen dan tidak dapat dihapus melalui antarmuka reguler.
- 🛡️ **Keamanan Administrator Tingkat Lanjut:**
  - **Kriptografi Standar Industri:** Hashing password menggunakan PBKDF2-SHA256 dengan 310.000 iterasi dan random salt 16-byte kriptografis.
  - **Sesi Admin Sementara:** Disimpan di `chrome.storage.session` (otomatis terkunci setelah 5 menit tidak aktif atau saat browser ditutup).
  - **Anti Brute-Force Rate Limiting:** Mekanisme progressive backoff otomatis jika terjadi percobaan password yang salah berulang kali.
  - **Sanitized Backup & Restore:** Fitur ekspor/impor konfigurasi aman tanpa menyertakan hash password atau data sensitif sesi.
- 🔏 **100% Privat & Offline:** Seluruh proses pencocokan query dan penyimpanan data dilakukan 100% lokal di browser pengguna tanpa mengirim data apa pun ke server eksternal.

---

## 📁 Struktur Direktori

```text
search-keyword-blocker/
├── manifest.json              # Konfigurasi Manifest V3
├── package.json               # Konfigurasi proyek & scripts
├── README.md                  # Dokumentasi proyek
├── .gitignore                 # Filter file repository
│
├── background/
│   └── service-worker.js     # Background listener & navigation redirect engine
│
├── content/
│   ├── search-filter.js      # Content script anti-flash & live DOM filter
│   └── anti-flash.css        # Concealment stylesheet saat inisialisasi query
│
├── core/
│   ├── normalizer.js          # Canonical string normalization (case, space, diacritics)
│   ├── keyword-matcher.js     # Algoritma pencocokan (contains, exact, word_boundary)
│   ├── search-engine-parser.js# Ekstraksi parameter query multi-engine
│   └── auth.js                # Web Crypto PBKDF2, salt, secure compare & rate-limiting
│
├── storage/
│   └── storage.js             # Abstraksi chrome.storage.local & session
│
├── pages/
│   ├── blocked.html           # Halaman pengalihan internal (blank / notice)
│   ├── blocked.css            # Styling visual modern halaman blocked
│   └── blocked.js             # Logika render tampilan blocked
│
├── popup/
│   ├── popup.html             # Popup menu ekstensi di toolbar browser
│   ├── popup.css              # Desain antarmuka glassmorphism modern
│   └── popup.js               # Logika status aktif, counter, & quick settings
│
├── options/
│   ├── options.html           # Dashboard lengkap pengaturan administrator
│   ├── options.css            # Styling responsif dashboard options
│   └── options.js             # Manajemen keyword, proteksi level, backup/restore
│
├── assets/
│   └── icons/                 # Aset ikon beresolusi tinggi (16, 32, 48, 128 px)
│
└── tests/
    ├── normalizer.test.js     # Unit test normalisasi teks & query
    ├── keyword-matcher.test.js# Unit test logika pencocokan keyword
    ├── search-engine-parser.test.js # Unit test parser URL search engine
    ├── auth.test.js           # Unit test kriptografi & brute-force protection
    └── runner.js              # Runner pengujian otomatis
```

---

## 🚀 Panduan Instalasi (Developer Mode)

Untuk mencoba atau mengembangkan ekstensi ini secara lokal:

1. **Clone repository ini:**
   ```bash
   git clone https://github.com/haqqirahman/search-keyword-blocker.git
   cd search-keyword-blocker
   ```

2. **Buka halaman ekstensi di browser:**
   - **Google Chrome:** Buka `chrome://extensions/`
   - **Brave Browser:** Buka `brave://extensions/`
   - **Microsoft Edge:** Buka `edge://extensions/`

3. **Aktifkan Developer Mode:**
   - Nyalakan saklar **Developer mode** di sudut kanan atas halaman.

4. **Muat Ekstensi (*Load unpacked*):**
   - Klik tombol **Load unpacked** di pojok kiri atas.
   - Pilih folder direktori proyek `search-keyword-blocker`.
   - Ekstensi akan langsung terpasang dan siap digunakan!

---

## 🧪 Menjalankan Pengujian Otomatis (*Unit Tests*)

Ekstensi ini dilengkapi dengan serangkaian pengujian otomatis untuk memvalidasi fungsi normalisasi, parser URL pencarian, algoritma pencocokan, serta sistem otentikasi:

```bash
npm test
```

Semua pengujian berjalan secara mandiri menggunakan Node.js murni tanpa dependensi eksternal yang berat.

---

## 📦 Pembuatan Paket untuk Chrome Web Store

Untuk mengemas ekstensi menjadi file `.zip` siap upload ke **Chrome Web Store Developer Dashboard**:

Jalankan perintah:
```bash
npm run package
```

File arsip produksi akan otomatis dihasilkan di:
```text
dist/search-keyword-blocker-v1.1.0.zip
```

> [!NOTE]
> File `.zip` yang dihasilkan hanya menyertakan aset produksi yang diperlukan (manifest, core, content, background, pages, popup, options, icons) dan secara otomatis mengesampingkan file pengujian, git, dan dokumen internal.

---

## 🔒 Kebijakan Privasi & Izin (*Permissions*)

Ekstensi ini hanya meminta izin yang mutlak diperlukan untuk menjalankan fungsinya:

| Izin (*Permission*) | Tujuan Penggunaan |
|---|---|
| `storage` | Menyimpan daftar kata kunci, preferensi tampilan, dan state konfigurasi secara lokal di perangkat Anda. |
| `webNavigation` | Mendeteksi URL pencarian sebelum halaman selesai dirender agar pencegahan berjalan seketika (*zero-latency*). |
| `tabs` | Mengarahkan tab aktif ke halaman peringatan (*blocked page*) ketika kata kunci terlarang terdeteksi. |
| `host_permissions` | Dibatasi secara ketat hanya pada domain mesin pencari yang didukung (`google`, `bing`, `brave`, `duckduckgo`, `yahoo`). |

**Privasi Terjamin:** Ekstensi ini **tidak pernah** mengumpulkan, merekam, atau mentransmisikan data pencarian maupun data pribadi pengguna ke server mana pun.

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah lisensi [MIT](LICENSE). Silakan gunakan, modifikasi, dan distribusikan sesuai ketentuan lisensi.
