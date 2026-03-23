/* Quick debug test for poster rendering */
import { createCanvas, loadImage } from 'canvas';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { POSTER } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function debugPoster() {
  console.log('=== POSTER config ===');
  console.log(JSON.stringify(POSTER, null, 2));
  
  const { width, height } = POSTER;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const imageAreaHeight = height * 0.60;
  const titleAreaHeight = height * 0.32;
  const footerHeight = height * 0.08;

  console.log(`Image area: 0-${imageAreaHeight}`);
  console.log(`Title area: ${imageAreaHeight}-${imageAreaHeight + titleAreaHeight}`);
  console.log(`Footer: ${height - footerHeight}-${height}`);

  // Background
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, width, imageAreaHeight);
  console.log('✅ Image area drawn');

  // Title area
  ctx.fillStyle = '#FFCC00';
  ctx.fillRect(0, imageAreaHeight, width, titleAreaHeight);
  console.log('✅ Title area drawn (yellow)');

  // Title text
  ctx.font = 'bold 42px sans-serif';
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'center';
  ctx.fillText('NGƯỜI VIỆT THÀNH CÔNG TẠI ĐỨC', width / 2, imageAreaHeight + 80);
  ctx.fillText('CÂU CHUYỆN TRUYỀN CẢM HỨNG', width / 2, imageAreaHeight + 140);
  console.log('✅ Title text drawn');

  // Footer
  ctx.fillStyle = '#DD0000';
  ctx.fillRect(0, height - footerHeight, width, footerHeight);
  console.log('✅ Footer drawn (red)');

  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = 'white';
  ctx.textAlign = 'left';
  ctx.fillText('Kênh thông tin Việt Nam - Đức', 30, height - footerHeight / 2 + 7);
  ctx.textAlign = 'right';
  ctx.fillText('🌐 GENAU', width - 30, height - footerHeight / 2 + 8);
  console.log('✅ Footer text drawn');

  // Logo
  try {
    const logo = await loadImage(join(__dirname, '..', 'assets', 'logo-genau.png'));
    const logoH = 50;
    const logoW = (logo.width / logo.height) * logoH;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.rect(20, 20, logoW + 30, logoH + 20);
    ctx.fill();
    ctx.drawImage(logo, 35, 30, logoW, logoH);
    console.log('✅ Logo drawn');
  } catch(e) {
    console.error('Logo error:', e.message);
  }

  const out = join(__dirname, '..', 'data', 'debug-poster.png');
  writeFileSync(out, canvas.toBuffer('image/png'));
  console.log(`\n✅ Saved: ${out}`);
}

debugPoster().catch(console.error);
