/* ========================================
   GENAU Bot — RSS Scraper
   ======================================== */

import RSSParser from 'rss-parser';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { RSS_FEEDS, MAX_ARTICLES_PER_CYCLE } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROCESSED_FILE = join(__dirname, '..', 'data', 'processed.json');

const parser = new RSSParser({
  timeout: 15000,
  headers: {
    'User-Agent': 'GENAU-Bot/1.0'
  }
});

/**
 * Load processed article IDs to avoid duplicates
 */
function loadProcessed() {
  if (!existsSync(PROCESSED_FILE)) {
    writeFileSync(PROCESSED_FILE, JSON.stringify({ articles: [] }), 'utf-8');
    return new Set();
  }
  try {
    const data = JSON.parse(readFileSync(PROCESSED_FILE, 'utf-8'));
    return new Set(data.articles || []);
  } catch {
    return new Set();
  }
}

/**
 * Save processed article IDs
 */
function saveProcessed(processedSet) {
  // Keep only last 500 IDs to prevent file from growing infinitely
  const arr = [...processedSet].slice(-500);
  writeFileSync(PROCESSED_FILE, JSON.stringify({ articles: arr }, null, 2), 'utf-8');
}

/**
 * Generate a unique ID for an article
 */
function articleId(article) {
  return article.link || article.guid || article.title;
}

/**
 * Fetch and parse all RSS feeds
 * @returns {Promise<Array>} List of new articles
 */
export async function crawlFeeds() {
  const processed = loadProcessed();
  const allArticles = [];

  console.log('🔍 Crawling RSS feeds...');

  for (const feed of RSS_FEEDS) {
    try {
      console.log(`  ${feed.icon} ${feed.name}...`);
      const result = await parser.parseURL(feed.url);

      for (const item of result.items.slice(0, 15)) {
        const id = articleId(item);
        if (processed.has(id)) continue;

        allArticles.push({
          id,
          source: feed.name,
          sourceIcon: feed.icon,
          title: item.title || '',
          description: item.contentSnippet || item.content || item.description || '',
          link: item.link || '',
          image: extractImage(item),
          pubDate: item.pubDate || item.isoDate || new Date().toISOString()
        });
      }
    } catch (err) {
      console.error(`  ❌ Failed to fetch ${feed.name}: ${err.message}`);
    }
  }

  // Sort by date (newest first)
  allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  console.log(`📊 Found ${allArticles.length} new articles`);
  return allArticles.slice(0, MAX_ARTICLES_PER_CYCLE * 3); // Feed more to AI for better selection
}

/**
 * Mark articles as processed
 */
export function markProcessed(articleIds) {
  const processed = loadProcessed();
  for (const id of articleIds) {
    processed.add(id);
  }
  saveProcessed(processed);
}

/**
 * Extract image URL from RSS item
 */
function extractImage(item) {
  // Try enclosure
  if (item.enclosure && item.enclosure.url) {
    return item.enclosure.url;
  }

  // Try media content
  if (item['media:content'] && item['media:content'].$) {
    return item['media:content'].$.url;
  }

  // Try to extract from content HTML
  if (item.content) {
    const match = item.content.match(/<img[^>]+src="([^"]+)"/);
    if (match) return match[1];
  }

  // Try description
  if (item.description) {
    const match = item.description.match(/<img[^>]+src="([^"]+)"/);
    if (match) return match[1];
  }

  return null;
}

/**
 * Scrape article page for all images
 * @returns {Promise<string[]>} Array of image URLs
 */
export async function scrapeArticleImages(articleUrl) {
  if (!articleUrl) return [];
  
  try {
    const html = await fetchPage(articleUrl);
    const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
    const images = [];
    const seen = new Set();
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
      let src = match[0]; // full tag
      let url = match[1]; // src value

      // Skip data URIs, SVGs, tracking pixels
      if (url.startsWith('data:') || url.endsWith('.svg') || url.endsWith('.gif')) continue;
      
      // Make absolute URL
      if (url.startsWith('//')) url = 'https:' + url;
      else if (url.startsWith('/')) {
        const base = new URL(articleUrl);
        url = base.origin + url;
      }
      
      // Skip non-http URLs
      if (!url.startsWith('http')) continue;
      
      // Skip known logo/icon patterns
      const lower = url.toLowerCase();
      if (lower.includes('logo') || lower.includes('icon') || lower.includes('avatar') ||
          lower.includes('banner') || lower.includes('button') || lower.includes('tracking') ||
          lower.includes('pixel') || lower.includes('badge') || lower.includes('share') ||
          lower.includes('facebook') || lower.includes('twitter') || lower.includes('whatsapp') ||
          lower.includes('1x1') || lower.includes('spacer')) continue;

      // Check for width/height attributes that suggest small images
      const widthMatch = src.match(/width="?(\d+)"?/i);
      const heightMatch = src.match(/height="?(\d+)"?/i);
      if (widthMatch && parseInt(widthMatch[1]) < 100) continue;
      if (heightMatch && parseInt(heightMatch[1]) < 100) continue;

      if (!seen.has(url)) {
        seen.add(url);
        images.push(url);
      }
    }

    // Also check for og:image and other meta images
    const ogMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
    if (ogMatch && !seen.has(ogMatch[1])) {
      images.unshift(ogMatch[1]); // Add to front
    }

    console.log(`  📸 Found ${images.length} images from article page`);
    return images.slice(0, 10); // Max 10 images
  } catch (err) {
    console.error(`  ⚠️ Could not scrape images: ${err.message}`);
    return [];
  }
}

/**
 * Fetch a page's HTML
 */
import https from 'https';
import http from 'http';

function fetchPage(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    const proto = url.startsWith('https') ? https : http;
    const request = proto.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      timeout: 15000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const newUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return fetchPage(newUrl, maxRedirects - 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });
    request.on('error', reject);
    request.on('timeout', () => { request.destroy(); reject(new Error('Timeout')); });
  });
}
