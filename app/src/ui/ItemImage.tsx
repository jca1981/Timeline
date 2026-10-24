// **** Billede-visning: hook + thumbnail-komponent (M11) ****
import { useEffect, useState } from 'react';
import { getImageUrl } from '../core/images';

// Simple cache så samme billede ikke hentes flere gange
const urlCache = new Map<string, string | null>();

/** Hent data-URI for et imageId (caches resultatet). */
export function useImageUrl(imageId: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => imageId ? urlCache.get(imageId) ?? null : null);
  useEffect(() => {
    if (!imageId) { setUrl(null); return; }
    if (urlCache.has(imageId)) { setUrl(urlCache.get(imageId)!); return; }
    let alive = true;
    getImageUrl(imageId).then((u) => {
      urlCache.set(imageId, u);
      if (alive) setUrl(u);
    });
    return () => { alive = false; };
  }, [imageId]);
  return url;
}

/** Thumbnail-komponent til Inspector/Timeline. */
export function ItemImage({ imageId, size = 150 }: { imageId?: string; size?: number }) {
  const url = useImageUrl(imageId);
  if (!url) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <img
        src={url}
        alt=""
        style={{ maxWidth: size, maxHeight: size, objectFit: 'contain', borderRadius: 4, border: '1px solid #444' }}
      />
    </div>
  );
}
