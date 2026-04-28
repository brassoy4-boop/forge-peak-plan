import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FeatureFlags {
  foro: boolean;
  chat: boolean;
}

interface Ctx {
  flags: FeatureFlags;
  loading: boolean;
  refresh: () => Promise<void>;
}

const FeatureFlagsContext = createContext<Ctx | undefined>(undefined);

const DEFAULTS: FeatureFlags = { foro: true, chat: true };

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase.rpc("get_feature_flags");
    if (data) {
      const map = new Map((data as any[]).map((r) => [r.key, r.value]));
      setFlags({
        foro: (map.get("feature_foro") ?? "true") === "true",
        chat: (map.get("feature_chat") ?? "true") === "true",
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <FeatureFlagsContext.Provider value={{ flags, loading, refresh }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) throw new Error("useFeatureFlags debe usarse dentro de FeatureFlagsProvider");
  return ctx;
}
