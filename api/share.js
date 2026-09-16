export const config = {
  runtime: 'edge', // Runs on Vercel Edge Network
};

// Helper function to safely escape strings for HTML attributes
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const articleId = searchParams.get('id');
  const BASE_URL = 'https://gospelintel.vercel.app';

  // Default fallback metadata
  let title = "Gospel Intel | Global Church News & Faith Insights";
  let description = "Empowering the body of Christ with timely global church coverage, theological depth, and digital ministry insights.";
  let imageUrl = "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1200&q=80";

  if (articleId) {
    try {
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/primeintelmedia-e2fe3/databases/(default)/documents/articles/${encodeURIComponent(articleId)}`;
      const res = await fetch(firestoreUrl);

      if (res.ok) {
        const doc = await res.json();
        const fields = doc.fields || {};

        if (fields.title?.stringValue) {
          title = `${fields.title.stringValue} | Gospel Intel`;
        }
        if (fields.excerpt?.stringValue) {
          description = fields.excerpt.stringValue;
        }
        if (fields.imageUrl?.stringValue) {
          let rawImg = fields.imageUrl.stringValue;
          if (rawImg.includes('dropbox.com')) {
            rawImg = rawImg.replace('dl=0', 'raw=1').replace('dl=1', 'raw=1');
            if (!rawImg.includes('raw=1')) {
              rawImg += rawImg.includes('?') ? '&raw=1' : '?raw=1';
            }
          }
          imageUrl = rawImg;
        }
      }
    } catch (err) {
      console.error("Edge fetch error:", err);
    }
  }

  // Safe fallback target URL
  const targetUrl = articleId ? `${BASE_URL}/reader.html?id=${encodeURIComponent(articleId)}` : BASE_URL;

  // Escape metadata before injecting into template
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImageUrl = escapeHtml(imageUrl);
  const safeTargetUrl = escapeHtml(targetUrl);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}">

    <!-- Open Graph / WhatsApp / Facebook / LinkedIn -->
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Gospel Intel">
    <meta property="og:url" content="${safeTargetUrl}">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDescription}">
    <meta property="og:image" content="${safeImageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">

    <!-- Twitter / X -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@gospelintel">
    <meta name="twitter:title" content="${safeTitle}">
    <meta name="twitter:description" content="${safeDescription}">
    <meta name="twitter:image" content="${safeImageUrl}">

    <!-- Redirect Human Users to Reader Page -->
    <meta http-equiv="refresh" content="0;url=${safeTargetUrl}">
</head>
<body>
    <p>Redirecting to <a href="${safeTargetUrl}">${safeTitle}</a>...</p>
    <script>window.location.href = ${JSON.stringify(targetUrl)};</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html;charset=UTF-8',
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
