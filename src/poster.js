/* ========================================
   GENAU Bot — Poster Generator (Sharp + SVG)
   4 Templates: Classic, Dark, Split, Bold
   ======================================== */

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { POSTER } from './config.js';
import https from 'https';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = join(__dirname, '..', 'assets', 'logo-genau-clean.png');
const W = 1080;
const H = 1080;

// ===== UTILITIES =====

function downloadImage(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      timeout: 15000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const newUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return downloadImage(newUrl, maxRedirects - 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    request.on('error', reject);
    request.on('timeout', () => { request.destroy(); reject(new Error('Timeout')); });
  });
}

function esc(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function parseHL(text) {
  const parts = [];
  const regex = /\[hl\](.*?)\[\/hl\]/g;
  let lastIdx = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push({ t: text.slice(lastIdx, match.index), hl: false });
    parts.push({ t: match[1], hl: true });
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < text.length) parts.push({ t: text.slice(lastIdx), hl: false });
  if (!parts.length) parts.push({ t: text, hl: false });
  return parts;
}

function wrapTitle(text, fontSize, areaW) {
  const parts = parseHL(text);
  const words = [];
  parts.forEach(p => {
    p.t.split(/\s+/).filter(w => w).forEach(w => words.push({ text: w, hl: p.hl }));
  });
  const charsPerLine = Math.floor(areaW / (fontSize * 0.58));
  const lines = [];
  let line = [], len = 0;
  words.forEach(w => {
    const wl = w.text.length + 1;
    if (len + wl > charsPerLine && line.length > 0) { lines.push([...line]); line = [w]; len = wl; }
    else { line.push(w); len += wl; }
  });
  if (line.length) lines.push(line);
  return lines;
}

function titleSvg(text, fontSize, areaW, areaH, normalColor, hlColor, centerX) {
  const lines = wrapTitle(text, fontSize, areaW);
  const lh = fontSize * 1.35;
  const total = lines.length * lh;
  const startY = (areaH - total) / 2 + fontSize;
  let svg = '';
  lines.forEach((words, i) => {
    const y = startY + i * lh;
    const spans = words.map(w => {
      const c = w.hl ? hlColor : normalColor;
      return `<tspan fill="${c}">${esc(w.text)}</tspan>`;
    }).join(' ');
    svg += `<text x="${centerX}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="${fontSize}">${spans}</text>\n`;
  });
  return svg;
}

async function getLogoLayers(topY = 20, leftX = 20, logoH = 80, withBg = true) {
  const layers = [];
  try {
    const buf = readFileSync(LOGO_PATH);
    const resized = await sharp(buf).resize(null, logoH, { fit: 'inside' }).png().toBuffer();
    const meta = await sharp(resized).metadata();
    const logoW = meta.width || 200;
    const logoRealH = meta.height || 80;
    if (withBg) {
      const padX = 20;
      const padTop = 14;
      const padBot = 14;
      const bw = logoW + padX * 2;
      const bh = logoRealH + padTop + padBot;
      const bgSvg = Buffer.from(`<svg width="${bw}" height="${bh}" xmlns="http://www.w3.org/2000/svg"><rect width="${bw}" height="${bh}" rx="12" fill="white" opacity="0.95"/></svg>`);
      layers.push({ input: bgSvg, top: topY, left: leftX });
      // Center logo inside badge
      layers.push({ input: resized, top: topY + padTop, left: leftX + padX });
    } else {
      layers.push({ input: resized, top: topY, left: leftX });
    }
  } catch (e) { console.error('  ⚠️ Logo:', e.message); }
  return layers;
}

async function getArticleImage(imageUrl, w, h) {
  if (!imageUrl) return null;
  try {
    console.log(`  🖼️ Downloading image...`);
    const buf = await downloadImage(imageUrl);
    const img = await sharp(buf).resize(w, h, { fit: 'cover', position: 'centre' }).png().toBuffer();
    console.log(`  ✅ Image OK`);
    return img;
  } catch (e) {
    console.error(`  ⚠️ Image failed: ${e.message}`);
    return null;
  }
}

// ===== TEMPLATE 1: CLASSIC (Ảnh trên + nền vàng + footer đỏ) =====

async function template1(content, imageUrl) {
  const imgH = Math.floor(H * 0.58);
  const footerH = Math.floor(H * 0.10);
  const titleH = H - imgH - footerH;
  const titleY = imgH;
  const footerY = imgH + titleH;

  const titleBg = '#FFCC00';
  const hlColor = '#DD0000';
  const fontSize = 42;

  const tSvg = content.posterTitle ? titleSvg(content.posterTitle, fontSize, W - 80, titleH, '#1a1a1a', hlColor, W / 2) : '';
  const srcSvg = content.imageSource ? `<text x="30" y="${imgH - 15}" font-family="Arial" font-style="italic" font-size="20" fill="rgba(255,255,255,0.85)">${esc('📷 ' + content.imageSource)}</text>` : '';

  const overlay = Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g1" x1="0" y1="${imgH - 120}" x2="0" y2="${imgH}" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="black" stop-opacity="0"/><stop offset="100%" stop-color="black" stop-opacity="0.6"/></linearGradient></defs>
      <rect x="0" y="${imgH - 120}" width="${W}" height="120" fill="url(#g1)"/>
      ${srcSvg}
      <rect x="0" y="${titleY}" width="${W}" height="${titleH}" fill="${titleBg}"/>
      <g transform="translate(0,${titleY})">${tSvg}</g>
      <rect x="0" y="${footerY}" width="${W}" height="${footerH}" fill="#DD0000"/>
      <text x="30" y="${footerY + footerH / 2 + 8}" font-family="Arial" font-weight="bold" font-size="24" fill="white">${esc(POSTER.footerText)}</text>
      <text x="${W - 30}" y="${footerY + footerH / 2 + 8}" text-anchor="end" font-family="Arial" font-weight="bold" font-size="26" fill="white">🌐 ${esc(POSTER.brandName)}</text>
    </svg>
  `);

  const layers = [];
  const img = await getArticleImage(imageUrl, W, imgH);
  const base = sharp({ create: { width: W, height: H, channels: 4, background: { r: 26, g: 26, b: 26, alpha: 1 } } }).png();

  if (img) { layers.push({ input: img, top: 0, left: 0 }); }
  else { layers.push(...fallbackBg(imgH, hlColor, titleBg)); }

  layers.push({ input: overlay, top: 0, left: 0 });
  layers.push(...await getLogoLayers(20, 20, 80, true));

  return base.composite(layers).png().toBuffer();
}

// ===== TEMPLATE 2: DARK (Ảnh full + overlay tối + title trắng/đỏ) =====

async function template2(content, imageUrl) {
  const hlColor = '#FF3333';
  const fontSize = 48;

  const tSvg = content.posterTitle ? titleSvg(content.posterTitle, fontSize, W - 100, H * 0.5, '#FFFFFF', hlColor, W / 2) : '';
  const srcSvg = content.imageSource ? `<text x="${W / 2}" y="${H - 80}" text-anchor="middle" font-family="Arial" font-style="italic" font-size="20" fill="rgba(255,255,255,0.7)">${esc('📷 ' + content.imageSource)}</text>` : '';

  const overlay = Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="black" opacity="0.55"/>
      <g transform="translate(0, ${H * 0.25})">${tSvg}</g>
      ${srcSvg}
      <rect x="0" y="${H - 50}" width="${W}" height="50" fill="#DD0000" opacity="0.9"/>
      <text x="30" y="${H - 18}" font-family="Arial" font-weight="bold" font-size="22" fill="white">${esc(POSTER.footerText)}</text>
      <text x="${W - 30}" y="${H - 18}" text-anchor="end" font-family="Arial" font-weight="bold" font-size="24" fill="white">🌐 ${esc(POSTER.brandName)}</text>
    </svg>
  `);

  const layers = [];
  const img = await getArticleImage(imageUrl, W, H);
  const base = sharp({ create: { width: W, height: H, channels: 4, background: { r: 20, g: 20, b: 30, alpha: 1 } } }).png();

  if (img) { layers.push({ input: img, top: 0, left: 0 }); }
  else { layers.push(...fallbackBg(H, hlColor, '#FFCC00')); }

  layers.push({ input: overlay, top: 0, left: 0 });
  layers.push(...await getLogoLayers(20, 20, 70, true));

  return base.composite(layers).png().toBuffer();
}

// ===== TEMPLATE 3: SPLIT (Ảnh trái 50% + nền đen phải + title vàng) =====

async function template3(content, imageUrl) {
  const halfW = Math.floor(W / 2);
  const hlColor = '#DD0000';
  const normalColor = '#FFCC00';
  const fontSize = 44;

  const tSvg = content.posterTitle ? titleSvg(content.posterTitle, fontSize, halfW - 60, H * 0.6, normalColor, hlColor, halfW / 2) : '';
  const srcSvg = content.imageSource ? `<text x="${halfW + halfW / 2}" y="${H - 80}" text-anchor="middle" font-family="Arial" font-style="italic" font-size="18" fill="rgba(255,255,255,0.6)">${esc('📷 ' + content.imageSource)}</text>` : '';

  const overlay = Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${halfW}" y="0" width="${halfW}" height="${H}" fill="#111111"/>
      <g transform="translate(${halfW}, ${H * 0.2})">${tSvg}</g>
      ${srcSvg}
      <rect x="${halfW}" y="${H - 60}" width="${halfW}" height="60" fill="#DD0000" opacity="0.9"/>
      <text x="${halfW + 20}" y="${H - 22}" font-family="Arial" font-weight="bold" font-size="20" fill="white">${esc(POSTER.footerText)}</text>
      <text x="${W - 20}" y="${H - 22}" text-anchor="end" font-family="Arial" font-weight="bold" font-size="22" fill="white">🌐 ${esc(POSTER.brandName)}</text>
    </svg>
  `);

  const layers = [];
  const img = await getArticleImage(imageUrl, halfW, H);
  const base = sharp({ create: { width: W, height: H, channels: 4, background: { r: 17, g: 17, b: 17, alpha: 1 } } }).png();

  if (img) { layers.push({ input: img, top: 0, left: 0 }); }
  else {
    const fallSvg = Buffer.from(`
      <svg width="${halfW}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="sb" x1="0" y1="0" x2="${halfW}" y2="${H}" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#1a1a2e"/><stop offset="100%" stop-color="#0f3460"/></linearGradient></defs>
        <rect width="${halfW}" height="${H}" fill="url(#sb)"/>
        <circle cx="${halfW * 0.7}" cy="${H * 0.3}" r="100" fill="${hlColor}" opacity="0.1"/>
      </svg>
    `);
    layers.push({ input: fallSvg, top: 0, left: 0 });
  }

  layers.push({ input: overlay, top: 0, left: 0 });
  layers.push(...await getLogoLayers(20, 20, 60, true));

  return base.composite(layers).png().toBuffer();
}

// ===== TEMPLATE 4: BOLD (Ảnh full + gradient dưới lên + title trắng/vàng) =====

async function template4(content, imageUrl) {
  const hlColor = '#FFCC00';
  const fontSize = 50;

  const tSvg = content.posterTitle ? titleSvg(content.posterTitle, fontSize, W - 80, H * 0.35, '#FFFFFF', hlColor, W / 2) : '';
  const srcSvg = content.imageSource ? `<text x="30" y="${H * 0.55}" font-family="Arial" font-style="italic" font-size="18" fill="rgba(255,255,255,0.6)">${esc('📷 ' + content.imageSource)}</text>` : '';

  const overlay = Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g4" x1="0" y1="${H * 0.3}" x2="0" y2="${H}" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="black" stop-opacity="0"/><stop offset="40%" stop-color="black" stop-opacity="0.7"/><stop offset="100%" stop-color="black" stop-opacity="0.95"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#g4)"/>
      <g transform="translate(0, ${H * 0.58})">${tSvg}</g>
      ${srcSvg}
      <rect x="0" y="${H - 5}" width="${W}" height="5" fill="${hlColor}"/>
      <text x="30" y="${H - 20}" font-family="Arial" font-weight="bold" font-size="22" fill="white">${esc(POSTER.footerText)}</text>
      <text x="${W - 30}" y="${H - 20}" text-anchor="end" font-family="Arial" font-weight="bold" font-size="24" fill="white">🌐 ${esc(POSTER.brandName)}</text>
    </svg>
  `);

  const layers = [];
  const img = await getArticleImage(imageUrl, W, H);
  const base = sharp({ create: { width: W, height: H, channels: 4, background: { r: 10, g: 10, b: 15, alpha: 1 } } }).png();

  if (img) { layers.push({ input: img, top: 0, left: 0 }); }
  else { layers.push(...fallbackBg(H, hlColor, '#DD0000')); }

  layers.push({ input: overlay, top: 0, left: 0 });
  layers.push(...await getLogoLayers(20, 20, 70, true));

  return base.composite(layers).png().toBuffer();
}

// ===== FALLBACK BG (khi không có ảnh bài báo) =====

function fallbackBg(areaH, c1, c2) {
  const svg = Buffer.from(`
    <svg width="${W}" height="${areaH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fbg" x1="0" y1="0" x2="${W}" y2="${areaH}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#1a1a2e"/><stop offset="50%" stop-color="#16213e"/><stop offset="100%" stop-color="#0f3460"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${areaH}" fill="url(#fbg)"/>
      <circle cx="${W * 0.8}" cy="${areaH * 0.3}" r="180" fill="${c1}" opacity="0.08"/>
      <circle cx="${W * 0.2}" cy="${areaH * 0.7}" r="120" fill="${c2}" opacity="0.06"/>
      <text x="${W / 2}" y="${areaH / 2 + 20}" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="120" fill="white" opacity="0.04">GENAU</text>
    </svg>
  `);
  return [{ input: svg, top: 0, left: 0 }];
}

// ===== MAIN API =====

const TEMPLATES = [template1, template2, template3, template4];
const TEMPLATE_NAMES = ['Classic', 'Dark', 'Split', 'Bold'];

export async function generatePoster(content, imageUrl, templateIndex = null) {
  const idx = (templateIndex !== null && templateIndex >= 0 && templateIndex < TEMPLATES.length)
    ? templateIndex
    : Math.floor(Math.random() * TEMPLATES.length);
  const name = TEMPLATE_NAMES[idx];
  console.log(`  🎨 Template: ${name} (#${idx + 1})`);
  const buffer = await TEMPLATES[idx](content, imageUrl);
  console.log('  ✅ Poster complete');
  return buffer;
}

export async function savePoster(content, imageUrl, outputPath) {
  const buffer = await generatePoster(content, imageUrl);
  writeFileSync(outputPath, buffer);
  console.log(`✅ Saved: ${outputPath}`);
  return outputPath;
}
