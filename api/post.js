export const config = {
  runtime: 'edge',
};

const DEFAULT_IMAGE = "https://dl.dropboxusercontent.com/scl/fi/11uhydbaxxcnemqmy2o76/1724942159759.jpg?rlkey=zbpbsfoq20bh6hxofjwr63h8s&st=pxrj8zq5&dl=0";
const DEFAULT_TITLE = "Gospel Intel - Modern Spiritual Platform";
const DEFAULT_DESC = "Modern responsive platform for spiritual insights, sermons, and messages.";
const PROJECT_ID = "primeintelmedia-e2fe3";

function stripHtmlAndTruncate(htmlStr, maxLen = 155) {
  if (!htmlStr) return DEFAULT_DESC;
  const clean = htmlStr.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
  return clean.length > maxLen ? clean.substring(0, maxLen) + '...' : clean;
}

const escapeAttr = (str = '') =>
  str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const setOrInjectTag = (htmlText, pattern, newTag) => {
  if (pattern.test(htmlText)) {
    return htmlText.replace(pattern, newTag);
  }
  return htmlText.replace(/<\/head>/i, `${newTag}\n</head>`);
};

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

  const rawHtmlRes = await fetch(`${url.origin}/post.html`);
  if (!rawHtmlRes.ok) {
    return new Response("Static HTML asset not found", { status: 404 });
  }

  let html = await rawHtmlRes.text();
  const post = await fetchPostFromFirestore(postId);

  const rawTitle = post?.title || DEFAULT_TITLE;
  const title = escapeAttr(rawTitle);
  const pageTitle = escapeAttr(post ? `${post.title} | Gospel Intel` : DEFAULT_TITLE);
  const description = escapeAttr(post ? stripHtmlAndTruncate(post.content) : DEFAULT_DESC);
  const image = escapeAttr(post?.imageUrl || DEFAULT_IMAGE);
  const currentUrl = escapeAttr(url.href);

  // Update Standard & Meta Tags
  html = html.replace(/<title[^>]*>.*?<\/title>/i, `<title>${pageTitle}</title>`);
  html = setOrInjectTag(html, /<meta[^>]*id="metaTitleTag"[^>]*>/i, `<meta id="metaTitleTag" name="title" content="${pageTitle}" />`);
  html = setOrInjectTag(html, /<meta[^>]*id="metaDescription"[^>]*>/i, `<meta id="metaDescription" name="description" content="${description}" />`);
  
  // Update Open Graph
  html = setOrInjectTag(html, /<meta[^>]*(?:property|name)=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${title}" />`);
  html = setOrInjectTag(html, /<meta[^>]*(?:property|name)=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${description}" />`);
  html = setOrInjectTag(html, /<meta[^>]*(?:property|name)=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${image}" />`);
  html = setOrInjectTag(html, /<meta[^>]*(?:property|name)=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${currentUrl}" />`);

  // Update Twitter Cards
  html = setOrInjectTag(html, /<meta[^>]*(?:name|property)=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${title}" />`);
  html = setOrInjectTag(html, /<meta[^>]*(?:name|property)=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${description}" />`);
  html = setOrInjectTag(html, /<meta[^>]*(?:name|property)=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${image}" />`);

  // Schema Injection
  const schemaJson = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": rawTitle,
    "description": description,
    "image": [image],
    "author": {
      "@type": "Person",
      "name": post?.author || "Gospel Intel Minister"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Gospel Intel"
    }
  });

  html = setOrInjectTag(html, /<script type="application\/ld\+json"[^>]*>.*?<\/script>/is, `<script type="application/ld+json" id="schemaStructuredData">${schemaJson}</script>`);

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400'
    }
  });
}
