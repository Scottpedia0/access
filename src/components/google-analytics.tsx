"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
    __gaReady?: boolean;
    vaultTrack?: (eventName: string, params?: Record<string, unknown>) => void;
  }
}

export function GoogleAnalytics() {
  const pathname = usePathname() || "/";

  useEffect(() => {
    if (typeof window === "undefined" || !measurementId) {
      return;
    }

    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function (...args: unknown[]) {
        window.dataLayer.push(args);
      };

    const gtag = window.gtag;
    const track = (eventName: string, params: Record<string, unknown> = {}) => {
      gtag("event", eventName, {
        page_path: `${window.location.pathname}${window.location.search}`,
        ...params,
      });
    };

    window.vaultTrack = track;

    if (!window.__gaReady) {
      gtag("js", new Date());
      gtag("config", measurementId, { send_page_view: false });
      window.__gaReady = true;
    }

    track("page_view", {
      page_title: document.title,
      page_location: window.location.href,
    });
  }, [pathname]);

  if (!measurementId) {
    return null;
  }

  return (
    <Script
      id="ga4"
      src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      strategy="afterInteractive"
    />
  );
}
