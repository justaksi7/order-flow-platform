import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const pages = new Set(["/", "/order-flow", "/education"]);
export function PageviewTracker() {
  const { pathname } = useLocation();
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    if (!pages.has(pathname)) return;
    void fetch("/api/analytics/pageview", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: pathname }), credentials: "omit",
      referrerPolicy: "no-referrer", keepalive: true
    }).catch(() => {});
  }, [pathname]);
  return null;
}
