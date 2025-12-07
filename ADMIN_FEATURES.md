# Admin Dashboard Features - Edit Service Catalog

## 📋 Deskripsi Fitur

Admin Dashboard sekarang dilengkapi dengan fitur **"Edit Service Catalog"** yang memungkinkan admin untuk mengubah jenis service catalog dari ticket permintaan yang sudah terbentuk. Fitur ini berguna ketika ada kesalahan dalam pemilihan service catalog saat permintaan dibuat.

---

## 🎯 Cara Menggunakan

### 1. **Akses Admin Dashboard**
- Buka: `http://localhost:3000/admin-dashboard.html`
- Atau dari halaman index.html, pilih role "Admin Iserve"

### 2. **Lihat Daftar Request**
- Admin dashboard menampilkan tabel semua permintaan yang masuk
- Kolom yang ditampilkan:
  - Request ID
  - Nama Service
  - Requestor (nama peminta)
  - Status
  - Urgensi
  - Assigned To (engineer yang ditunjuk)
  - Aksi

### 3. **Buka Detail Request**
- Klik tombol **👁️ Lihat Detail** pada baris request yang ingin diubah
- Modal akan terbuka menampilkan informasi lengkap request

### 4. **Edit Service Catalog**
Di bagian **"✏️ Edit Service Catalog"** pada modal detail:

#### **Langkah-langkah:**

1. **Pilih Service Catalog Baru** (wajib)
   - Klik dropdown "🎯 Ubah Jenis Service Catalog"
   - Pilih service yang benar dari daftar
   - Service Title, Service ID, dan Deskripsi akan otomatis terupdate

2. **Opsional: Tambahkan Catatan Perubahan**
   - Di field "📝 Catatan Perubahan", jelaskan alasan perubahan
   - Contoh: "Service diubah karena user salah pilih awalnya"

3. **Simpan Perubahan**
   - Klik tombol **"💾 Simpan Perubahan"**
   - Sistem akan:
     - Memvalidasi input
     - Menyimpan perubahan ke database
     - Mencatat audit trail (riwayat perubahan)
     - Menampilkan pesan sukses
     - Menutup modal dan merefresh daftar request

---

## 📊 Daftar Service Catalog Yang Tersedia

| Icon | Nama Service | ID | Deskripsi |
|------|------|------|-----------|
| 📊 | Data dan Laporan ADHOQ/OutQ | `svc_data_laporan` | Permintaan data dan laporan ADHOQ/OutQ |
| 📧 | Email Service (Zimbra) | `svc_email` | Buat email, reset password Zimbra |
| 🌙 | EOD Core Banking Development | `svc_eod` | End of Day Core Banking Development (EOD-Q) |
| 🖥️ | Hardware Request | `svc_hw_request` | Permintaan perangkat hardware |
| 🔧 | Instalasi Hardware/Software Cabang | `svc_hw_cabang` | Instalasi Hardware/Software Client Kantor Cabang/Outlet |
| 🏢 | Instalasi Hardware/Software Pusat | `svc_hw_pusat` | Instalasi Hardware/Software Client Kantor Pusat |
| 💾 | Instalasi Hardware/Software Server | `svc_hw_server` | Instalasi Hardware/Software Server Kantor Cabang/Outlet |
| 🏧 | Jaringan ATM & Channel | `svc_network_atm` | Jaringan Komunikasi ATM & Channel |
| 📡 | Jaringan Komunikasi Outlet | `svc_network_outlet` | Permintaan jaringan komunikasi outlet |
| 🗄️ | Maintenance Data | `svc_maintenance_data` | Pemeliharaan dan perbaikan data |
| ⚙️ | Maintenance Fitur Aplikasi | `svc_maintenance_app` | Maintenance Fitur Aplikasi Existing |
| 🏪 | Open Booth | `svc_open_booth` | Permintaan pembukaan booth baru |
| 🔄 | Penambahan Object Replikasi MIMIX | `svc_mimix` | Penambahan object replikasi MIMIX |
| 🖨️ | Pencetakan Rekening Koran | `svc_print_rekening` | Permintaan cetak rekening koran |
| 🌐 | Permintaan IP Server | `svc_ip_server` | Permintaan alokasi IP Server |
| 💿 | Restore Database Non Core | `svc_restore_db` | Restore Database non core/non as400 |
| 🔀 | Routing and Switching | `svc_routing` | Konfigurasi routing dan switching |
| 🖲️ | Server Non Virtual Machine | `svc_server_nonvm` | Permintaan server non virtual machine |
| ☁️ | Server Virtual Machine AS400 | `svc_server_vm` | Server virtual machine as400 |

---

## 🔧 Fitur Teknis

### Backend API: `/api/update-servicecatalog`

**Method:** POST  
**Content-Type:** application/json

**Request Body:**
```json
{
  "requestId": "req_1",
  "serviceTitle": "Email Service (Zimbra)",
  "serviceId": "svc_email",
  "description": "Buat email, reset password Zimbra",
  "changeNotes": "Service diubah karena user salah pilih awalnya"
}
```

**Response Success (200 OK):**
```json
{
  "status": "success",
  "message": "Service catalog updated successfully",
  "data": {
    "requestId": "req_1",
    "updated": {
      "serviceTitle": "Email Service (Zimbra)",
      "serviceId": "svc_email",
      "description": "Buat email, reset password Zimbra"
    },
    "oldValues": {
      "serviceTitle": "Permintaan IP Server",
      "serviceId": "svc_ip_server",
      "description": "Permintaan alokasi IP Server"
    },
    "changeNotes": "Service diubah karena user salah pilih awalnya",
    "updatedAt": "2025-12-04T06:55:50.123Z",
    "changeHistory": [
      {
        "timestamp": "2025-12-04T06:55:50.123Z",
        "changedBy": "admin",
        "oldValues": {...},
        "newValues": {...},
        "notes": "Service diubah karena user salah pilih awalnya"
      }
    ]
  }
}
```

### Audit Trail

Setiap perubahan service catalog disimpan dalam `changeHistory` pada request object:
- **timestamp**: Kapan perubahan dilakukan
- **changedBy**: Siapa yang melakukan (saat ini: "admin")
- **oldValues**: Nilai sebelumnya
- **newValues**: Nilai yang baru
- **notes**: Catatan alasan perubahan

---

## ✨ Fitur UI/UX

### Visual Indicators
- 🎯 Icon untuk dropdown pemilihan service
- ✏️ Icon untuk section edit
- 💾 Tombol simpan dengan icon disk
- ✕ Tombol batal dengan icon X
- Alert sukses (hijau) dan error (merah)

### Validasi Input
- Service Catalog wajib dipilih (dropdown validation)
- Automatic update pada Service Title, Service ID, dan Deskripsi
- Pesan error jika validasi gagal

### User Experience
- Modal berhasil menutup otomatis setelah save
- Daftar request otomatis di-refresh
- Alert success menampilkan 1.5 detik sebelum modal tutup
- Field readonly untuk Service Title, ID, dan Deskripsi (auto-updated)

---

## 📝 Logging & Debugging

Semua perubahan service catalog dicatat di console server:
```
✓ Service Catalog Updated for req_1
  Service Title: Permintaan IP Server → Email Service (Zimbra)
  Service ID: svc_ip_server → svc_email
  Change Notes: Service diubah karena user salah pilih awalnya
```

---

## 🛡️ Keamanan & Best Practices

### Saat Ini:
- Admin dapat mengubah service catalog tanpa batasan
- Semua perubahan tercatat dalam audit trail

### Rekomendasi Masa Depan:
- Tambahkan role-based access control (RBAC)
- Implementasi approval workflow untuk perubahan critical
- Tambahkan timestamp dan user identifier untuk setiap perubahan
- Notifikasi ke requestor ketika service catalog diubah

---

## 🚀 File-file yang Dimodifikasi

1. **`public/admin-dashboard.html`**
   - Menambahkan SERVICE_CATALOG constant
   - Update form untuk edit service catalog
   - Fungsi `updateServiceInfo()` untuk auto-update fields
   - Update fungsi `saveChanges()` dengan validasi baru

2. **`src/controller/requestController.js`**
   - API endpoint: `POST /api/update-servicecatalog`
   - Validasi input
   - Simpan change history
   - Logging untuk audit trail

3. **`src/routes/requestRoutes.js`**
   - Tambah route: `POST /api/update-servicecatalog`

---

## 📞 Support

Jika ada pertanyaan atau issue, silakan cek:
- Browser Console (F12) untuk error messages
- Server Console untuk API logs
- Change History di modal detail request untuk melihat riwayat perubahan
