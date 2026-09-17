export const config = {
  runtime: 'edge', // Runs on Vercel Edge Network
};

export default async function handler(request) {
  const { searchParams, origin } = new URL(request.url);
  const articleId = searchParams.get('id');
  const firebaseProjectId = 'primeintelmedia-e2fe3';

  // 1. Fetch static reader.html using current origin to prevent domain mismatch
  let html = '';
  try {
    const htmlResponse = await fetch(`${origin}/reader.html`);
    if (htmlResponse.ok) {
      html = await htmlResponse.text();
    } else {
      throw new Error(`Failed to load reader.html: status ${htmlResponse.status}`);
    }
  } catch (e) {
    console.error('Template fetch error:', e);
    return new Response(`Error loading page template: ${e.message}`, { status: 500 });
  }

  // Return base template if no article ID is present
  if (!articleId) {
    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  try {
    // 2. Fetch the article document from Firestore REST API
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/articles/${encodeURIComponent(articleId)}`;
    const res = await fetch(firestoreUrl);

    if (res.ok) {
      const data = await res.json();
      const fields = data.fields || {};

      const escapeAttr = (str = '') =>
        String(str)
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

      // Extract title safely
      const rawTitle = fields.title?.stringValue || 'Gospel Intel | Global Church News';
      const pageTitle = escapeAttr(`${rawTitle} | Gospel Intel`);
      const title = escapeAttr(rawTitle);

      // Extract description safely
      let rawSummary = fields.excerpt?.stringValue || fields.summary?.stringValue || fields.description?.stringValue || '';
      if (!rawSummary && fields.content?.stringValue) {
        rawSummary = fields.content.stringValue.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().substring(0, 155);
      }
      if (!rawSummary) {
        rawSummary = 'Empowering the body of Christ with timely global church coverage and theological depth.';
      }
      const summary = escapeAttr(rawSummary);

      // Extract image URL safely
      let imageUrl = fields.imageUrl?.stringValue || fields.image?.stringValue || 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1200&q=80';
      if (imageUrl.includes('dropbox.com')) {
        imageUrl = imageUrl.replace('dl=0', 'raw=1').replace('dl=1', 'raw=1');
        if (!imageUrl.includes('raw=1')) {
          imageUrl += imageUrl.includes('?') ? '&raw=1' : '?raw=1';
        }
      }
      const image = escapeAttr(imageUrl);
      const currentUrl = escapeAttr(`${origin}/reader.html?id=${articleId}`);
      const shareUrl = escapeAttr(`${origin}/share/${articleId}`);

      // Strict replacement targeted directly at IDs in reader.html
      html = html.replace(/<title[^>]*>.*?<\/title>/i, `<title>${pageTitle}</title>`);
      
      // Direct replacement by ID matching your reader.html
      html = html.replace(/id="metaTitleTag"\s+content="[^"]*"/i, `id="metaTitleTag" content="${pageTitle}"`);
      html = html.replace(/id="metaDescription"\s+content="[^"]*"/i, `id="metaDescription" content="${summary}"`);
      html = html.replace(/id="metaCanonical"\s+href="[^"]*"/i, `id="metaCanonical" href="${currentUrl}"`);

      // Open Graph replacements
      html = html.replace(/id="ogTitle"\s+content="[^"]*"/i, `id="ogTitle" content="${title}"`);
      html = html.replace(/id="ogDescription"\s+content="[^"]*"/i, `id="ogDescription" content="${summary}"`);
      html = html.replace(/id="ogImage"\s+content="[^"]*"/i, `id="ogImage" content="${image}"`);
      html = html.replace(/id="ogUrl"\s+content="[^"]*"/i, `id="ogUrl" content="${shareUrl}"`);

      // Twitter replacements
      html = html.replace(/id="twitterTitle"\s+content="[^"]*"/i, `id="twitterTitle" content="${title}"`);
      html = html.replace(/id="twitterDescription"\s+content="[^"]*"/i, `id="twitterDescription" content="${summary}"`);
      html = html.replace(/id="twitterImage"\s+content="[^"]*"/i, `id="twitterImage" content="${image}"`);
      html = html.replace(/id="twitterUrl"\s+content="[^"]*"/i, `id="twitterUrl" content="${shareUrl}"`);
    } else {
      console.warn(`Firestore returned status ${res.status} for article ID: ${articleId}`);
    }
  } catch (err) {
    console.error('Error fetching Firestore metadata:', err);
  }

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
