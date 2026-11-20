<script lang="ts">
  import { onMount } from 'svelte';
  import { appState } from '../stores/appState.svelte';
  import {
    Sparkles,
    CheckCircle2,
    HardDrive,
    Palette,
    Layers,
    Columns,
    Settings,
    X,
    ArrowRight
  } from '@lucide/svelte';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  function dismiss() {
    appState.completeWhatsNew();
    onClose();
  }

  onMount(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismiss();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="modal-backdrop" onclick={dismiss} onkeydown={(e) => e.key === 'Escape' && dismiss()} role="button" tabindex="0">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="whats-new-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
    <header class="whats-new-header">
      <div class="badge-row">
        <span class="version-tag">
          <Sparkles size={13} />
          BẢN NÂNG CẤP ĐỘT PHÁ
        </span>
        <span class="version-num">v1.3.0</span>
      </div>
      <h2>Chào mừng bạn đến với LMT Manager v1.3.0!</h2>
      <p class="subtitle">
        Phiên bản nâng cấp lớn: Cào 100% truyện offline vĩnh viễn, Trình đọc Truyện tranh Manga/Webtoon tăng tốc mượt mà, và Giao diện Reader chuẩn responsive không phân tâm.
      </p>
      <button class="close-btn" onclick={dismiss} title="Đóng">
        <X size={18} />
      </button>
    </header>

    <div class="whats-new-content custom-scrollbar">
      <!-- Feature 1: True 100% Offline Scrape -->
      <div class="feature-item">
        <div class="feature-icon offline">
          <HardDrive size={20} />
        </div>
        <div class="feature-detail">
          <h4>Cào 100% Offline Thực Thụ (True 100% Offline Scrape)</h4>
          <p>
            Chấm dứt hoàn toàn cơ chế cào một ít rồi đọc mới cào tiếp! Toàn bộ 100% nội dung chương được tải về và lưu trữ vĩnh viễn vào hệ thống <strong>IndexedDB</strong> trên ổ cứng. Mở chương tức thì 0ms, không bao giờ xuất hiện vòng xoay chờ tải hay lỗi tràn bộ nhớ 5MB của localStorage.
          </p>
        </div>
      </div>

      <!-- Feature 2: Comic & Manga Reader -->
      <div class="feature-item">
        <div class="feature-icon comic">
          <Palette size={20} />
        </div>
        <div class="feature-detail">
          <h4>Trình Đọc Truyện Tranh, Manga & Webtoon Tăng Tốc Không Khựng</h4>
          <p>
            Hỗ trợ nhập và tự động nhận diện file truyện tranh (<code>.cbz</code>, <code>.cbr</code>, zip ảnh, manga epub). Render ảo hóa (virtual windowing) cực nhanh, chuyển trang siêu mượt. Đầy đủ 3 chế độ đọc: <strong>Cuộn dọc Webtoon</strong>, <strong>Trang đơn</strong>, và <strong>Trang đôi song song</strong> kèm tùy chọn <strong>Lật phải sang trái (RTL)</strong> cho Manga Nhật Bản.
          </p>
        </div>
      </div>

      <!-- Feature 3: Library Media Categories -->
      <div class="feature-item">
        <div class="feature-icon library">
          <Layers size={20} />
        </div>
        <div class="feature-detail">
          <h4>Phân Loại Thư Viện Chuyên Biệt (Tiểu thuyết • Sách chữ • Truyện tranh)</h4>
          <p>
            Thư viện được chia thành các mục rõ ràng: <strong>📚 Tiểu thuyết</strong> (truyện chữ cào từ web), <strong>📖 Sách chữ</strong> (Ebook nhập từ máy tính), và <strong>🎨 Truyện tranh</strong> (Manga/Comic), kèm số lượng tác phẩm và số trang/chương riêng biệt.
          </p>
        </div>
      </div>

      <!-- Feature 4: Calibre 3-Column Layout & E-book Viewer -->
      <div class="feature-item">
        <div class="feature-icon layout">
          <Columns size={20} />
        </div>
        <div class="feature-detail">
          <h4>Giao Diện Reader Chuẩn Calibre E-book Viewer 3 Cột</h4>
          <p>
            Tái hiện trọn vẹn bố cục <strong>3 cột chữ (3-Column layout)</strong> chuẩn mực của phần mềm Calibre danh tiếng, Calibre Header hiển thị tên sách & chương ở đầu trang, và Calibre Footer hiển thị % tiến độ đọc (ví dụ: <code>1%</code>) ở chân trang.
          </p>
        </div>
      </div>

      <!-- Feature 5: Calibre Action Menu & 10 Preferences Categories -->
      <div class="feature-item">
        <div class="feature-icon calibre">
          <Settings size={20} />
        </div>
        <div class="feature-detail">
          <h4>Thanh Menu Calibre 20 Chức Năng & 10 Danh Mục Calibre Preferences</h4>
          <p>
            Thanh công cụ chuẩn Calibre đầy đủ 20 thao tác (Back, Forward, Search, Go to, TOC, Reference mode, Highlights, Reading statistics, Aa Font size...). Hộp thoại Preferences thiết kế tỉ mỉ với 10 mục: <em>Colors, Page layout, Styles, Headers and footers, Scrolling behavior, Selection behavior, Touch behavior, Keyboard shortcuts, Fonts, Miscellaneous</em>.
          </p>
        </div>
      </div>
    </div>

    <footer class="whats-new-footer">
      <button class="btn-explore" onclick={dismiss}>
        <span>Bắt đầu trải nghiệm ngay</span>
        <ArrowRight size={16} />
      </button>
    </footer>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(4, 7, 14, 0.82);
    backdrop-filter: blur(10px);
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    animation: fadeIn 0.25s ease-out;
  }

  .whats-new-card {
    background: #111520;
    border: 1px solid rgba(0, 210, 255, 0.2);
    border-radius: 16px;
    width: 660px;
    max-width: 95vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(0, 210, 255, 0.15);
    overflow: hidden;
    animation: zoomIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes zoomIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

  .whats-new-header {
    position: relative;
    padding: 24px 28px 18px 28px;
    background: linear-gradient(180deg, rgba(0, 210, 255, 0.08) 0%, transparent 100%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .badge-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .version-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    background: rgba(0, 210, 255, 0.12);
    border: 1px solid rgba(0, 210, 255, 0.3);
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 700;
    color: #00d2ff;
    letter-spacing: 0.5px;
  }

  .version-num {
    font-size: 13px;
    font-weight: 700;
    color: #94a3b8;
  }

  .whats-new-header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: #f8fafc;
    line-height: 1.3;
  }

  .subtitle {
    margin: 6px 0 0 0;
    font-size: 13px;
    color: #94a3b8;
    line-height: 1.5;
  }

  .close-btn {
    position: absolute;
    top: 20px;
    right: 20px;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #f8fafc;
  }

  .whats-new-content {
    padding: 20px 28px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex: 1;
  }

  .feature-item {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    transition: all 0.2s;
  }

  .feature-item:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(0, 210, 255, 0.2);
  }

  .feature-icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .feature-icon.offline {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.35);
    color: #10b981;
  }

  .feature-icon.comic {
    background: rgba(236, 72, 153, 0.15);
    border: 1px solid rgba(236, 72, 153, 0.35);
    color: #ec4899;
  }

  .feature-icon.library {
    background: rgba(14, 165, 233, 0.15);
    border: 1px solid rgba(14, 165, 233, 0.35);
    color: #0ea5e9;
  }

  .feature-icon.layout {
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.35);
    color: #a78bfa;
  }

  .feature-icon.calibre {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.35);
    color: #f59e0b;
  }

  .feature-detail {
    flex: 1;
  }

  .feature-detail h4 {
    margin: 0 0 4px 0;
    font-size: 14px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .feature-detail p {
    margin: 0;
    font-size: 12.5px;
    color: #94a3b8;
    line-height: 1.5;
  }

  .feature-detail code {
    background: rgba(0, 210, 255, 0.1);
    color: #00d2ff;
    padding: 1px 5px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 11.5px;
  }

  .whats-new-footer {
    padding: 16px 28px;
    background: rgba(0, 0, 0, 0.25);
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    justify-content: flex-end;
  }

  .btn-explore {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 22px;
    background: linear-gradient(135deg, #00d2ff 0%, #0099ff 100%);
    border: none;
    border-radius: 10px;
    color: #04070e;
    font-size: 13.5px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(0, 210, 255, 0.35);
    transition: all 0.2s;
  }

  .btn-explore:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(0, 210, 255, 0.45);
  }
</style>
