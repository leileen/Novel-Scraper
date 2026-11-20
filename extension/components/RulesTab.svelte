<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '../lib/db';
  import { saveSiteRule, deleteSiteRule, exportRulesToJson, importRulesFromJson } from '../lib/rules';
  import { triggerBlobDownload } from '../lib/exporter/txt';
  import type { SiteRule } from '../lib/types';
  import { Plus, Download, Upload, Trash2, Edit3, Check, X, Shield } from '@lucide/svelte';

  let rules = $state<SiteRule[]>([]);
  let isEditing = $state(false);
  let editForm = $state<Partial<SiteRule>>({
    domain: '',
    name: '',
    contentSelector: '',
    titleSelector: '',
    nextSelector: '',
    tocSelector: '',
    paginationSelector: '',
    excludeSelectors: []
  });
  let excludeText = $state('');

  onMount(async () => {
    await loadRules();
  });

  async function loadRules() {
    rules = await db.siteRules.orderBy('domain').toArray();
  }

  function startCreateRule() {
    editForm = {
      domain: '',
      name: '',
      contentSelector: '',
      titleSelector: '',
      nextSelector: '',
      tocSelector: '',
      paginationSelector: '',
      excludeSelectors: []
    };
    excludeText = '';
    isEditing = true;
  }

  function startEditRule(rule: SiteRule) {
    editForm = { ...rule };
    excludeText = (rule.excludeSelectors || []).join('\n');
    isEditing = true;
  }

  async function handleSaveRule() {
    if (!editForm.domain || !editForm.contentSelector) {
      alert('Vui lòng nhập Tên miền (Domain) và Bộ chọn nội dung (Content Selector).');
      return;
    }

    const excludes = excludeText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    await saveSiteRule({
      ...editForm,
      domain: editForm.domain.trim(),
      name: editForm.name?.trim() || editForm.domain.trim(),
      contentSelector: editForm.contentSelector.trim(),
      titleSelector: editForm.titleSelector?.trim() || '',
      nextSelector: editForm.nextSelector?.trim() || '',
      tocSelector: editForm.tocSelector?.trim() || '',
      paginationSelector: editForm.paginationSelector?.trim() || '',
      excludeSelectors: excludes,
      isPreset: false
    } as any);

    isEditing = false;
    await loadRules();
  }

  async function handleDelete(rule: SiteRule) {
    if (!rule.id || rule.isPreset) return;
    if (confirm(`Bạn có chắc muốn xóa luật cho tên miền "${rule.domain}"?`)) {
      await deleteSiteRule(rule.id);
      await loadRules();
    }
  }

  async function handleExportJson() {
    const jsonStr = await exportRulesToJson();
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    triggerBlobDownload(blob, 'novel_scraper_site_rules.json');
  }

  function handleImportJson(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      const { imported, errors } = await importRulesFromJson(content);
      if (errors.length > 0) {
        alert(`Nhập luật hoàn tất: ${imported} luật thành công.\nCó lỗi:\n${errors.join('\n')}`);
      } else {
        alert(`Đã nhập thành công ${imported} luật trang web!`);
      }
      await loadRules();
    };
    reader.readAsText(file);
    input.value = '';
  }
</script>

<div class="rules-container">
  <!-- Top Liquid Glass Action Bar -->
  <div class="toolbar">
    <button class="btn-capsule primary" onclick={startCreateRule}>
      <Plus size={12} />
      <span>Thêm luật mới</span>
    </button>
    <div class="tool-icons">
      <button class="btn-capsule" onclick={handleExportJson} title="Xuất file JSON">
        <Download size={12} />
        <span>Xuất</span>
      </button>
      <label class="btn-capsule file-label" title="Nhập file JSON">
        <Upload size={12} />
        <span>Nhập</span>
        <input type="file" accept=".json" onchange={handleImportJson} />
      </label>
    </div>
  </div>

  <!-- Edit/Create Rule Form -->
  {#if isEditing}
    <div class="glass-card form-card">
      <div class="form-header">
        <h4 class="form-title">{editForm.id ? 'Chỉnh sửa luật' : 'Thêm luật trang mới'}</h4>
        <button class="btn-close" onclick={() => isEditing = false}><X size={14} /></button>
      </div>

      <div class="form-grid">
        <label class="form-field">
          <span>Tên miền *</span>
          <input type="text" bind:value={editForm.domain} placeholder="comong.info" />
        </label>
        <label class="form-field">
          <span>Tên hiển thị</span>
          <input type="text" bind:value={editForm.name} placeholder="Cổ Mộng" />
        </label>
        <label class="form-field full-width">
          <span>Bộ chọn nội dung (Content Selector) *</span>
          <input type="text" bind:value={editForm.contentSelector} placeholder=".reading-content, #content" />
        </label>
        <label class="form-field">
          <span>Tiêu đề (Title)</span>
          <input type="text" bind:value={editForm.titleSelector} placeholder=".chapter-title, h1" />
        </label>
        <label class="form-field">
          <span>Nút chương sau (Next)</span>
          <input type="text" bind:value={editForm.nextSelector} placeholder=".btn-next, a#next_chap" />
        </label>
        <label class="form-field">
          <span>Mục lục (TOC Links)</span>
          <input type="text" bind:value={editForm.tocSelector} placeholder=".list-chapter a" />
        </label>
        <label class="form-field">
          <span>Phân trang mục lục</span>
          <input type="text" bind:value={editForm.paginationSelector} placeholder=".pagination .next a" />
        </label>
        <label class="form-field full-width">
          <span>Loại bỏ vùng rác (mỗi dòng 1 selector)</span>
          <textarea bind:value={excludeText} rows={2} placeholder=".ads&#10;.banner"></textarea>
        </label>
      </div>

      <div class="form-actions">
        <button class="btn-capsule" onclick={() => isEditing = false}>Hủy</button>
        <button class="btn-capsule electric" onclick={handleSaveRule}>
          <Check size={12} />
          <span>Lưu luật</span>
        </button>
      </div>
    </div>
  {/if}

  <!-- Rules List -->
  <div class="rules-list">
    {#each rules as rule (rule.id || rule.domain)}
      <div class="glass-card rule-item">
        <div class="rule-top">
          <div class="rule-name-wrap">
            <span class="rule-domain">{rule.domain}</span>
            {#if rule.name && rule.name !== rule.domain}
              <span class="rule-display-name">{rule.name}</span>
            {/if}
            {#if rule.isPreset}
              <span class="badge-preset"><Shield size={9} /> Mặc định</span>
            {/if}
          </div>
          {#if !rule.isPreset}
            <div class="rule-actions">
              <button class="rule-action-btn" onclick={() => startEditRule(rule)} title="Sửa">
                <Edit3 size={12} />
              </button>
              <button class="rule-action-btn delete" onclick={() => handleDelete(rule)} title="Xóa">
                <Trash2 size={12} />
              </button>
            </div>
          {/if}
        </div>
        <div class="rule-details">
          <span class="selector-pill" title="Content Selector"><code>{rule.contentSelector}</code></span>
          {#if rule.titleSelector}
            <span class="selector-pill" title="Title Selector"><code>{rule.titleSelector}</code></span>
          {/if}
          {#if rule.nextSelector}
            <span class="selector-pill" title="Next Selector"><code>{rule.nextSelector}</code></span>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .rules-container {
    padding: 6px 14px 24px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .tool-icons {
    display: flex;
    gap: 6px;
  }

  .file-label {
    position: relative;
    cursor: pointer;
  }

  .file-label input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .form-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-color: var(--border-glass-accent);
  }

  .form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .form-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .btn-close {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .form-field.full-width {
    grid-column: span 2;
  }

  .form-field span {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .form-field input,
  .form-field textarea {
    background: var(--surface-input);
    border: 1px solid var(--border-glass);
    box-shadow: var(--liquid-inner-shadow);
    border-radius: var(--radius-sm);
    padding: 6px 9px;
    color: var(--text-primary);
    font-size: 11px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
  }

  .form-field input:focus,
  .form-field textarea:focus {
    border-color: var(--border-glass-accent);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }

  .rules-list {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .rule-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 9px 12px;
  }

  .rule-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .rule-name-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .rule-domain {
    font-weight: 700;
    font-size: 12px;
    color: var(--text-primary);
    font-family: var(--font-mono);
  }

  .rule-display-name {
    font-size: 10px;
    color: var(--text-muted);
    padding: 1px 6px;
    border-radius: var(--radius-full);
    background: var(--surface-pill-well);
  }

  .badge-preset {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 9px;
    padding: 1.5px 7px;
    border-radius: var(--radius-full);
    background: rgba(76, 201, 176, 0.16);
    border: 1px solid rgba(76, 201, 176, 0.35);
    color: var(--accent-success);
    font-weight: 700;
  }

  .rule-actions {
    display: flex;
    gap: 4px;
  }

  .rule-action-btn {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--surface-pill-well);
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .rule-action-btn:hover {
    color: var(--text-primary);
  }

  .rule-action-btn.delete:hover {
    color: var(--accent-error);
  }

  .rule-details {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .selector-pill code {
    display: inline-block;
    background: var(--surface-pill-well);
    border: 1px solid var(--border-subtle);
    padding: 1.5px 6px;
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 9.5px;
    color: var(--text-secondary);
  }
</style>
