/* ========================================
   GENAU Bot — Royalty-Free Image Search (Pexels)
   ======================================== */

import https from 'https';

let apiKey = null;

/**
 * Initialize Pexels API
 */
export function initPexels(key) {
  apiKey = key;
  if (key) console.log('🖼️ Pexels API initialized');
}

/**
 * Search Pexels for royalty-free images matching keywords
 * @param {string[]} keywords - Search keywords (English)
 * @param {number} count - Number of images to return
 * @returns {Promise<Array<{url: string, photographer: string, src: object}>>}
 */
export async function searchImages(keywords, count = 5) {
  if (!apiKey) {
    console.log('  ⚠️ Pexels API key not set, skipping image search');
    return [];
  }

  // Try multiple keyword combinations for best results
  const queries = [
    keywords.join(' '),                    // All keywords
    keywords.slice(0, 2).join(' '),        // First 2 keywords
  ];

  const allImages = [];
  const seenIds = new Set();

  for (const query of queries) {
    if (allImages.length >= count) break;

    try {
      const results = await pexelsSearch(query, count);
      for (const photo of results) {
        if (!seenIds.has(photo.id)) {
          seenIds.add(photo.id);
          allImages.push({
            id: photo.id,
            url: photo.src.large2x || photo.src.large || photo.src.original,
            urlMedium: photo.src.medium,
            photographer: photo.photographer,
            alt: photo.alt || '',
            pexelsUrl: photo.url
          });
        }
      }
    } catch (err) {
      console.error(`  ⚠️ Pexels search error for "${query}":`, err.message);
    }
  }

  console.log(`  🖼️ Pexels: Found ${allImages.length} royalty-free images`);
  return allImages.slice(0, count);
}

/**
 * Internal Pexels API call
 */
function pexelsSearch(query, perPage = 5) {
  return new Promise((resolve, reject) => {
    const encodedQuery = encodeURIComponent(query);
    const options = {
      hostname: 'api.pexels.com',
      path: `/v1/search?query=${encodedQuery}&per_page=${perPage}&orientation=landscape`,
      headers: {
        'Authorization': apiKey
      },
      timeout: 10000
    };

    const req = https.get(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString());
          resolve(data.photos || []);
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}
