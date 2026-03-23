/* ========================================
   GENAU Bot — Gemini AI Module
   ======================================== */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { PROMPTS } from './config.js';

let genAI;
let model;

/**
 * Initialize Gemini
 */
export function initAI(apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  console.log('🤖 Gemini AI initialized');
}

/**
 * Filter & select best articles for Vietnamese community
 * @param {Array} articles - Raw articles from scraper
 * @returns {Promise<Array>} Selected articles with Vietnamese summaries
 */
export async function filterArticles(articles) {
  if (!articles.length) return [];

  // Build article list for AI
  const articleList = articles.map((a, i) =>
    `${i + 1}. [${a.source}] ${a.title}\n   ${a.description.slice(0, 200)}\n   Link: ${a.link}`
  ).join('\n\n');

  const prompt = `${PROMPTS.filterArticles}\n\n--- BÀI BÁO ---\n${articleList}`;

  try {
    console.log('🤖 Gemini: Đang lọc tin...');
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('❌ Gemini returned invalid JSON:', text.slice(0, 200));
      return [];
    }

    const selected = JSON.parse(jsonMatch[0]);
    console.log(`✅ Gemini chọn ${selected.length} bài`);

    // Merge with original article data
    return selected.map(sel => {
      const original = articles.find(a =>
        a.link === sel.link || a.title === sel.originalTitle
      );
      return {
        ...sel,
        source: original?.source || '',
        sourceIcon: original?.sourceIcon || '📰',
        image: original?.image || null,
        id: original?.id || sel.link,
        description: original?.description || ''
      };
    }).filter(a => a.link);

  } catch (err) {
    console.error('❌ Gemini filter error:', err.message);
    return [];
  }
}

/**
 * Generate Vietnamese content (poster title + caption) for an approved article
 * @param {Object} article - The approved article
 * @returns {Promise<Object>} { posterTitle, caption, imageSource }
 */
export async function generateContent(article) {
  const articleInfo = `
Nguồn: ${article.source || ''}
Tiêu đề gốc: ${article.originalTitle || article.title || ''}
Tóm tắt: ${article.summaryVi || article.description || ''}
Link: ${article.link || ''}
  `.trim();

  const prompt = `${PROMPTS.generateContent}\n\n--- BÀI BÁO ---\n${articleInfo}`;

  try {
    console.log('🤖 Gemini: Đang viết content...');
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ Gemini returned invalid content JSON:', text.slice(0, 200));
      return null;
    }

    const content = JSON.parse(jsonMatch[0]);
    console.log('✅ Content đã tạo xong');
    return content;

  } catch (err) {
    console.error('❌ Gemini content error:', err.message);
    return null;
  }
}
