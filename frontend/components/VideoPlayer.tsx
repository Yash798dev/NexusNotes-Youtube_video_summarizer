"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface VideoPlayerHandle {
  seekTo: (seconds: number) => void;
}

interface Props {
  videoId: string;
}

/**
 * YouTube embed via simple <iframe> + postMessage seekTo.
 * More reliable than the IFrame API script loader on Windows/localhost.
 */
const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(({ videoId }, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [src, setSrc] = useState("");

  // Build src client-side so window.location is available
  useEffect(() => {
    const origin = encodeURIComponent(window.location.origin);
    setSrc(
      `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${origin}&rel=0&modestbranding=1`
    );
  }, [videoId]);

  useImperativeHandle(ref, () => ({
    seekTo(seconds: number) {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "seekTo", args: [seconds, true] }),
        "*"
      );
      // Also try playVideo after seek
      setTimeout(() => {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: "command", func: "playVideo", args: [] }),
          "*"
        );
      }, 200);
    },
  }));

  if (!src) return null;

  return (
    <iframe
      ref={iframeRef}
      id="youtube-iframe-player"
      src={src}
      style={{ width: "100%", height: "100%", border: "none" }}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      title="YouTube video player"
    />
  );
});

VideoPlayer.displayName = "VideoPlayer";
export default VideoPlayer;
