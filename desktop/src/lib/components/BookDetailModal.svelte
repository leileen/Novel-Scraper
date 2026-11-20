<script lang="ts">
  import { appState } from '../stores/appState.svelte';
  import { exportNovel } from '../exporter';
  import type { ExportFormat, Chapter } from '../types';
  import {
    X,
    BookOpen,
    Download,
    RefreshCw,
    Globe,
    User,
    CheckCircle2,
    FileText,
    Search,
    LayoutGrid,
    List,
    ArrowUpDown
  } from '@lucide/svelte';

  const novel = $derived(appState.selectedNovel);
  let activeDetailTab = $state<'desc' | 'chapters'>('desc');
  let chapSearch = $state('');
  let selectedRangeIdx = $state(0);
  let viewMode = $state<'grid' | 'list'>('grid');
  let sortAsc = $state(true); // true: 1 -> N, false: N -> 1
  let quickJumpNumber = $state<number | ''>('');

  const realChapters = $derived(novel ? appState.getNovelChapters(novel.id) : []);

  const RANGE_SIZE = 100;

  // Master sorted chapters
  const sortedChapters = $derived.by(() => {
    if (!realChapters || realChapters.length === 0) return [];
    const list = [...realChapters];
    if (!sortAsc) {
      list.reverse();
    }
    return list;
  });

  // Clean, consistent pagination ranges (1-100, 101-200, 201-300...)
  const chapterRanges = $derived.by(() => {
    const total = realChapters.length;
    if (total <= RANGE_SIZE) return [];
    const list: Array<{ label: string; startIdx: number; endIdx: number }> = [];
    for (let i = 0; i < total; i += RANGE_SIZE) {
      const startIdx = i;
      const endIdx = Math.min(total - 1, i + RANGE_SIZE - 1);
      const startNum = startIdx + 1;
      const endNum = endIdx + 1;
      list.push({ label: `${startNum} - ${endNum}`, startIdx, endIdx });
    }
    return list;
  });

  const visibleChapters = $derived.by(() => {
    const q = chapSearch.trim().toLowerCase();
    if (q) {
      const filtered = realChapters.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          String(c.chapterNumber || c.index).includes(q)
      );
      return sortAsc ? filtered : [...filtered].reverse();
    }
    if (chapterRanges.length === 0) return sortedChapters;

    const range = chapterRanges[selectedRangeIdx] || chapterRanges[0];
    if (!range) return sortedChapters.slice(0, RANGE_SIZE);

    if (sortAsc) {
      return realChapters.slice(range.startIdx, range.endIdx + 1);
    } else {
      const start = selectedRangeIdx * RANGE_SIZE;
      const end = Math.min(sortedChapters.length, start + RANGE_SIZE);
      return sortedChapters.slice(start, end);
    }
  });

  function handleQuickJump(e: Event) {
    e.preventDefault();
    if (!quickJumpNumber || quickJumpNumber <= 0) return;
    const targetNum = Number(quickJumpNumber);
    const targetIdx = realChapters.findIndex(
      (c, idx) => (c.chapterNumber || c.index || idx + 1) === targetNum
    );
    if (targetIdx !== -1) {
      const rangeIdx = Math.floor(targetIdx / RANGE_SIZE);
      if (rangeIdx >= 0 && rangeIdx < chapterRanges.length) {
        selectedRangeIdx = rangeIdx;
        chapSearch = '';
      }
      appState.showToast(`Đã chuyển đến Chương ${targetNum}`, 'success');
    } else {
      const clampedIdx = Math.max(0, Math.min(realChapters.length - 1, targetNum - 1));
      selectedRangeIdx = Math.floor(clampedIdx / RANGE_SIZE);
      chapSearch = '';
    }
  }

  function closeModal() {
    appState.selectedNovel = null;
  }

  function readNow(chapterIndex?: number) {
    if (novel) {
      const targetNovel = novel;
      closeModal();
      void appState.openReader(targetNovel, chapterIndex);
    }
  }

  async function exportBook(format: ExportFormat) {
    if (!novel) return;
    appState.showToast(`Đang xuất "${novel.title}" thành file .${format}...`, 'info');
    try {
      const chaptersToExport: Chapter[] = realChapters.map((c, idx) => ({
        id: c.id || `${novel.id}-ch-${idx + 1}`,
        novelId: novel.id,
        chapterNumber: c.index || idx + 1,
        index: c.index || idx + 1,
        title: c.title,
        url: c.url,
        content:
          c.content && c.content.trim().length > 20
            ? c.content
            : `${c.title}\n\nNguồn: ${c.url}`,
        wordCount: c.wordCount || 1200,
        status: 'completed'
      }));

      await exportNovel(novel, chaptersToExport, format);
      appState.showToast(`Đã xuất file ${novel.title}.${format} thành công!`, 'success');
    } catch (err) {
      appState.showToast(`Lỗi xuất file: ${(err as Error).message}`, 'error');
    }
  }

  function checkUpdate() {
    if (!novel) return;
    appState.showToast(`Đang kiểm tra chương mới từ ${novel.sourceDomain}...`, 'info');
    setTimeout(() => {
      appState.showToast('Truyện đã ở chương mới nhất!', 'success');
    }, 1000);
  }
</script>

{#if novel}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={closeModal}>
    <div class="modal-dialog" onclick={(e) => e.stopPropagation()}>
      <!-- Close button -->
      <button class="close-btn" onclick={closeModal} title="Đóng">
        <X size={18} />
      </button>

      <!-- Book Header -->
      <div class="modal-header">
        <img src={novel.coverUrl} alt={novel.title} class="modal-cover" />
        <div class="header-details">
          <span class="detail-source">
            <Globe size={12} />
            {novel.sourceDomain}
          </span>
          <h2 class="detail-title">{novel.title}</h2>
          <div class="detail-meta">
            <span class="meta-item">
              <User size={13} /> {novel.author}
            </span>
            <span class="meta-dot">•</span>
            <span class="meta-item">
              {realChapters.length || novel.downloadedChapters}{novel.totalPublishedChapters && novel.totalPublishedChapters > (realChapters.length || novel.downloadedChapters) ? ` / ${novel.totalPublishedChapters}` : ` / ${novel.totalChapters}`} chương
            </span>
            <span class="meta-dot">•</span>
            <span class="status-tag {novel.status}">
              <CheckCircle2 size={12} />
              {novel.status === 'completed' ? 'Đã hoàn thành' : 'Đang theo dõi'}
            </span>
          </div>

          {#if novel.genres && novel.genres.length > 0}
            <div class="modal-genres-row">
              {#each novel.genres as g}
                <span class="modal-genre-tag">{g}</span>
              {/each}
            </div>
          {/if}

          <!-- Action Bar -->
          <div class="action-bar">
            <button class="action-btn primary" onclick={() => readNow()}>
              <BookOpen size={16} /> Đọc truyện ngay
            </button>
            <button class="action-btn" onclick={() => exportBook('epub')}>
              <Download size={14} /> Xuất EPUB
            </button>
            <button class="action-btn" onclick={() => exportBook('docx')}>
              <Download size={14} /> Xuất DOCX
            </button>
            <button class="action-btn" onclick={() => exportBook('txt')}>
              <FileText size={14} /> Xuất TXT
            </button>
            <button class="action-btn" onclick={() => exportBook('pdf')}>
              <Download size={14} /> Xuất PDF
            </button>
            <button class="action-btn" onclick={checkUpdate}>
              <RefreshCw size={14} /> Cập nhật chương
            </button>
          </div>
        </div>
      </div>

      <!-- Tab Headers: Mô tả / Danh sách chương -->
      <div class="modal-tabs">
        <button
          class="tab-btn"
          class:active={activeDetailTab === 'desc'}
          onclick={() => (activeDetailTab = 'desc')}
        >
          Mô tả & Tóm tắt
        </button>
        <button
          class="tab-btn"
          class:active={activeDetailTab === 'chapters'}
          onclick={() => (activeDetailTab = 'chapters')}
        >
          Danh sách chương ({realChapters.length || novel.totalChapters})
        </button>
      </div>

      <!-- Tab Content -->
      <div class="modal-body">
        {#if activeDetailTab === 'desc'}
          <div class="desc-content">
            <p>{novel.description}</p>
          </div>
        {:else}
          <div class="chapters-toolbar">
            <div class="toolbar-top-row">
              <div class="chap-search-box">
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Tìm chương theo số hoặc tên..."
                  bind:value={chapSearch}
                />
                {#if chapSearch.trim()}
                  <button class="clear-search-btn" onclick={() => (chapSearch = '')} title="Xóa tìm kiếm">
                    <X size={13} />
                  </button>
                {/if}
              </div>

              <!-- Quick Jump Form -->
              <form class="quick-jump-form" onsubmit={handleQuickJump}>
                <span class="jump-label">Đến số:</span>
                <input
                  type="number"
                  min="1"
                  max={realChapters.length || 1}
                  placeholder="#"
                  bind:value={quickJumpNumber}
                />
                <button type="submit" class="jump-btn">Đi</button>
              </form>

              <!-- Controls: Sort & View Mode -->
              <div class="toolbar-actions">
                <button
                  class="tool-btn"
                  class:active={!sortAsc}
                  onclick={() => (sortAsc = !sortAsc)}
                  title={sortAsc ? 'Đang xếp: Cũ nhất trước (1 → N). Bấm để đảo Mới nhất trước' : 'Đang xếp: Mới nhất trước (N → 1). Bấm để đảo Cũ nhất trước'}
                >
                  <ArrowUpDown size={14} />
                  <span>{sortAsc ? '1 → N' : 'N → 1'}</span>
                </button>

                <div class="view-toggle-group">
                  <button
                    class="view-btn"
                    class:active={viewMode === 'grid'}
                    onclick={() => (viewMode = 'grid')}
                    title="Hiển thị dạng lưới"
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    class="view-btn"
                    class:active={viewMode === 'list'}
                    onclick={() => (viewMode = 'list')}
                    title="Hiển thị dạng danh sách"
                  >
                    <List size={15} />
                  </button>
                </div>
              </div>
            </div>

            <!-- Ranges Pagination -->
            {#if !chapSearch.trim() && chapterRanges.length > 1}
              <div class="chap-ranges custom-scrollbar-x">
                {#each chapterRanges as range, idx}
                  <button
                    class="range-pill"
                    class:active={selectedRangeIdx === idx}
                    onclick={() => (selectedRangeIdx = idx)}
                  >
                    {range.label}
                  </button>
                {/each}
              </div>
            {/if}

            {#if chapSearch.trim()}
              <div class="search-result-hint">
                Tìm thấy <strong>{visibleChapters.length}</strong> chương phù hợp với "{chapSearch}"
              </div>
            {/if}
          </div>

          {#if visibleChapters.length === 0}
            <div class="no-chapters-found">
              Không tìm thấy chương nào phù hợp với từ khóa "{chapSearch}"
            </div>
          {:else if viewMode === 'grid'}
            <!-- Grid View: 3 responsive columns, strictly truncated, no overflow -->
            <div class="chapters-grid">
              {#each visibleChapters as chap, idx (chap.id || chap.index || idx)}
                {@const chapIndex = chap.index || chap.chapterNumber || (idx + 1)}
                {@const isCurrentRead = novel.lastReadChapterId === chap.id || novel.lastReadChapterTitle === chap.title}
                {@const isCached = Boolean(chap.content && chap.content.trim().length > 60)}
                <button
                  class="chapter-item"
                  class:current={isCurrentRead}
                  onclick={() => readNow(chapIndex)}
                  title={chap.title}
                >
                  <span class="chap-num-badge">#{chap.chapterNumber || chapIndex}</span>
                  <span class="chap-title">{chap.title}</span>
                  {#if isCurrentRead}
                    <span class="chap-read-tag">Đang đọc</span>
                  {:else if isCached}
                    <span class="chap-cached-dot" title="Đã lưu nội dung"></span>
                  {/if}
                </button>
              {/each}
            </div>
          {:else}
            <!-- List View: 1 wide column, full details -->
            <div class="chapters-list">
              {#each visibleChapters as chap, idx (chap.id || chap.index || idx)}
                {@const chapIndex = chap.index || chap.chapterNumber || (idx + 1)}
                {@const isCurrentRead = novel.lastReadChapterId === chap.id || novel.lastReadChapterTitle === chap.title}
                {@const isCached = Boolean(chap.content && chap.content.trim().length > 60)}
                <div class="chapter-list-row" class:current={isCurrentRead}>
                  <div class="list-left">
                    <span class="chap-num-badge large">#{chap.chapterNumber || chapIndex}</span>
                    <span class="chap-list-title" title={chap.title}>{chap.title}</span>
                  </div>
                  <div class="list-right">
                    {#if isCurrentRead}
                      <span class="chap-read-tag">Đang đọc</span>
                    {/if}
                    {#if isCached}
                      <span class="chap-cached-badge">
                        <CheckCircle2 size={12} /> Đã lưu
                      </span>
                    {/if}
                    {#if chap.wordCount}
                      <span class="chap-words-badge">{chap.wordCount.toLocaleString()} từ</span>
                    {/if}
                    <button class="list-read-btn" onclick={() => readNow(chapIndex)}>
                      Đọc ngay
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal-dialog {
    width: 860px;
    max-width: 94vw;
    max-height: 88vh;
    background-color: var(--bg-card);
    border: var(--border-card);
    border-radius: var(--radius-lg);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }

  .close-btn {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.08);
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .close-btn:hover {
    color: var(--text-main);
    background-color: rgba(255, 255, 255, 0.15);
  }

  .modal-header {
    display: flex;
    gap: 24px;
    padding: 24px 28px;
    background-color: #161b29;
    border-bottom: var(--border-subtle);
  }

  .modal-cover {
    width: 130px;
    height: 185px;
    object-fit: cover;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    flex-shrink: 0;
  }

  .header-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 8px;
    min-width: 0;
  }

  .detail-source {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11.5px;
    color: var(--accent-cyan);
  }

  .detail-title {
    font-size: 19px;
    font-weight: 700;
    color: var(--text-main);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .detail-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-muted);
    flex-wrap: wrap;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .meta-dot {
    color: var(--text-dim);
  }

  .status-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11.5px;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    background-color: rgba(16, 185, 129, 0.15);
    color: var(--status-success);
  }

  .modal-genres-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 2px;
  }

  .modal-genre-tag {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(0, 210, 255, 0.1);
    border: 1px solid rgba(0, 210, 255, 0.25);
    color: #38bdf8;
  }

  .action-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
    flex-wrap: wrap;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    font-size: 12.5px;
    font-weight: 600;
    border-radius: var(--radius-md);
    background-color: rgba(255, 255, 255, 0.08);
    color: var(--text-main);
    transition: all 0.15s ease;
  }

  .action-btn:hover {
    background-color: rgba(255, 255, 255, 0.15);
  }

  .action-btn.primary {
    background: linear-gradient(135deg, #00d2ff, #00b4db);
    color: #0b1320;
    box-shadow: 0 4px 12px rgba(0, 210, 255, 0.3);
  }

  .action-btn.primary:hover {
    filter: brightness(1.1);
  }

  .modal-tabs {
    display: flex;
    border-bottom: var(--border-subtle);
    padding: 0 28px;
    background-color: #192030;
  }

  .tab-btn {
    padding: 12px 18px;
    font-size: 13.5px;
    font-weight: 600;
    color: var(--text-muted);
    border-bottom: 2px solid transparent;
    transition: all 0.15s ease;
  }

  .tab-btn:hover {
    color: var(--text-main);
  }

  .tab-btn.active {
    color: var(--accent-cyan);
    border-bottom-color: var(--accent-cyan);
  }

  .modal-body {
    padding: 20px 28px;
    overflow-y: auto;
    flex: 1;
  }

  .desc-content {
    font-size: 14px;
    line-height: 1.7;
    color: #cbd5e1;
    white-space: pre-line;
  }

  /* CHAPTERS TOOLBAR */
  .chapters-toolbar {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
    position: sticky;
    top: 0;
    background-color: var(--bg-card);
    z-index: 10;
    padding-bottom: 6px;
  }

  .toolbar-top-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .chap-search-box {
    flex: 1;
    min-width: 220px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    background-color: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-md);
    color: var(--text-muted);
    transition: border-color 0.15s ease;
  }

  .chap-search-box:focus-within {
    border-color: var(--accent-cyan);
    box-shadow: 0 0 0 1px var(--accent-cyan);
  }

  .chap-search-box input {
    flex: 1;
    height: 36px;
    background: transparent;
    border: none;
    color: var(--text-main);
    font-size: 13px;
    outline: none;
  }

  .clear-search-btn {
    color: var(--text-muted);
    padding: 4px;
    border-radius: 50%;
  }

  .clear-search-btn:hover {
    color: var(--text-main);
    background: rgba(255, 255, 255, 0.1);
  }

  .quick-jump-form {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-md);
    padding: 2px 4px 2px 10px;
  }

  .jump-label {
    font-size: 11.5px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .quick-jump-form input {
    width: 60px;
    height: 30px;
    background: transparent;
    border: none;
    color: var(--text-main);
    font-size: 12.5px;
    outline: none;
  }

  .jump-btn {
    padding: 4px 10px;
    font-size: 11.5px;
    font-weight: 600;
    color: #0b1320;
    background: var(--accent-cyan);
    border-radius: var(--radius-sm);
    transition: filter 0.15s ease;
  }

  .jump-btn:hover {
    filter: brightness(1.1);
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tool-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    height: 36px;
    font-size: 12px;
    font-weight: 600;
    border-radius: var(--radius-md);
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--text-muted);
    transition: all 0.15s ease;
  }

  .tool-btn:hover {
    color: var(--text-main);
    background-color: rgba(255, 255, 255, 0.1);
  }

  .tool-btn.active {
    background-color: rgba(0, 210, 255, 0.15);
    border-color: rgba(0, 210, 255, 0.4);
    color: var(--accent-cyan);
  }

  .view-toggle-group {
    display: flex;
    align-items: center;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-md);
    padding: 2px;
    height: 36px;
  }

  .view-btn {
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    transition: all 0.15s ease;
  }

  .view-btn:hover {
    color: var(--text-main);
  }

  .view-btn.active {
    background-color: rgba(255, 255, 255, 0.12);
    color: var(--accent-cyan);
  }

  .chap-ranges {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 6px;
  }

  .range-pill {
    padding: 5px 12px;
    border-radius: var(--radius-full);
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: var(--text-muted);
    font-size: 11.5px;
    font-weight: 600;
    white-space: nowrap;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .range-pill:hover {
    color: var(--text-main);
    background-color: rgba(255, 255, 255, 0.1);
  }

  .range-pill.active {
    background: linear-gradient(135deg, #00d2ff, #00b4db);
    color: #0b1320;
    border-color: transparent;
    box-shadow: 0 2px 8px rgba(0, 210, 255, 0.3);
  }

  .search-result-hint {
    font-size: 12px;
    color: var(--text-muted);
    padding: 2px 2px;
  }

  /* CHAPTERS GRID - STRICT OVERFLOW & CLIPPING CONTROL */
  .chapters-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(235px, 1fr));
    gap: 8px;
    width: 100%;
    box-sizing: border-box;
  }

  .chapter-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background-color: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: var(--radius-sm);
    color: #cbd5e1;
    text-align: left;
    width: 100%;
    min-width: 0;
    overflow: hidden;
    box-sizing: border-box;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .chapter-item:hover {
    color: var(--accent-cyan);
    background-color: rgba(0, 210, 255, 0.08);
    border-color: rgba(0, 210, 255, 0.3);
    transform: translateY(-1px);
  }

  .chapter-item.current {
    background-color: rgba(0, 210, 255, 0.12);
    border-color: var(--accent-cyan);
    color: var(--accent-cyan);
    font-weight: 600;
  }

  .chap-num-badge {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 700;
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.25);
    padding: 1px 5px;
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  .chap-num-badge.large {
    font-size: 12px;
    padding: 3px 8px;
  }

  .chap-title {
    flex: 1;
    min-width: 0;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12.5px;
    line-height: 1.4;
  }

  .chap-read-tag {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 600;
    color: var(--accent-cyan);
    background: rgba(0, 210, 255, 0.15);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .chap-cached-dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--status-success);
  }

  /* CHAPTERS LIST VIEW - 1 WIDE COLUMN */
  .chapters-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    box-sizing: border-box;
  }

  .chapter-list-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 14px;
    background-color: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: var(--radius-sm);
    transition: all 0.15s ease;
  }

  .chapter-list-row:hover {
    background-color: rgba(0, 210, 255, 0.06);
    border-color: rgba(0, 210, 255, 0.25);
  }

  .chapter-list-row.current {
    background-color: rgba(0, 210, 255, 0.1);
    border-color: var(--accent-cyan);
  }

  .list-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .chap-list-title {
    flex: 1;
    font-size: 13.5px;
    font-weight: 500;
    color: #e2e8f0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .list-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .chap-cached-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--status-success);
    background: rgba(16, 185, 129, 0.12);
    padding: 2px 7px;
    border-radius: 4px;
  }

  .chap-words-badge {
    font-size: 11.5px;
    color: var(--text-muted);
  }

  .list-read-btn {
    padding: 5px 12px;
    font-size: 12px;
    font-weight: 600;
    color: #0b1320;
    background: var(--accent-cyan);
    border-radius: var(--radius-sm);
    transition: filter 0.15s ease;
    cursor: pointer;
  }

  .list-read-btn:hover {
    filter: brightness(1.15);
  }

  .no-chapters-found {
    padding: 40px 20px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13.5px;
  }
</style>
