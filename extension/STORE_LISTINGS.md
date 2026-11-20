# Hướng Dẫn Update Extension & Bộ Nội Dung Nộp 3 Store: Novel Scraper

> **Áp dụng cho:** Google Chrome Web Store · Microsoft Edge Add-ons · Mozilla Firefox Add-ons (AMO)  
> **Phiên bản hiện tại trong `package.json`:** `1.1.0` (đã đóng gói sẵn trong `.output/novel-scraper-1.1.0-*.zip`; khi phát hành bản kế tiếp cần tăng version mới)  
> **Nền tảng build:** WXT 0.21+ · Manifest V3 · Svelte 5 · TypeScript

---

## Mục Lục

1. [Bước 0: Chuẩn Bị & Đóng Gói Bản Update (Chung Cho Cả 3 Store)](#bước-0-chuẩn-bị--đóng-gói-bản-update-chung-cho-cả-3-store)
2. [Hướng Dẫn Update Trên Google Chrome Web Store](#1-hướng-dẫn-update-trên-google-chrome-web-store)
3. [Hướng Dẫn Update Trên Microsoft Edge Add-ons](#2-hướng-dẫn-update-trên-microsoft-edge-add-ons)
4. [Hướng Dẫn Update Trên Mozilla Firefox Add-ons (AMO)](#3-hướng-dẫn-update-trên-mozilla-firefox-add-ons-amo)
5. [Release Notes / What's New (Ghi Chú Phiên Bản Mới)](#4-release-notes--whats-new-ghi-chú-phiên-bản-mới)
6. [Nội Dung Store Listing (Tiếng Việt & English)](#5-nội-dung-store-listing-tiếng-việt--english)
7. [Khai Báo Quyền & Chính Sách Bảo Mật (Privacy & Permissions)](#6-khai-báo-quyền--chính-sách-bảo-mật-privacy--permissions)
8. [Ghi Chú Cho Nhân Viên Kiểm Duyệt (Reviewer Notes)](#7-ghi-chú-cho-nhân-viên-kiểm-duyệt-reviewer-notes)
9. [Danh Sách Tài Nguyên Ảnh Quảng Bá (Store Assets)](#8-danh-sách-tài-nguyên-ảnh-quảng-bá-store-assets)

---

## Bước 0: Chuẩn Bị & Đóng Gói Bản Update (Chung Cho Cả 3 Store)

> **Lưu ý quan trọng:** Cả 3 store sẽ **từ chối file ZIP** nếu `"version"` trùng với phiên bản đang phát hành. Ngoài ra, hãy chạy `npm run zip:all` để tạo lại đồng thời cả gói extension và `sources.zip` cho Firefox AMO nhằm đảm bảo mã nguồn khớp 100% với bản build.

### 1. Tăng số phiên bản (`version`)
Mở [`extension/package.json`](./package.json) và tăng trường `"version"` theo chuẩn SemVer (chỉ dùng số dạng `X.Y.Z`, ví dụ `"1.0.1"` hoặc `"1.1.0"`, không dùng tiền tố `v` hoặc hậu tố chữ nếu nộp bản release chính thức).

### 2. Kiểm tra TypeScript, Test & Đóng gói
Mở terminal tại thư mục `extension/` và chạy lần lượt:

```bash
# 1. Kiểm tra kiểu dữ liệu TypeScript
npm run check

# 2. Chạy toàn bộ bộ test tự động (Vitest)
npm test

# 3. Build & đóng gói ZIP cho cả 3 store (kèm sources.zip cho Firefox AMO)
npm run zip:all
```

*(Trên Windows PowerShell nếu bị chặn chính sách thực thi `npm`, thay `npm` bằng `npm.cmd`, ví dụ `npm.cmd run zip:all`.)*

### 3. Kiểm tra các tệp đầu ra trong `extension/.output/`
Sau khi `npm run zip:all` hoàn tất, kiểm tra 4 tệp mới theo `<version>` trong `.output/`:

| Store | Tệp ZIP cần nộp | Thư mục test unpacked |
|---|---|---|
| **Chrome Web Store** | `.output/novel-scraper-<version>-chrome.zip` | `.output/chrome-mv3/` |
| **Microsoft Edge Add-ons** | `.output/novel-scraper-<version>-edge.zip` | `.output/edge-mv3/` |
| **Mozilla Firefox (AMO)** | `.output/novel-scraper-<version>-firefox.zip` + `.output/novel-scraper-<version>-sources.zip` | `.output/firefox-mv3/` |

*(Hiện trạng bản `1.0.0` trong `.output/`: `chrome.zip` 396,647 bytes, `edge.zip` 396,647 bytes, `firefox.zip` 396,626 bytes — lưu ý `sources.zip` đang có timestamp cũ hơn ngày build 10/11, vì vậy **luôn chạy lại `npm run zip:all`** trước khi nộp bản update.)*

### 4. Kiểm tra nhanh trên trình duyệt trước khi upload
- **Chrome (`chrome://extensions/`) / Edge (`edge://extensions/`):** Bật *Developer mode* → *Load unpacked* trỏ tới `.output/chrome-mv3` (hoặc `edge-mv3`) → mở Side Panel kiểm tra quét mục lục, picker chuột, đọc offline và xuất file TXT/DOCX/PDF/EPUB/JSON.
- **Firefox (`about:debugging#/runtime/this-firefox`):** Bấm *Load Temporary Add-on...* → chọn `.output/firefox-mv3/manifest.json` → nhấn `Alt + Shift + N` kiểm tra Sidebar.

---

## 1. Hướng Dẫn Update Trên Google Chrome Web Store

**Cổng quản trị:** `https://chrome.google.com/webstore/devconsole`

1. Đăng nhập **Chrome Web Store Developer Dashboard** → chọn mục **Novel Scraper**.
2. Ở menu trái, vào mục **Package** → bấm **Upload new package**.
3. Chọn tệp `.output/novel-scraper-<version>-chrome.zip`. Hệ thống sẽ tự đọc `manifest.json` và nhận diện phiên bản mới.
4. Vào mục **Store listing**:
   - Kiểm tra/cập nhật **Description** (cho cả ngôn ngữ `vi` và `en` nếu đã cấu hình đa ngôn ngữ trên Dashboard) để bổ sung các tính năng mới (EPUB 3, JSON, tách tập ZIP, Offline Reader, Tab Auto-Sync, Deobfuscator, Backup/Restore).
   - Giữ nguyên hoặc cập nhật ảnh chụp màn hình từ `store-assets/`.
5. Vào mục **Privacy practices**:
   - **Quan trọng:** Vì `wxt.config.ts` hiện có quyền **`tabs`** trong `permissions` (bổ sung so với bản 1.0.0 ban đầu), hãy kiểm tra kỹ danh sách quyền hiển thị trên Dashboard và điền đầy đủ giải trình cho **`tabs`** cùng với `storage`, `activeTab`, `scripting`, `downloads`, `sidePanel` và `Host permission (<all_urls>)` (lấy nội dung ở [Mục 6](#6-khai-báo-quyền--chính-sách-bảo-mật-privacy--permissions)).
   - Mục **Data usage**: Không tích chọn mục thu thập dữ liệu nào.
   - Kiểm tra **Privacy policy URL** trỏ tới [`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md).
6. Vào mục **Test instructions** (nếu Dashboard hiển thị): Dán hướng dẫn test ở [Mục 7](#7-ghi-chú-cho-nhân-viên-kiểm-duyệt-reviewer-notes).
7. Bấm **Submit for review**.
   - *Tùy chọn:* Bật hoặc tắt *Automatic publishing* (nên để mặc định tự động phát hành sau khi qua duyệt, hoặc chọn *Deferred publishing* nếu muốn tự bấm Publish cùng lúc với Edge/Firefox).

---

## 2. Hướng Dẫn Update Trên Microsoft Edge Add-ons

**Cổng quản trị:** `https://partner.microsoft.com/dashboard/microsoftedge`

1. Đăng nhập **Microsoft Partner Center** → chọn **Novel Scraper** trong danh sách extensions.
2. Bấm **Create new submission** (hoặc **Update** nếu đang có bản nháp).
3. Tab **Packages**:
   - Xóa hoặc thay thế gói cũ bằng `.output/novel-scraper-<version>-edge.zip`.
   - Đợi hệ thống quét manifest và hiển thị đúng số phiên bản mới.
4. Tab **Availability**: Giữ nguyên cấu hình thị trường và trạng thái hiển thị (*Public*).
5. Tab **Properties** / **Store listings** (kiểm tra cả ngôn ngữ **Vietnamese** và **English**):
   - Cập nhật **Short description**, **Description**, **Search terms** (tối đa 10 từ khóa).
   - Điền mục **What's new in this version** (bằng nội dung ở [Mục 4](#4-release-notes--whats-new-ghi-chú-phiên-bản-mới)).
6. Tab **Privacy** (rất quan trọng nếu thêm quyền `tabs` hoặc cập nhật bản mới):
   - Kiểm tra ô **Single purpose** và giải trình từng quyền (`storage`, `activeTab`, `tabs`, `scripting`, `downloads`, `sidePanel`, `Host permission`).
   - **Are you using remote code?**: Chọn **No, I am not using remote code** (kèm giải trình nếu được hỏi).
   - **Data usage**: **Không tích chọn** bất kỳ ô thu thập dữ liệu nào.
   - **Certification**: Tích chọn cả 3 ô cam kết không bán/chuyển dữ liệu người dùng.
7. Tab **Certification** (hoặc **Notes for certification**):
   - Dán hướng dẫn kiểm thử cho Microsoft reviewer (lấy ở [Mục 7](#7-ghi-chú-cho-nhân-viên-kiểm-duyệt-reviewer-notes)).
8. Kiểm tra lại trang tổng quan (**Review and publish**) → bấm **Publish**.

---

## 3. Hướng Dẫn Update Trên Mozilla Firefox Add-ons (AMO)

**Cổng quản trị:** `https://addons.mozilla.org/developers`

1. Đăng nhập **Add-on Developer Hub** → vào **Manage My Submissions** → chọn **Novel Scraper**.
2. Ở menu trái (hoặc trang *Manage Status & Versions*), bấm **Upload New Version**.
3. **Bước 1 — Upload Add-on File**:
   - Chọn kênh phân phối **On this site** (Listed).
   - Tải lên `.output/novel-scraper-<version>-firefox.zip`.
   - Đợi hệ thống kiểm tra tự động (Validation). Lưu ý `manifest.json` của Firefox đã khai báo sẵn `data_collection_permissions: { required: ["none"] }` và `strict_min_version: "142.0"`.
4. **Bước 2 — Source Code Upload (BẮT BUỘC)**:
   - Khi được hỏi **"Does your add-on require source code review / Do You Need to Submit Source Code?"**, chọn **Yes** (vì extension sử dụng Vite/WXT, TypeScript và Svelte 5 có bước biên dịch/đóng gói).
   - Tải lên tệp `.output/novel-scraper-<version>-sources.zip` vừa tạo từ cùng lệnh `npm run zip:firefox` (hoặc `npm run zip:all`).
5. **Bước 3 — Version Details**:
   - **Release Notes**: Dán ghi chú phiên bản mới (EN / VI ở [Mục 4](#4-release-notes--whats-new-ghi-chú-phiên-bản-mới)).
   - **Notes to Reviewer**: Dán hướng dẫn build lại từ `sources.zip` (`npm ci`, `npm test`, `npm run build:firefox`) và giải trình quyền `tabs` ở [Mục 7](#7-ghi-chú-cho-nhân-viên-kiểm-duyệt-reviewer-notes).
6. Vào **Edit Product Page** (nếu cần cập nhật mô tả/tính năng mới trên trang giới thiệu AMO cho cả `en-US` và `vi`).
7. Bấm **Submit Version** để gửi duyệt.

---

## 4. Release Notes / What's New (Ghi Chú Phiên Bản Mới)

> Dùng cho mục **What's new in this version** (Edge), **Release Notes** (Firefox AMO), hoặc ghi chú khi đăng bản cập nhật.

### Tiếng Việt
```text
• Bổ sung xuất sách điện tử EPUB 3 (tương thích Kindle, Kobo, Apple Books) và JSON dữ liệu có cấu trúc.
• Hỗ trợ tách tập tự động theo số chương và đóng gói toàn bộ thành 1 tệp ZIP.
• Tích hợp Trình Đọc Ngoại Tuyến (Offline Reader) ngay trong Side Panel với 3 chủ đề màu (Dark, Sepia, Light), đổi phông Serif/Sans và lưu vị trí chương đang đọc.
• Tự động đồng bộ tab trình duyệt (Tab Auto-Sync) và hỗ trợ ủy quyền fetch qua tab đang mở để vượt lỗi CORS.
• Nâng cấp bộ lọc văn bản: giải mã chữ bị xáo trộn (Deobfuscator), quy tắc Tìm & Thay thế (Regex), ẩn tiêu đề chương lặp lại.
• Hỗ trợ quét mục lục phân trang nhiều lớp / AJAX (Mê Truyện Chữ, Cổ Mộng, TruyệnFull, Tàng Thư Viện) và Sao lưu / Phục hồi thư viện JSON.
```

### English
```text
• Added EPUB 3 e-book export (compatible with Kindle, Kobo, Apple Books) and structured JSON export.
• Added automatic volume splitting by chapter count with single-click ZIP bundling.
• Built-in Offline Reader inside the Side Panel with Dark/Sepia/Light themes, Serif/Sans fonts, adjustable text size, and per-novel reading progress memory.
• Added Tab Auto-Sync and same-origin tab-delegated fetch fallback for seamless crawling.
• Upgraded text sanitizer: text deobfuscator, custom Find & Replace / Regex rules, and duplicate chapter title omission.
• Enhanced multi-page / AJAX table-of-contents scanning (Cổ Mộng, TruyệnFull, Tàng Thư Viện, Mê Truyện Chữ) plus 1-click JSON library Backup & Restore.
```

---

## 5. Nội Dung Store Listing (Tiếng Việt & English)

### 🇻🇳 Tiếng Việt

#### Tên Tiện Ích (Extension Name)
- **Chrome** *(tối đa 45 ký tự — hiện 44 ký tự)* / **Edge & Firefox** *(tối đa 50 ký tự)*:
  ```text
  Novel Scraper - Trích xuất & Tải tiểu thuyết
  ```

#### Mô Tả Ngắn (Short Description / Summary)
- **Chrome** *(tối đa 132 ký tự)* / **Edge** *(150 ký tự)* / **Firefox** *(250 ký tự)* — **Hiện tại: 112 ký tự**:
  ```text
  Tiện ích Side Panel cào tiểu thuyết mọi trang web, lọc sạch quảng cáo, đọc offline và xuất TXT, DOCX, PDF, EPUB.
  ```

#### Từ Khóa / Thẻ Phân Loại
- **Chrome Category:** `Productivity`
- **Edge Search Terms** *(tối đa 10 từ khóa, cách nhau dấu phẩy)*:
  ```text
  cào truyện, tải tiểu thuyết, novel scraper, đọc truyện offline, xuất epub, xuất docx, xuất pdf, lọc quảng cáo truyện, reader view, web novel
  ```
- **Firefox Tags:**
  ```text
  cào truyện, tải tiểu thuyết, novel scraper, đọc offline, xuất epub, xuất docx, xuất pdf
  ```

#### Mô Tả Chi Tiết (Detailed Description)
```text
Novel Scraper là tiện ích mở rộng dạng Side Panel / Sidebar thông minh giúp bạn trích xuất, làm sạch, lưu trữ và đọc tiểu thuyết mạng ngoại tuyến từ mọi website, đồng thời xuất sách sang TXT, DOCX, PDF, EPUB 3 và JSON một cách nhanh chóng và hoàn toàn riêng tư.

✨ CÁC TÍNH NĂNG NỔI BẬT:

1. ENGINE BÓC TÁCH 3 TẦNG (UNIVERSAL ENGINE):
• Cấu hình tối ưu sẵn (Presets): Hỗ trợ mượt mà nhiều trang truyện phổ biến (Cổ Mộng, TruyệnFull, Tàng Thư Viện, Mê Truyện Chữ...), tự động quét mục lục phân trang nhiều lớp và AJAX.
• Tự Động Nhận Diện (Heuristic Reader View): Phân tích cấu trúc DOM và mật độ đoạn văn để tự tìm nội dung chương trên mọi website lạ.
• Chọn Vùng Bằng Chuột (Visual Element Picker): Rê chuột phát sáng phần tử và click để lưu CSS selector riêng cho từng tên miền.

2. LỌC VĂN BẢN SIÊU SẠCH (PURE TEXT SANITIZER):
• Loại bỏ quảng cáo, iframe, ảnh/video rác, thẻ ẩn chống bot (honeypot) và ký tự tàng hình chống copy (\u200B-\u200D).
• Chuẩn hóa Unicode tiếng Việt (NFC) chuẩn mực, không lỗi dấu.
• Giải mã chữ bị xáo trộn (Deobfuscator), lọc watermark/re-up và hỗ trợ bộ quy tắc Tìm & Thay thế (Find & Replace / Regex) tùy chỉnh.

3. GỘP & XUẤT ĐA ĐỊNH DẠNG (TXT · DOCX · PDF · EPUB · JSON):
• TXT (UTF-8 BOM): Mở chuẩn trên Windows Notepad, Word và ứng dụng đọc trên điện thoại.
• DOCX (Microsoft Word): Heading phân cấp chương, ngắt trang tự động (PageBreak) và căn lề in ấn.
• PDF: Bố cục sách in sạch đẹp, đánh số trang tự động.
• EPUB 3: Chuẩn sách điện tử quốc tế, tương thích Kindle, Kobo, Apple Books.
• JSON & Tách tập ZIP: Xuất dữ liệu đầy đủ hoặc tự động chia tập (vd: 100 chương/tập) thành 1 file .zip.

4. CÀO LỊCH SỰ, THƯ VIỆN & TRÌNH ĐỌC OFFLINE:
• Độ trễ ngẫu nhiên (1.5s - 3s), tự động thử lại khi gặp giới hạn tốc độ (429/503) và lưu tiến trình bền vững trong IndexedDB.
• Tự động đồng bộ tab trình duyệt (Tab Auto-Sync), phát hiện và tải bù chương thiếu chỉ với 1 click.
• Trình đọc Offline Reader tích hợp: 3 giao diện (Dark, Sepia, Light), chọn font Serif/Sans, chỉnh cỡ chữ và ghi nhớ tiến độ đọc.
• Sao lưu & phục hồi toàn bộ thư viện qua file JSON.

5. GIAO DIỆN HIỆN ĐẠI & BẢO MẬT 100% CLIENT-SIDE:
• Thiết kế kính mờ Glassmorphism (Shades of Blue) với Dark/Light Mode và chuyển đổi song ngữ Tiếng Việt / English tức thì.
• Phím tắt mở nhanh: Alt + Shift + N.
• Không máy chủ thu thập, không telemetry — toàn bộ dữ liệu nằm trên máy của bạn.
```

---

### 🇬🇧 English

#### Extension Name
- **Chrome** *(max 45 chars — currently 45 chars)* / **Edge & Firefox** *(max 50 chars)*:
  ```text
  Novel Scraper - Web Novel Downloader & Reader
  ```

#### Short Description / Summary
- **Chrome** *(max 132 chars)* / **Edge** *(150 chars)* / **Firefox** *(250 chars)* — **Currently 115 chars**:
  ```text
  Scrape web novels from any website in Side Panel. Clean text, read offline, and export to TXT, DOCX, PDF, and EPUB.
  ```

#### Keywords / Tags
- **Chrome Category:** `Productivity`
- **Edge Search Terms** *(max 10 comma-separated)*:
  ```text
  novel scraper, web novel downloader, ebook converter, offline reader, export epub, export docx, export pdf, reader view, side panel scraper, clean novel text
  ```
- **Firefox Tags:**
  ```text
  novel scraper, web novel downloader, ebook converter, offline reader, export epub, export docx
  ```

#### Detailed Description
```text
Novel Scraper is a privacy-first Side Panel / Sidebar browser extension designed to help book lovers extract, clean, read offline, and export web novels from any website into TXT, DOCX, PDF, EPUB 3, and JSON formats.

✨ KEY FEATURES:

1. UNIVERSAL 3-TIER SCRAPING ENGINE:
• Built-in Presets: Ready-to-use rules for popular novel platforms with multi-page and AJAX table-of-contents scanning.
• Heuristic Reader View: Automatically detects chapter titles and main story content on unfamiliar websites using DOM and paragraph-density analysis.
• Visual Element Picker: Hover to highlight elements and click to save custom CSS selectors per domain.

2. PURE TEXT SANITIZER PIPELINE:
• Strips ads, banners, scripts, iframes, hidden honeypot elements, and zero-width anti-copy characters (\u200B-\u200D).
• Standardized Unicode normalization (NFC) for clean typography.
• Text deobfuscator, custom watermark keyword filtering, and Find & Replace / Regex rules.

3. MULTI-FORMAT EXPORT (TXT · DOCX · PDF · EPUB · JSON):
• TXT (UTF-8 with BOM): Clean plain text with no encoding glitches.
• DOCX (Microsoft Word): Structured headings, automatic page breaks between chapters, and print margins.
• PDF: Print-ready book layout with automatic page numbering.
• EPUB 3: Standard e-book archive compatible with Kindle, Kobo, and Apple Books.
• JSON & Split-Volume ZIP: Export structured backups or automatically split long novels into multi-volume .zip bundles.

4. POLITE CRAWLING & BUILT-IN OFFLINE READER:
• Adaptive jitter delays (1.5s - 3.0s), exponential backoff on HTTP 429/503, and persistent IndexedDB queue.
• Automatic browser Tab Auto-Sync and 1-click missing chapter detection & re-download.
• Integrated Offline Reader with Dark, Sepia, and Light themes, Serif/Sans fonts, adjustable font size, and reading progress memory.
• 1-click JSON Backup & Restore for your entire offline library and site rules.

5. GLASSMORPHISM UI & ZERO TELEMETRY:
• Shades of Blue frosted glass Side Panel UI with Dark/Light modes and instant English / Vietnamese language switching.
• Quick shortcut: Alt + Shift + N.
• 100% client-side: zero tracking, zero analytics, zero remote servers.
```

---

## 6. Khai Báo Quyền & Chính Sách Bảo Mật (Privacy & Permissions)

> Đối chiếu trực tiếp với `extension/wxt.config.ts`:
> - **Chrome / Edge `permissions`:** `storage`, `activeTab`, `tabs`, `scripting`, `downloads`, `sidePanel`
> - **Firefox `permissions`:** `storage`, `activeTab`, `tabs`, `scripting`, `downloads` *(dùng `sidebar_action` thay cho `sidePanel`)*
> - **`host_permissions`:** `<all_urls>`

### Single Purpose Description *(Chrome & Edge — tối đa 1000 ký tự)*
```text
Novel Scraper is a side panel utility designed solely to allow users to extract, clean, read offline, and export web novel chapters from novel websites into TXT, DOCX, PDF, EPUB, and JSON files locally in their browser.
```

### Permission Justifications *(Copy từng ô tương ứng trên Chrome Web Store & Microsoft Partner Center)*

- **`storage` justification:**
  ```text
  Required to store user preferences (theme, language, polite crawling delay, custom watermark filters, replacement rules) and maintain the offline novel library and site rules locally in browser storage and IndexedDB.
  ```

- **`activeTab` justification:**
  ```text
  Required to access the active tab's novel webpage only when the user explicitly triggers chapter detection, TOC scanning, or the visual element picker.
  ```

- **`tabs` justification *(Mới bổ sung khớp với `wxt.config.ts`)*:**
  ```text
  Required to detect active tab switches/updates so the Side Panel automatically syncs with the novel currently viewed by the user, and to query/message the user's open novel tab for chapter extraction and same-origin page fetching during user-initiated crawls.
  ```

- **`scripting` justification:**
  ```text
  Required to inject the visual element picker overlay and reader view extraction logic into the active web novel page upon user request.
  ```

- **`downloads` justification:**
  ```text
  Required to allow users to export and download compiled novel files (.txt, .docx, .pdf, .epub, .json, or .zip) and JSON library backups to their local computer.
  ```

- **`sidePanel` justification *(Chỉ Chrome & Edge)*:**
  ```text
  Required to display the extension's primary user interface and built-in offline reader inside the browser's side panel while the user browses novel pages.
  ```

- **`host_permissions` (`<all_urls>`) justification:**
  ```text
  Required because web novels are hosted across thousands of independent domains. Users need to extract chapters from any novel reading website they visit and choose to scrape.
  ```

### Remote Code & Data Usage Declarations
- **Remote Code (Edge Partner Center):** Chọn **`No, I am not using remote code`**.
  - *Justification (nếu được yêu cầu):*
    ```text
    All JavaScript, CSS, and assets are bundled locally inside the extension package via Vite/WXT. No remote code, eval(), or external CDN scripts are loaded or executed.
    ```
- **Data Usage (Chrome & Edge):** **KHÔNG tích chọn bất kỳ mục thu thập dữ liệu nào** (100% client-side, không thu thập dữ liệu người dùng).
- **Edge Certification:** Tích chọn **cả 3 ô** xác nhận không bán/chuyển dữ liệu người dùng.
- **Firefox AMO Data Collection:** Đã khai báo sẵn trong `manifest.json`:
  ```json
  "data_collection_permissions": { "required": ["none"] }
  ```
- **Privacy Policy URL:**
  ```text
  https://github.com/novel-scraper/novel-scraper/blob/main/PRIVACY_POLICY.md
  ```
  *(Thay bằng URL repo/trang cá nhân thực tế nếu bạn host `PRIVACY_POLICY.md` ở URL khác.)*

---

## 7. Ghi Chú Cho Nhân Viên Kiểm Duyệt (Reviewer Notes)

### Dành cho Mozilla Firefox AMO *(bắt buộc kèm `sources.zip`)*
```text
Dear AMO Reviewer,

This update keeps all processing 100% client-side with zero telemetry or remote code execution ("data_collection_permissions": { "required": ["none"] }).

Note on permissions:
- "tabs" is used solely to sync the sidebar UI when the user switches tabs and to communicate with the active/matching novel tab during user-initiated TOC scanning or chapter fetching.

To reproduce the exact Firefox build from the uploaded sources.zip:
1. Ensure Node.js v20+ (tested on v22 LTS) and npm v10+ are installed.
2. Unpack novel-scraper-<version>-sources.zip and run:
   npm ci
3. Run the automated test suite:
   npm test
4. Build the Firefox MV3 extension:
   npm run build:firefox
5. The identical build output is generated in .output/firefox-mv3/

How to test:
1. Open any web novel chapter or table-of-contents page.
2. Open the Novel Scraper sidebar (toolbar icon or Alt+Shift+N).
3. Click "Auto Detect" or "Pick with Mouse" to extract content, or "Scan TOC" to gather chapters.
4. Export to TXT, DOCX, PDF, EPUB, or JSON, or open the built-in Offline Reader in the Library tab.

Thank you!
```

### Dành cho Chrome Web Store & Microsoft Edge Add-ons
```text
Reviewer Test Instructions:
1. Click the Novel Scraper toolbar icon (or press Alt+Shift+N) to open the Side Panel.
2. Navigate to any web novel page (chapter page or table of contents).
3. In the Scraper tab:
   - Click "Auto Detect" to extract the chapter title and main text using heuristic reader view.
   - Click "Pick with Mouse" to highlight DOM elements on the page and click to select a custom container (press ESC to cancel).
   - Click "Scan TOC" to collect chapter links, then "Start Crawl" to save chapters locally in IndexedDB.
4. In the Library tab:
   - Open the built-in Offline Reader or export the saved novel to TXT, DOCX, PDF, EPUB, or JSON.
5. Note on "tabs" permission: Used solely to auto-sync the Side Panel with the currently active novel tab and delegate same-origin chapter fetches to an open matching tab when triggered by the user. All data stays 100% local in the browser; no remote code or analytics are used.
```

---

## 8. Danh Sách Tài Nguyên Ảnh Quảng Bá (Store Assets)

Đã có sẵn trong `extension/store-assets/`:

| Loại ảnh | Kích thước | Đường dẫn |
|---|---|---|
| Small Promo Tile | `440 x 280 px` | `store-assets/promo-tile-440x280.png` |
| Marquee / Banner | `1400 x 560 px` | `store-assets/banner-1400x560.png` |
| Screenshot 1 (Cào & Chọn vùng — VI / EN) | `1280 x 800 px` | `store-assets/screenshot-1-vi-1280x800.png` · `store-assets/screenshot-1-en-1280x800.png` |
| Screenshot 2 (Kho truyện & Xuất 5 định dạng — VI / EN) | `1280 x 800 px` | `store-assets/screenshot-2-vi-1280x800.png` · `store-assets/screenshot-2-en-1280x800.png` |
| Screenshot 3 (Offline Reader & Sanitizer — VI / EN) | `1280 x 800 px` | `store-assets/screenshot-3-vi-1280x800.png` · `store-assets/screenshot-3-en-1280x800.png` |
