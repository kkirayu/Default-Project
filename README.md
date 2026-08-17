# Dompet Keluarga

Aplikasi monolith manajemen keuangan keluarga — Express + SQLite backend, React + [antd-mobile](https://github.com/ant-design/ant-design-mobile) frontend. Satu aplikasi, satu database, zero native dependency (pakai `node:sqlite` bawaan Node di lokal, dan **Turso/libSQL** saat di-deploy ke **Vercel**).

## Fitur

- **Autentikasi & Profil** — register/login/logout, edit nama (JWT httpOnly cookie)
- **Catat Transaksi** — pemasukan & pengeluaran per kategori, filter, pencarian, aturan edit 24 jam
- **Dashboard** — saldo bulanan, tren 6 bulan, pengeluaran per kategori, rekomendasi budget (rata-rata 3 bulan)
- **Alokasi Anggaran** — per kategori per bulan, pembagian otomatis 50/30/20, validasi total ≤ pemasukan, progress bar
- **Mode Keluarga** — buat/gabung keluarga via kode undangan (berlaku 7 hari), role admin/member, kontrol visibilitas transaksi per anggota
- **Pengingat Kirim Uang** — recurring (harian/mingguan/bulanan/sekali), tandai selesai

## Tech Stack

| Layer | Teknologi |
|---|---|
| Backend | Express 4 + `node:sqlite` (lokal) / Turso libSQL (Vercel) |
| Frontend | React 18 + Vite + antd-mobile + react-router |
| Auth | JWT (httpOnly cookie), bcryptjs |
| Database | SQLite (`data/wallet.db`) atau Turso (hosted libSQL) |
| Deploy | Vercel (serverless, via `api/index.js`) |

## Menjalankan

```bash
npm install

# Development (server :4000 + Vite :5173 dengan proxy /api)
npm run dev

# Produksi (build lalu jalankan satu proses di :4000 yang melayani API + frontend)
npm run build
npm start

# Isi data demo (akun: demo@keluarga.test / demo12345, transaksi 6 bulan)
npm run seed
```

Buka `http://localhost:5173` (dev) atau `http://localhost:4000` (produksi).

## Struktur

```
server/                 Express API (monolith)
  db.js                 skema SQLite + inisialisasi
  auth.js               JWT + middleware requireAuth
  helpers.js            validasi & format
  seed.js               kategori default + runner demo
  routes/
    auth.js  me.js  categories.js  transactions.js
    dashboard.js  budgets.js  family.js  reminders.js
src/                    Frontend React + antd-mobile
  pages/                Login, Register, Dashboard, Transactions, Budget, Family, Reminders, Profile
  components/           CategoryIcon, Charts (bar chart + donut SVG)
```

## API Utama

```
POST /api/auth/register | /login | /logout
GET/PATCH /api/me
GET/POST/PATCH/DELETE /api/categories
GET/POST/PATCH/DELETE /api/transactions          (?type=&categoryId=&from=&to=&q=&page=)
GET /api/dashboard?month=YYYY-MM
GET/POST /api/budgets?month= /bulk /auto          (auto = 50/30/20)
GET/POST/PATCH/DELETE /api/reminders              (+ /:id/complete)
GET/POST /api/family  POST /invite  POST /join    (join via kode)
PATCH/DELETE /api/family/members/:userId
GET /api/family/member/:userId/transactions       (admin, menghormati visibilitas)
```

## Catatan

- **Aturan edit 24 jam**: transaksi hanya bisa diedit/dihapus dalam 24 jam sejak dibuat. Set `EDIT_WINDOW_HOURS=0` untuk unlimited.
- **Database**: di lokal tersimpan di `data/wallet.db` (auto-create). Hapus folder `data/` untuk reset. Di Vercel memakai Turso (lihat di bawah).
- **Ganti `JWT_SECRET`** di lingkungan produksi.

---

## Deploy ke Vercel

> **Penting:** Vercel serverless berjalan di filesystem read-only, jadi file SQLite **tidak bisa persist** di sana. Solusinya: pakai **Turso** (hosted SQLite / libSQL) — skema & query tetap 100% kompatibel SQLite. Saat `TURSO_DATABASE_URL` diset, server otomatis memakai Turso; tanpa diset, memakai `node:sqlite` lokal.

### 1. Buat database Turso (gratis)

```bash
npm i -g @libsql/turso-cli   # atau: curl -sSfL https://get.turso.tech/install.sh | bash

turso auth login
turso db create dompet-keluarga
turso db tokens create dompet-keluarga   # simpan auth token
```

### 2. Set environment variables di Vercel

Di dashboard Vercel (project → Settings → Environment Variables), atau lewat CLI:

```bash
vercel env add TURSO_DATABASE_URL    # contoh: libsql://dompet-keluarga-xxx.turso.io
vercel env add TURSO_AUTH_TOKEN      # token dari langkah 1
vercel env add JWT_SECRET            # string rahasia acak
```

### 3. Deploy

```bash
npm i -g vercel
vercel                          # sekali untuk konfigurasi pertama (Production)
vercel --prod                   # deploy berikutnya
```

Atau hubungkan repo Git ke Vercel — setiap push ke branch default akan auto-deploy (Vercel menjalankan `npm run build`, lalu `api/index.js` melayani seluruh API + frontend).

### Cara kerjanya

- `vercel.json` → semua request dirutekan ke `api/index.js` (Express app yang sama dengan monolith).
- Skema tabel dibuat otomatis pada request pertama (`CREATE TABLE IF NOT EXISTS ...`), jadi database Turso boleh kosong.
- `dist/` hasil `vite build` ikut di-bundle ke fungsi serverless dan disajikan oleh Express.
- `data/`, `scripts/`, dan file `.db` di-exclude lewat `.vercelignore`.

### Kenapa tidak bisa sekadar `vercel` tanpa Turso?

Fungsi serverless Vercel hanya boleh menulis ke `/tmp` yang bersifat sementara — setiap cold start/redeploy akan menghapus data. Turso menghindari masalah ini dengan menyimpan SQLite-nya di cloud.
