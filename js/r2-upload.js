/*
  Front Porch Web — R2 upload client
  ─────────────────────────────────────────────────────────────────────
  Sends each photo to the Cloudflare Worker (worker/upload-worker.js),
  which proxies to the R2 bucket. The browser never sees R2 credentials.

  After deploying the Worker:
    1. Run `wrangler deploy` in /worker
    2. Copy the printed *.workers.dev URL
    3. Paste it below as R2_UPLOAD_ENDPOINT (keep the /upload path)

  Authorization is the user's Supabase access token (pulled fresh from
  the client on every upload, so token refreshes work transparently).
*/

const R2_UPLOAD_ENDPOINT = 'https://frontporchweb-uploads.swillison09.workers.dev/upload';
// ☝️ REPLACE `your-account` with the subdomain wrangler prints on deploy.
//    e.g. https://frontporchweb-uploads.acme-co.workers.dev/upload


// ── Helpers ────────────────────────────────────────────────────────────────

async function r2GetAccessToken() {
  const { data: { session } } = await sbClient.auth.getSession();
  return session?.access_token || null;
}

// Upload a single file via XHR (so we get upload-progress events;
// fetch() does not expose those in browsers).
//
// Returns { key, bytes } on success, throws on failure.
function uploadFileToR2(file, { submissionId, category, token, onProgress }) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    form.append('submissionId', submissionId);
    form.append('category', category);
    form.append('filename', file.name);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', R2_UPLOAD_ENDPOINT);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(e.loaded / e.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('Upload server returned an unreadable response.')); }
      } else {
        let msg = `Upload failed (HTTP ${xhr.status})`;
        try {
          const j = JSON.parse(xhr.responseText);
          if (j.error) msg = j.error;
        } catch { /* fall through with default */ }
        reject(new Error(msg));
      }
    };
    xhr.onerror   = () => reject(new Error('Network error during upload.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out.'));

    xhr.send(form);
  });
}

// Upload many photos sequentially. One-at-a-time is the safe default:
//   • predictable progress UI
//   • no thundering herd on the Worker
//   • keeps the page responsive
//
// items: [{ file, caption, category, originalId }]
// onProgress({ done, total, percent, currentName, currentItemPercent })
//
// Returns { uploaded: [...meta], failedAt: null | index }
async function uploadAllPhotos(items, { submissionId, onProgress } = {}) {
  const uploaded = [];
  const token    = await r2GetAccessToken();
  if (!token) throw new Error('You are signed out. Please sign in and try again.');

  for (let i = 0; i < items.length; i++) {
    const { file, caption, category, originalId } = items[i];

    const reportItem = (frac) => {
      if (!onProgress) return;
      const percent = Math.round(((i + frac) / items.length) * 100);
      onProgress({
        done:               i,
        total:              items.length,
        percent,
        currentName:        file.name,
        currentItemPercent: Math.round(frac * 100),
      });
    };
    reportItem(0);

    let result;
    try {
      result = await uploadFileToR2(file, {
        submissionId,
        category,
        token,
        onProgress: reportItem,
      });
    } catch (err) {
      err.failedAt   = i;
      err.failedName = file.name;
      throw err;
    }

    uploaded.push({
      key:      result.key,
      filename: file.name,
      size:     file.size,
      type:     file.type,
      caption:  caption || '',
      category,
      originalId,
    });
    reportItem(1);
  }

  if (onProgress) {
    onProgress({ done: items.length, total: items.length, percent: 100, currentName: '', currentItemPercent: 100 });
  }
  return { uploaded };
}

// Expose globally so portal.js can use without imports
window.uploadAllPhotos = uploadAllPhotos;
