<script lang="ts">
  import {
    ArrowLeft,
    ArrowRight,
    Search,
    ChevronRight,
    BookOpen,
    RotateCw,
    Edit3,
    ListFilter,
    Hand,
    Highlighter,
    Bookmark,
    Hourglass,
    Type,
    Settings,
    Volume2,
    RefreshCw,
    Maximize2,
    Printer,
    Terminal,
    Layout,
    X
  } from '@lucide/svelte';

  interface Props {
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
    onSearch: () => void;
    onGoTo: () => void;
    onOpenBook: () => void;
    onReload: () => void;
    onEditBook: () => void;
    onToc: () => void;
    onToggleReference: () => void;
    onHighlights: () => void;
    onBookmarks: () => void;
    onStats: () => void;
    onFontSize: () => void;
    onPreferences: () => void;
    onReadAloud: () => void;
    onProfiles: () => void;
    onFullscreen: () => void;
    onPrint: () => void;
    onInspector: () => void;
    onResetInterface: () => void;
    onQuit: () => void;
  }

  let {
    onClose,
    onPrev,
    onNext,
    onSearch,
    onGoTo,
    onOpenBook,
    onReload,
    onEditBook,
    onToc,
    onToggleReference,
    onHighlights,
    onBookmarks,
    onStats,
    onFontSize,
    onPreferences,
    onReadAloud,
    onProfiles,
    onFullscreen,
    onPrint,
    onInspector,
    onResetInterface,
    onQuit
  }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="calibre-menu-backdrop" onclick={onClose} role="button" tabindex="0">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="calibre-menu-card" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
    <div class="menu-grid">
      <!-- Row 1: Back / Forward -->
      <button class="calibre-action-item" onclick={onPrev} title="Chương trước">
        <ArrowLeft size={18} class="action-icon" />
        <span class="action-label">Back</span>
      </button>
      <button class="calibre-action-item" onclick={onNext} title="Chương kế tiếp">
        <ArrowRight size={18} class="action-icon" />
        <span class="action-label">Forward</span>
      </button>

      <!-- Row 2: Search / Go to -->
      <button class="calibre-action-item" onclick={onSearch} title="Tìm kiếm trong sách">
        <Search size={18} class="action-icon" />
        <span class="action-label">Search</span>
      </button>
      <button class="calibre-action-item" onclick={onGoTo} title="Chuyển đến chương/vị trí">
        <ChevronRight size={18} class="action-icon" />
        <span class="action-label">Go to</span>
      </button>

      <!-- Row 3: Open book / Reload / Edit book -->
      <button class="calibre-action-item" onclick={onOpenBook} title="Mở sách khác trong Thư viện">
        <BookOpen size={18} class="action-icon" />
        <span class="action-label">Open book</span>
      </button>
      <button class="calibre-action-item" onclick={onReload} title="Tải lại nội dung chương hiện tại">
        <RotateCw size={18} class="action-icon" />
        <span class="action-label">Reload</span>
      </button>
      <button class="calibre-action-item col-span-2" onclick={onEditBook} title="Chỉnh sửa nội dung & Quy tắc thay thế">
        <Edit3 size={18} class="action-icon" />
        <span class="action-label">Edit book</span>
      </button>

      <!-- Row 4: Table of Contents / Reference mode -->
      <button class="calibre-action-item" onclick={onToc} title="Mục lục toàn bộ chương">
        <ListFilter size={18} class="action-icon" />
        <span class="action-label">Table of Contents</span>
      </button>
      <button class="calibre-action-item" onclick={onToggleReference} title="Bật/Tắt số đoạn văn tham chiếu">
        <Hand size={18} class="action-icon" />
        <span class="action-label">Reference mode</span>
      </button>

      <!-- Row 5: Highlights / Bookmarks / Reading statistics -->
      <button class="calibre-action-item" onclick={onHighlights} title="Ghi chú & Đánh dấu đoạn trích">
        <Highlighter size={18} class="action-icon" />
        <span class="action-label">Highlights</span>
      </button>
      <button class="calibre-action-item" onclick={onBookmarks} title="Danh sách trang đã đánh dấu">
        <Bookmark size={18} class="action-icon" />
        <span class="action-label">Bookmarks</span>
      </button>
      <button class="calibre-action-item col-span-2" onclick={onStats} title="Thống kê tốc độ đọc và thời gian còn lại">
        <Hourglass size={18} class="action-icon" />
        <span class="action-label">Reading statistics</span>
      </button>

      <!-- Row 6: Font size / Preferences -->
      <button class="calibre-action-item" onclick={onFontSize} title="Tùy chỉnh cỡ chữ nhanh">
        <Type size={18} class="action-icon" />
        <span class="action-label">Font size</span>
      </button>
      <button class="calibre-action-item highlight" onclick={onPreferences} title="Hộp thoại cài đặt trình đọc chuyên sâu">
        <Settings size={18} class="action-icon" />
        <span class="action-label">Preferences</span>
      </button>

      <!-- Row 7: Read aloud / Profiles -->
      <button class="calibre-action-item" onclick={onReadAloud} title="Đọc truyện bằng Audio TTS">
        <Volume2 size={18} class="action-icon" />
        <span class="action-label">Read aloud</span>
      </button>
      <button class="calibre-action-item" onclick={onProfiles} title="Chuyển đổi bảng màu trang sách">
        <RefreshCw size={18} class="action-icon" />
        <span class="action-label">Profiles</span>
      </button>

      <!-- Row 8: Full screen / Print -->
      <button class="calibre-action-item" onclick={onFullscreen} title="Toàn màn hình">
        <Maximize2 size={18} class="action-icon" />
        <span class="action-label">Enter full screen</span>
      </button>
      <button class="calibre-action-item" onclick={onPrint} title="In hoặc xuất PDF">
        <Printer size={18} class="action-icon" />
        <span class="action-label">Print</span>
      </button>

      <!-- Row 9: Inspector / Reset interface / Quit -->
      <button class="calibre-action-item" onclick={onInspector} title="Kiểm tra thông số bộ nhớ IndexedDB">
        <Terminal size={18} class="action-icon" />
        <span class="action-label">Inspector</span>
      </button>
      <button class="calibre-action-item" onclick={onResetInterface} title="Khôi phục giao diện mặc định (3 cột)">
        <Layout size={18} class="action-icon" />
        <span class="action-label">Reset interface</span>
      </button>
      <button class="calibre-action-item quit-item col-span-2" onclick={onQuit} title="Đóng trình đọc và trở về thư viện">
        <X size={18} class="action-icon text-red" />
        <span class="action-label">Quit</span>
      </button>
    </div>
  </div>
</div>

<style>
  .calibre-menu-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(3px);
    z-index: 1900;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    padding-top: 50px;
    padding-right: 24px;
  }

  .calibre-menu-card {
    background: #fbf0d9;
    color: #2b2118;
    border: 1px solid #dcd1ba;
    border-radius: 8px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
    width: 360px;
    overflow: hidden;
    user-select: none;
    animation: popIn 0.16s ease-out;
  }

  @keyframes popIn {
    from {
      opacity: 0;
      transform: scale(0.96) translateY(-8px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .menu-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    background: #e9dec6;
    gap: 1px;
    border: 1px solid #dcd1ba;
  }

  .calibre-action-item {
    background: #fbf0d9;
    border: none;
    color: #2b2118;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s, color 0.15s;
  }

  .calibre-action-item:hover {
    background: #f1e4c7;
    color: #000;
  }

  .calibre-action-item.highlight {
    background: #f4e7c7;
    font-weight: 600;
  }

  .calibre-action-item.highlight:hover {
    background: #ecdcb4;
  }

  .calibre-action-item.col-span-2 {
    grid-column: span 2;
  }

  .action-icon {
    flex-shrink: 0;
    color: #4b3d2b;
  }

  .action-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .quit-item:hover .text-red {
    color: #dc2626;
  }
</style>
