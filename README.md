# 📚 Novel Scraper Ecosystem — Desktop Pro & Browser Extension

[![Desktop Edition](https://img.shields.io/badge/Desktop%20Pro-Tauri%20v2%20%2B%20Rust%20%2B%20Svelte%205-00D2FF?style=for-the-badge&logo=rust)](./desktop/README.md)
[![Browser Extension](https://img.shields.io/badge/Browser%20Extension-WXT%20MV3%20%2B%20Svelte%205-10B981?style=for-the-badge&logo=googlechrome)](./extension/README.md)
[![License](https://img.shields.io/badge/100%25%20Local-No%20Telemetry-3B82F6?style=for-the-badge)](./desktop/README.md)

**Novel Scraper** là hệ sinh thái công cụ cào tự động, làm sạch văn bản, quản lý thư viện ngoại tuyến, xuất sách điện tử đa định dạng (`EPUB 3`, `DOCX`, `PDF`, `TXT`, `JSON`) và đọc tiểu thuyết mạng chuyên sâu.

Dự án hiện được **tách biệt hoàn toàn thành 2 phiên bản độc lập** trong 2 thư mục riêng biệt để dễ dàng quản lý, phát triển và đóng gói:

---

## 🗂️ Cấu Trúc Dự Án Sau Khi Tách Riêng

```text
Novel Scraper/
├── desktop/                  # 🖥️ Bản Phần Mềm Máy Tính (Tauri v2 + Rust + Svelte 5)
│   ├── Novel Scraper.exe     # File chạy trực tiếp (Standalone Portable EXE)
│   ├── README.md             # Tài liệu chi tiết riêng cho bản Desktop Pro
│   ├── src/                  # Giao diện Svelte 5 Runes & trình đọc nâng cao
│   └── src-tauri/            # Nhân hệ thống Rust đa luồng & SQLite WAL
│
├── extension/                # 🌐 Bản Tiện Ích Mở Rộng Trình Duyệt (WXT Manifest V3)
│   ├── README.md             # Tài liệu chi tiết riêng cho bản Browser Extension
│   ├── entrypoints/          # Side Panel, Background Service Worker, Content Script
│   ├── components/           # Giao diện Side Panel Svelte 5
│   └── lib/                  # Engine bóc tách 3 tầng & Dexie IndexedDB
│
├── Novel Scraper.exe         # Bản copy nhanh của Desktop Pro EXE ngay tại thư mục gốc
└── README.md                 # Tài liệu điều hướng tổng quan (File hiện tại)
```

---

## 🚀 So Sánh & Liên Kết Tới Từng Phiên Bản

| Tiêu Chí | 🖥️ [Bản Desktop Pro (`./desktop`)](./desktop/README.md) | 🌐 [Bản Browser Extension (`./extension`)](./extension/README.md) |
|---|---|---|
| **Nền tảng cốt lõi** | **Tauri v2 + Rust + Svelte 5** (Không dùng Electron) | **WXT (Manifest V3) + Svelte 5** (Chrome, Edge, Brave, Firefox) |
| **Cách thức hoạt động** | Ứng dụng `.exe` độc lập (~14 MB), vượt CORS bằng nhân Rust `reqwest` | Tích hợp trực tiếp vào thanh bên (Side Panel) của trình duyệt |
| **Cơ sở dữ liệu** | SQLite (WAL mode) + Local Persistent Store | IndexedDB (Dexie.js) |
| **Trình đọc sách (Reader)** | **Power-User Immersive Reader** toàn màn hình: đồng bộ số chương thực, 5 chủ đề màu (Dark, OLED, Sepia, Mint, Light), 4 phông chữ, bố cục 2 cột sách mở, Đánh dấu trang (Bookmarks), Tìm & Thay thế từ trực tiếp (Live Regex/Convert Filter), Nhảy nhanh chương, Audio TTS tự qua chương & dịch AI Local LLM | Trình đọc gọn nhẹ tích hợp ngay trong thanh bên trình duyệt |
| **Tài liệu hướng dẫn** | 👉 **[Xem `desktop/README.md`](./desktop/README.md)** | 👉 **[Xem `extension/README.md`](./extension/README.md)** |

---

## ⚡ Khởi Chạy Nhanh

### 1. Chạy Bản Desktop Pro (`desktop/`)
* **Chạy ngay không cần cài đặt:** Mở trực tiếp [`desktop/Novel Scraper.exe`](./desktop/Novel%20Scraper.exe) hoặc [`Novel Scraper.exe`](./Novel%20Scraper.exe).
* **Phát triển mã nguồn:**
  ```bash
  cd desktop
  npm install
  npm run tauri dev
  ```
* 📖 Xem đầy đủ tính năng, kiến trúc và phím tắt tại: **[`desktop/README.md`](./desktop/README.md)**.

### 2. Chạy Bản Browser Extension (`extension/`)
* **Phát triển & Đóng gói:**
  ```bash
  cd extension
  npm install
  npm run dev
  ```
* 📖 Xem đầy đủ hướng dẫn cài đặt tiện ích vào trình duyệt tại: **[`extension/README.md`](./extension/README.md)**.
