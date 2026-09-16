export const config = {
  runtime: 'edge', // Runs on Vercel Edge Network
};

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const articleId = searchParams.get('id');
  const BASE_URL = 'https://gospelintel.vercel.app';

  // Fallback default metadata if no ID or article not found
  let title = "Gospel Intel | Global Church News & Faith Insights";
  let description = "Empowering the body of Christ with timely global church coverage, theological depth, and digital ministry insights.";
  let imageUrl = "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1200&q=80";

  if (articleId) {
    try {
      // 1. Fetch article JSON directly from Firestore REST API (Edge compatible)
      // Replace YOUR_PROJECT_ID with your actual Firebase Project ID
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/primeintelmedia-e2fe3/databases/(default)/documents/articles/${articleId}`;
      const res = await fetch(firestoreUrl);

      if (res.ok) {
        const doc = await res.json();
        const fields = doc.fields || {};

        // Extract Firestore fields safely
        if (fields.title?.stringValue) title = `${fields.title.stringValue} | Gospel Intel`;
        if (fields.excerpt?.stringValue) description = fields.excerpt.stringValue;
        if (fields.imageUrl?.stringValue) {
          let rawImg = fields.imageUrl.stringValue;
          // Format Dropbox URL to raw image format
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

  const targetUrl = `${BASE_URL}/reader.html?id=${articleId || ''}`;

  // 2. Generate HTML with dynamic Open Graph tags
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <meta name="description" content="${description}">

    <!-- Open Graph / WhatsApp / Facebook / LinkedIn -->
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Gospel Intel">
    <meta property="og:url" content="${targetUrl}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">

    <!-- Twitter / X -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@gospelintel">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${imageUrl}">

    <!-- Redirect Human Users to Reader Page -->
    <meta http-equiv="refresh" content="0;url=${targetUrl}">
</head>
<body>
    <p>Redirecting to <a href="${targetUrl}">${title}</a>...</p>
    <script>window.location.href = "${targetUrl}";</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html;charset=UTF-8',
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
