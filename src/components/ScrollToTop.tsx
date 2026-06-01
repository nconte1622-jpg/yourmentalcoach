import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls the page to the top on every route change.
 * Place inside <BrowserRouter>.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
