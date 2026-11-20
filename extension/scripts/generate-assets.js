import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT_DIR = process.cwd();
const PUBLIC_ICON_DIR = path.join(ROOT_DIR, 'public', 'icon');
const STORE_ASSETS_DIR = path.join(ROOT_DIR, 'store-assets');

if (!fs.existsSync(PUBLIC_ICON_DIR)) {
  fs.mkdirSync(PUBLIC_ICON_DIR, { recursive: true });
}
if (!fs.existsSync(STORE_ASSETS_DIR)) {
  fs.mkdirSync(STORE_ASSETS_DIR, { recursive: true });
}

const svgPath = path.join(PUBLIC_ICON_DIR, 'icon.svg');
const svgBuffer = fs.readFileSync(svgPath);

async function generateExtensionIcons() {
  console.log('Generating extension icons from icon.svg...');
  const sizes = [16, 32, 48, 128, 300, 512];

  for (const size of sizes) {
    const outPath = path.join(PUBLIC_ICON_DIR, `${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`  ✓ Created public/icon/${size}.png`);
  }
}

async function generatePromoTile() {
  console.log('Generating Chrome Web Store Promo Tile (440x280)...');
  const promoSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#070B14" />
          <stop offset="60%" stop-color="#0B1329" />
          <stop offset="100%" stop-color="#0F1F3D" />
        </linearGradient>
      </defs>
      <rect width="440" height="280" fill="url(#bg)" />
      <circle cx="100" cy="140" r="120" fill="#00D2FF" opacity="0.12" filter="blur(40px)" />
      
      <g transform="translate(40, 60)">
        <text x="0" y="45" font-family="system-ui, sans-serif" font-size="28" font-weight="800" fill="#FFFFFF">
          Novel <tspan fill="#00D2FF">Scraper</tspan>
        </text>
        <text x="0" y="78" font-family="system-ui, sans-serif" font-size="14" font-weight="500" fill="#94A3B8">
          Universal Web Novel Downloader
        </text>
        <g transform="translate(0, 105)">
          <rect width="80" height="26" rx="13" fill="#1E293B" stroke="#00D2FF" stroke-width="1" />
          <text x="40" y="17" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#00D2FF" text-anchor="middle">TXT</text>

          <rect x="90" width="80" height="26" rx="13" fill="#1E293B" stroke="#3A7BD5" stroke-width="1" />
          <text x="130" y="17" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#3A7BD5" text-anchor="middle">DOCX</text>

          <rect x="180" width="80" height="26" rx="13" fill="#1E293B" stroke="#A855F7" stroke-width="1" />
          <text x="220" y="17" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#A855F7" text-anchor="middle">PDF</text>
        </g>
      </g>
    </svg>
  `;

  const icon128 = await sharp(svgBuffer).resize(120, 120).png().toBuffer();

  const baseImage = sharp(Buffer.from(promoSvg));
  await baseImage
    .composite([
      {
        input: icon128,
        top: 80,
        left: 290
      }
    ])
    .png()
    .toFile(path.join(STORE_ASSETS_DIR, 'promo-tile-440x280.png'));

  console.log('  ✓ Created store-assets/promo-tile-440x280.png');
}

async function generateMarqueeBanner() {
  console.log('Generating Banner (1400x560)...');
  const bannerSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="560" viewBox="0 0 1400 560">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#050811" />
          <stop offset="50%" stop-color="#0B1329" />
          <stop offset="100%" stop-color="#0A1832" />
        </linearGradient>
      </defs>
      <rect width="1400" height="560" fill="url(#bg)" />
      <circle cx="280" cy="280" r="240" fill="#00D2FF" opacity="0.15" filter="blur(80px)" />
      <circle cx="1100" cy="280" r="200" fill="#3A7BD5" opacity="0.12" filter="blur(70px)" />

      <g transform="translate(140, 180)">
        <text x="0" y="70" font-family="system-ui, sans-serif" font-size="64" font-weight="900" fill="#FFFFFF">
          Novel <tspan fill="#00D2FF">Scraper</tspan>
        </text>
        <text x="0" y="130" font-family="system-ui, sans-serif" font-size="24" font-weight="500" fill="#94A3B8">
          Tiện ích Side Panel cào tiểu thuyết mọi trang web · Xuất file TXT, DOCX, PDF
        </text>
        <text x="0" y="170" font-family="system-ui, sans-serif" font-size="18" font-weight="400" fill="#64748B">
          Universal Heuristic Reader View · Visual Element Picker · Polite Anti-Ban Crawler
        </text>
      </g>
    </svg>
  `;

  const icon260 = await sharp(svgBuffer).resize(260, 260).png().toBuffer();

  await sharp(Buffer.from(bannerSvg))
    .composite([
      {
        input: icon260,
        top: 150,
        left: 1020
      }
    ])
    .png()
    .toFile(path.join(STORE_ASSETS_DIR, 'banner-1400x560.png'));

  console.log('  ✓ Created store-assets/banner-1400x560.png');
}

async function generateScreenshots() {
  console.log('Generating Screenshots (1280x800)...');
  const screenshotViSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#080D1A" />
          <stop offset="100%" stop-color="#0F172A" />
        </linearGradient>
      </defs>
      <rect width="1280" height="800" fill="url(#bg)" />
      <g transform="translate(80, 80)">
        <text x="0" y="40" font-family="system-ui, sans-serif" font-size="36" font-weight="800" fill="#FFFFFF">
          Trích Xuất &amp; Cào Tiểu Thuyết Từ <tspan fill="#00D2FF">Mọi Trang Web</tspan>
        </text>
        <text x="0" y="80" font-family="system-ui, sans-serif" font-size="18" fill="#94A3B8">
          Tự nhận diện nội dung thông minh · Bộ chọn vùng bằng chuột · Lọc sạch quảng cáo &amp; watermark
        </text>
      </g>
      <!-- Mock Side Panel Preview -->
      <g transform="translate(440, 160)">
        <rect width="400" height="580" rx="16" fill="#101A30" stroke="rgba(0, 210, 255, 0.4)" stroke-width="2" />
        <rect x="20" y="20" width="360" height="130" rx="12" fill="#13203C" />
        <text x="40" y="55" font-family="system-ui, sans-serif" font-size="16" font-weight="700" fill="#FFFFFF">Yêu Em Từ Cái Nhìn Đầu Tiên</text>
        <text x="40" y="80" font-family="system-ui, sans-serif" font-size="12" fill="#00D2FF">comong.info · Đang cào chương 85/120</text>
        <rect x="40" y="105" width="320" height="6" rx="3" fill="#1E293B" />
        <rect x="40" y="105" width="224" height="6" rx="3" fill="#00D2FF" />

        <rect x="20" y="170" width="360" height="320" rx="12" fill="#13203C" />
        <text x="40" y="205" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#94A3B8">DANH SÁCH CHƯƠNG</text>
        <text x="40" y="235" font-family="system-ui, sans-serif" font-size="12" fill="#00D2FF">✓ Chương 84: Duyên phận bắt đầu</text>
        <text x="40" y="265" font-family="system-ui, sans-serif" font-size="12" fill="#F59E0B">⟳ Chương 85: Gặp gỡ ngoài đời</text>
        <text x="40" y="295" font-family="system-ui, sans-serif" font-size="12" fill="#64748B">· Chương 86: Chờ tải...</text>

        <!-- Bottom Controls -->
        <rect x="20" y="510" width="360" height="50" rx="25" fill="#00D2FF" />
        <text x="200" y="541" font-family="system-ui, sans-serif" font-size="14" font-weight="800" fill="#070B14" text-anchor="middle">📥 GỘP &amp; TẢI VỀ (TXT · DOCX · PDF)</text>
      </g>
    </svg>
  `;

  await sharp(Buffer.from(screenshotViSvg))
    .png()
    .toFile(path.join(STORE_ASSETS_DIR, 'screenshot-1-vi-1280x800.png'));

  const screenshotEnSvg = screenshotViSvg
    .replace('Trích Xuất & Cào Tiểu Thuyết Từ <tspan fill="#00D2FF">Mọi Trang Web</tspan>', 'Scrape Web Novels From <tspan fill="#00D2FF">Any Website</tspan>')
    .replace('Tự nhận diện nội dung thông minh · Bộ chọn vùng bằng chuột · Lọc sạch quảng cáo & watermark', 'Smart Reader View · Visual Element Picker · Ad & Watermark Sanitizer')
    .replace('DANH SÁCH CHƯƠNG', 'CHAPTER LIST')
    .replace('📥 GỘP &amp; TẢI VỀ (TXT · DOCX · PDF)', '📥 MERGE &amp; DOWNLOAD (TXT · DOCX · PDF)');

  await sharp(Buffer.from(screenshotEnSvg))
    .png()
    .toFile(path.join(STORE_ASSETS_DIR, 'screenshot-1-en-1280x800.png'));

  console.log('  ✓ Created store-assets/screenshot-1-vi-1280x800.png');
  console.log('  ✓ Created store-assets/screenshot-1-en-1280x800.png');
}

async function main() {
  await generateExtensionIcons();
  await generatePromoTile();
  await generateMarqueeBanner();
  await generateScreenshots();
  console.log('\nAll branding & store assets created successfully!');
}

main().catch(console.error);
