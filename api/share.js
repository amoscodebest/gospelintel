export const config = {
  runtime: 'edge', // Runs on Vercel Edge Network
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const articleId = searchParams.get('id');
  const baseUrl = 'https://gospelintel.vercel.app';
  const firebaseProjectId = 'primeintelmedia-e2fe3';

  // 1. Fetch static reader.html template
  let html = '';
  try {
    const htmlResponse = await fetch(`${baseUrl}/reader.html`);
    if (htmlResponse.ok) {
      html = await htmlResponse.text();
    } else {
      throw new Error(`Failed to load reader.html: ${htmlResponse.status}`);
    }
  } catch (e) {
    console.error('Template fetch error:', e);
    return new Response('Error loading page template', { status: 500 });
  }

  // Return base template if no article ID is present
  if (!articleId) {
    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  try {
    // 2. Fetch the article document from Firestore REST API
    // Ensure the collection name matches your Firestore database ("articles" vs "newsPosts")
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/articles/${encodeURIComponent(articleId)}`;
    const res = await fetch(firestoreUrl);

    if (res.ok) {
      const data = await res.json();
      const fields = data.fields || {};

      const escapeAttr = (str = '') =>
        str
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

      const rawTitle = fields.title?.stringValue || 'Gospel Intel | Global Church News';
      const pageTitle = escapeAttr(`${rawTitle} | Gospel Intel`);
      const title = escapeAttr(rawTitle);

      let rawSummary = fields.excerpt?.stringValue || fields.summary?.stringValue || fields.description?.stringValue || '';
      if (!rawSummary && fields.content?.stringValue) {
        rawSummary = fields.content.stringValue.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().substring(0, 155);
      }
      if (!rawSummary) {
        rawSummary = 'Empowering the body of Christ with timely global church coverage and theological depth.';
      }
      const summary = escapeAttr(rawSummary);

      let imageUrl = fields.imageUrl?.stringValue || fields.image?.stringValue || 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1200&q=80';
      
      // Dropbox link processing
      if (imageUrl.includes('dropbox.com')) {
        imageUrl = imageUrl.replace('dl=0', 'raw=1').replace('dl=1', 'raw=1');
        if (!imageUrl.includes('raw=1')) {
          imageUrl += imageUrl.includes('?') ? '&raw=1' : '?raw=1';
        }
      }
      const image = escapeAttr(imageUrl);
      const currentUrl = escapeAttr(`${baseUrl}/reader.html?id=${articleId}`);

      const setOrInjectTag = (htmlText, pattern, newTag) => {
        if (pattern.test(htmlText)) {
          return htmlText.replace(pattern, newTag);
        }
        return htmlText.replace(/<\/head>/i, `${newTag}\n</head>`);
      };

      // Update Titles, Descriptions, OG & Twitter Meta Tags
      html = html.replace(/<title[^>]*>.*?<\/title>/i, `<title>${pageTitle}</title>`);
      html = setOrInjectTag(html, /<meta[^>]*name=["']description["'][^>]*>/i, `<meta name="description" content="${summary}" />`);
      
      // Open Graph Tags
      html = setOrInjectTag(html, /<meta[^>]*(?:property|name)=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${title}" />`);
      html = setOrInjectTag(html, /<meta[^>]*(?:property|name)=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${summary}" />`);
      html = setOrInjectTag(html, /<meta[^>]*(?:property|name)=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${image}" />`);
      html = setOrInjectTag(html, /<meta[^>]*(?:property|name)=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${currentUrl}" />`);

      // Twitter Tags
      html = setOrInjectTag(html, /<meta[^>]*(?:name|property)=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${title}" />`);
      html = setOrInjectTag(html, /<meta[^>]*(?:name|property)=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${summary}" />`);
      html = setOrInjectTag(html, /<meta[^>]*(?:name|property)=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${image}" />`);
    }
  } catch (err) {
    console.error('Error fetching Firestore metadata:', err);
  }

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
    },
  });
}
