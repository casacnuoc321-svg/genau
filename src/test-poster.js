/* ========================================
   GENAU Bot — Test Poster Script
   Run: npm run test-poster
   ======================================== */

import { savePoster } from './poster.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('🧪 Testing poster generation...\n');

  const content = {
    posterTitle: 'NGƯỜI VIỆT [hl]THÀNH CÔNG[/hl] TẠI ĐỨC: CÂU CHUYỆN TRUYỀN CẢM HỨNG',
    imageSource: 'Deutsche Welle',
    caption: 'Test caption'
  };

  // Test with a placeholder (no actual image URL)
  const outputPath = join(__dirname, '..', 'data', 'test-poster.png');
  await savePoster(content, null, outputPath);

  console.log(`\n✅ Check the poster at: ${outputPath}`);
}

main().catch(console.error);
