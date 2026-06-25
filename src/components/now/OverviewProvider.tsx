"use client";

/**
 * Fetches the live overview payload (Finnhub quote + metric, EDGAR fundamentals) ONCE and shares it
 * with every data-driven section via context, so the hero, "priced in", modeler, and history don't
 * each hit the API. The Finnhub key stays server-side — this only ever calls our own /api/overview.
 */

import { createContext, useContext, useEffect, useState } from "react";
import type { OverviewPayload } from "@/app/api/overview/route";

interface OverviewState {
  data: OverviewPayload | null;
  error: boolean;
  /** True until the first fetch resolves or fails. */
  loading: boolean;
}

const OverviewContext = createContext<OverviewState>({
  data: null,
  error: false,
  loading: true,
});

export function OverviewProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OverviewState>({
    data: null,
    error: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/overview")
      .then((r) => r.json())
      .then((data: OverviewPayload) => {
        if (!cancelled) setState({ data, error: false, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ data: null, error: true, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <OverviewContext.Provider value={state}>{children}</OverviewContext.Provider>;
}

export function useOverview(): OverviewState {
  return useContext(OverviewContext);
}
