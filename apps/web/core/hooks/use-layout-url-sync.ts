import { useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { EIssueLayoutTypes } from "@plane/types";

export const useLayoutUrlSync = (currentLayout: EIssueLayoutTypes | undefined) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  useEffect(() => {
    if (!currentLayout) return;
    
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("layout") !== currentLayout) {
      params.set("layout", currentLayout);
      // Using next/navigation replace for better integration with Next.js router state
      replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [currentLayout, pathname, replace, searchParams]);
};
