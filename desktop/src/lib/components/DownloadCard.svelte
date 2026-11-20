<script lang="ts">
  import type { DownloadTask } from '../types';
  import { appState } from '../stores/appState.svelte';
  import {
    Pause,
    Play,
    Trash2,
    FolderOpen,
    RefreshCw,
    AlertCircle,
    Globe,
    CheckCircle2,
    BookOpen
  } from '@lucide/svelte';

  interface Props {
    task: DownloadTask;
  }

  let { task: initialTask }: Props = $props();
  const task = $derived(appState.downloadQueue.find(t => t.id === initialTask.id) || initialTask);

  function togglePause() {
    appState.togglePause(task.id);
  }

  function deleteTask() {
    appState.removeTask(task.id);
  }

  function openFolder() {
    appState.showToast(`Mở thư mục: ${appState.settings.storagePath}\\${task.title}`, 'info');
  }

  function retryTask() {
    appState.togglePause(task.id);
  }

  function readNovel() {
    const novel = appState.novels.find(
      (n) =>
        (task.novelId && n.id === String(task.novelId)) ||
        n.sourceUrl === task.url ||
        n.title === task.title
    );
    if (novel) {
      void appState.openReader(novel);
    } else {
      appState.activeTab = 'library';
    }
  }
</script>

<div
  class="download-card"
  class:active={task.status === 'downloading'}
  class:paused={task.status === 'paused'}
  class:queued={task.status === 'queued'}
  class:error={task.status === 'error'}
>
  <!-- Thumbnail -->
  <div class="card-thumbnail">
    {#if task.coverUrl}
      <img src={task.coverUrl} alt={task.title} class="cover-img" />
    {:else}
      <div class="cover-placeholder"></div>
    {/if}
  </div>

  <!-- Content & Info -->
  <div class="card-content">
    <div class="card-header-row">
      <h3 class="card-title truncate" title={task.title}>{task.title}</h3>
      <span class="source-tag">
        <Globe size={11} />
        {task.sourceDomain}
      </span>
    </div>

    {#if task.author || (task.genres && task.genres.length > 0)}
      <div class="card-sub-meta">
        {#if task.author}
          <span class="author-label">{task.author}</span>
        {/if}
        {#if task.genres && task.genres.length > 0}
          <span class="genres-label">• {task.genres.slice(0, 2).join(', ')}</span>
        {/if}
      </div>
    {/if}

    <!-- Stats & Progress description -->
    <div class="progress-info-row">
      {#if task.status === 'downloading'}
        <span class="progress-text">
          Đã tải: <strong>{task.downloadedChapters}</strong> / {task.totalChapters}{task.totalPublishedChapters && task.totalPublishedChapters > task.totalChapters ? ` (Công bố: ${task.totalPublishedChapters})` : ''} chương
          <span class="dot-separator">•</span>
          Tốc độ: <span class="cyan-text">{task.speed}</span>
          <span class="dot-separator">•</span>
          ({task.progressPercent}%)
        </span>
      {:else if task.status === 'paused'}
        <span class="progress-text text-paused">
          Đang tạm dừng • {task.downloadedChapters} / {task.totalChapters} chương
        </span>
      {:else if task.status === 'queued'}
        <span class="progress-text text-queued">
          Đang chờ trong hàng đợi...
        </span>
      {:else if task.status === 'completed'}
        <span class="progress-text text-success">
          <CheckCircle2 size={13} />
          Đã tải hoàn tất • {task.downloadedChapters} / {task.totalChapters} chương (100%)
        </span>
      {:else if task.status === 'error'}
        <span class="progress-text text-error">
          <AlertCircle size={13} />
          {task.errorMessage || 'Lỗi kết nối - Thử lại sau 15 giây'}
        </span>
      {/if}
    </div>

    <!-- Progress Bar -->
    <div class="progress-track">
      <div
        class="progress-fill"
        style="width: {task.progressPercent}%;"
        class:glow={task.status === 'downloading'}
        class:completed={task.status === 'completed'}
      ></div>
    </div>
  </div>

  <!-- Action Buttons -->
  <div class="card-actions">
    {#if task.status === 'downloading'}
      {#if task.totalChapters > 0}
        <button class="action-btn play" title="Đọc ngay" onclick={readNovel}>
          <BookOpen size={16} />
        </button>
      {/if}
      <button class="action-btn" title="Tạm dừng" onclick={togglePause}>
        <Pause size={16} />
      </button>
      <button class="action-btn" title="Mở thư mục lưu" onclick={openFolder}>
        <FolderOpen size={16} />
      </button>
      <button class="action-btn danger" title="Xóa tác vụ" onclick={deleteTask}>
        <Trash2 size={16} />
      </button>
    {:else if task.status === 'completed'}
      <button class="action-btn play" title="Đọc ngay" onclick={readNovel}>
        <BookOpen size={16} />
      </button>
      <button class="action-btn" title="Mở thư mục lưu" onclick={openFolder}>
        <FolderOpen size={16} />
      </button>
      <button class="action-btn danger" title="Xóa khỏi hàng đợi" onclick={deleteTask}>
        <Trash2 size={16} />
      </button>
    {:else if task.status === 'paused'}
      {#if task.totalChapters > 0}
        <button class="action-btn play" title="Đọc ngay" onclick={readNovel}>
          <BookOpen size={16} />
        </button>
      {/if}
      <button class="action-btn play" title="Tiếp tục tải" onclick={togglePause}>
        <Play size={16} />
      </button>
      <button class="action-btn danger" title="Xóa tác vụ" onclick={deleteTask}>
        <Trash2 size={16} />
      </button>
    {:else if task.status === 'queued'}
      <button class="action-btn play" title="Tải ngay" onclick={togglePause}>
        <Play size={16} />
      </button>
      <button class="action-btn danger" title="Hủy hàng đợi" onclick={deleteTask}>
        <Trash2 size={16} />
      </button>
    {:else if task.status === 'error'}
      <button class="action-btn retry" title="Thử lại" onclick={retryTask}>
        <RefreshCw size={16} />
      </button>
      <button class="action-btn danger" title="Xóa tác vụ" onclick={deleteTask}>
        <Trash2 size={16} />
      </button>
    {/if}
  </div>
</div>

<style>
  .download-card {
    display: flex;
    align-items: center;
    gap: 16px;
    background-color: var(--bg-card);
    border: var(--border-card);
    border-radius: var(--radius-lg);
    padding: 14px 18px;
    margin-bottom: 12px;
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .download-card:hover {
    background-color: var(--bg-card-hover);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .download-card.active {
    border-color: rgba(0, 210, 255, 0.2);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }

  .download-card.paused {
    opacity: 0.85;
  }

  .download-card.queued {
    opacity: 0.65;
  }

  .download-card.error {
    border-color: var(--border-error);
    background-color: rgba(239, 68, 68, 0.05);
  }

  .card-thumbnail {
    width: 48px;
    height: 64px;
    border-radius: var(--radius-sm);
    overflow: hidden;
    flex-shrink: 0;
    background-color: #273145;
    box-shadow: var(--shadow-sm);
  }

  .cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cover-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #1f293d, #111520);
  }

  .card-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .card-header-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .card-sub-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    color: var(--text-muted);
  }

  .author-label {
    color: #cbd5e1;
    font-weight: 500;
  }

  .genres-label {
    color: #38bdf8;
  }

  .card-title {
    font-size: 14.5px;
    font-weight: 600;
    color: var(--text-main);
  }

  .source-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--text-muted);
    background-color: rgba(255, 255, 255, 0.06);
    padding: 2px 8px;
    border-radius: var(--radius-full);
    border: var(--border-subtle);
    flex-shrink: 0;
  }

  .progress-info-row {
    display: flex;
    align-items: center;
  }

  .progress-text {
    font-size: 12.5px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .dot-separator {
    color: var(--text-dim);
  }

  .cyan-text {
    color: var(--accent-cyan);
    font-weight: 600;
  }

  .text-paused {
    color: var(--status-paused);
  }

  .text-success {
    color: var(--status-success);
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
  }

  .text-queued {
    color: var(--text-dim);
    font-style: italic;
  }

  .text-error {
    color: var(--status-error);
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
  }

  /* Progress track & fill */
  .progress-track {
    width: 100%;
    height: 6px;
    background-color: rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-full);
    overflow: hidden;
    margin-top: 2px;
  }

  .progress-fill {
    height: 100%;
    background-color: var(--accent-cyan);
    border-radius: var(--radius-full);
    transition: width 0.3s ease;
  }

  .progress-fill.glow {
    box-shadow: 0 0 10px var(--accent-cyan);
  }

  .progress-fill.completed {
    background-color: var(--status-success);
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
  }

  .paused .progress-fill {
    background-color: #64748b;
  }

  .error .progress-fill {
    background-color: var(--status-error);
  }

  /* Card action buttons */
  .card-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .action-btn {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    border: var(--border-subtle);
    background-color: rgba(255, 255, 255, 0.03);
    color: var(--text-muted);
  }

  .action-btn:hover {
    color: var(--text-main);
    background-color: rgba(255, 255, 255, 0.09);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .action-btn.play {
    color: var(--accent-cyan);
  }

  .action-btn.play:hover {
    background-color: rgba(0, 210, 255, 0.15);
  }

  .action-btn.retry {
    color: var(--status-warning);
  }

  .action-btn.danger:hover {
    color: var(--status-error);
    background-color: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
  }
</style>
