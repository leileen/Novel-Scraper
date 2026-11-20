import { describe, it, expect } from 'vitest';
import { sanitizeHtmlContent, removeAdLines, UNWANTED_TAGS } from '../lib/sanitizer';

describe('Challenger M2: Content Sanitizer & Honeypot Stress Testing', () => {
  // =========================================================================
  // Test Suite 1: Hidden Honeypots & Anti-Scraper Traps
  // =========================================================================
  describe('1. Hidden Honeypots & Anti-Scraper Traps', () => {
    it('1.1: Removes display:none inline styles with standard spacing', () => {
      const html = `
        <div class="content">
          <p>Đoạn văn thật sự thứ nhất.</p>
          <div style="display:none">Trap 1: display:none</div>
          <p>Đoạn văn thật sự thứ hai.</p>
        </div>
      `;
      const result = sanitizeHtmlContent(html);
      expect(result).toContain('Đoạn văn thật sự thứ nhất.');
      expect(result).toContain('Đoạn văn thật sự thứ hai.');
      expect(result).not.toContain('Trap 1');
    });

    it('1.2: Removes display: none inline styles with loose spacing and semicolons', () => {
      const html = `
        <div class="content">
          <p>Đoạn văn thật sự thứ nhất.</p>
          <span style="display: none;">Trap 2: display: none with space and semicolon</span>
          <p style="  display :  none  ; color: red; ">Trap 2b: loose spacing</p>
          <p>Đoạn văn thật sự thứ hai.</p>
        </div>
      `;
      const result = sanitizeHtmlContent(html);
      expect(result).toContain('Đoạn văn thật sự thứ nhất.');
      expect(result).toContain('Đoạn văn thật sự thứ hai.');
      expect(result).not.toContain('Trap 2');
      expect(result).not.toContain('Trap 2b');
    });

    it('1.3: Removes visibility:hidden and visibility: hidden inline styles', () => {
      const html = `
        <div class="content">
          <p>Đoạn văn thật sự thứ nhất.</p>
          <span style="visibility:hidden">Trap 3: visibility:hidden</span>
          <div style="visibility: hidden;">Trap 3b: visibility: hidden with space</div>
          <p>Đoạn văn thật sự thứ hai.</p>
        </div>
      `;
      const result = sanitizeHtmlContent(html);
      expect(result).toContain('Đoạn văn thật sự thứ nhất.');
      expect(result).toContain('Đoạn văn thật sự thứ hai.');
      expect(result).not.toContain('Trap 3');
      expect(result).not.toContain('Trap 3b');
    });

    it('1.4: Removes boolean hidden and hidden="hidden" attributes', () => {
      const html = `
        <div class="content">
          <p>Đoạn văn thật sự thứ nhất.</p>
          <p hidden>Trap 4: boolean hidden</p>
          <div hidden="hidden">Trap 4b: hidden=hidden</div>
          <span hidden="">Trap 4c: hidden empty</span>
          <p>Đoạn văn thật sự thứ hai.</p>
        </div>
      `;
      const result = sanitizeHtmlContent(html);
      expect(result).toContain('Đoạn văn thật sự thứ nhất.');
      expect(result).toContain('Đoạn văn thật sự thứ hai.');
      expect(result).not.toContain('Trap 4');
      expect(result).not.toContain('Trap 4b');
      expect(result).not.toContain('Trap 4c');
    });

    it('1.5: Removes aria-hidden="true" attributes but preserves aria-hidden="false"', () => {
      const html = `
        <div class="content">
          <p>Đoạn văn thật sự thứ nhất.</p>
          <div aria-hidden="true">Trap 5: aria-hidden true</div>
          <p aria-hidden="false">Đoạn văn aria-hidden false hợp lệ.</p>
        </div>
      `;
      const result = sanitizeHtmlContent(html);
      expect(result).toContain('Đoạn văn thật sự thứ nhất.');
      expect(result).toContain('Đoạn văn aria-hidden false hợp lệ.');
      expect(result).not.toContain('Trap 5');
    });

    it('1.6: Removes nested honeypot structures cleanly', () => {
      const html = `
        <div class="content">
          <p>Đoạn văn trước bẫy.</p>
          <div style="display:none">
            Trap parent
            <div style="visibility:hidden">
              Trap child
              <span hidden>Trap grandchild deep</span>
            </div>
          </div>
          <p>Nội dung xen giữa <span style="display:none">Trap inline <b>bold trap</b></span> tiếp tục nội dung.</p>
          <p>Đoạn văn sau bẫy.</p>
        </div>
      `;
      const result = sanitizeHtmlContent(html);
      expect(result).toContain('Đoạn văn trước bẫy.');
      expect(result).toContain('Nội dung xen giữa');
      expect(result).toContain('tiếp tục nội dung.');
      expect(result).toContain('Đoạn văn sau bẫy.');
      expect(result).not.toContain('Trap parent');
      expect(result).not.toContain('Trap child');
      expect(result).not.toContain('Trap grandchild');
      expect(result).not.toContain('Trap inline');
      expect(result).not.toContain('bold trap');
    });

    it('1.7: Removes uppercase STYLE="DISPLAY:NONE" and mixed-case attributes', () => {
      const html = `
        <div class="content">
          <p>Đoạn văn thật sự thứ nhất.</p>
          <div STYLE="DISPLAY:NONE">Trap 7a: uppercase STYLE and DISPLAY:NONE</div>
          <span style="ViSiBiLiTy: HiDdEn">Trap 7b: mixed case visibility</span>
          <p>Đoạn văn thật sự thứ hai.</p>
        </div>
      `;
      const result = sanitizeHtmlContent(html);
      expect(result).toContain('Đoạn văn thật sự thứ nhất.');
      expect(result).toContain('Đoạn văn thật sự thứ hai.');
      expect(result).not.toContain('Trap 7a');
      expect(result).not.toContain('Trap 7b');
    });

    it('1.8: Handles complex multi-rule inline styles with display:none !important', () => {
      const html = `
        <div class="content">
          <p>Đoạn văn thật sự thứ nhất.</p>
          <div style="font-size: 14px; display: none !important; color: #333;">Trap 8: display none important</div>
          <p>Đoạn văn thật sự thứ hai.</p>
        </div>
      `;
      const result = sanitizeHtmlContent(html);
      expect(result).toContain('Đoạn văn thật sự thứ nhất.');
      expect(result).toContain('Đoạn văn thật sự thứ hai.');
      expect(result).not.toContain('Trap 8');
    });
  });

  // =========================================================================
  // Test Suite 2: Collapsible Read-More Buttons & UI Widgets
  // =========================================================================
  describe('2. Collapsible Read-More Buttons & UI Widgets', () => {
    it('2.1: Strips .w2w_read_more buttons and its nested contents', () => {
      const html = `
        <div class="chapter-content">
          <p>Mở đầu chương truyện đầy kịch tính.</p>
          <div class="w2w_read_more">
            <button>Xem thêm toàn bộ chương</button>
            <span>Nhấn vào đây để mở rộng</span>
          </div>
          <p>Nội dung tiếp theo của chương truyện.</p>
        </div>
      `;
      const result = sanitizeHtmlContent(html);
      expect(result).toContain('Mở đầu chương truyện đầy kịch tính.');
      expect(result).toContain('Nội dung tiếp theo của chương truyện.');
      expect(result).not.toContain('w2w_read_more');
      expect(result).not.toContain('Xem thêm toàn bộ chương');
      expect(result).not.toContain('Nhấn vào đây để mở rộng');
    });

    it('2.2: Strips .readmore_open_button and .readmore_close_button', () => {
      const html = `
        <div class="chapter-content">
          <p>Văn bản truyện phần 1.</p>
          <a href="javascript:void(0)" class="readmore_open_button">Đọc tiếp ▼</a>
          <p>Văn bản truyện phần 2.</p>
          <div class="readmore_close_button">Thu gọn ▲</div>
        </div>
      `;
      const result = sanitizeHtmlContent(html);
      expect(result).toContain('Văn bản truyện phần 1.');
      expect(result).toContain('Văn bản truyện phần 2.');
      expect(result).not.toContain('readmore_open_button');
      expect(result).not.toContain('Đọc tiếp');
      expect(result).not.toContain('readmore_close_button');
      expect(result).not.toContain('Thu gọn');
    });

    it('2.3: Strips social and ad widgets (.social-share, .fb-like, .advertisement, etc.)', () => {
      const html = `
        <div class="content">
          <p>Đoạn truyện đầu.</p>
          <div class="fb-like">Like Fanpage 100k member</div>
          <div class="advertisement">Khuyến mãi nạp thẻ 50%</div>
          <div class="social-share">Chia sẻ qua Zalo, Telegram</div>
          <p>Đoạn truyện cuối.</p>
        </div>
      `;
      const result = sanitizeHtmlContent(html);
      expect(result).toContain('Đoạn truyện đầu.');
      expect(result).toContain('Đoạn truyện cuối.');
      expect(result).not.toContain('Like Fanpage');
      expect(result).not.toContain('Khuyến mãi');
      expect(result).not.toContain('Telegram');
    });
  });

  // =========================================================================
  // Test Suite 3: Ad Line Filtering & Genuine Narrative/Dialogue Preservation
  // =========================================================================
  describe('3. Ad Line Filtering & Dialogue Preservation', () => {
    const commonAdKeywords = ['nguồn', 'nguồn gốc', 'nguồn nước', 'liên kết', 'chia sẻ', 'truyện'];

    it('3.1: Preserves dialogue with double quotes containing keywords', () => {
      const text = [
        '"Nguồn gốc của bảo kiếm này rốt cuộc từ đâu mà có?" Tiêu Viêm ngạc nhiên hỏi.',
        '"Nguồn nước ở con suối này độc tính cực mạnh, ngàn vạn lần chớ uống!" Dược Lão trầm giọng cảnh báo.',
        '"Chúng ta hãy liên kết lại, cùng nhau xông vào cấm địa!" Tiêu Huân Nhi kiên quyết nói.',
        '"Hãy chia sẻ cho ta chút ít dược liệu này được không?" tên mập cười xuề xòa.',
        '"Ngươi có từng nghe qua câu chuyện ngàn năm trước của Đấu Khí Đại Lục?"'
      ].join('\n');

      const filtered = removeAdLines(text, commonAdKeywords);

      expect(filtered).toContain('Nguồn gốc của bảo kiếm');
      expect(filtered).toContain('Nguồn nước ở con suối này');
      expect(filtered).toContain('Chúng ta hãy liên kết lại');
      expect(filtered).toContain('Hãy chia sẻ cho ta');
      expect(filtered).toContain('câu chuyện ngàn năm trước');
    });

    it('3.2: Preserves dialogue with Vietnamese quotes (“...”) containing keywords', () => {
      const text = [
        '“Nguồn gốc công pháp của ngươi thật quái dị.” Lão giả vuốt râu.',
        '“Nguồn nước linh tuyền này thật sảng khoái!” Nàng thốt lên.',
        '“Liên kết giữa hai người bọn họ dường như không thể chia cắt.”',
        '“Chia sẻ khó khăn cùng bằng hữu là việc nên làm.”'
      ].join('\n');

      const filtered = removeAdLines(text, commonAdKeywords);

      expect(filtered).toContain('Nguồn gốc công pháp');
      expect(filtered).toContain('Nguồn nước linh tuyền');
      expect(filtered).toContain('Liên kết giữa hai người');
      expect(filtered).toContain('Chia sẻ khó khăn');
    });

    it('3.3: Preserves dialogue with leading dialogue dashes (- / — / –)', () => {
      const text = [
        '- Nguồn gốc của vật này rất phức tạp, sau này ta sẽ kể cho con nghe.',
        '— Nguồn nước độc hại này đã hủy hoại cả ngôi làng.',
        '– Hãy liên kết các phân đà lại để ứng phó ma thú triều.',
        '- Nàng có muốn chia sẻ tâm sự cùng ta không?',
        '— Truyện này ta đã đọc từ thuở nhỏ rồi.'
      ].join('\n');

      const filtered = removeAdLines(text, commonAdKeywords);

      expect(filtered).toContain('Nguồn gốc của vật này rất phức tạp');
      expect(filtered).toContain('Nguồn nước độc hại');
      expect(filtered).toContain('Hãy liên kết các phân đà');
      expect(filtered).toContain('Nàng có muốn chia sẻ tâm sự');
      expect(filtered).toContain('Truyện này ta đã đọc');
    });

    it('3.4: Removes actual advertisement lines containing keywords', () => {
      const text = [
        'Đoạn văn mở đầu bình thường.',
        'Nguồn: truyenfull.vn - Trang web đọc truyện chữ hàng đầu',
        'Nguồn gốc: convert từ qidian.com bởi translator123',
        'Nguồn gốc: convert từ qidian',
        'Nguồn gốc: TruyenYY',
        'Nguồn gốc: Sưu tầm',
        'Nguồn gốc - Bàn Long Hội',
        'Đọc truyện tại web truyen.net để ủng hộ tác giả và dịch giả',
        'Chia sẻ truyện lên Facebook để nhận chương VIP mỗi ngày',
        'Liên kết website: https://novel-scraper.info',
        'Đoạn văn kết thúc câu chuyện.'
      ].join('\n');

      const filtered = removeAdLines(text, commonAdKeywords);

      expect(filtered).toContain('Đoạn văn mở đầu bình thường.');
      expect(filtered).toContain('Đoạn văn kết thúc câu chuyện.');
      expect(filtered).not.toContain('truyenfull.vn');
      expect(filtered).not.toContain('qidian.com');
      expect(filtered).not.toContain('convert từ qidian');
      expect(filtered).not.toContain('TruyenYY');
      expect(filtered).not.toContain('Sưu tầm');
      expect(filtered).not.toContain('Bàn Long Hội');
      expect(filtered).not.toContain('truyen.net');
      expect(filtered).not.toContain('Chia sẻ truyện lên Facebook');
      expect(filtered).not.toContain('novel-scraper.info');
    });

    it('3.5: Discards ads disguised as dialogue with strong ad indicators', () => {
      const fakeDialogueAds = [
        '"Đọc truyện tại https://truyenhdt.com để đọc chương mới nhất!"',
        '- Nguồn: truyenfull.vn, cảm ơn bạn đọc đã theo dõi.',
        '“Chia sẻ truyện để ủng hộ nhóm dịch nhé các bạn!”'
      ].join('\n');

      const filtered = removeAdLines(fakeDialogueAds, commonAdKeywords);

      expect(filtered).not.toContain('truyenhdt.com');
      expect(filtered).not.toContain('truyenfull.vn');
      expect(filtered).not.toContain('Chia sẻ truyện để ủng hộ');
    });

    it('3.6: Tests non-dialogue narrative prose containing keywords in context', () => {
      const narrativeProse = [
        'Tiêu Viêm lội qua con suối sâu, tìm kiếm nguồn nước tinh khiết chảy từ đỉnh núi tuyết.',
        'Hắn bắt đầu suy ngẫm về nguồn gốc bí ẩn của chiếc nhẫn màu đen trên ngón tay.',
        'Hai đại gia tộc quyết định liên kết liên minh phòng thủ trước sự trỗi dậy của Hồn Điện.',
        'Cả hai cùng chia sẻ gánh nặng trong những ngày tháng gian nan nhất.',
        'Đó là một câu chuyện bi tráng được lưu truyền qua hàng vạn năm của đại lục.'
      ].join('\n');

      const filtered = removeAdLines(narrativeProse, ['nguồn', 'truyện']);

      expect(filtered).toContain('nguồn nước tinh khiết');
      expect(filtered).toContain('nguồn gốc bí ẩn');
      expect(filtered).toContain('quyết định liên kết liên minh');
      expect(filtered).toContain('cùng chia sẻ gánh nặng');
      expect(filtered).toContain('câu chuyện bi tráng');
    });

    it('3.7: Preserves short narrative sentences (<60 chars) starting with compound words (Nguồn gốc, Nguồn nước, Nguồn năng lượng, Truyện kể rằng)', () => {
      const sentences = [
        'Nguồn gốc của hắn rất bí ẩn.',
        'Nguồn nước ở đây rất trong mát.',
        'Nguồn năng lượng này cực kỳ to lớn và hung bạo.',
        'Truyện kể rằng ngày xửa ngày xưa có một vị kiếm tiên tuyệt thế trên đỉnh núi cao vời vợi.'
      ].join('\n');

      const filtered = removeAdLines(sentences, ['nguồn', 'truyện']);
      // Compound words and generic keywords in narrative are properly preserved:
      expect(filtered.includes('Nguồn gốc của hắn rất bí ẩn.')).toBe(true);
      expect(filtered.includes('Nguồn nước ở đây rất trong mát.')).toBe(true);
      expect(filtered.includes('Nguồn năng lượng này cực kỳ to lớn')).toBe(true);
      expect(filtered.includes('Truyện kể rằng')).toBe(true);
    });

    it('3.8: Preserves non-dialogue prose containing "chia sẻ" or "liên kết" unless accompanied by strong ad markers', () => {
      const narrativeWithChiaSe = [
        'Hai gia tộc quyết định liên kết sức mạnh lại với nhau để chống lại thế lực tà ác phương Bắc.',
        'Nàng luôn sẵn lòng chia sẻ thức ăn và áo ấm cho những người nghèo khổ trong thành phố này.',
        'Hai người cùng chia sẻ khó khăn.',
        'Hai gia tộc liên kết sức mạnh.'
      ].join('\n');

      const filteredChiaSe = removeAdLines(narrativeWithChiaSe, ['chia sẻ']);
      const filteredLienKet = removeAdLines(narrativeWithChiaSe, ['liên kết']);

      // Because 'chia sẻ' and 'liên kết' are classified as generic keywords without strong ad markers:
      expect(filteredChiaSe.includes('chia sẻ thức ăn')).toBe(true);
      expect(filteredChiaSe.includes('Hai người cùng chia sẻ khó khăn.')).toBe(true);
      expect(filteredLienKet.includes('liên kết sức mạnh')).toBe(true);
      expect(filteredLienKet.includes('Hai gia tộc liên kết sức mạnh.')).toBe(true);
    });

    it('3.9: Preserves dialogue formatted with ASCII single quotes (\'...\') in isQuotedDialogue', () => {
      const singleQuoteDialogue = [
        "'Chúng ta hãy liên kết lại, cùng nhau xông vào cấm địa!'",
        "'Hãy chia sẻ đi!'"
      ].join('\n');

      const filtered = removeAdLines(singleQuoteDialogue, commonAdKeywords);
      // ASCII single quotes are properly recognized as dialogue and preserved:
      expect(filtered.includes('Chúng ta hãy liên kết lại')).toBe(true);
      expect(filtered.includes('Hãy chia sẻ đi')).toBe(true);
    });

    it('3.10: Genuine dialogue with standard double quotes or dashes is successfully preserved', () => {
      const dialogue = [
        '"Nguồn gốc của bảo kiếm này rốt cuộc từ đâu mà có?"',
        '“Nguồn nước ở con suối này độc tính cực mạnh!”',
        '- Chúng ta hãy liên kết lại, cùng nhau xông vào cấm địa!',
        '— Hãy chia sẻ cho ta chút ít dược liệu này.'
      ].join('\n');

      const filtered = removeAdLines(dialogue, commonAdKeywords);
      expect(filtered).toContain('Nguồn gốc của bảo kiếm');
      expect(filtered).toContain('Nguồn nước ở con suối');
      expect(filtered).toContain('Chúng ta hãy liên kết lại');
      expect(filtered).toContain('Hãy chia sẻ cho ta');
    });

    it('3.11: Removes attribution ad lines with compound nouns (Nguồn gốc, Nguồn cội) without TLDs while preserving narrative', () => {
      const adLinesWithoutTld = [
        'Nguồn gốc: convert từ qidian',
        'Nguồn gốc: TruyenYY',
        'Nguồn gốc: Sưu tầm',
        'Nguồn gốc - Bàn Long Hội',
        'Nguồn cội: TruyenFull',
        'Nguồn gốc：convert từ qidian',
        '[Nguồn gốc: TruyenYY]',
        'Nguồn: truyenfull',
        'Nguồn - tangthuvien'
      ];

      for (const adLine of adLinesWithoutTld) {
        const result = removeAdLines(adLine, ['nguồn']);
        expect(result.trim(), `Expected ad line "${adLine}" to be removed`).toBe('');
      }

      const narrativeLines = [
        'Nguồn gốc của hắn rất bí ẩn.',
        'Nguồn nước trong suối rất ngọt ngào.',
        'Nguồn năng lượng này cực kỳ to lớn và hung bạo.'
      ];

      for (const narrative of narrativeLines) {
        const result = removeAdLines(narrative, ['nguồn']);
        expect(result, `Expected narrative line "${narrative}" to be preserved`).toContain(narrative);
      }
    });
  });

  // =========================================================================
  // Test Suite 4: End-to-End Extraction with sanitizeHtmlContent
  // =========================================================================
  describe('4. End-to-End Extraction with sanitizeHtmlContent', () => {
    it('4.1: Comprehensive adversarial HTML containing honeypots, widgets, and ads', () => {
      const complexHtml = `
        <div id="chapter-content">
          <div style="display:none">TRAP_HONEYPOT_1: Bot detection trap</div>
          <div STYLE="DISPLAY: NONE;">TRAP_HONEYPOT_2: Uppercase style trap</div>
          <p hidden>TRAP_HONEYPOT_3: Hidden attribute trap</p>
          <span style="visibility:hidden">TRAP_HONEYPOT_4: Visibility hidden trap</span>
          <div aria-hidden="true">TRAP_HONEYPOT_5: Aria hidden trap</div>
          <div class="w2w_read_more"><button>TRAP_WIDGET_1: Read more</button></div>
          <div class="readmore_open_button">TRAP_WIDGET_2: Open button</div>
          <div class="readmore_close_button">TRAP_WIDGET_3: Close button</div>

          <p>“Nguồn gốc của luồng năng lượng này rốt cuộc từ đâu?” Tiêu Viêm tự hỏi.</p>
          <div class="ads">Quảng cáo nhà thuốc gia truyền 3 đời</div>
          <p>- Nguồn nước này độc lắm, cẩn thận kẻo trúng độc!</p>
          <p>Nguồn: truyenfull.vn - Đọc truyện online hay nhất</p>
          <p>Hai người nhìn nhau mỉm cười, cùng chia sẻ mật ngọt chiến thắng sau trận chiến sinh tử.</p>
          <div style="display:none">
            TRAP_NESTED_PARENT
            <div style="visibility:hidden">TRAP_NESTED_CHILD</div>
          </div>
          <p>Ánh tà dương buông xuống, bóng hình hai người dần khuất sau rặng núi xa xôi.</p>
        </div>
      `;

      const keywords = ['nguồn:', 'truyenfull', 'quảng cáo'];
      const result = sanitizeHtmlContent(complexHtml, keywords);

      // Verify all honeypots and unwanted widgets stripped
      expect(result).not.toContain('TRAP_HONEYPOT_1');
      expect(result).not.toContain('TRAP_HONEYPOT_2');
      expect(result).not.toContain('TRAP_HONEYPOT_3');
      expect(result).not.toContain('TRAP_HONEYPOT_4');
      expect(result).not.toContain('TRAP_HONEYPOT_5');
      expect(result).not.toContain('TRAP_WIDGET_1');
      expect(result).not.toContain('TRAP_WIDGET_2');
      expect(result).not.toContain('TRAP_WIDGET_3');
      expect(result).not.toContain('TRAP_NESTED_PARENT');
      expect(result).not.toContain('TRAP_NESTED_CHILD');
      expect(result).not.toContain('Quảng cáo nhà thuốc');
      expect(result).not.toContain('Nguồn: truyenfull.vn');

      // Verify legitimate dialogue and narrative preserved
      expect(result).toContain('“Nguồn gốc của luồng năng lượng này rốt cuộc từ đâu?” Tiêu Viêm tự hỏi.');
      expect(result).toContain('- Nguồn nước này độc lắm, cẩn thận kẻo trúng độc!');
      expect(result).toContain('Hai người nhìn nhau mỉm cười, cùng chia sẻ mật ngọt chiến thắng sau trận chiến sinh tử.');
      expect(result).toContain('Ánh tà dương buông xuống, bóng hình hai người dần khuất sau rặng núi xa xôi.');
    });
  });
});
