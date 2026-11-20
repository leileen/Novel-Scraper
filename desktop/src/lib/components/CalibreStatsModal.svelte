<script lang="ts">
  import { appState } from '../stores/appState.svelte';
  import { Hourglass, BookOpen, Clock, FileText, CheckCircle2, TrendingUp, X } from '@lucide/svelte';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  const novel = $derived(appState.activeReaderNovel);
  const currentChapter = $derived(appState.currentChapter);
  const chapters = $derived(novel ? appState.getNovelChapters(novel.id) : []);

  const totalWordsInChapter = $derived(
    (currentChapter.content || '').split(/\s+/).filter(Boolean).length
  );
  const avgReadingSpeedWPM = 250; // Vietnamese reading speed
  const minutesInChapter = $derived(Math.max(1, Math.ceil(totalWordsInChapter / avgReadingSpeedWPM)));

  const totalChapters = $derived(chapters.length || novel?.totalChapters || 1);
  const currentIdx = $derived(currentChapter.index || 1);
  const chaptersRemaining = $derived(Math.max(0, totalChapters - currentIdx));
  const estimatedHoursRemaining = $derived(
    ((chaptersRemaining * 2000) / avgReadingSpeedWPM / 60).toFixed(1)
  );
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="modal-backdrop" onclick={onClose} role="button" tabindex="0">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="stats-card" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
    <header class="stats-header">
      <div class="title-with-icon">
        <Hourglass size={18} class="cyan-icon" />
        <h4>Reading Statistics (Thống kê đọc)</h4>
      </div>
      <button class="close-btn" onclick={onClose}>
        <X size={16} />
      </button>
    </header>

    <div class="stats-body">
      <div class="stat-highlight">
        <span class="highlight-val">{novel?.readingProgress || 1}%</span>
        <span class="highlight-label">Tiến độ hoàn thành toàn bộ tác phẩm</span>
      </div>

      <div class="stats-grid">
        <div class="stat-box">
          <BookOpen size={16} class="cyan-icon" />
          <div class="stat-data">
            <strong>Chương {currentIdx} / {totalChapters}</strong>
            <span>Vị trí chương hiện tại</span>
          </div>
        </div>

        <div class="stat-box">
          <FileText size={16} class="cyan-icon" />
          <div class="stat-data">
            <strong>~{totalWordsInChapter.toLocaleString()} từ</strong>
            <span>Độ dài chương đang đọc</span>
          </div>
        </div>

        <div class="stat-box">
          <Clock size={16} class="cyan-icon" />
          <div class="stat-data">
            <strong>~{minutesInChapter} phút</strong>
            <span>Thời gian đọc chương này</span>
          </div>
        </div>

        <div class="stat-box">
          <TrendingUp size={16} class="cyan-icon" />
          <div class="stat-data">
            <strong>~{estimatedHoursRemaining} giờ</strong>
            <span>Ước tính để đọc xong truyện</span>
          </div>
        </div>
      </div>
    </div>

    <footer class="stats-footer">
      <button class="calibre-btn primary" onclick={onClose}>
        <CheckCircle2 size={15} />
        <span>Đã hiểu</span>
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
    backdrop-filter: blur(4px);
    z-index: 2100;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .stats-card {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    width: 460px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
    color: #f1f5f9;
    overflow: hidden;
  }

  .stats-header {
    height: 50px;
    background: #0f172a;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 18px;
  }

  .title-with-icon {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cyan-icon {
    color: #38bdf8;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
  }

  .close-btn:hover {
    color: #fff;
  }

  .stats-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .stat-highlight {
    background: linear-gradient(135deg, rgba(2, 132, 199, 0.2), rgba(14, 165, 233, 0.08));
    border: 1px solid rgba(56, 189, 248, 0.3);
    border-radius: 8px;
    padding: 16px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .highlight-val {
    font-size: 36px;
    font-weight: 700;
    color: #38bdf8;
  }

  .highlight-label {
    font-size: 12px;
    color: #94a3b8;
    margin-top: 2px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .stat-box {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 12px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .stat-data {
    display: flex;
    flex-direction: column;
  }

  .stat-data strong {
    font-size: 14px;
    color: #f1f5f9;
  }

  .stat-data span {
    font-size: 11px;
    color: #94a3b8;
    margin-top: 2px;
  }

  .stats-footer {
    height: 52px;
    background: #0f172a;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0 18px;
  }

  .calibre-btn.primary {
    background: #0284c7;
    border: none;
    color: #fff;
    padding: 6px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
</style>
