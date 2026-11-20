import type { SiteRule } from '../types';

export const DEFAULT_SITE_RULES: Omit<SiteRule, 'id'>[] = [
  {
    domain: 'comong.info',
    name: 'Cổ Mộng',
    contentSelector: '.page-description, .entry-content, .reading-content, .chapter-c, .story-content, .text-content, #content-story, .content-reading',
    titleSelector: 'h1.chapter-title, h2.chapter-title, h1:not(.story-title):not(.site-title):not(.logo):not(.site-logo), .entry-title',
    nextSelector: '.wpc-nav-next a, .wpc-nav-next .wpc-nav-link, .nav-next a, a.next-chapter, a.next, .nav-links a.next',
    tocSelector: '.wpc-chapter-select select, select.chapter-select, select[name*="chapter"], .chapter-item a, .list-chapter li a, .list-chapter a, ul.mucluc a, #chapter-list a',
    paginationSelector: '.nav-pagination a.next, a.page-numbers.next, .pagination a.next, .pagination-next',
    excludeSelectors: ['.w2w_read_more', '.readmore_open_button', '.readmore_close_button', '.wpc-chapter-nav-simple', '.ads', '.adsbygoogle', '.header-content', '.footer-content', '.post-ad'],
    isPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    domain: 'truyenfull.io',
    name: 'TruyệnFull (io)',
    contentSelector: '#chapter-c, .chapter-c',
    titleSelector: '.chapter-title, h2.chapter-title',
    nextSelector: '#next_chap, a#next_chap',
    tocSelector: '#list-chapter .list-chapter a, ul.list-chapter a',
    paginationSelector: 'ul.pagination li.active + li a',
    excludeSelectors: ['.ads-responsive', '.banner', '.adsbygoogle'],
    isPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    domain: 'truyenfull.vn',
    name: 'TruyệnFull (vn)',
    contentSelector: '#chapter-c, .chapter-c',
    titleSelector: '.chapter-title, h2.chapter-title',
    nextSelector: '#next_chap, a#next_chap',
    tocSelector: '#list-chapter .list-chapter a, ul.list-chapter a',
    paginationSelector: 'ul.pagination li.active + li a',
    excludeSelectors: ['.ads-responsive', '.banner', '.adsbygoogle'],
    isPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    domain: 'truyen.tangthuvien.vn',
    name: 'Tàng Thư Viện',
    contentSelector: '.box-chap, .chapter-c',
    titleSelector: 'h1.truyen-title, .chapter-title',
    nextSelector: 'a.btn-next, a#btn-next',
    tocSelector: '#list-chapter ul li a',
    paginationSelector: '.pagination .next a',
    excludeSelectors: ['.chap-nav', '.box-ads'],
    isPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    domain: 'metruyenchu.com.vn',
    name: 'Mê Truyện Chữ',
    contentSelector: '#vungdoc .truyen, #vungdoc, .vung-doc .truyen, .vung-doc, #js-read__content, .chapter-content',
    titleSelector: 'h2.current-chapter, .chapter-title h2, .chapter-title, h1.chapter-title, h1:not(.current-book)',
    nextSelector: '.chapter_control a.next, #gotochap a.next, a.next, .next-chap a, a.js-btn-next',
    tocSelector: '#chapter-list a, .title-list-chapter ~ div ul li a, .list-chapter a, ul.mucluc a, .mucluc a, #list-chapter a',
    paginationSelector: '.paging a, .pagination .next a',
    excludeSelectors: ['.chapter_control', '.line-control', '.chap-info', '.book-relate', '#comment', '.nh-read__ad'],
    isPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    domain: 'metruyenchuvn.com',
    name: 'Mê Truyện Chữ (VN)',
    contentSelector: '#vungdoc .truyen, #vungdoc, .vung-doc .truyen, .vung-doc, #js-read__content, .chapter-content',
    titleSelector: 'h2.current-chapter, .chapter-title h2, .chapter-title, h1.chapter-title, h1:not(.current-book)',
    nextSelector: '.chapter_control a.next, #gotochap a.next, a.next, .next-chap a, a.js-btn-next',
    tocSelector: '#chapter-list a, .title-list-chapter ~ div ul li a, .list-chapter a, ul.mucluc a, .mucluc a, #list-chapter a',
    paginationSelector: '.paging a, .pagination .next a',
    excludeSelectors: ['.chapter_control', '.line-control', '.chap-info', '.book-relate', '#comment', '.nh-read__ad'],
    isPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    domain: 'metruyencv.com',
    name: 'Mê Truyện CV',
    contentSelector: '#vungdoc .truyen, #vungdoc, .vung-doc .truyen, .vung-doc, #js-read__content, .chapter-content',
    titleSelector: 'h2.current-chapter, .chapter-title h2, .chapter-title, h1.chapter-title, h1:not(.current-book)',
    nextSelector: '.chapter_control a.next, #gotochap a.next, a.next, .next-chap a, a.js-btn-next',
    tocSelector: '#chapter-list a, .title-list-chapter ~ div ul li a, .list-chapter a, ul.mucluc a, .mucluc a, #list-chapter a',
    paginationSelector: '.paging a, .pagination .next a',
    excludeSelectors: ['.chapter_control', '.line-control', '.chap-info', '.book-relate', '#comment', '.nh-read__ad'],
    isPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    domain: 'metruyencv.us',
    name: 'Mê Truyện CV (US)',
    contentSelector: '#vungdoc .truyen, #vungdoc, .vung-doc .truyen, .vung-doc, #js-read__content, .chapter-content',
    titleSelector: 'h2.current-chapter, .chapter-title h2, .chapter-title, h1.chapter-title, h1:not(.current-book)',
    nextSelector: '.chapter_control a.next, #gotochap a.next, a.next, .next-chap a, a.js-btn-next',
    tocSelector: '#chapter-list a, .title-list-chapter ~ div ul li a, .list-chapter a, ul.mucluc a, .mucluc a, #list-chapter a',
    paginationSelector: '.paging a, .pagination .next a',
    excludeSelectors: ['.chapter_control', '.line-control', '.chap-info', '.book-relate', '#comment', '.nh-read__ad'],
    isPreset: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];
