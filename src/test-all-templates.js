/* Test all 4 poster templates */
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Temporarily override random to test each template
const content = {
  posterTitle: 'HÀNG NGHÌN NHÀ THUỐC TẠI ĐỨC [hl]ĐÓNG CỬA[/hl] ĐỂ PHẢN ĐỐI',
  imageSource: 'Zeit Online',
  caption: 'Test'
};

async function testAll() {
  // Import the module
  const poster = await import('./poster.js');
  
  // We'll use a news image URL for testing
  const testImgUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Flag_of_Germany.svg/1200px-Flag_of_Germany.svg.png';
  
  // Override Math.random to force each template
  const origRandom = Math.random;
  
  for (let i = 0; i < 4; i++) {
    Math.random = () => i / 4 + 0.01; // Force template index
    console.log(`\n=== Template ${i + 1} ===`);
    const buffer = await poster.generatePoster(content, testImgUrl);
    const out = join(__dirname, '..', 'data', `template-${i + 1}.png`);
    writeFileSync(out, buffer);
    console.log(`✅ Saved: template-${i + 1}.png`);
  }
  
  Math.random = origRandom;
  console.log('\n✅ All 4 templates generated!');
}

testAll().catch(console.error);
