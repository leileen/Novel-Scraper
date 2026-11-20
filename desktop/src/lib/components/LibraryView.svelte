<script lang="ts">
  import { appState } from '../stores/appState.svelte';
  import { exportNovel } from '../exporter';
  import { parseEbookFile, type ImportedEbook } from '../importer';
  import ImportModal from './ImportModal.svelte';
  import type { LibraryFilter, Novel, ExportFormat, Chapter } from '../types';
  import {
    Search,
    LayoutGrid,
    List,
    BookOpen,
    Star,
    CheckCircle2,
    RefreshCw,
    Download,
    Trash2,
    CheckSquare,
    Square,
    Upload,
    Tag,
    Globe,
    Filter,
    X,
    RotateCcw,
    Layers,
    User,
    FileText,
    Sparkles
  } from '@lucide/svelte';

  let selectedNovelIds = $state<Set<string>>(new Set());
  let fileInputEl = $state<HTMLInputElement | null>(null);
  let isDraggingOver = $state(false);
  let isParsingImport = $state(false);
  let importPreviewEbooks = $state<ImportedEbook[]>([]);

  // Multi-dimensional Filter Computation
  const allGenres = $derived(appState.getAllGenres());
  const allDomains = $derived(appState.getAllDomains());

  const hasActiveFilters = $derived(
    appState.libraryFilter !== 'all' ||
    appState.libraryGenreFilter !== 'all' ||
    appState.libraryProgressFilter !== 'all' ||
    appState.libraryDomainFilter !== 'all' ||
    appState.librarySearchQuery.trim().length > 0
  );

  // Media Categories Counts
  const novelCount = $derived(appState.novels.filter(n => (n.contentType || (n.isImported ? 'book' : 'novel')) === 'novel').length);
  const bookCount = $derived(appState.novels.filter(n => (n.contentType || (n.isImported ? 'book' : 'novel')) === 'book').length);
  const comicCount = $derived(appState.novels.filter(n => n.contentType === 'comic').length);
  const allCount = $derived(appState.novels.length);

  const filteredNovels = $derived(
    appState.novels.filter(novel => {
      // 0. High-level Media Category Filter
      if (appState.libraryMediaCategory !== 'all') {
        const cat = novel.contentType || (novel.isImported ? 'book' : 'novel');
        if (cat !== appState.libraryMediaCategory) return false;
      }
      // 1. Status Filter Tab
      if (appState.libraryFilter === 'reading' && novel.status !== 'reading') return false;
      if (appState.libraryFilter === 'favorite' && novel.status !== 'favorite') return false;
      if (appState.libraryFilter === 'completed' && novel.status !== 'completed') return false;
      if (appState.libraryFilter === 'needs_update' && novel.status !== 'needs_update') return false;

      // 2. Genre Filter
      if (appState.libraryGenreFilter !== 'all') {
        const hasGenre = Array.isArray(novel.genres) && novel.genres.includes(appState.libraryGenreFilter);
        if (!hasGenre) return false;
      }

      // 3. Reading Progress Filter
      const prog = novel.readingProgress || 0;
      if (appState.libraryProgressFilter === 'unread' && prog !== 0) return false;
      if (appState.libraryProgressFilter === 'starting' && (prog <= 0 || prog > 25)) return false;
      if (appState.libraryProgressFilter === 'reading' && (prog <= 25 || prog > 75)) return false;
      if (appState.libraryProgressFilter === 'nearly_done' && (prog <= 75 || prog >= 100)) return false;
      if (appState.libraryProgressFilter === 'completed' && prog < 100) return false;

      // 4. Source Domain Filter
      if (appState.libraryDomainFilter !== 'all') {
        if (novel.sourceDomain !== appState.libraryDomainFilter) return false;
      }

      // 5. Search query
      if (appState.librarySearchQuery.trim()) {
        const query = appState.librarySearchQuery.toLowerCase();
        const matchesTitle = novel.title.toLowerCase().includes(query);
        const matchesAuthor = (novel.author || '').toLowerCase().includes(query);
        const matchesDomain = (novel.sourceDomain || '').toLowerCase().includes(query);
        const matchesGenre = Array.isArray(novel.genres) && novel.genres.some(g => g.toLowerCase().includes(query));
        if (!matchesTitle && !matchesAuthor && !matchesDomain && !matchesGenre) return false;
      }

      return true;
    })
  );

  function resetAllFilters() {
    appState.libraryFilter = 'all';
    appState.libraryGenreFilter = 'all';
    appState.libraryProgressFilter = 'all';
    appState.libraryDomainFilter = 'all';
    appState.librarySearchQuery = '';
  }

  // Handle Drag & Drop Files
  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDraggingOver = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    isDraggingOver = false;
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDraggingOver = false;
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      await processSelectedFiles(Array.from(e.dataTransfer.files));
    }
  }

  async function handleFileInputChange(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      await processSelectedFiles(Array.from(target.files));
      target.value = '';
    }
  }

  async function processSelectedFiles(files: File[]) {
    isParsingImport = true;
    appState.showToast(`Đang phân tích cấu trúc ${files.length} tệp ebook...`, 'info');
    const parsedList: ImportedEbook[] = [];

    try {
      for (const file of files) {
        try {
          const ebook = await parseEbookFile(file);
          parsedList.push(ebook);
        } catch (err) {
          appState.showToast(`Lỗi giải mã "${file.name}": ${(err as Error).message}`, 'error');
        }
      }

      if (parsedList.length > 0) {
        importPreviewEbooks = parsedList;
      }
    } finally {
      isParsingImport = false;
    }
  }

  function toggleSelect(id: string, event: MouseEvent) {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      event.stopPropagation();
      const updated = new Set(selectedNovelIds);
      if (updated.has(id)) {
        updated.delete(id);
      } else {
        updated.add(id);
      }
      selectedNovelIds = updated;
    } else {
      const novel = appState.novels.find(n => n.id === id);
      if (novel) {
        appState.selectedNovel = novel;
      }
    }
  }

  function selectAll() {
    if (selectedNovelIds.size === filteredNovels.length) {
      selectedNovelIds = new Set();
    } else {
      selectedNovelIds = new Set(filteredNovels.map(n => n.id));
    }
  }

  async function bulkExport(format: ExportFormat) {
    const selectedList = appState.novels.filter(n => selectedNovelIds.has(n.id));
    appState.showToast(`Đang xuất ${selectedList.length} truyện ra định dạng .${format}...`, 'info');
    try {
      for (const novel of selectedList) {
        const realChaps = appState.getNovelChapters(novel.id);
        const chaptersToExport: Chapter[] =
          realChaps.length > 0
            ? realChaps
            : [
                {
                  id: `ch-1`,
                  novelId: novel.id,
                  chapterNumber: 1,
                  title: `Chương 1: Khởi đầu`,
                  url: novel.sourceUrl,
                  content: `Mở đầu bộ truyện ${novel.title}.\n\nTác giả: ${novel.author || 'Đang cập nhật'}`,
                  wordCount: 500,
                  status: 'completed'
                }
              ];
        await exportNovel(novel, chaptersToExport, format);
      }
      appState.showToast(`Đã xuất thành công ${selectedList.length} bộ truyện!`, 'success');
      selectedNovelIds = new Set();
    } catch (err) {
      appState.showToast(`Lỗi xuất file: ${(err as Error).message}`, 'error');
    }
  }

  async function bulkDelete() {
    const list = Array.from(selectedNovelIds);
    await appState.deleteNovels(list);
    selectedNovelIds = new Set();
  }
</script>

<!-- Drag and Drop Dropzone Target -->
<div
  class="library-view"
  class:dragging-over={isDraggingOver}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  role="region"
  aria-label="Thư viện tiểu thuyết"
>
  <!-- Hidden File Input for Import -->
  <input
    type="file"
    bind:this={fileInputEl}
    onchange={handleFileInputChange}
    multiple
    accept=".epub,.txt,.mobi,.azw,.azw3,.prc,.docx,.pdf,.fb2,.json,.zip,.cbz,.cbr"
    style="display: none;"
  />

  <!-- High-Level Media Categories Bar (Tất cả, Tiểu thuyết, Sách chữ, Truyện tranh) -->
  <div class="media-category-bar">
    <button
      class="media-tab"
      class:active={appState.libraryMediaCategory === 'all'}
      onclick={() => (appState.libraryMediaCategory = 'all')}
    >
      <Layers size={14} />
      <span>Tất cả</span>
      <span class="media-pill">{allCount}</span>
    </button>
    <button
      class="media-tab"
      class:active={appState.libraryMediaCategory === 'novel'}
      onclick={() => (appState.libraryMediaCategory = 'novel')}
    >
      <BookOpen size={14} />
      <span>Tiểu thuyết</span>
      <span class="media-pill novel-pill">{novelCount}</span>
    </button>
    <button
      class="media-tab"
      class:active={appState.libraryMediaCategory === 'book'}
      onclick={() => (appState.libraryMediaCategory = 'book')}
    >
      <FileText size={14} />
      <span>Sách chữ</span>
      <span class="media-pill book-pill">{bookCount}</span>
    </button>
    <button
      class="media-tab comic-tab"
      class:active={appState.libraryMediaCategory === 'comic'}
      onclick={() => (appState.libraryMediaCategory = 'comic')}
    >
      <Sparkles size={14} />
      <span>Truyện tranh</span>
      <span class="media-pill comic-pill">{comicCount}</span>
    </button>
  </div>

  <!-- Top Control Bar (Search, Status Tabs, Import Button, View Mode) -->
  <div class="library-top-bar">
    <div class="search-box">
      <Search size={16} class="search-icon" />
      <input
        type="text"
        placeholder="Tìm kiếm truyện, tác giả, thể loại... (Ctrl+F)"
        bind:value={appState.librarySearchQuery}
      />
      {#if appState.librarySearchQuery}
        <button class="clear-search-btn" onclick={() => (appState.librarySearchQuery = '')}>
          <X size={14} />
        </button>
      {/if}
    </div>

    <!-- Status Filter Tabs -->
    <div class="filter-tabs">
      <button
        class="filter-tab"
        class:active={appState.libraryFilter === 'all'}
        onclick={() => (appState.libraryFilter = 'all')}
      >
        Tất cả ({appState.novels.length})
      </button>
      <button
        class="filter-tab"
        class:active={appState.libraryFilter === 'reading'}
        onclick={() => (appState.libraryFilter = 'reading')}
      >
        Đang đọc
      </button>
      <button
        class="filter-tab"
        class:active={appState.libraryFilter === 'favorite'}
        onclick={() => (appState.libraryFilter = 'favorite')}
      >
        Yêu thích
      </button>
      <button
        class="filter-tab"
        class:active={appState.libraryFilter === 'completed'}
        onclick={() => (appState.libraryFilter = 'completed')}
      >
        Đã xong
      </button>
      <button
        class="filter-tab"
        class:active={appState.libraryFilter === 'needs_update'}
        onclick={() => (appState.libraryFilter = 'needs_update')}
      >
        Cần cập nhật
      </button>
    </div>

    <!-- Import Ebook Button -->
    <button
      class="import-book-btn"
      onclick={() => fileInputEl?.click()}
      disabled={isParsingImport}
      title="Nhập sách từ máy tính (EPUB, TXT, MOBI, AZW, DOCX, PDF, FB2...)"
    >
      <Upload size={15} />
      <span>{isParsingImport ? 'Đang đọc...' : 'Nhập sách'}</span>
    </button>

    <!-- View Mode Switch -->
    <div class="view-mode-toggle">
      <button
        class="mode-btn"
        class:active={appState.libraryViewMode === 'grid'}
        onclick={() => (appState.libraryViewMode = 'grid')}
        title="Hiển thị dạng lưới"
      >
        <LayoutGrid size={16} />
      </button>
      <button
        class="mode-btn"
        class:active={appState.libraryViewMode === 'list'}
        onclick={() => (appState.libraryViewMode = 'list')}
        title="Hiển thị dạng danh sách"
      >
        <List size={16} />
      </button>
    </div>
  </div>

  <!-- Multi-Dimensional Filter Bar (Genres, % Progress, Source Domain, Reset) -->
  <div class="multi-filter-bar">
    <!-- Genre Chips List -->
    <div class="genre-chips-container custom-scrollbar-x">
      <button
        class="genre-chip"
        class:active={appState.libraryGenreFilter === 'all'}
        onclick={() => (appState.libraryGenreFilter = 'all')}
      >
        Tất cả thể loại
      </button>
      {#each allGenres as genre}
        {@const count = appState.novels.filter(n => n.genres?.includes(genre)).length}
        <button
          class="genre-chip"
          class:active={appState.libraryGenreFilter === genre}
          onclick={() => (appState.libraryGenreFilter = genre)}
        >
          {genre} ({count})
        </button>
      {/each}
    </div>

    <!-- Secondary Dropdowns (Progress & Domain) -->
    <div class="filter-dropdowns">
      <!-- Progress Filter -->
      <select
        class="filter-select"
        bind:value={appState.libraryProgressFilter}
        aria-label="Lọc theo tiến độ đọc"
      >
        <option value="all">Mọi tiến độ đọc</option>
        <option value="unread">Chưa đọc (0%)</option>
        <option value="starting">Mới bắt đầu (1 - 25%)</option>
        <option value="reading">Đang đọc dở (26 - 75%)</option>
        <option value="nearly_done">Sắp xong (> 75%)</option>
        <option value="completed">Đã xong (100%)</option>
      </select>

      <!-- Source Domain Filter -->
      <select
        class="filter-select"
        bind:value={appState.libraryDomainFilter}
        aria-label="Lọc theo nguồn truyện"
      >
        <option value="all">Mọi nguồn truyện</option>
        {#each allDomains as domain}
          {@const dCount = appState.novels.filter(n => n.sourceDomain === domain).length}
          <option value={domain}>{domain} ({dCount})</option>
        {/each}
      </select>

      <!-- Reset Filter Button -->
      {#if hasActiveFilters}
        <button class="reset-filter-btn" onclick={resetAllFilters} title="Khôi phục toàn bộ bộ lọc">
          <RotateCcw size={13} />
          <span>Đặt lại</span>
        </button>
      {/if}
    </div>
  </div>

  <!-- Drag-and-drop overlay hint -->
  {#if isDraggingOver}
    <div class="drag-drop-overlay">
      <div class="drag-drop-box">
        <Upload size={48} class="bounce-icon" />
        <h3>Thả tệp vào đây để nhập sách ngay</h3>
        <p>Hỗ trợ EPUB, TXT, MOBI, AZW, AZW3, DOCX, PDF, FB2, JSON/ZIP</p>
      </div>
    </div>
  {/if}

  <!-- Novel Grid / List Container -->
  <div class="library-content">
    {#if filteredNovels.length === 0}
      <div class="empty-state">
        <BookOpen size={48} class="empty-icon" />
        <h3>Không tìm thấy bộ truyện nào</h3>
        <p>Thử đổi tiêu chí lọc hoặc bấm <strong>Nhập sách</strong> / kéo thả tệp ebook vào đây để đọc ngay.</p>
        {#if hasActiveFilters}
          <button class="empty-action-btn" onclick={resetAllFilters}>
            <RotateCcw size={14} /> Đặt lại bộ lọc
          </button>
        {/if}
      </div>
    {:else if appState.libraryViewMode === 'grid'}
      <!-- Fluid Grid with Refined 2:3 Cards & Micro-animations -->
      <div class="novels-grid">
        {#each filteredNovels as novel (novel.id)}
          {@const isSelected = selectedNovelIds.has(novel.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="novel-card"
            class:selected={isSelected}
            onclick={(e) => toggleSelect(novel.id, e)}
            role="button"
            tabindex="0"
          >
            <!-- Checkbox badge when multi-selecting -->
            <div class="card-select-handle" class:visible={selectedNovelIds.size > 0 || isSelected}>
              {#if isSelected}
                <CheckSquare size={16} class="check-icon selected" />
              {:else}
                <Square size={16} class="check-icon" />
              {/if}
            </div>

            <div class="cover-container">
              <img src={novel.coverUrl} alt={novel.title} class="novel-cover" loading="lazy" />

              <!-- Content-Type Badge (Top-Left) -->
              {#if novel.contentType === 'comic'}
                <span class="cover-type-badge comic-type">🎨 Truyện tranh</span>
              {:else if novel.contentType === 'book'}
                <span class="cover-type-badge book-type">📖 Sách chữ</span>
              {/if}

              <!-- Source / Imported Badge (Top-Right) -->
              {#if novel.sourceDomain}
                <span class="cover-source-badge" title={novel.sourceDomain}>
                  <Globe size={10} />
                  {novel.sourceDomain.replace(/\.com\.vn|\.vn|\.net/i, '')}
                </span>
              {/if}

              <!-- Chapters / Pages Count Badge (Bottom-Right) -->
              <span class="cover-badge" title={novel.contentType === 'comic' ? 'Số trang truyện' : 'Số chương hiện có'}>
                <Layers size={10} />
                {#if novel.contentType === 'comic'}
                  {novel.totalComicPages || novel.totalChapters} trang
                {:else}
                  {novel.downloadedChapters}{novel.totalPublishedChapters && novel.totalPublishedChapters > novel.downloadedChapters ? ` / ${novel.totalPublishedChapters}` : ''} ch
                {/if}
              </span>

              <!-- Read Progress Bar (Bottom) -->
              <div class="cover-progress-track">
                <div class="cover-progress-fill" style="width: {novel.readingProgress || 0}%;"></div>
              </div>
            </div>

            <div class="novel-info">
              <h4 class="novel-title truncate-2" title={novel.title}>{novel.title}</h4>
              <p class="novel-author truncate">
                <User size={12} class="inline-icon" />
                {novel.author || 'Đang cập nhật'}
              </p>

              <!-- Genres Row -->
              {#if novel.genres && novel.genres.length > 0}
                <div class="card-genres">
                  {#each novel.genres.slice(0, 2) as g}
                    <span class="card-genre-pill">{g}</span>
                  {/each}
                  {#if novel.genres.length > 2}
                    <span class="card-genre-more">+{novel.genres.length - 2}</span>
                  {/if}
                </div>
              {/if}

              <div class="novel-card-footer">
                {#if novel.lastReadChapterTitle}
                  <button
                    class="novel-last-read truncate"
                    title="Đọc tiếp: {novel.lastReadChapterTitle}"
                    onclick={(e) => {
                      e.stopPropagation();
                      void appState.openReader(novel);
                    }}
                  >
                    {novel.lastReadChapterTitle}
                  </button>
                {/if}
                <button
                  class="card-read-btn"
                  title="Đọc truyện ngay"
                  onclick={(e) => {
                    e.stopPropagation();
                    void appState.openReader(novel);
                  }}
                >
                  <BookOpen size={12} /> Đọc
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <!-- Refined List View -->
      <div class="novels-list">
        {#each filteredNovels as novel (novel.id)}
          {@const isSelected = selectedNovelIds.has(novel.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="novel-list-row"
            class:selected={isSelected}
            onclick={(e) => toggleSelect(novel.id, e)}
            role="button"
            tabindex="0"
          >
            <img src={novel.coverUrl} alt={novel.title} class="list-cover" loading="lazy" />
            <div class="list-info">
              <h4 class="novel-title truncate">{novel.title}</h4>
              <p class="novel-author">
                {novel.author || 'Đang cập nhật'} • <span class="dim">{novel.sourceDomain}</span>
                {#if novel.genres && novel.genres.length > 0}
                  • <span class="genre-text">{novel.genres.slice(0, 3).join(', ')}</span>
                {/if}
              </p>
            </div>
            <div class="list-chapters">
              <span class="chaps-count">
                {#if novel.contentType === 'comic'}
                  🎨 {novel.totalComicPages || novel.totalChapters} trang
                {:else if novel.contentType === 'book'}
                  📖 {novel.downloadedChapters} chương
                {:else}
                  {novel.downloadedChapters}{novel.totalPublishedChapters && novel.totalPublishedChapters > novel.downloadedChapters ? ` / ${novel.totalPublishedChapters}` : ''} chương
                {/if}
              </span>
            </div>
            <div class="list-progress">
              <span>Đọc: {novel.readingProgress || 0}%</span>
              <div class="progress-track">
                <div class="progress-fill" style="width: {novel.readingProgress || 0}%;"></div>
              </div>
            </div>
            <div class="list-actions">
              <button
                class="row-btn"
                title="Đọc ngay"
                onclick={(e) => {
                  e.stopPropagation();
                  void appState.openReader(novel);
                }}
              >
                <BookOpen size={15} />
                <span>Đọc</span>
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Floating Bulk Action Bar -->
  {#if selectedNovelIds.size > 0}
    <div class="floating-action-bar">
      <div class="floating-info">
        <CheckSquare size={17} class="cyan-icon" />
        <span>Đã chọn <strong>{selectedNovelIds.size}</strong> bộ truyện</span>
      </div>
      <div class="floating-buttons">
        <button class="float-btn" onclick={() => bulkExport('epub')}>
          <Download size={14} /> Xuất EPUB
        </button>
        <button class="float-btn" onclick={() => bulkExport('docx')}>
          <Download size={14} /> Xuất DOCX
        </button>
        <button class="float-btn" onclick={() => bulkExport('txt')}>
          <Download size={14} /> Xuất TXT
        </button>
        <button class="float-btn danger" onclick={bulkDelete}>
          <Trash2 size={14} /> Xóa
        </button>
        <button class="float-btn close" onclick={() => (selectedNovelIds = new Set())}>
          Bỏ chọn
        </button>
      </div>
    </div>
  {/if}

  <!-- Import Modal Preview -->
  {#if importPreviewEbooks.length > 0}
    <ImportModal
      bind:ebooks={importPreviewEbooks}
      onClose={() => (importPreviewEbooks = [])}
    />
  {/if}
</div>

<style>
  .library-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--bg-main);
    overflow: hidden;
    position: relative;
  }

  .library-view.dragging-over {
    outline: 2px dashed #00d2ff;
    outline-offset: -4px;
  }

  .drag-drop-overlay {
    position: absolute;
    inset: 0;
    background: rgba(4, 7, 14, 0.88);
    backdrop-filter: blur(8px);
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    animation: fadeIn 0.15s ease-out;
  }

  .drag-drop-box {
    border: 2px dashed #00d2ff;
    border-radius: 20px;
    padding: 40px 60px;
    text-align: center;
    color: #00d2ff;
    background: rgba(0, 210, 255, 0.05);
  }

  .drag-drop-box h3 {
    margin: 14px 0 6px 0;
    font-size: 18px;
    font-weight: 700;
    color: #f1f5f9;
  }

  .drag-drop-box p {
    margin: 0;
    font-size: 13px;
    color: #94a3b8;
  }

  /* High-Level Media Categories Bar */
  .media-category-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 24px 6px 24px;
    background-color: var(--bg-surface);
  }

  .media-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .media-tab:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-main);
  }

  .media-tab.active {
    background: #0284c7;
    border-color: #38bdf8;
    color: #fff;
    box-shadow: 0 2px 10px rgba(2, 132, 199, 0.35);
  }

  .media-tab.comic-tab.active {
    background: linear-gradient(135deg, #db2777, #9333ea);
    border-color: #f472b6;
    box-shadow: 0 2px 10px rgba(219, 39, 119, 0.35);
  }

  .media-pill {
    background: rgba(0, 0, 0, 0.35);
    padding: 1px 7px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
  }

  .cover-type-badge {
    position: absolute;
    top: 8px;
    left: 8px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.3px;
    z-index: 2;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
  }

  .cover-type-badge.comic-type {
    background: linear-gradient(135deg, #ec4899, #8b5cf6);
    color: #fff;
  }

  .cover-type-badge.book-type {
    background: linear-gradient(135deg, #10b981, #06b6d4);
    color: #fff;
  }

  /* Library Top Bar */
  .library-top-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 24px 10px 24px;
    background-color: var(--bg-surface);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .search-box {
    position: relative;
    width: 320px;
  }

  .search-box input {
    width: 100%;
    padding: 8px 32px 8px 36px;
    background-color: rgba(255, 255, 255, 0.03);
    border: var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-main);
    font-size: 13px;
    outline: none;
    transition: all 0.2s;
  }

  .search-box input:focus {
    border-color: var(--accent-cyan);
    box-shadow: 0 0 10px rgba(0, 210, 255, 0.15);
  }

  :global(.search-icon) {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    pointer-events: none;
  }

  .clear-search-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
  }

  .filter-tabs {
    display: flex;
    gap: 4px;
    background-color: rgba(255, 255, 255, 0.02);
    padding: 3px;
    border-radius: var(--radius-md);
    border: var(--border-subtle);
  }

  .filter-tab {
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-size: 12.5px;
    font-weight: 500;
    transition: all 0.2s;
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .filter-tab:hover {
    color: var(--text-main);
  }

  .filter-tab.active {
    background-color: rgba(0, 210, 255, 0.12);
    color: var(--accent-cyan);
    font-weight: 600;
  }

  .import-book-btn {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 7px 14px;
    border-radius: var(--radius-md);
    background: rgba(52, 211, 153, 0.12);
    border: 1px solid rgba(52, 211, 153, 0.3);
    color: #34d399;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .import-book-btn:hover {
    background: rgba(52, 211, 153, 0.22);
    border-color: rgba(52, 211, 153, 0.5);
    transform: translateY(-1px);
  }

  .view-mode-toggle {
    display: flex;
    gap: 2px;
    background-color: rgba(255, 255, 255, 0.02);
    padding: 2px;
    border-radius: var(--radius-md);
    border: var(--border-subtle);
  }

  .mode-btn {
    padding: 6px;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
  }

  .mode-btn:hover {
    color: var(--text-main);
  }

  .mode-btn.active {
    background-color: rgba(0, 210, 255, 0.12);
    color: var(--accent-cyan);
  }

  /* Multi-Dimensional Filter Bar */
  .multi-filter-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 24px;
    background-color: rgba(13, 21, 36, 0.6);
    border-bottom: var(--border-subtle);
    backdrop-filter: blur(5px);
  }

  .genre-chips-container {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow-x: auto;
    max-width: 65%;
    padding-bottom: 2px;
  }

  .genre-chip {
    white-space: nowrap;
    font-size: 11.5px;
    font-weight: 500;
    padding: 4px 11px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s;
  }

  .genre-chip:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #f1f5f9;
  }

  .genre-chip.active {
    background: rgba(0, 210, 255, 0.15);
    border-color: rgba(0, 210, 255, 0.35);
    color: #00d2ff;
    font-weight: 600;
  }

  .filter-dropdowns {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .filter-select {
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 11.5px;
    padding: 5px 10px;
    border-radius: 6px;
    outline: none;
    cursor: pointer;
  }

  .filter-select:focus {
    border-color: #00d2ff;
  }

  .reset-filter-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: #ef4444;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .reset-filter-btn:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  /* Library Content Area */
  .library-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 70%;
    color: var(--text-muted);
    text-align: center;
  }

  .empty-state h3 {
    margin: 16px 0 8px 0;
    color: var(--text-main);
    font-size: 18px;
  }

  .empty-state p {
    font-size: 13.5px;
    max-width: 420px;
    line-height: 1.5;
    margin-bottom: 16px;
  }

  .empty-action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    background: rgba(0, 210, 255, 0.12);
    border: 1px solid rgba(0, 210, 255, 0.3);
    color: #00d2ff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  /* Refined Novels Grid */
  .novels-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(185px, 1fr));
    gap: 20px;
  }

  .novel-card {
    background-color: var(--bg-surface);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: var(--radius-lg);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
    cursor: pointer;
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
                box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1),
                border-color 0.25s ease;
  }

  .novel-card:hover {
    transform: translateY(-4px);
    border-color: rgba(0, 210, 255, 0.35);
    box-shadow: 0 14px 32px rgba(0, 0, 0, 0.45), 0 0 20px rgba(0, 210, 255, 0.12);
  }

  .novel-card.selected {
    border-color: var(--accent-cyan);
    box-shadow: 0 0 0 2px var(--accent-cyan);
  }

  .card-select-handle {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 10;
    opacity: 0;
    transition: opacity 0.2s;
    background-color: rgba(0, 0, 0, 0.65);
    border-radius: 4px;
    padding: 2px;
  }

  .novel-card:hover .card-select-handle,
  .card-select-handle.visible {
    opacity: 1;
  }

  :global(.check-icon) {
    color: var(--text-muted);
  }

  :global(.check-icon.selected) {
    color: var(--accent-cyan);
  }

  /* 2:3 Aspect Ratio Book Cover */
  .cover-container {
    position: relative;
    width: 100%;
    padding-top: 140%; /* 2:3 ratio */
    background-color: #1a2233;
    overflow: hidden;
  }

  .novel-cover {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.35s ease;
  }

  .novel-card:hover .novel-cover {
    transform: scale(1.04);
  }

  .cover-source-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    background-color: rgba(4, 7, 14, 0.78);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #94a3b8;
    font-size: 9.5px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .cover-badge {
    position: absolute;
    bottom: 8px;
    right: 8px;
    background-color: rgba(4, 7, 14, 0.82);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #e2e8f0;
    font-size: 10px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .cover-progress-track {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 3.5px;
    background-color: rgba(0, 0, 0, 0.5);
  }

  .cover-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #00d2ff 0%, #34d399 100%);
    transition: width 0.3s ease;
  }

  /* Card Info Area */
  .novel-info {
    padding: 12px;
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 5px;
  }

  .novel-title {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--text-main);
    line-height: 1.4;
    margin: 0;
  }

  .truncate-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .novel-author {
    font-size: 11.5px;
    color: var(--text-muted);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  :global(.inline-icon) {
    color: #64748b;
  }

  .card-genres {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
  }

  .card-genre-pill {
    font-size: 9.5px;
    padding: 1.5px 6px;
    border-radius: 4px;
    background: rgba(0, 210, 255, 0.08);
    border: 1px solid rgba(0, 210, 255, 0.2);
    color: #38bdf8;
    white-space: nowrap;
  }

  .card-genre-more {
    font-size: 9.5px;
    color: #64748b;
  }

  .novel-card-footer {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .novel-last-read {
    flex: 1;
    font-size: 11px;
    color: var(--accent-cyan);
    background: transparent;
    border: none;
    text-align: left;
    padding: 0;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .novel-last-read:hover {
    text-decoration: underline;
  }

  .card-read-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 6px;
    background-color: rgba(0, 210, 255, 0.1);
    color: var(--accent-cyan);
    border: 1px solid rgba(0, 210, 255, 0.25);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .card-read-btn:hover {
    background-color: var(--accent-cyan);
    color: #040714;
  }

  /* Refined List View */
  .novels-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .novel-list-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 16px;
    background-color: var(--bg-surface);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .novel-list-row:hover {
    background-color: rgba(255, 255, 255, 0.04);
    border-color: rgba(0, 210, 255, 0.25);
    transform: translateX(3px);
  }

  .novel-list-row.selected {
    border-color: var(--accent-cyan);
    background-color: rgba(0, 210, 255, 0.05);
  }

  .list-cover {
    width: 38px;
    height: 52px;
    object-fit: cover;
    border-radius: 4px;
    background-color: #1a2233;
    flex-shrink: 0;
  }

  .list-info {
    flex: 2;
    min-width: 0;
  }

  .list-info .novel-title {
    font-size: 13.5px;
    font-weight: 600;
  }

  .list-info .novel-author {
    font-size: 12px;
    color: var(--text-muted);
  }

  .dim {
    color: #64748b;
  }

  .genre-text {
    color: #38bdf8;
  }

  .list-chapters {
    font-size: 12px;
    color: #94a3b8;
    white-space: nowrap;
  }

  .list-progress {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11.5px;
    color: var(--text-muted);
  }

  .progress-track {
    width: 100%;
    height: 5px;
    background-color: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #00d2ff, #34d399);
  }

  .row-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 6px;
    background-color: rgba(0, 210, 255, 0.1);
    color: var(--accent-cyan);
    border: 1px solid rgba(0, 210, 255, 0.25);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .row-btn:hover {
    background-color: var(--accent-cyan);
    color: #040714;
  }

  /* Floating Bulk Action Bar */
  .floating-action-bar {
    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(13, 21, 36, 0.94);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0, 210, 255, 0.35);
    border-radius: 999px;
    padding: 8px 16px 8px 22px;
    display: flex;
    align-items: center;
    gap: 20px;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6), 0 0 25px rgba(0, 210, 255, 0.2);
    z-index: 100;
    animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .floating-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-main);
  }

  .floating-buttons {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .float-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-main);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .float-btn:hover {
    background: rgba(0, 210, 255, 0.15);
    border-color: rgba(0, 210, 255, 0.4);
    color: var(--accent-cyan);
  }

  .float-btn.danger {
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .float-btn.danger:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  .float-btn.close {
    color: #94a3b8;
  }

  .custom-scrollbar-x::-webkit-scrollbar {
    height: 4px;
  }

  .custom-scrollbar-x::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translate(-50%, 20px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
