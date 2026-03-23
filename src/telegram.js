/* ========================================
   GENAU Bot — Telegram Module
   ======================================== */

import { Telegraf, Markup } from 'telegraf';

let bot;
let chatId;

// Store pending articles (waiting for user approval)
const pendingArticles = new Map();
// Store articles waiting for template selection
const pendingTemplateChoice = new Map();

// Callbacks
let onApproveCallback = null;
let onCrawlCallback = null;

/**
 * Initialize Telegram bot
 */
export function initTelegram(token, targetChatId) {
  chatId = targetChatId;
  bot = new Telegraf(token);

  // Handle callback buttons (approve/reject)
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (data.startsWith('approve_')) {
      const articleId = data.replace('approve_', '');
      const article = pendingArticles.get(articleId);

      if (article) {
        pendingArticles.delete(articleId);
        await ctx.answerCbQuery('✅ Đã duyệt! Chọn template...');
        await ctx.editMessageReplyMarkup(undefined);

        try {
          await ctx.editMessageText(
            ctx.callbackQuery.message.text + '\n\n✅ ĐÃ DUYỆT',
            { parse_mode: 'HTML' }
          );
        } catch (e) { /* ignore */ }

        // Ask for template selection
        const tmplId = Date.now().toString(36);
        pendingTemplateChoice.set(tmplId, article);

        await bot.telegram.sendMessage(chatId,
          '🎨 <b>Chọn template poster:</b>',
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('1️⃣ Classic', `tmpl_${tmplId}_0`),
               Markup.button.callback('2️⃣ Dark', `tmpl_${tmplId}_1`)],
              [Markup.button.callback('3️⃣ Split', `tmpl_${tmplId}_2`),
               Markup.button.callback('4️⃣ Bold', `tmpl_${tmplId}_3`)],
              [Markup.button.callback('🎲 Random', `tmpl_${tmplId}_random`)]
            ])
          }
        );
      } else {
        await ctx.answerCbQuery('⚠️ Bài này đã hết hạn');
      }

    } else if (data.startsWith('tmpl_')) {
      // Template selection: tmpl_{id}_{index}
      const parts = data.split('_');
      const tmplId = parts[1];
      const choice = parts[2];
      const article = pendingTemplateChoice.get(tmplId);

      if (article) {
        pendingTemplateChoice.delete(tmplId);
        const templateIndex = choice === 'random' ? Math.floor(Math.random() * 4) : parseInt(choice);
        const names = ['Classic', 'Dark', 'Split', 'Bold'];
        await ctx.answerCbQuery(`🎨 Template: ${names[templateIndex]}`);
        await ctx.editMessageText(`🎨 Template: <b>${names[templateIndex]}</b> — Đang tạo poster...`, { parse_mode: 'HTML' });

        if (onApproveCallback) {
          onApproveCallback(article, templateIndex);
        }
      } else {
        await ctx.answerCbQuery('⚠️ Đã hết hạn');
      }

    } else if (data.startsWith('reject_')) {
      const articleId = data.replace('reject_', '');
      pendingArticles.delete(articleId);
      await ctx.answerCbQuery('❌ Đã bỏ qua');

      try {
        await ctx.editMessageText(
          ctx.callbackQuery.message.text + '\n\n❌ ĐÃ BỎ QUA',
          { parse_mode: 'HTML' }
        );
        await ctx.editMessageReplyMarkup(undefined);
      } catch (e) { /* ignore */ }
    }
  });

  // Simple commands
  bot.command('start', (ctx) => {
    ctx.reply(
      '🇩🇪 *GENAU Bot*\n\n' +
      'Bot tự động tìm tin tức từ Đức cho cộng đồng Việt.\n\n' +
      '📋 Lệnh:\n' +
      '/status — Trạng thái bot\n' +
      '/crawl — Chạy crawl ngay\n',
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('status', (ctx) => {
    ctx.reply(
      `🟢 GENAU Bot đang chạy\n` +
      `📰 Đang chờ duyệt: ${pendingArticles.size} bài\n` +
      `⏰ Thời gian: ${new Date().toLocaleString('vi-VN', { timeZone: 'Europe/Berlin' })}`
    );
  });

  bot.command('crawl', async (ctx) => {
    await ctx.reply('🔄 Đang chạy crawl...');
    if (onCrawlCallback) {
      onCrawlCallback();
    }
  });

  console.log('📱 Telegram bot initialized');
  return bot;
}

/**
 * Start the bot (start polling)
 */
export async function startBot() {
  if (!bot) throw new Error('Bot not initialized');
  await bot.launch();
  console.log('📱 Telegram bot started');

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

/**
 * Set callback for article approval
 */
export function onApprove(callback) {
  onApproveCallback = callback;
}

/**
 * Set callback for manual crawl trigger
 */
export function onCrawl(callback) {
  onCrawlCallback = callback;
}

/**
 * Send article preview for approval
 */
export async function sendArticlePreview(article) {
  if (!bot || !chatId) return;

  // Create a short ID for callbacks
  const shortId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  pendingArticles.set(shortId, article);

  const message =
    `${article.sourceIcon || '📰'} <b>${article.source || 'Tin tức'}</b>\n\n` +
    `📰 <b>${article.originalTitle || ''}</b>\n\n` +
    `📝 ${article.summaryVi || ''}\n\n` +
    `⭐ Điểm: ${article.relevanceScore || '?'}/10\n` +
    `💡 ${article.reason || ''}\n\n` +
    `🔗 <a href="${article.link}">Đọc bản gốc</a>`;

  try {
    await bot.telegram.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      ...Markup.inlineKeyboard([
        Markup.button.callback('✅ Duyệt & Tạo poster', `approve_${shortId}`),
        Markup.button.callback('❌ Bỏ qua', `reject_${shortId}`)
      ])
    });
  } catch (err) {
    console.error('❌ Failed to send preview:', err.message);
  }
}

/**
 * Send batch separator
 */
export async function sendBatchHeader(count) {
  if (!bot || !chatId) return;
  const time = new Date().toLocaleString('vi-VN', { timeZone: 'Europe/Berlin' });
  try {
    await bot.telegram.sendMessage(
      chatId,
      `🔔 <b>GENAU — Tin mới</b>\n` +
      `⏰ ${time}\n` +
      `📊 ${count} bài đã lọc\n` +
      `━━━━━━━━━━━━━━━`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    console.error('❌ Failed to send batch header:', err.message);
  }
}

/**
 * Send final result (poster image + caption + article images)
 */
export async function sendResult(posterBuffer, caption, articleImages = []) {
  if (!bot || !chatId) return;

  try {
    // Send poster image
    await bot.telegram.sendPhoto(chatId, { source: posterBuffer }, {
      caption: '🎨 Poster đã tạo xong! ⬆️'
    });

    // Send caption as separate message for easy copy
    await bot.telegram.sendMessage(
      chatId,
      `📋 <b>CAPTION:</b>\n\n${caption}\n\n` +
      `━━━━━━━━━━━━━━━\n` +
      `💡 Copy caption ở trên và đăng lên Facebook cùng ảnh poster`,
      { parse_mode: 'HTML' }
    );

    // Send article images as album if available
    if (articleImages.length > 1) {
      const mediaGroup = [];
      for (const img of articleImages.slice(0, 10)) {
        const imgUrl = typeof img === 'string' ? img : (img.urlMedium || img.url);
        const credit = typeof img === 'string' ? '' : ` (📷 ${img.photographer})`;
        mediaGroup.push({
          type: 'photo',
          media: imgUrl,
          ...(mediaGroup.length === 0 ? { caption: `📸 ${articleImages.length} ảnh minh họa miễn phí từ Pexels — Có thể dùng cho bài Facebook` } : {})
        });
      }

      try {
        await bot.telegram.sendMediaGroup(chatId, mediaGroup);
        
        const credits = articleImages
          .filter(img => typeof img !== 'string' && img.photographer)
          .map(img => `📷 ${img.photographer}`)
          .join('\n');
        
        await bot.telegram.sendMessage(
          chatId,
          `💡 <b>GỢI Ý:</b> Dùng ảnh minh họa trên + poster để đăng <b>album Facebook</b>\n\n` +
          `✅ Ảnh từ Pexels — <b>miễn phí thương mại</b>\n` +
          (credits ? `\n<b>Credit:</b>\n${credits}` : ''),
          { parse_mode: 'HTML' }
        );
      } catch (imgErr) {
        console.error('  ⚠️ Could not send image album:', imgErr.message);
      }
    }
  } catch (err) {
    console.error('❌ Failed to send result:', err.message);
  }
}

/**
 * Send error notification
 */
export async function sendError(message) {
  if (!bot || !chatId) return;
  try {
    await bot.telegram.sendMessage(chatId, `⚠️ <b>Lỗi:</b> ${message}`, {
      parse_mode: 'HTML'
    });
  } catch (err) {
    console.error('❌ Failed to send error:', err.message);
  }
}
