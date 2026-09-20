import { forwardRef } from "react";

/**
 * Navigation links in the shared shell use a full document navigation.
 * This intentionally bypasses a stalled Next.js client transition while
 * preserving the current pathname/query and authentication session.
 */
const AppLink = forwardRef(function AppLink({ href, ...props }, ref) {
  return <a ref={ref} href={typeof href === "string" ? href : String(href || "#")} {...props} />;
});

export default AppLink;
