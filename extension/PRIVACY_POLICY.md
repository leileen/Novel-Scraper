# Privacy Policy / Chính Sách Bảo Mật: Novel Scraper

*Last Updated / Cập nhật lần cuối: 2026-11-02*

---

## 🇻🇳 Tiếng Việt

### 1. Cam Kết Về Quyền Riêng Tư
**Novel Scraper** được thiết kế dựa trên nguyên tắc bảo vệ quyền riêng tư tối đa của người dùng ("Privacy by Design"). Tiện ích hoạt động 100% phía người dùng (Client-Side). Chúng tôi **KHÔNG** thu thập, lưu trữ, truyền tải, buôn bán hoặc chia sẻ bất kỳ dữ liệu cá nhân nào của bạn cho bất kỳ máy chủ bên thứ ba nào.

### 2. Dữ Liệu Được Xử Lý
- **Lưu trữ Cục bộ (IndexedDB & Chrome Local Storage)**:
  - Dữ liệu truyện, danh sách chương, văn bản đã cào và cấu hình tiện ích (chế độ sáng/tối, độ trễ, danh sách từ khóa lọc quảng cáo) chỉ được lưu trực tiếp trên trình duyệt của bạn (Local Storage).
  - Không có bất kỳ dữ liệu nào được đồng bộ lên máy chủ đám mây của chúng tôi (chúng tôi không sở hữu máy chủ backend).
- **Quyền Truy cập Web (Host Permissions `<all_urls>`)**:
  - Quyền này được sử dụng duy nhất cho mục đích: cho phép bạn kích hoạt tính năng chọn vùng (Visual Element Picker) và trích xuất nội dung chương trên các trang web đọc truyện mà chính bạn chủ động duyệt tới.
  - Tiện ích không theo dõi lịch sử duyệt web và không gửi dữ liệu trang web ra bên ngoài.

### 3. Tuân Thủ Chính Sách Firefox AMO
Tiện ích khai báo trung thực và tuân thủ tuyệt đối quy định:
```json
"data_collection_permissions": {
  "required": ["none"]
}
```
Không có bất kỳ dữ liệu kỹ thuật, telemetery hay thông tin nhận dạng nào bị thu thập.

### 4. Liên Hệ
Nếu bạn có bất kỳ câu hỏi nào liên quan đến bảo mật hoặc quyền riêng tư, vui lòng liên hệ qua trang mã nguồn dự án.

---

## 🇬🇧 English

### 1. Privacy Commitment
**Novel Scraper** is built with a strict "Privacy by Design" philosophy. The extension operates 100% client-side inside your browser. We do **NOT** collect, track, transmit, sell, or share any personal data, browsing history, or user information to any remote servers.

### 2. Handled Data
- **Local Storage (IndexedDB & Chrome Local Storage)**:
  - Novel texts, chapters, and user preferences (theme, polite crawling delay, custom ad keywords) are stored exclusively within your local browser storage.
  - No data is synced to any external server (we operate zero backend servers).
- **Host Permissions (`<all_urls>`)**:
  - Required solely to allow the Visual Element Picker and reader extraction engine to parse novel text on websites you actively visit and choose to scrape.
  - The extension never monitors your general web surfing habits or sends page data elsewhere.

### 3. Mozilla AMO & Chrome Web Store Compliance
The extension strictly declares and enforces:
```json
"data_collection_permissions": {
  "required": ["none"]
}
```
No analytics, telemetry, or tracking scripts are included.

### 4. Contact
For any security or privacy questions, please open an issue in the project repository.
