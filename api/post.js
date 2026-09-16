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

  const origin = url.origin;
  const rawHtmlRes = await fetch(`${origin}/post.html`);

  if (!rawHtmlRes.ok) {
    return new Response("Static HTML asset not found", { status: 404 });
  }

  const post = await fetchPostFromFirestore(postId);

  const title = post ? `${post.title} | Gospel Intel` : DEFAULT_TITLE;
  const description = post ? stripHtmlAndTruncate(post.content) : DEFAULT_DESC;
  const image = post?.imageUrl || DEFAULT_IMAGE;
  const currentUrl = url.href;

  const schemaJson = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post?.title || DEFAULT_TITLE,
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

  const rewriter = new HTMLRewriter()
    .on('title#docTitle', {
      element(el) { el.setInnerContent(title); }
    })
    .on('meta#metaTitle', {
      element(el) { el.setAttribute('content', title); }
    })
    .on('meta#metaDesc', {
      element(el) { el.setAttribute('content', description); }
    })
    .on('meta#ogUrl', {
      element(el) { el.setAttribute('content', currentUrl); }
    })
    .on('meta#ogTitle', {
      element(el) { el.setAttribute('content', title); }
    })
    .on('meta#ogDesc', {
      element(el) { el.setAttribute('content', description); }
    })
    .on('meta#ogImage', {
      element(el) { el.setAttribute('content', image); }
    })
    .on('meta#twUrl', {
      element(el) { el.setAttribute('content', currentUrl); }
    })
    .on('meta#twTitle', {
      element(el) { el.setAttribute('content', title); }
    })
    .on('meta#twDesc', {
      element(el) { el.setAttribute('content', description); }
    })
    .on('meta#twImage', {
      element(el) { el.setAttribute('content', image); }
    })
    .on('script#schemaStructuredData', {
      element(el) { el.setInnerContent(schemaJson); }
    });

  const transformedResponse = rewriter.transform(rawHtmlRes);

  return new Response(transformedResponse.body, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=3600'
    }
  });
}
