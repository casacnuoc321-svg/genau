/* ========================================
   GENAU Bot — Test Crawl Script
   Run: npm run test-crawl
   ======================================== */

import { crawlFeeds } from './scraper.js';

async function main() {
  console.log('🧪 Testing RSS crawl...\n');

  const articles = await crawlFeeds();

  console.log('\n📋 Results:');
  console.log(`Total articles: ${articles.length}\n`);

  articles.forEach((a, i) => {
    console.log(`${i + 1}. [${a.source}] ${a.title}`);
    console.log(`   🔗 ${a.link}`);
    console.log(`   🖼️ ${a.image ? 'Has image' : 'No image'}`);
    console.log(`   📅 ${a.pubDate}`);
    console.log('');
  });
}

main().catch(console.error);
