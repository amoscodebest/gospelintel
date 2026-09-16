export const config = {
  runtime: 'edge',
};

const DEFAULT_IMAGE = "https://dl.dropboxusercontent.com/scl/fi/11uhydbaxxcnemqmy2o76/1724942159759.jpg?rlkey=zbpbsfoq20bh6hxofjwr63h8s&st=pxrj8zq5&raw=1";
const DEFAULT_TITLE = "Gospel Intel - Modern Spiritual Platform";
const DEFAULT_DESC = "Modern responsive platform for spiritual insights, sermons, and messages.";
const PROJECT_ID = "primeintelmedia-e2fe3";

function stripHtmlAndTruncate(htmlStr, maxLen = 155) {
  if (!htmlStr) return DEFAULT_DESC;
  const clean = htmlStr.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
  return clean.length > maxLen ? clean.substring(0, maxLen) + '...' : clean;
}

async function fetchPostFromFirestore(postId) {
  if (!postId) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/posts/${postId}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    
    const fields = json.fields || {};
    return {
      title: fields.title?.stringValue || DEFAULT_TITLE,
      content: fields.content?.stringValue || "",
      imageUrl: fields.imageUrl?.stringValue || DEFAULT_IMAGE,
      author: fields.author?.stringValue || "Gospel Intel Minister",
      category: fields.category?.stringValue || "General"
    };
  } catch (err) {
    console.error("Firestore REST fetch error:", err);
    return null;
  }
}

export default async function handler(request) {
  const url = new URL(request.url);
  const postId = url.searchParams.get('id');

  // Fetch target post data
  const post = await fetchPostFromFirestore(postId);

  const title = post ? `${post.title} | Gospel Intel` : DEFAULT_TITLE;
  const description = post ? stripHtmlAndTruncate(post.content) : DEFAULT_DESC;
  let image = post?.imageUrl || DEFAULT_IMAGE;
  
  // Fix Dropbox links for direct image rendering
  if (image.includes("dropbox.com") && image.includes("dl=0")) {
    image = image.replace("dl=0", "raw=1");
  }
  
  const currentUrl = url.href;

  // Construct raw HTML string directly to avoid circular fetch rewrite loops
  const htmlPayload = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${currentUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${currentUrl}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${image}">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${title}",
    "description": "${description}",
    "image": ["${image}"],
    "author": {
      "@type": "Person",
      "name": "${post?.author || 'Gospel Intel Minister'}"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Gospel Intel"
    }
  }
  </script>
</head>
<body>
  <script>
    // Forward query string execution to client reader template
    window.location.href = "/post.html?id=${postId || ''}";
  </script>
</body>
</html>`;

  return new Response(htmlPayload, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=3600'
    }
  });
}
