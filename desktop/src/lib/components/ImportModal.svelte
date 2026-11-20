<script lang="ts">
  import { appState } from '../stores/appState.svelte';
  import type { ImportedEbook } from '../importer/types';
  import { convertImportedToNovel } from '../importer';
  import {
    X,
    Upload,
    BookOpen,
    FileText,
    CheckCircle2,
    Layers,
    Tag,
    User,
    Sparkles,
    Trash2
  } from '@lucide/svelte';

  interface Props {
    ebooks: ImportedEbook[];
    onClose: () => void;
  }

  let { ebooks = $bindable([]), onClose }: Props = $props();

  function removeItem(index: number) {
    ebooks = ebooks.filter((_, i) => i !== index);
    if (ebooks.length === 0) {
      onClose();
    }
  }

  async function handleImportAll() {
    if (ebooks.length === 0) return;

    let importedCount = 0;
    for (const eb of ebooks) {
      const { novel, chapters, comicPages } = convertImportedToNovel(eb);
      await appState.addImportedNovel(novel, chapters, comicPages);
      importedCount++;
    }

    appState.showToast(`Đã nhập thành công ${importedCount} tác phẩm vào Thư viện!`, 'success');
    onClose();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="modal-backdrop" onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()} role="button" tabindex="0">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="import-modal-panel" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
    <header class="modal-header">
      <div class="header-left">
        <div class="icon-bubble">
          <Upload size={18} />
        </div>
        <div>
          <h3>Xác nhận nhập sách vào Thư viện</h3>
          <p class="header-sub">
            Đã nhận diện {ebooks.length} tệp ebook. Kiểm tra thông tin trước khi lưu vào Thư viện.
          </p>
        </div>
      </div>
      <button class="close-btn" onclick={onClose} title="Đóng">
        <X size={18} />
      </button>
    </header>

    <div class="modal-body custom-scrollbar">
      {#each ebooks as item, idx}
        <div class="ebook-preview-card">
          <img src={item.coverUrl} alt={item.title} class="preview-cover" />

          <div class="preview-info">
            <div class="preview-top-row">
              <span class="format-pill {item.format}">{item.format.toUpperCase()}</span>
              <span class="file-size-pill">
                {(item.fileSize / (1024 * 1024)).toFixed(2)} MB
              </span>
              <button
                class="remove-btn"
                onclick={() => removeItem(idx)}
                title="Bỏ qua tệp này"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div class="form-row">
              <label for="book-title-{idx}">Tiêu đề sách</label>
              <input
                id="book-title-{idx}"
                type="text"
                bind:value={item.title}
                class="form-input"
              />
            </div>

            <div class="form-cols">
              <div class="form-row">
                <label for="book-author-{idx}"><User size={12} /> Tác giả</label>
                <input
                  id="book-author-{idx}"
                  type="text"
                  bind:value={item.author}
                  class="form-input"
                />
              </div>

              <div class="form-row">
                <label for="book-chaps-{idx}"><Layers size={12} /> Số chương nhận diện</label>
                <input
                  id="book-chaps-{idx}"
                  type="text"
                  readonly
                  value="{item.totalChapters} chương"
                  class="form-input readonly"
                />
              </div>
            </div>

            {#if item.genres && item.genres.length > 0}
              <div class="genre-tags">
                {#each item.genres as g}
                  <span class="genre-tag"><Tag size={10} /> {g}</span>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <footer class="modal-footer">
      <button class="btn-secondary" onclick={onClose}>
        Hủy bỏ
      </button>
      <button class="btn-primary" onclick={handleImportAll}>
        <CheckCircle2 size={16} />
        Thêm tất cả vào Thư viện ({ebooks.length} sách)
      </button>
    </footer>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(4, 7, 14, 0.78);
    backdrop-filter: blur(8px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    animation: fadeIn 0.2s ease-out;
  }

  .import-modal-panel {
    background: #0d1524;
    border: 1px solid rgba(0, 210, 255, 0.2);
    border-radius: 16px;
    width: 100%;
    max-width: 680px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65), 0 0 40px rgba(0, 210, 255, 0.1);
    animation: zoomIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    overflow: hidden;
  }

  .modal-header {
    padding: 20px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .icon-bubble {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: rgba(0, 210, 255, 0.12);
    border: 1px solid rgba(0, 210, 255, 0.3);
    color: #00d2ff;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: #f1f5f9;
  }

  .header-sub {
    margin: 2px 0 0 0;
    font-size: 12px;
    color: #94a3b8;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.06);
  }

  .modal-body {
    padding: 20px 24px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .ebook-preview-card {
    display: flex;
    gap: 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    padding: 14px;
    transition: border-color 0.2s;
  }

  .ebook-preview-card:hover {
    border-color: rgba(0, 210, 255, 0.25);
  }

  .preview-cover {
    width: 80px;
    height: 114px;
    object-fit: cover;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    background: #1e293b;
    flex-shrink: 0;
  }

  .preview-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .preview-top-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .format-pill {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 6px;
    text-transform: uppercase;
    background: rgba(0, 210, 255, 0.15);
    color: #00d2ff;
    border: 1px solid rgba(0, 210, 255, 0.3);
  }

  .format-pill.epub {
    background: rgba(52, 211, 153, 0.15);
    color: #34d399;
    border-color: rgba(52, 211, 153, 0.3);
  }

  .format-pill.txt {
    background: rgba(251, 191, 36, 0.15);
    color: #fbbf24;
    border-color: rgba(251, 191, 36, 0.3);
  }

  .format-pill.mobi, .format-pill.azw, .format-pill.azw3 {
    background: rgba(167, 139, 250, 0.15);
    color: #a78bfa;
    border-color: rgba(167, 139, 250, 0.3);
  }

  .file-size-pill {
    font-size: 11px;
    color: #64748b;
  }

  .remove-btn {
    margin-left: auto;
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .remove-btn:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .form-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .form-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .form-row label {
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .form-input {
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #f1f5f9;
    font-size: 13px;
    padding: 6px 10px;
    border-radius: 6px;
    outline: none;
    transition: border-color 0.2s;
  }

  .form-input:focus {
    border-color: #00d2ff;
  }

  .form-input.readonly {
    color: #64748b;
    cursor: default;
    background: rgba(15, 23, 42, 0.4);
  }

  .genre-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 2px;
  }

  .genre-tag {
    font-size: 10px;
    padding: 2px 7px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    color: #cbd5e1;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .modal-footer {
    padding: 16px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #f1f5f9;
  }

  .btn-primary {
    background: linear-gradient(135deg, #00d2ff 0%, #0099ff 100%);
    border: none;
    color: #040714;
    padding: 8px 18px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 14px rgba(0, 210, 255, 0.35);
    transition: all 0.2s;
  }

  .btn-primary:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes zoomIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
</style>
