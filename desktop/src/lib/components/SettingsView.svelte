<script lang="ts">
  import { appState } from '../stores/appState.svelte';
  import {
    Network,
    HardDrive,
    Palette,
    Shield,
    Folder,
    Check,
    Cpu,
    Key
  } from '@lucide/svelte';

  let activeSection = $state<'network' | 'storage' | 'appearance' | 'license'>('network');

  const accentPresets = [
    { name: 'Neon Cyan', color: '#00D2FF' },
    { name: 'Neon Pink', color: '#FF2E93' },
    { name: 'Emerald', color: '#10B981' },
    { name: 'Electric Purple', color: '#8B5CF6' },
    { name: 'Sunset Amber', color: '#F59E0B' }
  ];

  function saveSettings() {
    appState.showToast('Đã lưu các thiết lập cấu hình hệ thống!', 'success');
  }

  function activateLicense() {
    if (!appState.settings.licenseKey?.trim()) {
      appState.showToast('Vui lòng nhập mã bản quyền hợp lệ', 'error');
      return;
    }
    appState.settings.isPremium = true;
    appState.showToast('Xác thực bản quyền thành công! Đã kích hoạt Premium Pro.', 'success');
  }
</script>

<div class="settings-view">
  <!-- Settings Vertical Tabs -->
  <aside class="settings-nav">
    <h3 class="nav-heading">Cấu hình ứng dụng</h3>
    <button
      class="nav-tab-btn"
      class:active={activeSection === 'network'}
      onclick={() => (activeSection = 'network')}
    >
      <Network size={16} /> Mạng & Proxy
    </button>
    <button
      class="nav-tab-btn"
      class:active={activeSection === 'storage'}
      onclick={() => (activeSection = 'storage')}
    >
      <HardDrive size={16} /> Lưu trữ & Thư mục
    </button>
    <button
      class="nav-tab-btn"
      class:active={activeSection === 'appearance'}
      onclick={() => (activeSection = 'appearance')}
    >
      <Palette size={16} /> Giao diện & Màu sắc
    </button>
    <button
      class="nav-tab-btn"
      class:active={activeSection === 'license'}
      onclick={() => (activeSection = 'license')}
    >
      <Shield size={16} /> Bản quyền & DRM
    </button>
  </aside>

  <!-- Settings Body Content -->
  <div class="settings-content">
    {#if activeSection === 'network'}
      <div class="settings-section">
        <h2 class="section-title">Cấu hình mạng & Chống chặn IP</h2>
        <p class="section-desc">Tinh chỉnh các tham số kết nối để tối ưu tốc độ cào và hạn chế việc bị chặn IP từ Cloudflare.</p>

        <div class="settings-card">
          <div class="field-row">
            <div class="field-info">
              <label for="concurrency-range" class="field-label">Số luồng tải đồng thời (Concurrency)</label>
              <span class="field-help">Số chương được tải song song cùng lúc (Khuyên dùng: 3 - 6)</span>
            </div>
            <div class="field-control">
              <input
                id="concurrency-range"
                type="number"
                min="1"
                max="16"
                bind:value={appState.settings.concurrency}
                class="num-input"
              />
            </div>
          </div>

          <div class="field-row">
            <div class="field-info">
              <label for="delay-input" class="field-label">Thời gian trễ cố định (Request Delay)</label>
              <span class="field-help">Khoảng nghỉ giữa các request (mili-giây)</span>
            </div>
            <div class="field-control">
              <input
                id="delay-input"
                type="number"
                min="0"
                max="5000"
                step="50"
                bind:value={appState.settings.requestDelayMs}
                class="num-input"
              />
              <span class="unit-text">ms</span>
            </div>
          </div>

          <div class="field-row">
            <div class="field-info">
              <label for="jitter-input" class="field-label">Độ trễ ngẫu nhiên (Jitter Delay)</label>
              <span class="field-help">Mô phỏng hành vi lướt web tự nhiên của con người để tránh bị nhận diện bot</span>
            </div>
            <div class="field-control">
              <input
                id="jitter-input"
                type="number"
                min="0"
                max="2000"
                step="50"
                bind:value={appState.settings.jitterDelayMs}
                class="num-input"
              />
              <span class="unit-text">ms</span>
            </div>
          </div>

          <div class="field-row column">
            <div class="field-info">
              <label for="ua-input" class="field-label">User-Agent Header</label>
              <span class="field-help">Chuỗi định danh trình duyệt gửi kèm trong mỗi request</span>
            </div>
            <input id="ua-input" type="text" bind:value={appState.settings.userAgent} class="full-input" />
          </div>

          <div class="field-row column">
            <div class="field-info">
              <label for="proxy-input" class="field-label">Proxy (HTTP / SOCKS5)</label>
              <span class="field-help">Ví dụ: socks5://127.0.0.1:1080 hoặc http://user:pass@proxy.com:8080</span>
            </div>
            <input
              id="proxy-input"
              type="text"
              placeholder="Để trống nếu không dùng proxy"
              bind:value={appState.settings.proxyUrl}
              class="full-input"
            />
          </div>
        </div>
      </div>
    {:else if activeSection === 'storage'}
      <div class="settings-section">
        <h2 class="section-title">Quản lý Lưu trữ & Dữ liệu Cục bộ</h2>
        <p class="section-desc">Cấu hình thư mục lưu file truyện (.epub, .docx, .txt) và vị trí cơ sở dữ liệu SQLite.</p>

        <div class="settings-card">
          <div class="field-row column">
            <div class="field-info">
              <label for="storage-path-input" class="field-label">Thư mục Thư viện Truyện</label>
              <span class="field-help">Tất cả các định dạng xuất bản và ảnh bìa sẽ được tự động chuẩn hóa tại đây</span>
            </div>
            <div class="path-picker-row">
              <input id="storage-path-input" type="text" bind:value={appState.settings.storagePath} class="full-input" />
              <button class="browse-btn" onclick={() => appState.showToast('Mở cửa sổ chọn thư mục...', 'info')}>
                <Folder size={16} /> Chọn thư mục
              </button>
            </div>
          </div>
        </div>
      </div>
    {:else if activeSection === 'appearance'}
      <div class="settings-section">
        <h2 class="section-title">Cá nhân hóa Giao diện</h2>
        <p class="section-desc">Thay đổi màu nhấn (Accent Color) để đồng bộ lên các nút bấm, viền và thanh tiến trình.</p>

        <div class="settings-card">
          <div class="field-row column">
            <div class="field-info">
              <span class="field-label">Màu nhấn chủ đạo (Accent Color - Premium)</span>
              <span class="field-help">Chọn một trong các bảng màu neon bên dưới</span>
            </div>
            <div class="color-presets">
              {#each accentPresets as preset}
                <button
                  class="color-preset-btn"
                  class:active={appState.settings.accentColor === preset.color}
                  style="--clr: {preset.color};"
                  onclick={() => {
                    appState.settings.accentColor = preset.color;
                    document.documentElement.style.setProperty('--accent-cyan', preset.color);
                    appState.showToast(`Đã đổi màu nhấn sang: ${preset.name}`, 'info');
                  }}
                >
                  <span class="color-dot"></span>
                  <span class="preset-name">{preset.name}</span>
                  {#if appState.settings.accentColor === preset.color}
                    <Check size={14} class="check-icon" />
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        </div>
      </div>
    {:else if activeSection === 'license'}
      <div class="settings-section">
        <h2 class="section-title">Bản quyền phần mềm & Khóa thiết bị (DRM)</h2>
        <p class="section-desc">Quản lý giấy phép kích hoạt các tính năng độc quyền (Dịch AI Local, Audio TTS, Auto-Tracker).</p>

        <div class="settings-card">
          <div class="field-row column">
            <div class="field-info">
              <span class="field-label">Mã định danh phần cứng (Hardware ID)</span>
              <span class="field-help">Tự động sinh từ CPU và bo mạch chủ thông qua `machine-uid`</span>
            </div>
            <div class="hwid-box">
              <Cpu size={16} class="cyan-icon" />
              <code>HWID-NS-7F89-B42A-9901-WINDOWS-X64</code>
            </div>
          </div>

          <div class="field-row column">
            <div class="field-info">
              <label for="license-input" class="field-label">Mã bản quyền (License Key)</label>
              <span class="field-help">Nhập key bạn nhận được khi đăng ký tài khoản Premium</span>
            </div>
            <div class="path-picker-row">
              <input
                id="license-input"
                type="text"
                placeholder="PRO-XXXX-XXXX-XXXX"
                bind:value={appState.settings.licenseKey}
                class="full-input"
              />
              <button class="activate-btn" onclick={activateLicense}>
                <Key size={15} /> Kích hoạt
              </button>
            </div>
          </div>

          <div class="field-row">
            <div class="field-info">
              <span class="field-label">Phiên bản phần mềm</span>
              <span class="field-help">Novel Scraper Desktop Pro v1.3.0 (Bản phát hành chính thức)</span>
            </div>
            <div class="field-control">
              <button class="activate-btn" onclick={() => appState.openWhatsNew()}>
                Xem nhật ký cập nhật v1.3
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Bottom Save Button -->
    <div class="save-footer">
      <button class="main-save-btn" onclick={saveSettings}>
        Lưu tất cả thay đổi
      </button>
    </div>
  </div>
</div>

<style>
  .settings-view {
    display: flex;
    height: 100%;
    overflow: hidden;
  }

  .settings-nav {
    width: 240px;
    background-color: var(--bg-sidebar);
    border-right: var(--border-subtle);
    padding: 24px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex-shrink: 0;
  }

  .nav-heading {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--text-dim);
    margin-bottom: 12px;
    padding-left: 10px;
  }

  .nav-tab-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: var(--radius-md);
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 500;
    text-align: left;
  }

  .nav-tab-btn:hover {
    color: var(--text-main);
    background-color: rgba(255, 255, 255, 0.04);
  }

  .nav-tab-btn.active {
    color: var(--accent-cyan);
    background-color: rgba(0, 210, 255, 0.08);
    font-weight: 600;
  }

  .settings-content {
    flex: 1;
    overflow-y: auto;
    padding: 28px 36px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .section-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-main);
    margin-bottom: 6px;
  }

  .section-desc {
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 20px;
    line-height: 1.5;
  }

  .settings-card {
    background-color: var(--bg-card);
    border: var(--border-card);
    border-radius: var(--radius-lg);
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .field-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  .field-row.column {
    flex-direction: column;
    align-items: flex-start;
  }

  .field-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field-label {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--text-main);
  }

  .field-help {
    font-size: 11.5px;
    color: var(--text-muted);
  }

  .field-control {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .num-input {
    width: 80px;
    height: 38px;
    text-align: center;
    font-size: 13.5px;
    font-weight: 600;
    background-color: #161b29;
  }

  .unit-text {
    font-size: 12px;
    color: var(--text-muted);
  }

  .full-input {
    width: 100%;
    height: 40px;
    padding: 0 14px;
    font-size: 13px;
    background-color: #161b29;
  }

  .path-picker-row {
    display: flex;
    gap: 10px;
    width: 100%;
  }

  .browse-btn, .activate-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 16px;
    background-color: rgba(255, 255, 255, 0.08);
    color: var(--text-main);
    border-radius: var(--radius-md);
    font-size: 12.5px;
    font-weight: 600;
    white-space: nowrap;
    height: 40px;
  }

  .activate-btn {
    background: linear-gradient(135deg, #00d2ff, #00b4db);
    color: #0b1320;
  }

  .color-presets {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
    width: 100%;
    margin-top: 6px;
  }

  .color-preset-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: var(--radius-md);
    background-color: #161b29;
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: var(--text-main);
    font-size: 12px;
    font-weight: 600;
  }

  .color-preset-btn:hover {
    border-color: var(--clr);
  }

  .color-preset-btn.active {
    border-color: var(--clr);
    background-color: rgba(255, 255, 255, 0.05);
  }

  .color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: var(--clr);
    box-shadow: 0 0 6px var(--clr);
  }

  .hwid-box {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: var(--radius-md);
    background-color: #161b29;
    border: var(--border-subtle);
    font-family: monospace;
    font-size: 13px;
    color: var(--accent-cyan);
    width: 100%;
  }

  .save-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: auto;
    padding-top: 16px;
  }

  .main-save-btn {
    padding: 10px 24px;
    background: linear-gradient(135deg, #00d2ff, #00b4db);
    color: #0b1320;
    font-size: 13px;
    font-weight: 700;
    border-radius: var(--radius-md);
    box-shadow: 0 4px 14px rgba(0, 210, 255, 0.3);
  }
</style>
