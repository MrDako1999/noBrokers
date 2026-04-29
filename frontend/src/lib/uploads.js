import api from '@/lib/api';

// Two-step upload to Cloudflare R2:
//   1. ask the backend for a presigned PUT URL
//   2. upload the file binary directly to R2
// Returns { url, key } that the caller submits with the parent entity.
export async function uploadFile(file, kind, onProgress) {
  if (!file) throw new Error('No file');

  const { data } = await api.post('/uploads/presign', {
    contentType: file.type,
    kind,
  });

  if (file.size > data.maxBytes) {
    throw new Error(
      `File is too large (max ${(data.maxBytes / (1024 * 1024)).toFixed(0)}MB)`,
    );
  }

  // Use XHR (not axios) so we get an upload progress event without piping
  // a presigned PUT through axios (which insists on adding its own headers).
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', data.uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    if (onProgress) {
      xhr.upload.addEventListener('progress', (ev) => {
        if (ev.lengthComputable) onProgress(ev.loaded / ev.total);
      });
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(file);
  });

  return { url: data.publicUrl, key: data.key };
}

export async function deleteUpload(key) {
  if (!key) return;
  await api.delete(`/uploads/${encodeURIComponent(key)}`);
}
