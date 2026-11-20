<script lang="ts">
  import { t, setLanguage } from '../lib/i18n';
  import { db } from '../lib/db';
  import { saveSettings, DEFAULT_AD_KEYWORDS, normalizeAdKeywords, normalizeCustomReplacements } from '../lib/storage/settings';
  import { exportDatabaseBackup, downloadBackupFile, restoreDatabaseBackup } from '../lib/storage/backup';
  import type { AppSettings } from '../lib/types';
  import { Save, RotateCcw, Check, Download, Upload, Trash2 } from '@lucide/svelte';

  let { 
    settings = $bindable(), 
    onSettingsUpdated 
  } = $props<{
    settings: AppSettings;
    onSettingsUpdated: (updated: AppSettings) => void;
  }>();

  let keywordsText = $state(normalizeAdKeywords(settings?.adKeywords).join('\n'));
  let savedSuccess = $state(false);
  let fileInputEl = $state<HTMLInputElement | null>(null);

  let replacementsText = $state(
    normalizeCustomReplacements(settings?.customReplacements)
      .map((r) => `${r.from} => ${r.to || ''}`)
      .join('\n')
  );

  let deobfuscateEnabled = $state(settings?.deobfuscateText !== false);

  async function handleSave() {
    const lines = keywordsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const parsedReplacements = replacementsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const parts = l.split('=>');
        return {
          from: parts[0]?.trim() || '',
          to: parts[1]?.trim() || ''
        };
      })
      .filter((r) => r.from.length > 0);

    const updated: AppSettings = {
      ...settings,
      adKeywords: lines,
      deobfuscateText: deobfuscateEnabled,
      customReplacements: parsedReplacements
    };

    await saveSettings(updated);
    settings = updated;
    onSettingsUpdated(updated);

    savedSuccess = true;
    setTimeout(() => {
      savedSuccess = false;
    }, 2000);
  }

  function handleResetKeywords() {
    keywordsText = DEFAULT_AD_KEYWORDS.join('\n');
  }

  async function handleBackupDownload() {
    try {
      const json = await exportDatabaseBackup();
      downloadBackupFile(json);
    } catch (err) {
      alert(`Lỗi khi tạo bản sao lưu: ${(err as Error).message}`);
    }
  }

  async function handleFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const content = reader.result as string;
        const res = await restoreDatabaseBackup(content);
        alert(`Khôi phục thành công!\n- Tiểu thuyết: ${res.novelsCount} bộ\n- Chương: ${res.chaptersCount} chương\n- Luật trang: ${res.rulesCount} quy tắc.`);
        location.reload();
      } catch (err) {
        alert(`Lỗi khôi phục: ${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
  }

  async function handleWipeAllData() {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ danh sách truyện và chương đã lưu? Các thiết lập cài đặt sẽ được giữ nguyên.')) {
      await db.chapters.clear();
      await db.novels.clear();
      alert('Đã xóa sạch toàn bộ dữ liệu truyện và chương!');
      window.location.reload();
    }
  }
</script>

<div class="settings-container">
  <!-- Appearance & Polite Crawling Unified Card -->
  <div class="glass-card section-card">
    <h4 class="section-title">Giao diện & Tốc độ cào</h4>

    <div class="setting-row">
      <span class="setting-label">{t('language')}</span>
      <div class="segmented-well">
        <button
          class="seg-pill"
          class:active={settings.language === 'vi'}
          onclick={() => {
            settings.language = 'vi';
            setLanguage('vi');
            handleSave();
          }}
        >
          Tiếng Việt
        </button>
        <button
          class="seg-pill"
          class:active={settings.language === 'en'}
          onclick={() => {
            settings.language = 'en';
            setLanguage('en');
            handleSave();
          }}
        >
          English
        </button>
      </div>
    </div>

    <div class="setting-row">
      <span class="setting-label">Chủ đề</span>
      <div class="segmented-well">
        <button
          class="seg-pill"
          class:active={settings.theme === 'dark'}
          onclick={() => {
            settings.theme = 'dark';
            handleSave();
          }}
        >
          {t('darkMode')}
        </button>
        <button
          class="seg-pill"
          class:active={settings.theme === 'light'}
          onclick={() => {
            settings.theme = 'light';
            handleSave();
          }}
        >
          {t('lightMode')}
        </button>
      </div>
    </div>

    <div class="setting-row">
      <span class="setting-label">Độ trễ giữa các chương (giây)</span>
      <div class="delay-inputs">
        <input
          type="number"
          step="0.5"
          min="0.5"
          max="10"
          class="number-input"
          bind:value={settings.politeDelayMin}
          title="Tối thiểu"
        />
        <span class="delay-sep">–</span>
        <input
          type="number"
          step="0.5"
          min="1"
          max="20"
          class="number-input"
          bind:value={settings.politeDelayMax}
          title="Tối đa"
        />
      </div>
    </div>
  </div>

  <!-- Processing & Export Switches Card -->
  <div class="glass-card section-card">
    <h4 class="section-title">Xử lý văn bản & Xuất file</h4>

    <label class="liquid-toggle-row">
      <div class="toggle-info">
        <span class="toggle-title">Bỏ dòng đánh số chương khi xuất</span>
        <span class="toggle-sub">Tự động xóa các dòng "Chương 1, 2..." trong file tải về</span>
      </div>
      <input
        type="checkbox"
        class="liquid-checkbox"
        bind:checked={settings.omitChapterTitles}
        onchange={handleSave}
      />
    </label>

    <label class="liquid-toggle-row">
      <div class="toggle-info">
        <span class="toggle-title">Giải mã từ né kiểm duyệt</span>
        <span class="toggle-sub">Khôi phục chữ bị chèn ký tự (vd: g/h/e/n &rarr; ghen)</span>
      </div>
      <input
        type="checkbox"
        class="liquid-checkbox"
        bind:checked={deobfuscateEnabled}
        onchange={handleSave}
      />
    </label>
  </div>

  <!-- Filter & Replace Card -->
  <div class="glass-card section-card">
    <div class="card-top-header">
      <h4 class="section-title">{t('adKeywords')}</h4>
      <button class="text-btn" onclick={handleResetKeywords} title="Khôi phục mặc định">
        <RotateCcw size={10} />
        <span>Mặc định</span>
      </button>
    </div>
    <textarea
      class="keywords-textarea"
      bind:value={keywordsText}
      rows={3}
      placeholder="Mỗi dòng 1 cụm từ quảng cáo cần xóa..."
    ></textarea>

    <h4 class="section-title mt-1">Thay thế từ tùy chỉnh (từ_cũ => từ_mới)</h4>
    <textarea
      class="keywords-textarea"
      bind:value={replacementsText}
      rows={3}
      placeholder="truyencv => &#10;Tiêu Viêm => Tiêu Viêm Ca"
    ></textarea>
  </div>

  <!-- Backup & Restore Database Section -->
  <div class="glass-card section-card">
    <h4 class="section-title">Dữ liệu & Sao lưu</h4>
    <div class="backup-actions">
      <button class="btn-capsule" onclick={handleBackupDownload}>
        <Download size={12} />
        <span>Sao lưu (.json)</span>
      </button>

      <button class="btn-capsule" onclick={() => fileInputEl?.click()}>
        <Upload size={12} />
        <span>Khôi phục</span>
      </button>

      <button class="btn-capsule danger" onclick={handleWipeAllData} title="Xóa toàn bộ truyện đã lưu">
        <Trash2 size={12} />
        <span>Xóa kho</span>
      </button>
      <input 
        type="file" 
        bind:this={fileInputEl} 
        onchange={handleFileSelected} 
        accept=".json" 
        style="display: none;" 
      />
    </div>
  </div>

  <!-- Save Button -->
  <button class="btn-capsule electric save-btn" onclick={handleSave}>
    {#if savedSuccess}
      <Check size={13} />
      <span>Đã lưu cài đặt!</span>
    {:else}
      <Save size={13} />
      <span>Lưu cấu hình</span>
    {/if}
  </button>
</div>

<style>
  .settings-container {
    padding: 6px 14px 24px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-card {
    display: flex;
    flex-direction: column;
    gap: 9px;
    padding: 11px 13px;
  }

  .card-top-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .section-title {
    font-size: 11.5px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .mt-1 {
    margin-top: 3px;
  }

  .setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
  }

  .setting-label {
    color: var(--text-secondary);
    font-weight: 500;
  }

  .segmented-well {
    display: inline-flex;
    gap: 2px;
    padding: 2.5px;
    border-radius: var(--radius-full);
    background: var(--surface-pill-well);
    border: 1px solid var(--border-subtle);
  }

  .seg-pill {
    padding: 3px 10px;
    border-radius: var(--radius-full);
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .seg-pill.active {
    background: var(--gradient-03-vivid);
    color: #FFFFFF;
    box-shadow: var(--liquid-pill-shadow);
  }

  .delay-inputs {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .delay-sep {
    color: var(--text-muted);
  }

  .number-input {
    width: 48px;
    background: var(--surface-input);
    border: 1px solid var(--border-glass);
    box-shadow: var(--liquid-inner-shadow);
    border-radius: var(--radius-full);
    padding: 3px 6px;
    color: var(--text-primary);
    font-size: 11px;
    font-family: var(--font-mono);
    text-align: center;
    outline: none;
  }

  .liquid-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 6px 9px;
    border-radius: var(--radius-sm);
    background: var(--surface-pill-well);
    border: 1px solid var(--border-subtle);
    cursor: pointer;
  }

  .toggle-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .toggle-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .toggle-sub {
    font-size: 9.5px;
    color: var(--text-muted);
  }

  .liquid-checkbox {
    accent-color: #A77693;
    width: 14px;
    height: 14px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .text-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 600;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
  }

  .text-btn:hover {
    color: var(--text-primary);
  }

  .keywords-textarea {
    width: 100%;
    background: var(--surface-input);
    border: 1px solid var(--border-glass);
    box-shadow: var(--liquid-inner-shadow);
    border-radius: var(--radius-sm);
    padding: 7px 10px;
    color: var(--text-primary);
    font-size: 11px;
    font-family: inherit;
    line-height: 1.45;
    outline: none;
    resize: vertical;
  }

  .keywords-textarea:focus {
    border-color: var(--border-glass-accent);
  }

  .backup-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .btn-capsule.danger {
    color: var(--accent-error);
    border-color: rgba(242, 116, 116, 0.35);
  }

  .btn-capsule.danger:hover {
    background: rgba(242, 116, 116, 0.14);
  }

  .save-btn {
    width: 100%;
    padding: 9px 16px;
    font-size: 12px;
  }
</style>
