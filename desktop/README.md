# 🖥️ Novel Scraper Desktop Pro v1.3 — 100% Offline Novel Downloader, Manga/Comic Reader & Calibre E-book Viewer

[![Version](https://img.shields.io/badge/Release-v1.3.0-00D2FF?style=for-the-badge&logo=rocket)](package.json)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11%20%7C%20macOS%20%7C%20Linux-00D2FF?style=for-the-badge&logo=windows)](src-tauri/tauri.conf.json)
[![Core](https://img.shields.io/badge/Core-Tauri%20v2%20%2B%20Rust%201.80%2B-DEA584?style=for-the-badge&logo=rust)](src-tauri/Cargo.toml)
[![Frontend](https://img.shields.io/badge/UI-Svelte%205%20(Runes)%20%2B%20SvelteKit-FF3E00?style=for-the-badge&logo=svelte)](package.json)
[![Database](https://img.shields.io/badge/Database-IndexedDB%20%2B%20SQLite%20WAL-003B57?style=for-the-badge&logo=sqlite)](src/lib/db/offlineStore.ts)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%200%20Errors-3178C6?style=for-the-badge&logo=typescript)](tsconfig.json)

**Novel Scraper Desktop Pro v1.3** là ứng dụng máy tính độc lập (Native Desktop Application) hiệu năng cao được xây dựng trên nền tảng **Tauri v2 (Rust Backend)** và **Svelte 5 Runes (Frontend)** — hoàn toàn **không sử dụng Electron**, khởi động tức thì, dung lượng siêu nhẹ và tiêu thụ RAM cực thấp ngay cả khi lưu trữ hàng chục nghìn chương truyện và hàng nghìn trang truyện tranh.

---

## 🌟 Điểm Mới Đột Phá Trong Phiên Bản v1.3.0

1. ⚡ **Cào 100% Offline Thực Thụ (True 100% Offline Scrape)**:
   - Chấm dứt hoàn toàn cơ chế cào một ít rồi đọc mới cào tiếp hay thanh phần trăm ảo!
   - Toàn bộ 100% nội dung chương được tải về và lưu trữ vĩnh viễn vào hệ thống **IndexedDB** (`novel_scraper_offline_db`) trên ổ đĩa máy tính.
   - Không bị giới hạn 5MB của localStorage. Mở bất kỳ chương nào lập tức trong **< 1ms**, không còn vòng xoay chờ tải từ mạng.
   - Checkpointing tự động: Cho phép tạm dừng, tiếp tục cào hoặc phục hồi tiến trình mà không cần tải lại các chương đã lưu.

2. 🎨 **Trình Đọc Truyện Tranh, Manga & Webtoon Tăng Tốc Không Khựng**:
   - Tự động phát hiện và import các file truyện tranh: `.cbz`, `.cbr`, `.zip` ảnh, thư mục ảnh, manga `.epub`.
   - Cơ chế ảo hóa (virtual windowing) và tiền giải mã hình ảnh (image preloading 3 trang kế tiếp) giúp cuộn trang siêu mượt 60 FPS, không khựng, không tràn RAM.
   - Hỗ trợ **3 chế độ đọc truyện tranh chuyên nghiệp**:
     - **Webtoon (Cuộn dọc liên tục)**: Thích hợp cho Manhwa/Manhua với tùy chỉnh khoảng cách giữa các trang (gap).
     - **Trang đơn (Single Page)**: Xem từng trang với phím mũi tên hoặc click mép màn hình.
     - **Trang đôi (Double Page Spread)**: Xem 2 trang song song như một cuốn truyện tranh thực thụ.
     - **Lật Phải sang Trái (RTL Mode)**: Chuẩn mực đọc truyện tranh Manga Nhật Bản truyền thống.

3. 🗂️ **Phân Tách Thư Viện 3 Thể Loại Media Chuyên Biệt**:
   - Thư viện nay chia thành 4 tab trực quan: `Tất cả` | `📚 Tiểu thuyết` | `📖 Sách chữ` | `🎨 Truyện tranh`.
   - Hiển thị số lượng tác phẩm và số chương/trang riêng biệt, gắn nhãn nhận diện format sinh động trên từng thẻ sách.

4. 📖 **Giao Diện Reader Chuẩn Calibre E-book Viewer (3-Column Layout)**:
   - Học tập toàn diện giao diện Calibre E-book Viewer: Bố cục **3 cột chữ (3-Column layout)** cân bằng hoàn hảo trên màn hình rộng (cùng tùy chọn 2 cột, 1 cột, cuộn dọc).
   - **Calibre Header**: Hiển thị tên sách `[EPUB] - E-book viewer` và tên chương đang đọc ở đầu trang.
   - **Calibre Footer**: Hiển thị vị trí chương, thanh tiến độ và phần trăm đọc chính xác (ví dụ: `1%`).

5. ⚙️ **Calibre Action Bar (20 Chức Năng) & 10 Danh Mục Calibre Preferences**:
   - Thanh công cụ Calibre chuẩn mực: `Back`, `Forward`, `Search`, `Go to`, `Open book`, `Reload`, `Edit book`, `Table of Contents`, `Reference mode`, `Highlights`, `Bookmarks`, `Reading statistics`, `Aa Font size`, `Preferences`, `Read aloud`, `Profiles`, `Enter full screen`, `Print`, `Inspector`, `Reset interface`, `Quit`.
   - Hộp thoại **Preferences** gồm 10 danh mục chi tiết:
     1. *Colors* (Màu nền & màu chữ, Sepia Calibre, White, Dark, OLED, Solarized, Custom)
     2. *Page layout* (Số cột 1/2/3/Auto, Lề trang, Khoảng cách cột)
     3. *Styles* (Thụt đầu dòng, Drop caps, Khoảng cách đoạn)
     4. *Headers and footers* (Tùy chỉnh nội dung đầu và chân trang)
     5. *Scrolling behavior* (Tự động cuộn trang, Tự qua chương)
     6. *Selection behavior* (Chế độ tham chiếu số đoạn văn `¶`)
     7. *Touch behavior* (Khu vực chạm cảm ứng)
     8. *Keyboard shortcuts* (Bảng phím tắt)
     9. *Fonts* (Phông chữ Sans, Serif, Literata, Monospace, Cỡ chữ, Giãn dòng)
     10. *Miscellaneous* (Tốc độ Audio TTS, Khôi phục chuẩn Calibre 3 cột)

---

## 📑 Mục Lục

1. [Kiến Trúc Hệ Thống & Công Nghệ](#-kiến-trúc-hệ-thống--công-nghệ)
2. [Sơ Đồ Luồng Hoạt Động (Architecture Flowchart)](#-sơ-đồ-luồng-hoạt-động)
3. [Tính Năng Trọng Tâm](#-tính-năng-trọng-tâm)
4. [Bảng Phím Tắt Trình Đọc (Keyboard Shortcuts)](#-bảng-phím-tắt-trình-đọc-keyboard-shortcuts)
5. [Cấu Trúc Thư Mục (`desktop/`)](#-cấu-trúc-thư-mục-desktop)
6. [Hướng Dẫn Chạy & Phát Triển](#-hướng-dẫn-chạy--phát-triển)

---

## 🚀 Kiến Trúc Hệ Thống & Công Nghệ

| Tầng (Layer) | Công Nghệ / Thư Viện | Vai Trò Kỹ Thuật |
|---|---|---|
| **Native Shell & IPC** | [Tauri v2](https://v2.tauri.app/) + WebView2 | Giao tiếp IPC tốc độ cao giữa giao diện và nhân hệ điều hành; nhúng toàn bộ tài nguyên tĩnh trực tiếp vào một file `.exe` duy nhất. |
| **Backend Đa Luồng** | [Rust (Edition 2021)](https://www.rust-lang.org/) + `tokio` | Xử lý bất đồng bộ đa luồng, tải trang HTML vượt CORS qua `reqwest` (`rustls-tls`) và phân tích DOM tốc độ cao bằng `scraper`. |
| **Kho Lưu Trữ Offline** | **IndexedDB** (`novel_scraper_offline_db`) | Lưu trữ 100% nội dung chương và hàng nghìn ảnh truyện tranh không giới hạn dung lượng trên ổ cứng máy tính. |
| **Giao Diện Người Dùng** | [Svelte 5 (Runes `$state`, `$derived`)](https://svelte.dev/) | Phản hồi tức thì 60 FPS, quản lý trạng thái tập trung qua `appState.svelte.ts`, không tốn bộ nhớ Virtual DOM. |
| **Đóng Gói Sách Điện Tử** | `docx`, `jspdf`, `fflate` (EPUB 3) | Khởi tạo trực tiếp file `.epub`, `.docx`, `.pdf`, `.txt` (UTF-8 BOM) và `.json` chuẩn xác đến từng thẻ siêu dữ liệu. |
| **AI & Giọng Đọc** | Web Speech API + Local LLM (OpenAI API compatible) | Đọc truyện Audio TTS tự động qua chương và dịch thuật/biên tập mượt mà chương truyện qua Ollama hoặc LM Studio. |

---

## ⌨️ Bảng Phím Tắt Trình Đọc (Keyboard Shortcuts)

| Phím tắt | Tác vụ |
|---|---|
| `M` | Bật / Tắt Calibre Action Menu |
| `P` | Mở hộp thoại Calibre Preferences (10 Danh mục) |
| `T` | Mở Mục lục chương (Table of Contents) |
| `B` | Đánh dấu chương hiện tại (Bookmark kèm vị trí %) |
| `F` hoặc `F11` | Bật / Tắt chế độ Toàn màn hình (Fullscreen) |
| `Space` | Tự động cuộn trang (Auto-scroll) / Sang trang Webtoon |
| `Mũi tên Trái` / `A` | Quay lại chương / trang trước (hoặc sang trang sau nếu đọc Manga RTL) |
| `Mũi tên Phải` / `D` | Sang chương / trang sau (hoặc quay lại nếu đọc Manga RTL) |
| `+` / `=` | Tăng cỡ chữ nhanh |
| `-` | Giảm cỡ chữ nhanh |
| `Ctrl + F` | Tìm kiếm văn bản & Sửa tên Convert trực tiếp trong chương |
| `Esc` | Đóng menu popup / Thoát trình đọc về Thư viện |

---

## 📦 Biên Dịch Bản Cài Đặt Release

```powershell
# Chạy kiểm thử tự động
npm.cmd test --prefix desktop

# Kiểm tra cú pháp và kiểu dữ liệu
npm.cmd run check --prefix desktop

# Đóng gói bộ cài đặt Windows (.exe Setup, Portable .exe, .msi)
npm.cmd run tauri build --prefix desktop
```
Bản cài đặt sẽ được tạo ra tại thư mục:
`desktop/src-tauri/target/release/bundle/nsis/Novel-Scraper-v1.3.0-Setup.exe`
