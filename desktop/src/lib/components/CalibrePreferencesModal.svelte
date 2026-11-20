<script lang="ts">
  import { appState } from '../stores/appState.svelte';
  import type { ReaderSettings } from '../types';
  import {
    Palette,
    Columns,
    Type,
    Sliders,
    MousePointer,
    Hand,
    Keyboard,
    Settings,
    RotateCcw,
    X,
    Check,
    Bookmark,
    Layers,
    FileText,
    Eye
  } from '@lucide/svelte';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  type PrefCategory =
    | 'colors'
    | 'layout'
    | 'styles'
    | 'headers'
    | 'scrolling'
    | 'selection'
    | 'touch'
    | 'shortcuts'
    | 'fonts'
    | 'misc';

  let activeCategory = $state<PrefCategory>('layout');

  const categories = [
    { id: 'colors', name: 'Colors', desc: 'Colors of the page and text', icon: Palette },
    { id: 'layout', name: 'Page layout', desc: 'Page margins and number of pages per screen', icon: Columns },
    { id: 'styles', name: 'Styles', desc: 'Style rules for text and background image', icon: FileText },
    { id: 'headers', name: 'Headers and footers', desc: 'Customize the headers and footers', icon: Layers },
    { id: 'scrolling', name: 'Scrolling behavior', desc: 'Control how the viewer scrolls', icon: Sliders },
    { id: 'selection', name: 'Selection behavior', desc: 'Control how the viewer selects text', icon: MousePointer },
    { id: 'touch', name: 'Touch behavior', desc: 'Customize what various touchscreen gestures do', icon: Hand },
    { id: 'shortcuts', name: 'Keyboard shortcuts', desc: 'Customize the keyboard shortcuts', icon: Keyboard },
    { id: 'fonts', name: 'Fonts', desc: 'Font choices', icon: Type },
    { id: 'misc', name: 'Miscellaneous', desc: 'Window size, last read position, toolbar, etc.', icon: Settings }
  ];

  function update<K extends keyof ReaderSettings>(key: K, val: ReaderSettings[K]) {
    appState.readerSettings[key] = val;
    appState.persistState();
  }

  function resetToCalibreDefaults() {
    appState.readerSettings = {
      ...appState.readerSettings,
      theme: 'pure_white',
      columnsCount: 'auto',
      twoColumn: false,
      fontSize: 18,
      lineHeight: 1.7,
      fontFamily: 'serif',
      fontWeight: 400,
      firstLineIndentEm: 1.8,
      textAlign: 'justify',
      showCalibreHeader: false,
      showCalibreFooter: true,
      showReaderHeader: false,
      showReaderFooter: true,
      marginTop: 20,
      marginBottom: 25,
      marginLeftRight: 40,
      columnGap: 48
    };
    appState.persistState();
    appState.showToast('Đã khôi phục thiết lập mặc định (3 cột tự động)!', 'success');
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="modal-backdrop" onclick={onClose} role="button" tabindex="0">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="calibre-prefs-dialog" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
    <!-- Header -->
    <header class="dialog-header">
      <div class="header-title">
        <Settings size={20} class="cyan-icon" />
        <h3>Cài đặt trình đọc chuyên sâu</h3>
      </div>
      <button class="close-btn" onclick={onClose} title="Đóng (Esc)">
        <X size={18} />
      </button>
    </header>

    <div class="dialog-body">
      <!-- Left Category Sidebar -->
      <nav class="prefs-sidebar">
        {#each categories as cat}
          {@const Icon = cat.icon}
          <button
            class="category-item"
            class:active={activeCategory === cat.id}
            onclick={() => (activeCategory = cat.id as PrefCategory)}
          >
            <div class="cat-left">
              <Icon size={16} class="cat-icon" />
              <div class="cat-text">
                <span class="cat-name">{cat.name}</span>
                <span class="cat-desc">{cat.desc}</span>
              </div>
            </div>
          </button>
        {/each}
      </nav>

      <!-- Right Config Panel -->
      <main class="prefs-content custom-scrollbar">
        <!-- 1. COLORS -->
        {#if activeCategory === 'colors'}
          <div class="panel-section">
            <h4 class="section-title">Color Scheme (Bảng màu trang sách)</h4>
            <div class="theme-grid">
              <button
                class="theme-card theme-calibre"
                class:active={appState.readerSettings.theme === 'sepia'}
                onclick={() => update('theme', 'sepia')}
              >
                <div class="theme-sample calibre-bg">Aa</div>
                <div class="theme-label">
                  <strong>Giấy ngà cổ điển (Sepia)</strong>
                  <span>Vàng ngà bảo vệ mắt, phong cách trang sách</span>
                </div>
              </button>

              <button
                class="theme-card theme-white"
                class:active={appState.readerSettings.theme === 'calibre_white' || appState.readerSettings.theme === 'light'}
                onclick={() => update('theme', 'calibre_white')}
              >
                <div class="theme-sample white-bg">Aa</div>
                <div class="theme-label">
                  <strong>Pure White</strong>
                  <span>Nền trắng sách giấy in</span>
                </div>
              </button>

              <button
                class="theme-card theme-dark"
                class:active={appState.readerSettings.theme === 'dark'}
                onclick={() => update('theme', 'dark')}
              >
                <div class="theme-sample dark-bg">Aa</div>
                <div class="theme-label">
                  <strong>Night Dark</strong>
                  <span>Nền đen than dịu mắt ban đêm</span>
                </div>
              </button>

              <button
                class="theme-card theme-oled"
                class:active={appState.readerSettings.theme === 'oled'}
                onclick={() => update('theme', 'oled')}
              >
                <div class="theme-sample oled-bg">Aa</div>
                <div class="theme-label">
                  <strong>OLED Black</strong>
                  <span>Đen tuyệt đối tiết kiệm pin</span>
                </div>
              </button>

              <button
                class="theme-card theme-solarized"
                class:active={appState.readerSettings.theme === 'solarized'}
                onclick={() => update('theme', 'solarized')}
              >
                <div class="theme-sample solarized-bg">Aa</div>
                <div class="theme-label">
                  <strong>Solarized Sand</strong>
                  <span>Màu cát sa mạc êm dịu</span>
                </div>
              </button>

              <button
                class="theme-card theme-custom"
                class:active={appState.readerSettings.theme === 'custom'}
                onclick={() => update('theme', 'custom')}
              >
                <div class="theme-sample custom-bg">Aa</div>
                <div class="theme-label">
                  <strong>Custom Colors</strong>
                  <span>Tự chọn mã màu hex riêng</span>
                </div>
              </button>
            </div>

            {#if appState.readerSettings.theme === 'custom'}
              <div class="custom-color-pickers">
                <div class="picker-group">
                  <label>Màu nền sách:</label>
                  <input
                    type="color"
                    value={appState.readerSettings.customBgColor || '#fbf0d9'}
                    onchange={(e) => update('customBgColor', (e.target as HTMLInputElement).value)}
                  />
                  <span>{appState.readerSettings.customBgColor || '#fbf0d9'}</span>
                </div>
                <div class="picker-group">
                  <label>Màu chữ:</label>
                  <input
                    type="color"
                    value={appState.readerSettings.customTextColor || '#5f4b32'}
                    onchange={(e) => update('customTextColor', (e.target as HTMLInputElement).value)}
                  />
                  <span>{appState.readerSettings.customTextColor || '#5f4b32'}</span>
                </div>
              </div>
            {/if}
          </div>

        <!-- 2. PAGE LAYOUT -->
        {:else if activeCategory === 'layout'}
          <div class="panel-section">
            <h4 class="section-title">Number of Columns per Screen (Bố cục chia cột)</h4>
            <div class="btn-group-row">
              <button
                class="opt-btn"
                class:active={appState.readerSettings.columnsCount === 3}
                onclick={() => update('columnsCount', 3)}
              >
                3 Cột (Tiêu chuẩn)
              </button>
              <button
                class="opt-btn"
                class:active={appState.readerSettings.columnsCount === 2}
                onclick={() => update('columnsCount', 2)}
              >
                2 Cột (Mở rộng)
              </button>
              <button
                class="opt-btn"
                class:active={appState.readerSettings.columnsCount === 1}
                onclick={() => update('columnsCount', 1)}
              >
                1 Cột (Đơn)
              </button>
              <button
                class="opt-btn"
                class:active={appState.readerSettings.columnsCount === 'auto'}
                onclick={() => update('columnsCount', 'auto')}
              >
                Tự động thích ứng
              </button>
            </div>

            <h4 class="section-title" style="margin-top: 24px;">Margins & Column Spacing (Căn lề trang)</h4>
            <div class="slider-row">
              <div class="slider-header">
                <span>Khoảng cách giữa các cột chữ (Column Gap)</span>
                <span class="val">{appState.readerSettings.columnGap || 32}px</span>
              </div>
              <input
                type="range"
                min="16"
                max="80"
                value={appState.readerSettings.columnGap || 32}
                oninput={(e) => update('columnGap', Number((e.target as HTMLInputElement).value))}
              />
            </div>

            <div class="slider-row">
              <div class="slider-header">
                <span>Căn lề trái & phải (Left & Right Margins)</span>
                <span class="val">{appState.readerSettings.marginLeftRight || 40}px</span>
              </div>
              <input
                type="range"
                min="10"
                max="120"
                value={appState.readerSettings.marginLeftRight || 40}
                oninput={(e) => update('marginLeftRight', Number((e.target as HTMLInputElement).value))}
              />
            </div>

            <div class="slider-row">
              <div class="slider-header">
                <span>Căn lề trên (Top Margin)</span>
                <span class="val">{appState.readerSettings.marginTop || 20}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                value={appState.readerSettings.marginTop || 20}
                oninput={(e) => update('marginTop', Number((e.target as HTMLInputElement).value))}
              />
            </div>

            <div class="slider-row">
              <div class="slider-header">
                <span>Căn lề dưới (Bottom Margin)</span>
                <span class="val">{appState.readerSettings.marginBottom || 25}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                value={appState.readerSettings.marginBottom || 25}
                oninput={(e) => update('marginBottom', Number((e.target as HTMLInputElement).value))}
              />
            </div>
          </div>

        <!-- 3. STYLES -->
        {:else if activeCategory === 'styles'}
          <div class="panel-section">
            <h4 class="section-title">Paragraph Formatting & Text Flow</h4>
            <div class="toggle-row">
              <div>
                <span class="toggle-title">Thụt đầu dòng đoạn văn (First-line Indent)</span>
                <span class="toggle-sub">Thụt lề chữ đầu mỗi đoạn văn theo chuẩn sách in</span>
              </div>
              <input
                type="checkbox"
                checked={appState.readerSettings.textIndent}
                onchange={(e) => update('textIndent', (e.target as HTMLInputElement).checked)}
                class="switch-input"
              />
            </div>

            {#if appState.readerSettings.textIndent}
              <div class="slider-row">
                <div class="slider-header">
                  <span>Độ thụt đầu dòng</span>
                  <span class="val">{appState.readerSettings.firstLineIndentEm || 1.5}em</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.25"
                  value={appState.readerSettings.firstLineIndentEm || 1.5}
                  oninput={(e) => update('firstLineIndentEm', Number((e.target as HTMLInputElement).value))}
                />
              </div>
            {/if}

            <div class="toggle-row">
              <div>
                <span class="toggle-title">Drop Caps (Chữ cái đầu chương phóng to)</span>
                <span class="toggle-sub">Tạo điểm nhấn cổ điển sang trọng đầu mỗi chương</span>
              </div>
              <input
                type="checkbox"
                checked={appState.readerSettings.dropCaps}
                onchange={(e) => update('dropCaps', (e.target as HTMLInputElement).checked)}
                class="switch-input"
              />
            </div>

            <div class="slider-row">
              <div class="slider-header">
                <span>Khoảng cách giữa các đoạn văn</span>
                <span class="val">{appState.readerSettings.paragraphSpacing || 1.25}em</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.1"
                value={appState.readerSettings.paragraphSpacing || 1.25}
                oninput={(e) => update('paragraphSpacing', Number((e.target as HTMLInputElement).value))}
              />
            </div>
          </div>

        <!-- 4. HEADERS AND FOOTERS -->
        {:else if activeCategory === 'headers'}
          <div class="panel-section">
            <h4 class="section-title">Headers & Footers (Đầu trang & Chân trang)</h4>
            <div class="toggle-row">
              <div>
                <span class="toggle-title">Hiển thị Tiêu đề đầu trang (Header)</span>
                <span class="toggle-sub">Hiển thị tên sách hoặc tên chương hiện tại</span>
              </div>
              <input
                type="checkbox"
                checked={appState.readerSettings.showCalibreHeader}
                onchange={(e) => update('showCalibreHeader', (e.target as HTMLInputElement).checked)}
                class="switch-input"
              />
            </div>

            <div class="toggle-row">
              <div>
                <span class="toggle-title">Hiển thị Chân trang (Footer)</span>
                <span class="toggle-sub">Hiển thị % tiến độ đọc và số trang (ví dụ: 1%)</span>
              </div>
              <input
                type="checkbox"
                checked={appState.readerSettings.showCalibreFooter}
                onchange={(e) => update('showCalibreFooter', (e.target as HTMLInputElement).checked)}
                class="switch-input"
              />
            </div>

            <div class="field-row">
              <label>Vị trí Header bên trái:</label>
              <select
                value={appState.readerSettings.headerLeft || 'title'}
                onchange={(e) => update('headerLeft', (e.target as HTMLSelectElement).value as any)}
              >
                <option value="title">Tên sách</option>
                <option value="author">Tên tác giả</option>
                <option value="none">Không hiển thị</option>
              </select>
            </div>

            <div class="field-row">
              <label>Vị trí Header chính giữa:</label>
              <select
                value={appState.readerSettings.headerCenter || 'chapter'}
                onchange={(e) => update('headerCenter', (e.target as HTMLSelectElement).value as any)}
              >
                <option value="chapter">Tên chương</option>
                <option value="title">Tên sách</option>
                <option value="none">Không hiển thị</option>
              </select>
            </div>

            <div class="field-row">
              <label>Vị trí Footer bên phải:</label>
              <select
                value={appState.readerSettings.footerRight || 'percentage'}
                onchange={(e) => update('footerRight', (e.target as HTMLSelectElement).value as any)}
              >
                <option value="percentage">% Tiến độ đọc (Ví dụ: 1%)</option>
                <option value="time_left">Thời gian ước tính</option>
                <option value="none">Không hiển thị</option>
              </select>
            </div>
          </div>

        <!-- 5. SCROLLING BEHAVIOR -->
        {:else if activeCategory === 'scrolling'}
          <div class="panel-section">
            <h4 class="section-title">Scrolling & Pagination Modes</h4>
            <div class="toggle-row">
              <div>
                <span class="toggle-title">Tự động cuộn trang (Auto-scroll)</span>
                <span class="toggle-sub">Tự động cuộn mượt mà khi đọc rảnh tay</span>
              </div>
              <input
                type="checkbox"
                checked={appState.readerSettings.autoScroll}
                onchange={(e) => update('autoScroll', (e.target as HTMLInputElement).checked)}
                class="switch-input"
              />
            </div>

            {#if appState.readerSettings.autoScroll}
              <div class="slider-row">
                <div class="slider-header">
                  <span>Tốc độ tự động cuộn</span>
                  <span class="val">{appState.readerSettings.autoScrollSpeed} px/nhịp</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={appState.readerSettings.autoScrollSpeed}
                  oninput={(e) => update('autoScrollSpeed', Number((e.target as HTMLInputElement).value))}
                />
              </div>
            {/if}

            <div class="toggle-row">
              <div>
                <span class="toggle-title">Tự động qua chương khi cuộn chạm đáy</span>
                <span class="toggle-sub">Chuyển tiếp liền mạch sang chương kế tiếp</span>
              </div>
              <input
                type="checkbox"
                checked={appState.readerSettings.autoNextChapter}
                onchange={(e) => update('autoNextChapter', (e.target as HTMLInputElement).checked)}
                class="switch-input"
              />
            </div>
          </div>

        <!-- 6. SELECTION BEHAVIOR -->
        {:else if activeCategory === 'selection'}
          <div class="panel-section">
            <h4 class="section-title">Text Selection & Context Tools</h4>
            <p class="section-info">
              Khi bôi đen văn bản trong trình đọc, bạn có thể nhanh chóng tra cứu nghĩa, sao chép trích dẫn, hoặc tạo ghi chú đánh dấu trang.
            </p>
            <div class="toggle-row">
              <div>
                <span class="toggle-title">Chế độ tham chiếu (Reference mode)</span>
                <span class="toggle-sub">Hiển thị số đoạn văn bên lề để dễ trích dẫn và nghiên cứu</span>
              </div>
              <input
                type="checkbox"
                checked={appState.readerSettings.referenceMode}
                onchange={(e) => update('referenceMode', (e.target as HTMLInputElement).checked)}
                class="switch-input"
              />
            </div>
          </div>

        <!-- 7. TOUCH BEHAVIOR -->
        {:else if activeCategory === 'touch'}
          <div class="panel-section">
            <h4 class="section-title">Touchscreen & Gesture Zones</h4>
            <div class="touch-zones-diagram">
              <div class="zone zone-left">
                <span>Chạm mép trái</span>
                <strong>Trang trước</strong>
              </div>
              <div class="zone zone-center">
                <span>Chạm ở giữa</span>
                <strong>Bật/Tắt Menu thao tác</strong>
              </div>
              <div class="zone zone-right">
                <span>Chạm mép phải</span>
                <strong>Trang sau</strong>
              </div>
            </div>
          </div>

        <!-- 8. KEYBOARD SHORTCUTS -->
        {:else if activeCategory === 'shortcuts'}
          <div class="panel-section">
            <h4 class="section-title">Keyboard Shortcuts Map (Phím tắt điều khiển)</h4>
            <div class="shortcuts-table">
              <div class="shortcut-row">
                <kbd>Mũi tên phải</kbd> / <kbd>Space</kbd>
                <span>Sang trang kế tiếp / Cuộn xuống</span>
              </div>
              <div class="shortcut-row">
                <kbd>Mũi tên trái</kbd> / <kbd>Shift+Space</kbd>
                <span>Quay lại trang trước / Cuộn lên</span>
              </div>
              <div class="shortcut-row">
                <kbd>F</kbd> / <kbd>F11</kbd>
                <span>Bật / Tắt chế độ toàn màn hình</span>
              </div>
              <div class="shortcut-row">
                <kbd>Esc</kbd>
                <span>Thoát trình đọc hoặc đóng hộp thoại</span>
              </div>
              <div class="shortcut-row">
                <kbd>B</kbd>
                <span>Đánh dấu trang hiện tại (Bookmark)</span>
              </div>
              <div class="shortcut-row">
                <kbd>T</kbd>
                <span>Mở Mục lục chương (Table of Contents)</span>
              </div>
              <div class="shortcut-row">
                <kbd>+</kbd> / <kbd>-</kbd>
                <span>Tăng / Giảm cỡ chữ nhanh</span>
              </div>
            </div>
          </div>

        <!-- 9. FONTS -->
        {:else if activeCategory === 'fonts'}
          <div class="panel-section">
            <h4 class="section-title">Font Choices & Typography</h4>
            <div class="font-picker-grid">
              <button
                class="font-card font-serif"
                class:active={appState.readerSettings.fontFamily === 'serif'}
                onclick={() => update('fontFamily', 'serif')}
              >
                <span class="font-sample">Serif (Sách in truyền thống)</span>
                <span class="font-name">Merriweather / Georgia</span>
              </button>

              <button
                class="font-card font-sans"
                class:active={appState.readerSettings.fontFamily === 'sans'}
                onclick={() => update('fontFamily', 'sans')}
              >
                <span class="font-sample">Sans-Serif (Hiện đại)</span>
                <span class="font-name">Inter / Segoe UI</span>
              </button>

              <button
                class="font-card font-literata"
                class:active={appState.readerSettings.fontFamily === 'literata'}
                onclick={() => update('fontFamily', 'literata')}
              >
                <span class="font-sample">Literata (Sách xuất bản)</span>
                <span class="font-name">Google Books Font</span>
              </button>

              <button
                class="font-card font-mono"
                class:active={appState.readerSettings.fontFamily === 'mono'}
                onclick={() => update('fontFamily', 'mono')}
              >
                <span class="font-sample">Monospace (Lập trình)</span>
                <span class="font-name">Fira Code / Consolas</span>
              </button>
            </div>

            <div class="slider-row" style="margin-top: 20px;">
              <div class="slider-header">
                <span>Cỡ chữ (Font size)</span>
                <span class="val">{appState.readerSettings.fontSize}px</span>
              </div>
              <input
                type="range"
                min="12"
                max="32"
                value={appState.readerSettings.fontSize}
                oninput={(e) => update('fontSize', Number((e.target as HTMLInputElement).value))}
              />
            </div>

            <div class="slider-row">
              <div class="slider-header">
                <span>Độ giãn dòng (Line height)</span>
                <span class="val">{appState.readerSettings.lineHeight}</span>
              </div>
              <input
                type="range"
                min="1.3"
                max="2.5"
                step="0.05"
                value={appState.readerSettings.lineHeight}
                oninput={(e) => update('lineHeight', Number((e.target as HTMLInputElement).value))}
              />
            </div>

            <div class="slider-row">
              <div class="slider-header">
                <span>Độ đậm chữ (Font weight)</span>
                <span class="val">{appState.readerSettings.fontWeight}</span>
              </div>
              <input
                type="range"
                min="300"
                max="700"
                step="100"
                value={appState.readerSettings.fontWeight}
                oninput={(e) => update('fontWeight', Number((e.target as HTMLInputElement).value))}
              />
            </div>
          </div>

        <!-- 10. MISCELLANEOUS -->
        {:else if activeCategory === 'misc'}
          <div class="panel-section">
            <h4 class="section-title">Miscellaneous Settings (Cài đặt nâng cao khác)</h4>
            <div class="slider-row">
              <div class="slider-header">
                <span>Tốc độ đọc giọng nói AI (TTS Speech Rate)</span>
                <span class="val">{appState.readerSettings.ttsRate}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={appState.readerSettings.ttsRate}
                oninput={(e) => update('ttsRate', Number((e.target as HTMLInputElement).value))}
              />
            </div>

            <div class="toggle-row">
              <div>
                <span class="toggle-title">Tự động phát chương tiếp theo khi nghe TTS xong</span>
                <span class="toggle-sub">Đọc liên tục không cần thao tác bấm nút</span>
              </div>
              <input
                type="checkbox"
                checked={appState.readerSettings.autoNextTTS}
                onchange={(e) => update('autoNextTTS', (e.target as HTMLInputElement).checked)}
                class="switch-input"
              />
            </div>

            <div style="margin-top: 30px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08);">
              <button class="reset-defaults-btn" onclick={resetToCalibreDefaults}>
                <RotateCcw size={15} />
                <span>Khôi phục toàn bộ về mặc định (3 Cột)</span>
              </button>
            </div>
          </div>
        {/if}
      </main>
    </div>

    <!-- Footer -->
    <footer class="dialog-footer">
      <button class="calibre-btn cancel" onclick={onClose}>Hủy bỏ</button>
      <button class="calibre-btn primary" onclick={onClose}>
        <Check size={16} />
        <span>Áp dụng cài đặt</span>
      </button>
    </footer>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(5px);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .calibre-prefs-dialog {
    background: #182030;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    width: 900px;
    max-width: 95vw;
    height: 640px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
    color: #f1f5f9;
    overflow: hidden;
  }

  .dialog-header {
    height: 52px;
    background: #111827;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-title h3 {
    font-size: 16px;
    font-weight: 600;
  }

  .cyan-icon {
    color: #38bdf8;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
  }

  .dialog-body {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  /* Left Sidebar */
  .prefs-sidebar {
    width: 290px;
    background: #0f172a;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    overflow-y: auto;
    padding: 10px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .category-item {
    background: transparent;
    border: none;
    text-align: left;
    padding: 8px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    color: #94a3b8;
  }

  .category-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #f1f5f9;
  }

  .category-item.active {
    background: #0284c7;
    color: #fff;
    box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35);
  }

  .cat-left {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .cat-text {
    display: flex;
    flex-direction: column;
  }

  .cat-name {
    font-size: 13px;
    font-weight: 600;
  }

  .cat-desc {
    font-size: 10.5px;
    opacity: 0.75;
    margin-top: 1px;
    line-height: 1.3;
  }

  /* Right Content */
  .prefs-content {
    flex: 1;
    padding: 24px;
    overflow-y: auto;
    background: #182030;
  }

  .panel-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: #38bdf8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .section-info {
    font-size: 13px;
    color: #94a3b8;
    line-height: 1.5;
  }

  /* Themes */
  .theme-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .theme-card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 10px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
  }

  .theme-card:hover {
    border-color: #38bdf8;
  }

  .theme-card.active {
    border-color: #0284c7;
    background: rgba(2, 132, 199, 0.12);
    box-shadow: 0 0 0 1px #0284c7;
  }

  .theme-sample {
    width: 38px;
    height: 38px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: bold;
    flex-shrink: 0;
  }

  .calibre-bg {
    background: #fbf0d9;
    color: #5f4b32;
  }

  .white-bg {
    background: #ffffff;
    color: #1a1a1a;
  }

  .dark-bg {
    background: #1e293b;
    color: #f1f5f9;
  }

  .oled-bg {
    background: #000000;
    color: #e2e8f0;
  }

  .solarized-bg {
    background: #fdf6e3;
    color: #657b83;
  }

  .custom-bg {
    background: linear-gradient(135deg, #f43f5e, #8b5cf6);
    color: #fff;
  }

  .theme-label {
    display: flex;
    flex-direction: column;
  }

  .theme-label strong {
    font-size: 13px;
    color: #f1f5f9;
  }

  .theme-label span {
    font-size: 11px;
    color: #94a3b8;
  }

  .custom-color-pickers {
    display: flex;
    gap: 24px;
    padding: 12px;
    background: rgba(0, 0, 0, 0.25);
    border-radius: 8px;
  }

  .picker-group {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }

  /* Button Groups */
  .btn-group-row {
    display: flex;
    gap: 8px;
  }

  .opt-btn {
    flex: 1;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 12px;
    padding: 9px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .opt-btn:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .opt-btn.active {
    background: #0284c7;
    border-color: #38bdf8;
    color: #fff;
    font-weight: 600;
  }

  /* Sliders & Toggles */
  .slider-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
  }

  .slider-header {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: #e2e8f0;
  }

  .slider-header .val {
    color: #38bdf8;
    font-weight: 600;
  }

  input[type='range'] {
    width: 100%;
    accent-color: #0284c7;
    cursor: pointer;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .toggle-title {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #f1f5f9;
  }

  .toggle-sub {
    font-size: 11px;
    color: #94a3b8;
  }

  .switch-input {
    width: 18px;
    height: 18px;
    accent-color: #0284c7;
    cursor: pointer;
  }

  .field-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
  }

  .field-row label {
    font-size: 13px;
    color: #cbd5e1;
  }

  .field-row select {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #f1f5f9;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 13px;
  }

  /* Touch Zones Diagram */
  .touch-zones-diagram {
    display: flex;
    height: 160px;
    border: 2px dashed rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    overflow: hidden;
  }

  .zone {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 10px;
    text-align: center;
    border-right: 1px dashed rgba(255, 255, 255, 0.15);
  }

  .zone:last-child {
    border-right: none;
  }

  .zone span {
    font-size: 11px;
    color: #94a3b8;
  }

  .zone strong {
    font-size: 13px;
    color: #38bdf8;
    margin-top: 4px;
  }

  /* Shortcuts Table */
  .shortcuts-table {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    font-size: 13px;
  }

  kbd {
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.2);
    padding: 2px 7px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 11px;
    color: #38bdf8;
  }

  /* Font Cards */
  .font-picker-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .font-card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 12px;
    cursor: pointer;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: all 0.2s;
  }

  .font-card:hover {
    border-color: #38bdf8;
  }

  .font-card.active {
    border-color: #0284c7;
    background: rgba(2, 132, 199, 0.12);
  }

  .font-serif .font-sample {
    font-family: 'Merriweather', 'Georgia', serif;
  }

  .font-sans .font-sample {
    font-family: system-ui, sans-serif;
  }

  .font-literata .font-sample {
    font-family: 'Literata', 'Georgia', serif;
  }

  .font-mono .font-sample {
    font-family: monospace;
  }

  .font-sample {
    font-size: 14px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .font-name {
    font-size: 11px;
    color: #94a3b8;
  }

  .reset-defaults-btn {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
    font-size: 13px;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .reset-defaults-btn:hover {
    background: rgba(239, 68, 68, 0.25);
  }

  /* Footer */
  .dialog-footer {
    height: 56px;
    background: #111827;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding: 0 20px;
  }

  .calibre-btn {
    padding: 8px 18px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
  }

  .calibre-btn.cancel {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #cbd5e1;
  }

  .calibre-btn.cancel:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .calibre-btn.primary {
    background: #0284c7;
    border: none;
    color: #fff;
    box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4);
  }

  .calibre-btn.primary:hover {
    background: #0369a1;
  }
</style>
