# Project: Novel Scraper

## Architecture
Novel Scraper is a Chrome Manifest V3 browser extension built with WXT (Vite), Svelte 5, TypeScript, and TailwindCSS.
The system is organized into modular layers:
- **Crawler Layer (`lib/crawler/`)**: Manages full table-of-contents scanning, pagination traversal, concurrent chapter fetching with retry, rate limiting, and crawl lifecycle states (start, pause, resume, cancel).
- **Extractor Layer (`lib/extractor/`)**: Parses HTML documents using rule-based selectors (`extractChapterWithRule`, `extractTocWithRule`) with heuristic fallbacks (`lib/extractor/heuristic.ts`), title detection, and next-chapter navigation.
- **Presets & Rules (`lib/db/presets.ts`, `lib/rules/`)**: Default and user-defined site rules mapping domains to selectors for content, titles, next links, TOC, pagination, and excluded elements.
- **Sanitizer Layer (`lib/sanitizer/`)**: Cleans extracted HTML, strips anti-scraping honeypot traps, removes advertisement blocks, formats paragraphs, normalizes Unicode, and strips unwanted UI tags.
- **Exporter Layer (`lib/exporter/`)**: Formats and exports collected novel data into TXT, DOCX, PDF, EPUB, and JSON, with natural chapter sorting and deduplication.
- **Storage Layer (`lib/storage/`, `lib/db/`)**: IndexedDB (Dexie) storage for novels, chapters, settings, and custom site rules.
- **UI & Entrypoints (`entrypoints/`, `components/`)**: Chrome sidepanel, content scripts (element picker, DOM extraction), and background service worker.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | comong.info TOC Extraction | Extract chapter list (titles and URLs) from comong.info novel overview page using `.chapter-item a` | M1 | Survey Explorer 1 & 3 |
| 2 | comong.info Chapter Content Extraction | Extract main novel text from `.page-description, .story-content` while excluding `.w2w_read_more`, navigation, and ads | M1 | Survey Explorer 1 & 3 |
| 3 | comong.info Chapter Title Extraction | Isolate chapter title (`h1:not(.story-title)`) without colliding with novel title (`h1.story-title`) | M1 | Survey Explorer 1 & 3 |
| 4 | comong.info Next Chapter Navigation | Detect next chapter URL via `.wpc-nav-next a, .wpc-nav-link` and regex supporting trailing arrows (`→`) | M1 | Survey Explorer 1 & 3 |
| 5 | Selector Query Defensive Guard | Safe `try/catch` wrapper around `doc.querySelector` for preset/custom selectors to prevent DOMException crashes | M1 | Survey Explorer 1 & 2 |
| 6 | DOMParser Relative URL Resolution | Resolve relative URLs (`/chapter/...`) against document base URL across all extraction contexts | M1 | Survey Explorer 2 |
| 7 | Anti-Scraper Honeypot Trap Removal | Detect and strip hidden honey-pot elements (`display:none`, `visibility:hidden`) in content sanitizer | M2 | Survey Explorer 2 |
| 8 | Sanitizer Ad & Button Stripping | Clean readmore buttons (`.w2w_read_more`) and ad lines without deleting legitimate novel text paragraphs | M2 | Survey Explorer 1 & 2 |
| 9 | Element Picker UI Integration | Apply and store selector returned by interactive element picker (`PICKER_RESULT`) instead of discarding it | M2 | Survey Explorer 2 |
| 10 | Crawler Pagination Loop Prevention | Track pagination URLs in `seenPaginationUrls` separately from chapter URLs to avoid runaway loops | M3 | Survey Explorer 2 |
| 11 | Crawler Concurrency Lock | Add active crawl mutex lock in `CrawlManager.startCrawl` to prevent concurrent crawl collisions | M3 | Survey Explorer 2 |
| 12 | Chapter Deduplication Logic | Deduplicate chapters by URL or `(chapterNumber + normalizedTitle)` without dropping chapters sharing names | M3 | Survey Explorer 2 |
| 13 | EPUB Exporter Implementation | Implement EPUB 3 generator with valid metadata, container.xml, OPF package, NCX toc, and chapter XHTMLs | M4 | Survey Explorer 2 & 3 |
| 14 | JSON Exporter Implementation | Implement JSON exporter generating structured novel metadata, chapter list, and full contents | M4 | Survey Explorer 2 & 3 |
| 15 | Exporter Types & UI Integration | Add EPUB and JSON to `ExportFormat` types, settings, ScraperTab, and LibraryTab selectors | M4 | Survey Explorer 2 & 3 |
| 16 | TypeScript Check & Build Cleanliness | Fix `tsconfig.json` and type definitions so `npm run check` and `npm run build` succeed with 0 errors | M4 | Survey Explorer 2 & 3 |
| 17 | E2E Opaque-Box Test Suite | Comprehensive 4-tier test suite covering comong.info, crawler, picker, sanitizer, and all exporters | M-TEST | Survey Explorer 3 |
| 18 | Final E2E Test Suite Pass | Execute and pass 100% of test suites with zero failures and zero regressions | M5 | ORIGINAL_REQUEST R3 |
| 19 | Adversarial Coverage Hardening | White-box stress and edge case validation across all components | M5 | Project Pattern Tier 5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M-TEST | E2E Testing Suite Track | Design and publish comprehensive test suite across Tiers 1-4 in `test/`, publish `TEST_READY.md` | None | DONE |
| M1 | comong.info Presets, Extractor & Heuristics | Fix comong.info selectors, defensive querySelector try/catch, URL resolution, heuristic arrow regex | None | DONE |
| M2 | Content Sanitizer & Element Picker Bug Fixes | Honeypot trap stripping, UI button exclusion, safe ad removal, picker result storage | None | DONE |
| M3 | Crawler Engine Robustness & Sorter Deduplication | Pagination URL tracking, crawl lock mutex, safe deduplication by URL/chapterNumber | None | DONE |
| M4 | EPUB & JSON Exporters & TypeScript Build Cleanliness | EPUB 3 generator, JSON exporter, UI & type integration, tsconfig fixes for `npm run check` | M3 | DONE |
| M5 | Final Milestone: 100% E2E Pass & Adversarial Hardening | Phase 1: Pass 100% E2E tests (Tiers 1-4). Phase 2: Adversarial coverage hardening (Tier 5) | M-TEST, M1, M2, M3, M4 | DONE |

## Interface Contracts

### Extractor ↔ Crawler (`lib/extractor` ↔ `lib/crawler`)
- `extractChapterWithRule(doc: Document, rule: SiteRule, currentUrl?: string): { title: string; content: string; nextUrl?: string }`:
  - `title`: Extracted chapter title (guaranteed non-empty; fallback to heuristic if needed).
  - `content`: Sanitized HTML content.
  - `nextUrl`: Fully-resolved absolute URL for next chapter, or `undefined`.
- `extractTocWithRule(doc: Document, rule: SiteRule, currentUrl?: string): Array<{ title: string; url: string; chapterNumber: number }>`:
  - All returned URLs MUST be fully qualified absolute URLs (`new URL(href, currentUrl).href`).

### Exporter Interface (`lib/exporter/index.ts`)
- `exportToTxt(novel: Novel, chapters: Chapter[]): Promise<Blob>`
- `exportToDocx(novel: Novel, chapters: Chapter[]): Promise<Blob>`
- `exportToPdf(novel: Novel, chapters: Chapter[]): Promise<string>`
- `exportToEpub(novel: Novel, chapters: Chapter[]): Promise<Blob>`
- `exportToJson(novel: Novel, chapters: Chapter[]): Promise<Blob>`

### Sanitizer Interface (`lib/sanitizer/index.ts`)
- `sanitizeHtmlContent(rawHtml: string, excludeSelectors?: string[]): string`:
  - Strips script, style, iframe, audio, video, object, embed tags.
  - Strips hidden honeypot elements (`style*="display:none"`, `style*="display: none"`, `visibility:hidden`, `hidden` attribute).
  - Strips elements matching `excludeSelectors`.
  - Normalizes whitespace, clean paragraphs, and Unicode.

## Code Layout
- `lib/db/presets.ts`: Default site configurations and CSS selectors.
- `lib/crawler/index.ts`: Crawler queue, pagination, rate limiting, and lifecycle.
- `lib/extractor/index.ts`: Rule-based chapter and TOC extraction.
- `lib/extractor/heuristic.ts`: Readability-style heuristics and regex pattern matchers.
- `lib/sanitizer/index.ts`: HTML sanitization, ad removal, and text formatting.
- `lib/exporter/`:
  - `txt.ts`: Plain text exporter.
  - `docx.ts`: DOCX exporter.
  - `pdf.ts`: PDF HTML exporter.
  - `epub.ts`: EPUB 3 zip archive generator.
  - `json.ts`: JSON structured exporter.
  - `sorter.ts`: Natural sorting and deduplication.
  - `index.ts`: Exporter entry point.
- `lib/types/index.ts`: Core data structures and interfaces (`Novel`, `Chapter`, `SiteRule`, `ExportFormat`).
- `components/`:
  - `ScraperTab.svelte`: Main scraping UI, live logs, picker trigger.
  - `LibraryTab.svelte`: Saved novels, export format selector, chapter viewer.
  - `RulesTab.svelte`: Site rule editor and preset browser.
- `test/`:
  - `comong.test.ts`: Dedicated comong.info DOM and extraction tests.
  - `crawler.test.ts`: Crawler queue, pagination, and lifecycle tests.
  - `exporter.test.ts`: Exporter formats and deduplication tests.
  - `sanitizer.test.ts`: Sanitization, honeypot, and ad removal tests.
  - `picker.test.ts`: Picker result message and state tests.
  - `rules.test.ts`: Site rule matching and preset validation.
  - `stress_and_sites.test.ts`: Multi-site and high-volume chapter sorting stress tests.
