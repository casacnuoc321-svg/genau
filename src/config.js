/* ========================================
   GENAU Bot — Configuration
   ======================================== */

// RSS Feeds — German news sources
export const RSS_FEEDS = [
  {
    name: 'Tagesschau',
    url: 'https://www.tagesschau.de/index~rss2.xml',
    icon: '📺'
  },
  {
    name: 'Deutsche Welle',
    url: 'https://rss.dw.com/xml/rss-de-all',
    icon: '🌐'
  },
  {
    name: 'SPIEGEL',
    url: 'https://www.spiegel.de/schlagzeilen/index.rss',
    icon: '📰'
  },
  {
    name: 'Zeit Online',
    url: 'https://newsfeed.zeit.de/index',
    icon: '🗞️'
  },
  {
    name: 'Süddeutsche Zeitung',
    url: 'https://rss.sueddeutsche.de/rss/Topthemen',
    icon: '📄'
  }
];

// Schedule — 3 times per day (8h, 14h, 20h CET)
export const CRON_SCHEDULE = '0 8,14,20 * * *';

// How many articles to show per crawl cycle
export const MAX_ARTICLES_PER_CYCLE = 10;

// Poster settings
export const POSTER = {
  width: 1080,
  height: 1080,
  titleBgColor: '#FFCC00',
  highlightColor: '#DD0000',
  footerBgColor: '#DD0000',
  footerText: 'Kênh thông tin Việt Nam - Đức',
  brandName: 'GENAU',
  fontSize: 42
};

// Gemini prompts
export const PROMPTS = {
  filterArticles: `Bạn là biên tập viên của kênh GENAU — kênh thông tin cho cộng đồng người Việt tại Đức.

Dưới đây là danh sách bài báo tiếng Đức mới nhất. Hãy chọn ra tối đa 10 bài HAY NHẤT, chia làm 2 nhóm:

**NHÓM A (5 bài ưu tiên) — Người Việt & Nhập cư:**
- Tin liên quan trực tiếp đến người Việt Nam tại Đức
- Luật nhập cư, visa, cư trú, nhập quốc tịch
- Chính sách về người nước ngoài, lao động nước ngoài
- Quan hệ Đức - Việt Nam, Đức - châu Á
- Phân biệt đối xử, hội nhập, cộng đồng nước ngoài

**NHÓM B (5 bài) — Đời sống xã hội Đức:**
- Việc làm, lương, kinh tế, giá cả
- An ninh, tai nạn, cảnh báo
- Đời sống hàng ngày, giao thông, y tế
- Tin hot, giật gân, bất ngờ
- Giáo dục, nhà ở, thời tiết

Nếu không đủ 5 bài nhóm A, bổ sung thêm bài nhóm B.

Với mỗi bài được chọn, trả về JSON array với format:
[
  {
    "originalTitle": "tiêu đề gốc tiếng Đức",
    "link": "link gốc",
    "summaryVi": "tóm tắt 1-2 câu bằng tiếng Việt",
    "reason": "lý do chọn bài này (ngắn gọn)",
    "relevanceScore": 1-10,
    "group": "A" hoặc "B"
  }
]

Sắp xếp: nhóm A trước, nhóm B sau. Trong mỗi nhóm, bài có relevanceScore cao nhất lên trước.
CHỈ trả JSON, không thêm gì khác.`,

  generateContent: `Bạn là content creator của kênh GENAU — kênh chia sẻ cuộc sống ở Đức cho cộng đồng Việt.

Dựa trên bài báo dưới đây, hãy tạo:

1. **posterTitle**: Tiêu đề cho poster (tối đa 12 từ, IN HOA, ngắn gọn, gây chú ý). Dùng [hl]...[/hl] để đánh dấu 1-2 từ khóa quan trọng cần highlight.

2. **caption**: Caption Facebook bằng tiếng Việt, NGẮN GỌN:
   - Đoạn 1 (3 câu): Mở đầu bằng emoji + hook gây tò mò, tóm tắt nội dung chính
   - Đoạn 2 (3 câu): Chi tiết quan trọng hoặc ảnh hưởng đến cộng đồng Việt
   - Dòng cuối: 📰 Nguồn: [tên báo gốc]
   - Dòng hashtag: #GENAU #CuocSongDuc + 2-3 hashtag phù hợp
   - KHÔNG viết quá dài, tối đa 80 từ

3. **imageSource**: Tên trang báo gốc

4. **imageKeywords**: Mảng 3-5 từ khóa tiếng Anh để tìm ảnh minh họa trên Pexels (ảnh stock). Ví dụ: ["pharmacy", "germany", "protest"] hoặc ["train", "accident", "railway"]. Chọn từ khóa cụ thể, mô tả trực quan.

Trả về JSON:
{
  "posterTitle": "...",
  "caption": "...",
  "imageSource": "...",
  "imageKeywords": ["keyword1", "keyword2", "keyword3"]
}

CHỈ trả JSON, không thêm gì khác.`
};
