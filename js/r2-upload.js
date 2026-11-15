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

// The upload server takes only these types (see worker/upload-worker.js).
const R2_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'];
const R2_TYPE_BY_EXT   = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
                           heic: 'image/heic', heif: 'image/heif', gif: 'image/gif' };

// Turn a picked file into one the upload server accepts.
//   - An allowed type goes as it is.
//   - An allowed extension with a blank or generic type (common for HEIC
//     on Windows and Chromebooks) is relabelled with the right type.
//   - Anything else the browser can draw (SVG, BMP, AVIF, TIFF in Safari)
//     is converted here: SVG to PNG, so a logo keeps its transparency,
//     and the rest to JPEG.
// Throws a plain-English error if the browser cannot read the file.
async function r2PrepareFile(file) {
  if (R2_ALLOWED_TYPES.includes(file.type)) return file;

  const m       = /\.([a-z0-9]+)$/i.exec(file.name || '');
  const ext     = m ? m[1].toLowerCase() : '';
  const generic = !file.type || file.type === 'application/octet-stream';
  if (generic && R2_TYPE_BY_EXT[ext]) {
    return new File([file], file.name, { type: R2_TYPE_BY_EXT[ext], lastModified: file.lastModified });
  }

  const isSvg = file.type === 'image/svg+xml' || ext === 'svg';
  const url   = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const im   = new Image();
      im.onload  = () => resolve(im);
      im.onerror = () => reject(new Error('decode'));
      im.src     = url;
    });

    let w = img.naturalWidth  || 0;
    let h = img.naturalHeight || 0;
    if (!w || !h) { w = 2000; h = 2000; }           // an SVG with no size of its own
    const MAX = 4000;                               // longest side we send
    let scale = Math.min(1, MAX / Math.max(w, h));
    if (isSvg) {                                    // draw vector logos big enough to stay sharp
      scale = Math.min(MAX / Math.max(w, h), Math.max(1, 2000 / Math.max(w, h)));
    }
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));

    const canvas  = document.createElement('canvas');
    canvas.width  = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!isSvg) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cw, ch); }
    ctx.drawImage(img, 0, 0, cw, ch);

    const outType = isSvg ? 'image/png' : 'image/jpeg';
    const blob    = await new Promise((resolve) => canvas.toBlob(resolve, outType, 0.92));
    if (!blob) throw new Error('encode');
    const base = (file.name || 'photo').replace(/\.[^.]*$/, '') || 'photo';
    return new File([blob], `${base}.${isSvg ? 'png' : 'jpg'}`, { type: outType, lastModified: file.lastModified });
  } catch (e) {
    throw new Error(`"${file.name}" is a kind of image we can't upload. Please save it as a JPEG or PNG and try again.`);
  } finally {
    URL.revokeObjectURL(url);
  }
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
    let sendFile = file;
    try {
      sendFile = await r2PrepareFile(file);
      result = await uploadFileToR2(sendFile, {
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
      filename: sendFile.name,
      size:     sendFile.size,
      type:     sendFile.type,
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
