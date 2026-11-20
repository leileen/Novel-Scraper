# Test Infrastructure & Specification Guide — Novel Scraper

## 1. Overview & Test Architecture

Novel Scraper's automated testing infrastructure is built upon **Vitest** with the **happy-dom** lightweight DOM environment, designed for fast, isolated, and deterministic testing of Chrome Manifest V3 extension logic without external network dependencies.

```
                    ┌────────────────────────────┐
                    │      Vitest Test Runner    │
                    │   (happy-dom environment)  │
                    └──────────────┬─────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Tier 1: Feature │     │ Tier 2: Boundary │     │ Tier 3: Cross-   │
│     Coverage     │     │  & Corner Cases  │     │ Feature Pipeline │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                         │                         │
         └─────────────────────────┼─────────────────────────┘
                                   │
                                   ▼
                    ┌────────────────────────────┐
                    │ Tier 4: Real-World Scenarios│
                    │ (Realistic DOM Fixtures)   │
                    └────────────────────────────┘
```

### Core Design Principles
1. **Pure Opaque-Box Verification**: Tests interact with modules strictly through their public API interfaces (`lib/extractor`, `lib/crawler`, `lib/sanitizer`, `lib/exporter`, `lib/picker`, `lib/db/presets`). Implementation internals are not asserted directly.
2. **Deterministic & Isolated**: Zero live internet dependencies. All HTTP responses and DOM fixtures are mocked deterministically within tests using standard web APIs (`DOMParser`, mocked `fetch`).
3. **Progressive Testability**: Tests validate specifications and interface contracts defined in `PROJECT.md`. Tests verify current milestone features while setting clear contracts for subsequent milestones (M1–M4).
4. **Platform Independence**: Tests are fully compatible with Windows, macOS, and Linux runtimes, handling Windows PowerShell execution constraints through standard command wrappers.

---

## 2. Test Tiers Structure

The test suite is partitioned into four distinct validation tiers conforming to the `PROJECT.md` Feature Inventory:

### Tier 1: Feature Coverage (Happy Path)
Every core feature is validated with at least 5 dedicated, high-confidence test cases:
- **comong.info Extraction**: Table of contents (TOC) link scanning, chapter content container isolation, chapter title extraction, next-link detection, and preset configuration integrity.
- **Crawler Engine**: CrawlManager queue execution, polite delay pacing, pause/resume state transitions, cancellation lifecycle, and event subscriber progress broadcasting.
- **Element Picker**: Static ID selector generation, class-based selector generation, ignored noisy classes, hierarchical DOM traversal fallback, and picker overlay interaction.
- **Content Sanitizer**: Unicode NFC normalization, zero-width invisible character stripping, ad line keyword filtering, paragraph whitespace cleanup, and Vietnamese/English word counting.
- **Exporters**: Plain text (TXT) generation with UTF-8 BOM, Microsoft Word (DOCX) binary blob generation, print-ready PDF HTML rendering with A4 `@media print` rules, natural chapter sorting, and chapter deduplication.

### Tier 2: Boundary & Corner Cases
Targeted validation for rare, adversarial, and edge conditions across all pipelines:
- **Empty & Minimal Data**: Empty table of contents, 0-chapter novels, single-chapter novels without pagination, empty chapter text bodies.
- **Navigation & Links**: Missing next-chapter links, final chapter disabled buttons (`.wpc-nav-disabled`), relative URL paths (`/chapter/chuong-1`), circular pagination references.
- **Unicode & Typography**: Vietnamese tone marks, combining accent marks, arrows (`→`, `\u2192`, `»`, `>`, `›`), zero-width traps (`\u200B`, `\u200D`, `\uFEFF`, `\u00AD`), and mixed whitespace (`\u00A0`).
- **Malformed Markup**: Unclosed HTML tags, nested script/style blocks, broken HTML structures, detached DOM nodes.
- **Anti-Scraping & Honeypots**: Hidden trap elements (`display:none`, `visibility:hidden`, `[hidden]`, `[aria-hidden="true"]`), inline ad injections, collapsible read-more buttons (`.w2w_read_more`).
- **Naming Collisions & Deduplication**: Chapters sharing identical or empty titles (e.g. "Ngoại truyện", "Không đề", `""`), duplicate chapter URLs with distinct casing.

### Tier 3: Cross-Feature Combinations
End-to-end integration tests connecting multiple modules in sequence:
- **Crawler ➔ Extractor ➔ Sanitizer ➔ Sorter ➔ Exporters**: Simulates fetching multi-chapter HTML documents, extracting titles and containers, cleaning ads and honeypots, sorting out-of-order arrivals, deduplicating duplicate entries, and exporting to TXT, DOCX, and PDF.
- **Element Picker ➔ Site Rules ➔ Extractor**: Simulates picking selectors via the visual picker overlay and applying generated selectors to drive chapter extraction.

### Tier 4: Real-World Scenarios
High-fidelity simulations reflecting real-world site behaviors:
- **Realistic comong.info Crawl**: Authentic DOM fixtures replicating WordPress Flatsome theme structures (`.chapter-list-grid`, `.page-description`, `h1.story-title` vs `h1:not(.story-title)`, `.wpc-nav-next a`).
- **Multi-Site Compatibility**: Verification across disparate novel platform structures (`truyenfull.vn`, `truyen.tangthuvien.vn`, `comong.info`).
- **High-Volume Stress**: Sorting, missing chapter detection, and export generation across 1,500 chapters within strict performance thresholds (<1.5s).

---

## 3. Directory Layout & Test Suite Map

```
test/
├── comong.test.ts           # Tier 1, 2, 4: comong.info TOC, chapter, title, next link & realistic DOM
├── crawler.test.ts          # Tier 1, 2, 3: CrawlManager lifecycle, queue, retry, pagination, events
├── picker_sanitizer.test.ts # Tier 1, 2, 3: Picker selector generator, overlay, honeypot & ad stripping
├── exporter_all.test.ts     # Tier 1, 2, 3: TXT, DOCX, PDF, EPUB/JSON specs, natural sort, deduplication
├── exporter.test.ts         # Baseline exporter unit tests
├── extractor.test.ts        # Baseline heuristic and rule extractor unit tests
├── rules.test.ts            # Domain extraction and basic selector tests
├── sanitizer.test.ts        # Baseline text sanitizer tests
└── stress_and_sites.test.ts # Multi-site extraction and 1,500 chapters stress test
```

---

## 4. Feature Coverage Matrix (PROJECT.md)

| Feature # | Feature Name | Target Test File | Tier | Coverage Description |
| :---: | :--- | :--- | :---: | :--- |
| **1** | comong.info TOC Extraction | `comong.test.ts` | 1, 2, 4 | Tests `.chapter-item a` extraction inside `.chapter-row`, pagination links, empty TOC |
| **2** | comong.info Chapter Content Extraction | `comong.test.ts` | 1, 2, 4 | Tests `.page-description`, isolates from `#content`, strips `.w2w_read_more` |
| **3** | comong.info Chapter Title Extraction | `comong.test.ts` | 1, 2, 4 | Isolates `h1:not(.story-title)` without colliding with `h1.story-title` novel name |
| **4** | comong.info Next Chapter Navigation | `comong.test.ts` | 1, 2, 4 | Tests `.wpc-nav-next a, .wpc-nav-link`, trailing unicode arrows (`→`), single-chapter |
| **5** | Selector Query Defensive Guard | `comong.test.ts`, `crawler.test.ts` | 2 | Validates that invalid or non-standard selectors degrade safely without crashing |
| **6** | Relative URL Resolution | `comong.test.ts`, `crawler.test.ts` | 2 | Verifies relative paths (`/chapter/...`) resolve against base URL |
| **7** | Anti-Scraper Honeypot Trap Removal | `picker_sanitizer.test.ts` | 1, 2 | Verifies hidden elements (`display:none`, `visibility:hidden`, `[hidden]`) removal |
| **8** | Sanitizer Ad & Button Stripping | `picker_sanitizer.test.ts` | 1, 2 | Strips `.w2w_read_more`, ad classes (`.ads`, `.banner`), ad keywords |
| **9** | Element Picker UI Integration | `picker_sanitizer.test.ts` | 1, 3 | Validates selector generation, overlay lifecycle, `PICKER_RESULT` message schema |
| **10** | Crawler Pagination Loop Prevention | `crawler.test.ts` | 1, 2 | Tests `scanFullToc` duplicate pagination tracking, stopping on cycles |
| **11** | Crawler Concurrency Guard | `crawler.test.ts` | 1, 2 | Tests active crawl tracking (`getActiveNovelId`), sequential crawl safety |
| **12** | Chapter Deduplication Logic | `exporter_all.test.ts` | 1, 2 | Tests deduplication by URL and composite identity; protects non-unique titles |
| **13** | EPUB Exporter Specification | `exporter_all.test.ts` | 1, 4 | Validates EPUB 3 packaging contract, container structure, and MIME type |
| **14** | JSON Exporter Specification | `exporter_all.test.ts` | 1, 4 | Validates JSON structured export schema (novel metadata, chapter array) |
| **15** | Exporter Types & UI Integration | `exporter_all.test.ts` | 1 | Tests export formats across TXT, DOCX, PDF, and contract handlers |
| **16** | TypeScript Build Cleanliness | Workspace Root | 1 | Verified via `cmd /c "npm run check"` and `cmd /c "npm run build"` |
| **17** | E2E Opaque-Box Test Suite | All `test/*.test.ts` | 1-4 | Comprehensive test execution via `cmd /c "npx vitest run"` |

---

## 5. Execution Commands

### Run Full Test Suite
```bash
cmd /c "npx vitest run"
```

### Run Specific Test Suite
```bash
cmd /c "npx vitest run test/comong.test.ts"
cmd /c "npx vitest run test/crawler.test.ts"
cmd /c "npx vitest run test/picker_sanitizer.test.ts"
cmd /c "npx vitest run test/exporter_all.test.ts"
```

### Run with Watch Mode (Development)
```bash
cmd /c "npx vitest"
```

### Run Extension Build
```bash
cmd /c "npm run build"
```
