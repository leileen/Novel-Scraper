<script lang="ts">
  import { appState } from '../stores/appState.svelte';
  import {
    Download,
    Library,
    BookOpen,
    SlidersHorizontal,
    Sparkles,
    Keyboard,
    CheckCircle2,
    ArrowRight,
    X
  } from '@lucide/svelte';

  function finishOnboarding() {
    appState.completeOnboarding();
  }
</script>

{#if appState.showOnboarding}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="welcome-backdrop" onclick={finishOnboarding}>
    <div class="welcome-dialog" onclick={(e) => e.stopPropagation()}>
      <button class="welcome-close-btn" onclick={finishOnboarding} title="Đóng hướng dẫn">
        <X size={18} />
      </button>

      <!-- Hero Banner with Extension Logo -->
      <div class="welcome-hero">
        <div class="hero-logo-wrap">
          <img src="/logo.svg" alt="Novel Scraper Logo" class="hero-logo-img" />
        </div>
        <div class="hero-text">
          <div class="version-pill">
            <Sparkles size={12} />
            <span>PHIÊN BẢN CHÍNH THỨC v1.3.0 — PRO</span>
          </div>
          <h1 class="welcome-title">Chào mừng bạn đến với LMT's Novel - Comic - Book Manager</h1>
          <p class="welcome-subtitle">
            Hệ thống quản lý, đọc và tải offline 100% Tiểu thuyết, Truyện tranh (Comic/Manga) và Sách điện tử (EPUB, MOBI, AZW3, PDF, TXT, CBZ) với giao diện đọc chuẩn responsive!
          </p>
        </div>
      </div>

      <!-- 4 Core Steps Grid -->
      <div class="guide-steps-grid">
        <!-- Step 1 -->
        <div class="guide-step-card">
          <div class="step-header">
            <span class="step-badge">BƯỚC 1</span>
            <div class="step-icon-box cyan">
              <Download size={18} />
            </div>
            <h3 class="step-title">Dán Link & Tải Truyện Đa Luồng</h3>
          </div>
          <p class="step-desc">
            Sao chép đường dẫn (URL) bộ truyện từ <code>metruyenchu.com.vn</code>,
            <code>truyenfull.vn</code>, <code>tangthuvien.net</code>... dán vào thanh nhập trên
            <strong>Dashboard</strong> và nhấn <strong>Bắt đầu tải</strong>. Phần mềm sẽ tự động quét
            đầy đủ toàn bộ phân trang mục lục AJAX (hàng nghìn chương) và tải về máy.
          </p>
        </div>

        <!-- Step 2 -->
        <div class="guide-step-card">
          <div class="step-header">
            <span class="step-badge">BƯỚC 2</span>
            <div class="step-icon-box emerald">
              <Library size={18} />
            </div>
            <h3 class="step-title">Quản Lý Thư Viện & Xuất 5 Định Dạng</h3>
          </div>
          <p class="step-desc">
            Truyện tải xong được lưu an toàn trong mục <strong>Thư viện</strong> ngoại tuyến. Nhấp vào
            bìa sách để xem mục lục theo từng cụm 100 chương, đọc tiếp hoặc xuất ra 5 định dạng chuẩn:
            <strong>EPUB 3</strong> (Kindle/Kobo), <strong>DOCX</strong> (Word), <strong>PDF</strong>
            (bản in), <strong>TXT</strong> (UTF-8 BOM) và <strong>JSON</strong>.
          </p>
        </div>

        <!-- Step 3 -->
        <div class="guide-step-card">
          <div class="step-header">
            <span class="step-badge">BƯỚC 3</span>
            <div class="step-icon-box purple">
              <BookOpen size={18} />
            </div>
            <h3 class="step-title">Trình Đọc Sách Chuyên Sâu (Power-User)</h3>
          </div>
          <p class="step-desc">
            Tận hưởng <strong>5 chế độ màu bảo vệ mắt</strong> (Ban đêm, OLED Đen, Giấy cũ, Xanh dịu,
            Ban ngày), <strong>4 phông chữ chuẩn tiếng Việt</strong> (Sans, Palatino, Cambria,
            Monospace), bố cục <strong>2 cột sách mở</strong>, <strong>Đánh dấu trang</strong>,
            <strong>Tìm & Thay thế tên riêng Convert</strong>, <strong>Audio TTS</strong> và
            <strong>Dịch AI Local LLM</strong>.
          </p>
        </div>

        <!-- Step 4 -->
        <div class="guide-step-card">
          <div class="step-header">
            <span class="step-badge">BƯỚC 4</span>
            <div class="step-icon-box amber">
              <SlidersHorizontal size={18} />
            </div>
            <h3 class="step-title">Bộ Luật CSS & Tối Ưu Kết Nối</h3>
          </div>
          <p class="step-desc">
            Mở mục <strong>Bộ luật cào</strong> để xem hoặc thêm mới quy tắc CSS Selector cho bất kỳ
            trang web tiểu thuyết nào. Tại mục <strong>Cài đặt</strong>, bạn có thể điều chỉnh số
            luồng tải đồng thời (Concurrency), độ trễ lịch sự tránh chặn IP và cấu hình Proxy.
          </p>
        </div>
      </div>

      <!-- Quick Keyboard Shortcuts Strip -->
      <div class="shortcuts-strip">
        <div class="strip-label">
          <Keyboard size={15} />
          <span>Phím tắt trình đọc:</span>
        </div>
        <div class="shortcut-pills">
          <span class="sc-pill"><kbd>←</kbd> / <kbd>→</kbd> Chuyển chương</span>
          <span class="sc-pill"><kbd>M</kbd> Mở mục lục & Nhảy chương</span>
          <span class="sc-pill"><kbd>B</kbd> Đánh dấu trang</span>
          <span class="sc-pill"><kbd>Ctrl + F</kbd> Tìm & Thay thế từ</span>
          <span class="sc-pill"><kbd>Space</kbd> Tự động cuộn</span>
          <span class="sc-pill"><kbd>+</kbd> / <kbd>-</kbd> Cỡ chữ</span>
        </div>
      </div>

      <!-- Footer CTA -->
      <div class="welcome-footer">
        <div class="footer-note">
          <CheckCircle2 size={15} class="note-icon" />
          <span>
            Bạn có thể xem lại hướng dẫn này bất cứ lúc nào bằng nút <strong>Hướng dẫn</strong> ở thanh
            menu bên trái.
          </span>
        </div>

        <button class="start-app-btn" onclick={finishOnboarding}>
          <span>Bắt đầu sử dụng ngay</span>
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .welcome-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(6, 9, 16, 0.82);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 250;
    padding: 20px;
  }

  .welcome-dialog {
    width: 880px;
    max-width: 95vw;
    max-height: 92vh;
    overflow-y: auto;
    background: linear-gradient(180deg, #161d2e 0%, #111622 100%);
    border: 1px solid rgba(0, 210, 255, 0.28);
    border-radius: 16px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.8), 0 0 32px rgba(0, 210, 255, 0.12);
    padding: 28px 32px;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  .welcome-close-btn {
    position: absolute;
    top: 18px;
    right: 18px;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.06);
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .welcome-close-btn:hover {
    background-color: rgba(255, 255, 255, 0.14);
    color: var(--text-main);
  }

  .welcome-hero {
    display: flex;
    align-items: center;
    gap: 22px;
    padding-bottom: 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .hero-logo-wrap {
    width: 78px;
    height: 78px;
    flex-shrink: 0;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 0 18px rgba(0, 210, 255, 0.35));
  }

  .hero-logo-img {
    width: 78px;
    height: 78px;
    object-fit: contain;
  }

  .hero-text {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .version-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    width: fit-content;
    padding: 3px 10px;
    border-radius: 999px;
    background-color: rgba(0, 210, 255, 0.12);
    border: 1px solid rgba(0, 210, 255, 0.3);
    color: var(--accent-cyan);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.6px;
  }

  .welcome-title {
    font-size: 22px;
    font-weight: 800;
    color: #f8fafc;
    letter-spacing: -0.2px;
  }

  .welcome-subtitle {
    font-size: 13.5px;
    color: #94a3b8;
    line-height: 1.55;
  }

  .guide-steps-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }

  .guide-step-card {
    background-color: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: border-color 0.2s ease, background-color 0.2s ease;
  }

  .guide-step-card:hover {
    border-color: rgba(0, 210, 255, 0.3);
    background-color: rgba(0, 210, 255, 0.04);
  }

  .step-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .step-badge {
    font-size: 10px;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 5px;
    background-color: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
    letter-spacing: 0.5px;
  }

  .step-icon-box {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .step-icon-box.cyan {
    background-color: rgba(0, 210, 255, 0.14);
    color: #00d2ff;
  }

  .step-icon-box.emerald {
    background-color: rgba(16, 185, 129, 0.14);
    color: #10b981;
  }

  .step-icon-box.purple {
    background-color: rgba(168, 85, 247, 0.15);
    color: #c084fc;
  }

  .step-icon-box.amber {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .step-title {
    font-size: 14px;
    font-weight: 700;
    color: #f8fafc;
  }

  .step-desc {
    font-size: 12.5px;
    line-height: 1.6;
    color: #94a3b8;
  }

  .step-desc strong {
    color: #e2e8f0;
  }

  .step-desc code {
    font-family: var(--font-mono);
    font-size: 11.5px;
    padding: 1px 5px;
    border-radius: 4px;
    background-color: rgba(0, 210, 255, 0.1);
    color: #38bdf8;
  }

  .shortcuts-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 10px;
    background-color: rgba(0, 0, 0, 0.28);
    border: 1px solid rgba(255, 255, 255, 0.06);
    flex-wrap: wrap;
  }

  .strip-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
    color: var(--accent-cyan);
  }

  .shortcut-pills {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .sc-pill {
    font-size: 11.5px;
    color: #cbd5e1;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background-color: rgba(255, 255, 255, 0.04);
    padding: 3px 8px;
    border-radius: 6px;
  }

  .sc-pill kbd {
    font-family: var(--font-mono);
    font-size: 10.5px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 4px;
    background-color: rgba(0, 210, 255, 0.15);
    color: var(--accent-cyan);
    border: 1px solid rgba(0, 210, 255, 0.3);
  }

  .welcome-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding-top: 6px;
  }

  .footer-note {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    color: #94a3b8;
  }

  :global(.note-icon) {
    color: #10b981;
    flex-shrink: 0;
  }

  .footer-note strong {
    color: #e2e8f0;
  }

  .start-app-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 11px 24px;
    border-radius: 10px;
    background: linear-gradient(135deg, #00d2ff 0%, #0099ff 100%);
    color: #07101d;
    font-size: 13.5px;
    font-weight: 800;
    box-shadow: 0 6px 20px rgba(0, 210, 255, 0.35);
    flex-shrink: 0;
    transition: transform 0.15s ease, filter 0.15s ease;
  }

  .start-app-btn:hover {
    filter: brightness(1.08);
    transform: translateY(-1px);
  }
</style>
