import { useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { EIssueLayoutTypes } from "@plane/types";

export const useLayoutUrlSync = (currentLayout: EIssueLayoutTypes | undefined) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!currentLayout) return;

    const params = new URLSearchParams(searchParams.toString());
    // Only trigger a router replace if the URL doesn't match the new store state
    if (params.get("layout") !== currentLayout) {
      params.set("layout", currentLayout);
      const newUrl = `${pathname}?${params.toString()}`;
      router.replace(newUrl);
    }
  }, [currentLayout, pathname, router, searchParams]);
};