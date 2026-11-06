"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Images } from "lucide-react";
import "./asset-image.css";

export const assetUrl = (id: string) => `/api/studio/assets/${encodeURIComponent(id)}/file`;
const RETRY_DELAYS = [1000, 3000];
type AssetImageProps = { id: string; name: string; className?: string };

export function AssetImage({ id, ...props }: AssetImageProps) {
  const src = assetUrl(id);
  // A new source gets fresh state and cancels the previous image's recovery work.
  return <AssetImageRequest key={src} src={src} {...props}/>;
}

function AssetImageRequest({ src, name, className = "" }: Omit<AssetImageProps, "id"> & { src: string }) {
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState("");
  const failedRef = useRef(false);
  const automaticRetries = useRef(0);
  const requestNumber = useRef(0);

  const retry = useCallback(() => {
    if (!failedRef.current) return;
    // Focus and online can arrive together; only start one replacement request.
    failedRef.current = false;
    setFailed(false);
    setRetryKey(`${Date.now()}-${++requestNumber.current}`);
  }, []);

  useEffect(() => {
    if (!failed) return;
    const timer = automaticRetries.current < RETRY_DELAYS.length ? window.setTimeout(() => {
      if (!failedRef.current) return;
      automaticRetries.current += 1;
      retry();
    }, RETRY_DELAYS[automaticRetries.current]) : undefined;
    window.addEventListener("focus", retry);
    window.addEventListener("online", retry);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", retry);
      window.removeEventListener("online", retry);
    };
  }, [failed, retry]);

  if (failed) return <span className={`asset-image-failed ${className}`} role="img" aria-label={`${name}，图片暂时无法加载`} title="图片暂时无法加载，请稍后刷新重试"><Images size={26} aria-hidden="true"/><span aria-hidden="true">图片暂时无法加载</span></span>;
  const requestSrc = retryKey ? `${src}?retry=${retryKey}` : src;
  return <img key={requestSrc} className={className} src={requestSrc} alt={name} loading="lazy" onError={() => { failedRef.current = true; setFailed(true); }}/>;
}
