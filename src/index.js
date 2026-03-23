/* ========================================
   GENAU Bot — Entry Point
   Main orchestrator: scheduler + pipeline
   ======================================== */

import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';

import { crawlFeeds, markProcessed } from './scraper.js';
import { initPexels, searchImages } from './images.js';
import { initAI, filterArticles, generateContent } from './ai.js';
import { generatePoster } from './poster.js';
import {
  initTelegram, startBot, onApprove, onCrawl,
  sendArticlePreview, sendBatchHeader, sendResult, sendError
} from './telegram.js';
import { CRON_SCHEDULE } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ========== Ensure data dir exists ==========
const dataDir = join(__dirname, '..', 'data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

// ========== Load .env manually ==========
function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch (err) {
    console.error('⚠️ Could not load .env file:', err.message);
  }
}

// ========== Main Pipeline ==========
async function runPipeline() {
  console.log('\n' + '='.repeat(50));
  console.log(`🚀 GENAU Pipeline — ${new Date().toLocaleString('vi-VN', { timeZone: 'Europe/Berlin' })}`);
  console.log('='.repeat(50));

  try {
    // Step 1: Crawl RSS feeds
    const articles = await crawlFeeds();
    if (!articles.length) {
      console.log('📭 Không có bài mới');
      return;
    }

    // Step 2: AI filter & select
    const selected = await filterArticles(articles);
    if (!selected.length) {
      console.log('🤷 AI không chọn được bài nào');
      return;
    }

    // Step 3: Send to Telegram for approval
    await sendBatchHeader(selected.length);

    for (const article of selected) {
      await sendArticlePreview(article);
      if (article.id) markProcessed([article.id]);
      await sleep(1000);
    }

    console.log(`✅ Đã gửi ${selected.length} bài qua Telegram`);

  } catch (err) {
    console.error('❌ Pipeline error:', err);
    await sendError(err.message);
  }
}

// ========== Handle Approval ==========
async function handleApproval(article, templateIndex) {
  console.log(`\n✅ Approved: ${article.originalTitle || ''}`);

  try {
    // Generate content via Gemini
    const content = await generateContent(article);
    if (!content) {
      await sendError('Không thể tạo content cho bài này');
      return;
    }

    // Search for royalty-free images on Pexels
    let freeImages = [];
    if (content.imageKeywords && content.imageKeywords.length) {
      console.log(`📸 Pexels search: ${content.imageKeywords.join(', ')}`);
      freeImages = await searchImages(content.imageKeywords, 5);
    }

    // Use Pexels image for poster (royalty-free), fallback to RSS image
    const posterImage = (freeImages.length ? freeImages[0].url : null) || article.image;
    const posterBuffer = await generatePoster(content, posterImage, templateIndex);

    // Send to Telegram (with royalty-free images)
    await sendResult(posterBuffer, content.caption, freeImages);
    console.log('✅ Result sent to Telegram');

  } catch (err) {
    console.error('❌ Approval handler error:', err);
    await sendError(`Lỗi xử lý: ${err.message}`);
  }
}

// ========== Start ==========
async function main() {
  console.log('🇩🇪 GENAU Auto News Bot');
  console.log('========================\n');

  loadEnv();

  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, GEMINI_API_KEY } = process.env;

  // Validate keys
  const missing = [];
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN.includes('your_')) missing.push('TELEGRAM_BOT_TOKEN');
  if (!TELEGRAM_CHAT_ID || TELEGRAM_CHAT_ID.includes('your_')) missing.push('TELEGRAM_CHAT_ID');
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('your_')) missing.push('GEMINI_API_KEY');

  if (missing.length) {
    console.error(`❌ Missing in .env: ${missing.join(', ')}`);
    console.error('   Edit genau-bot/.env and fill in your API keys');
    process.exit(1);
  }

  // Initialize modules
  initAI(GEMINI_API_KEY);
  initPexels(process.env.PEXELS_API_KEY);
  initTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);
  onApprove(handleApproval);
  onCrawl(runPipeline);

  // Schedule pipeline (3 times/day: 8h, 14h, 20h Berlin time)
  cron.schedule(CRON_SCHEDULE, () => {
    console.log('\n⏰ Scheduled run triggered');
    runPipeline();
  }, { timezone: 'Europe/Berlin' });

  console.log(`⏰ Schedule: ${CRON_SCHEDULE} (Europe/Berlin)`);
  console.log('📱 Đang khởi động bot...\n');

  // Start Telegram bot (this blocks - must be last)
  await startBot();

  console.log('✅ Bot đang chạy! Gửi /crawl trong Telegram để test.\n');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
