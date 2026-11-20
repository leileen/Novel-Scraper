<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { t } from '../lib/i18n';
  import { db } from '../lib/db';
  import { crawler } from '../lib/crawler';
  import { exportNovel } from '../lib/exporter';
  import { getSettings, saveSettings } from '../lib/storage/settings';
  import type { Novel, Chapter, ExportFormat, AppSettings } from '../lib/types';
  import { 
    Book, 
    BookOpen,
    Trash2, 
    Search,
    CheckCircle2,
    Loader2
  } from '@lucide/svelte';
  import OfflineReader from './OfflineReader.svelte';

  let { settings } = $props<{ settings?: AppSettings }>();

  let novels = $state<Novel[]>([]);
  let searchQuery = $state('');
  let isLoading = $state(true);
  let selectedReadingNovel = $state<Novel | null>(null);

  // Export options & status
  let omitChapterTitles = $state<boolean>(false);
  let isExporting = $state(false);
  let exportingNovelId = $state<number | null>(null);
  let exportingFormat = $state<ExportFormat | null>(null);
  let toastMessage = $state('');
  let toastTimeout: ReturnType<typeof setTimeout> | null = null;

  function showToast(msg: string) {
    toastMessage = msg;
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastMessage = '';
    }, 3200);
  }

  let unsubscribeCrawler: (() => void) | null = null;

  onDestroy(() => {
    if (unsubscribeCrawler) unsubscribeCrawler();
    if (toastTimeout) clearTimeout(toastTimeout);
  });

  onMount(async () => {
    omitChapterTitles = settings?.omitChapterTitles ?? false;
    await loadNovels();
    unsubscribeCrawler = crawler.subscribe((event) => {
      const target = novels.find((n) => n.id === event.novelId);
      if (target) {
        if (event.downloadedChapters !== undefined) {
          target.downloadedChapters = event.downloadedChapters;
        }
        if (event.totalChapters) {
          target.totalChapters = event.totalChapters;
        }
        target.status = event.status;
      }
    });
  });

  $effect(() => {
    if (settings && settings.omitChapterTitles !== undefined) {
      omitChapterTitles = settings.omitChapterTitles;
    }
  });

  async function toggleOmitChapterTitles() {
    omitChapterTitles = !omitChapterTitles;
    if (settings) {
      settings.omitChapterTitles = omitChapterTitles;
      await saveSettings(settings);
    } else {
      const s = await getSettings();
      s.omitChapterTitles = omitChapterTitles;
      await saveSettings(s);
    }
    showToast(
      omitChapterTitles
        ? 'Đã BẬT bỏ dòng đánh số chương khi xuất file'
        : 'Đã TẮT bỏ dòng đánh số chương khi xuất file'
    );
  }

  async function loadNovels() {
    isLoading = true;
    novels = await db.novels.orderBy('updatedAt').reverse().toArray();
    isLoading = false;
  }

  const filteredNovels = $derived(
    novels.filter((n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.sourceUrl.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  async function handleQuickExport(novel: Novel, format: ExportFormat) {
    if (!novel.id) return;
    if (isExporting) return;

    const chapters = await db.chapters
      .where('novelId')
      .equals(novel.id)
      .and((c) => c.status === 'completed' || c.status === 'locked')
      .sortBy('chapterNumber');

    if (chapters.length === 0) {
      showToast('Truyện này chưa có chương nào được tải.');
      return;
    }

    try {
      isExporting = true;
      exportingNovelId = novel.id;
      exportingFormat = format;
      showToast(`Đang xuất file ${format.toUpperCase()}${omitChapterTitles ? ' (bỏ số chương)' : ''}...`);

      await exportNovel(novel, chapters, format, 0, { omitChapterTitles });
      showToast(`Đã xuất file ${format.toUpperCase()} thành công!`);
    } catch (err) {
      console.error('Export error:', err);
      showToast(`Lỗi xuất file: ${(err as Error).message}`);
    } finally {
      isExporting = false;
      exportingNovelId = null;
      exportingFormat = null;
    }
  }

  async function handleDeleteNovel(novel: Novel) {
    if (!novel.id) return;
    if (confirm(`Bạn có chắc muốn xóa truyện "${novel.title}" và toàn bộ chương đã tải?`)) {
      await db.chapters.where('novelId').equals(novel.id).delete();
      await db.novels.delete(novel.id);
      await loadNovels();
    }
  }
</script>

{#if selectedReadingNovel}
  <OfflineReader 
    novel={selectedReadingNovel} 
    onClose={() => {
      selectedReadingNovel = null;
      loadNovels();
    }} 
  />
{/if}

<div class="library-container">
  {#if toastMessage}
    <div class="toast-notification">
      <CheckCircle2 size={13} class="icon-toast" />
      <span class="toast-text">{toastMessage}</span>
    </div>
  {/if}

  <!-- Unified Liquid Glass Search & Omit-Chapter-Title Switch Bar -->
  <div class="library-header">
    <div class="search-box">
      <Search size={12} class="search-icon" />
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Tìm truyện ({novels.length})..."
        class="search-input"
      />
      {#if searchQuery}
        <button class="search-clear" onclick={() => searchQuery = ''}>✕</button>
      {/if}
    </div>

    <button
      type="button"
      class="omit-pill-switch"
      class:active={omitChapterTitles}
      onclick={toggleOmitChapterTitles}
      title="Loại bỏ dòng đánh số chương (Chương 1, 2...) khi xuất file DOCX, PDF, TXT, EPUB"
    >
      <span class="switch-dot"></span>
      <span>Bỏ số chương</span>
    </button>
  </div>

  <!-- Novel List -->
  {#if isLoading}
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Đang tải thư viện...</span>
    </div>
  {:else if filteredNovels.length === 0}
    <div class="empty-library glass-panel">
      <div class="empty-icon-wrap">
        <Book size={28} />
      </div>
      <p class="empty-title">{t('noNovels')}</p>
      <p class="empty-sub">Hãy cào truyện từ các website để đọc hoặc xuất file tại đây.</p>
    </div>
  {:else}
    <div class="novels-list">
      {#each filteredNovels as novel (novel.id)}
        {@const completedCount = novel.downloadedChapters || 0}
        {@const totalCount = novel.totalChapters || 0}
        {@const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}

        <div class="novel-card glass-panel">
          <div class="card-main">
            <!-- Liquid Gradient 03 Book Spine / Cover Thumbnail -->
            <div class="novel-spine" class:has-cover={Boolean(novel.coverUrl)}>
              {#if novel.coverUrl}
                <img src={novel.coverUrl} alt={novel.title} class="spine-cover-img" />
              {:else}
                <span class="spine-text">{novel.title}</span>
              {/if}
              <span class="spine-num font-mono">{totalCount} CH</span>
            </div>

            <!-- Novel Info -->
            <div class="novel-info">
              <div class="info-top">
                <h4 class="novel-name" title={novel.title}>{novel.title}</h4>
                <button class="btn-delete" onclick={() => handleDeleteNovel(novel)} title="Xóa truyện">
                  <Trash2 size={12} />
                </button>
              </div>

              <div class="meta-row">
                <span class="domain-tag font-mono">
                  {novel.sourceUrl.replace(/^https?:\/\//, '').split('/')[0]}
                </span>
                <span class="progress-label font-mono">{completedCount}/{totalCount} ch ({percent}%)</span>
              </div>

              <!-- Liquid Progress Bar -->
              <div class="bar-track">
                <div class="bar-fill" style="width: {percent}%;"></div>
              </div>
            </div>
          </div>

          <!-- Streamlined Liquid Glass Footer -->
          <div class="card-footer">
            <button 
              class="read-now-btn" 
              onclick={() => (selectedReadingNovel = novel)}
              title="Đọc ngoại tuyến ngay trong Side Panel"
            >
              <BookOpen size={11} />
              <span>Đọc ngay</span>
            </button>

            <div class="export-pills-well">
              {#each (['docx', 'pdf', 'txt', 'epub'] as const) as fmt}
                <button 
                  class="mini-fmt" 
                  disabled={isExporting && exportingNovelId === novel.id}
                  onclick={() => handleQuickExport(novel, fmt)}
                  title={omitChapterTitles ? `Xuất ${fmt.toUpperCase()} (Đã bỏ dòng số chương)` : `Xuất ${fmt.toUpperCase()}`}
                >
                  {#if isExporting && exportingNovelId === novel.id && exportingFormat === fmt}
                    <Loader2 size={10} class="spin" />
                  {:else}
                    {fmt.toUpperCase()}
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .library-container {
    padding: 6px 14px 24px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .font-mono {
    font-family: var(--font-mono);
  }

  .library-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .search-box {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 7px;
    background: var(--surface-input);
    border: 1px solid var(--border-glass);
    box-shadow: var(--liquid-inner-shadow);
    border-radius: var(--radius-full);
    padding: 6px 11px;
    transition: all 0.2s ease;
  }

  .search-box:focus-within {
    border-color: var(--border-glass-accent);
    box-shadow: var(--liquid-inner-shadow), var(--glow-cyan-sm);
  }

  .search-icon {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 11px;
    outline: none;
    min-width: 0;
  }

  .search-clear {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 10px;
    cursor: pointer;
  }

  /* Liquid Pill Switch for Omitting Chapter Numbers */
  .omit-pill-switch {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 11px;
    border-radius: var(--radius-full);
    background: var(--surface-glass-card);
    border: 1px solid var(--border-glass);
    box-shadow: var(--liquid-inner-shadow);
    color: var(--text-secondary);
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .omit-pill-switch:hover {
    background: var(--surface-glass-hover);
    color: var(--text-primary);
    border-color: var(--border-glass-accent);
  }

  .omit-pill-switch.active {
    background: rgba(167, 118, 147, 0.24);
    border-color: var(--border-glass-accent);
    color: var(--text-primary);
  }

  .switch-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--text-muted);
    transition: all 0.2s ease;
  }

  .omit-pill-switch.active .switch-dot {
    background: var(--accent-success);
    box-shadow: 0 0 6px var(--accent-success);
  }

  .novels-list {
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .novel-card {
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: all 0.2s ease;
  }

  .novel-card:hover {
    border-color: var(--border-glass-accent);
    background: var(--surface-glass-hover);
    transform: translateY(-1px);
  }

  .card-main {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .novel-spine {
    width: 38px;
    height: 52px;
    border-radius: 10px;
    background: var(--gradient-03-vivid);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 4px 3.5px;
    flex-shrink: 0;
    box-shadow: var(--liquid-pill-shadow);
    border: 1px solid rgba(255, 255, 255, 0.38);
    position: relative;
    overflow: hidden;
  }

  .novel-spine.has-cover {
    padding: 0;
    justify-content: flex-end;
  }

  .spine-cover-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .novel-spine.has-cover .spine-num {
    position: relative;
    z-index: 1;
    margin: 0 2.5px 2.5px 2.5px;
    background: rgba(10, 18, 32, 0.78);
    backdrop-filter: blur(4px);
  }

  .spine-text {
    font-size: 6.5px;
    font-weight: 800;
    color: #FFFFFF;
    line-height: 1.1;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .spine-num {
    background: rgba(10, 18, 32, 0.45);
    border-radius: 5px;
    font-size: 6.5px;
    font-weight: 700;
    color: #FFFFFF;
    text-align: center;
    padding: 1px 0;
  }

  .novel-info {
    flex: 1;
    min-width: 0;
  }

  .info-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .novel-name {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    margin: 0;
  }

  .btn-delete {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px;
    transition: color 0.15s;
    flex-shrink: 0;
  }

  .btn-delete:hover {
    color: var(--accent-error);
  }

  .meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 3px;
    margin-bottom: 5px;
  }

  .domain-tag {
    font-size: 9.5px;
    color: var(--text-muted);
  }

  .progress-label {
    font-size: 9.5px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .bar-track {
    width: 100%;
    height: 4.5px;
    border-radius: var(--radius-full);
    background: var(--surface-pill-well);
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: var(--radius-full);
    background: var(--gradient-03-horizontal);
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--border-subtle);
  }

  .read-now-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 11px;
    border-radius: var(--radius-full);
    background: var(--gradient-03-vivid);
    border: 1px solid rgba(255, 255, 255, 0.35);
    box-shadow: var(--liquid-pill-shadow);
    color: #FFFFFF;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .read-now-btn:hover {
    filter: brightness(1.08);
    transform: translateY(-0.5px);
  }

  .export-pills-well {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 2px;
    border-radius: var(--radius-full);
    background: var(--surface-pill-well);
    border: 1px solid var(--border-subtle);
  }

  .mini-fmt {
    padding: 3px 7px;
    border-radius: var(--radius-full);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    font-size: 9.5px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mini-fmt:hover:not(:disabled) {
    background: var(--capsule-cream);
    color: var(--capsule-cream-text);
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
  }

  .mini-fmt:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Toast Notification */
  .toast-notification {
    position: fixed;
    bottom: 16px;
    left: 14px;
    right: 14px;
    background: rgba(18, 28, 46, 0.9);
    border: 1px solid var(--border-glass-strong);
    box-shadow: var(--liquid-pill-shadow);
    border-radius: var(--radius-full);
    padding: 7px 14px;
    display: flex;
    align-items: center;
    gap: 7px;
    color: #FFFFFF;
    font-size: 11px;
    font-weight: 600;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    z-index: 1000;
    animation: toast-in 0.22s ease-out;
  }

  [data-theme="light"] .toast-notification {
    background: rgba(255, 255, 255, 0.92);
    color: var(--text-primary);
    border-color: var(--border-glass-accent);
  }

  .icon-toast {
    flex-shrink: 0;
  }

  .toast-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @keyframes toast-in {
    from { transform: translateY(8px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .empty-library {
    text-align: center;
    padding: 36px 16px;
    border-style: dashed;
  }

  .empty-icon-wrap {
    margin-bottom: 8px;
    opacity: 0.45;
    display: flex;
    justify-content: center;
    color: var(--grad-rose-bright);
  }

  .empty-title {
    font-weight: 700;
    color: var(--text-primary);
  }

  .empty-sub {
    font-size: 10.5px;
    color: var(--text-muted);
    margin-top: 4px;
  }

  .loading-state {
    text-align: center;
    padding: 36px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--text-muted);
    font-size: 11px;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(167, 118, 147, 0.25);
    border-top-color: #A77693;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .spin {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
