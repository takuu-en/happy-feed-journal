import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import type { Baby, Family } from "@/lib/types";

interface AppState {
  session: Session | null;
  initializing: boolean;
  families: Family[];
  currentFamily: Family | null;
  setCurrentFamilyId: (id: string) => void;
  babies: Baby[];
  currentBaby: Baby | null;
  setCurrentBabyId: (id: string) => void;
  refreshFamilies: () => Promise<void>;
  refreshBabies: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [families, setFamilies] = useState<Family[]>([]);
  const [currentFamilyId, setCurrentFamilyId] = useState<string | null>(null);
  const [babies, setBabies] = useState<Baby[]>([]);
  const [currentBabyId, setCurrentBabyId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshFamilies = useCallback(async () => {
    if (!session) {
      setFamilies([]);
      return;
    }
    const { data, error } = await supabase
      .from("families")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("Failed to load families", error.message);
      return;
    }
    setFamilies(data ?? []);
    setCurrentFamilyId((prev) => {
      if (prev && data?.some((f) => f.id === prev)) return prev;
      return data?.[0]?.id ?? null;
    });
  }, [session]);

  const refreshBabies = useCallback(async () => {
    if (!currentFamilyId) {
      setBabies([]);
      setCurrentBabyId(null);
      return;
    }
    const { data, error } = await supabase
      .from("babies")
      .select("*")
      .eq("family_id", currentFamilyId)
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("Failed to load babies", error.message);
      return;
    }
    setBabies(data ?? []);
    setCurrentBabyId((prev) => {
      if (prev && data?.some((b) => b.id === prev)) return prev;
      return data?.[0]?.id ?? null;
    });
  }, [currentFamilyId]);

  useEffect(() => {
    if (session) refreshFamilies();
    else {
      setFamilies([]);
      setCurrentFamilyId(null);
    }
  }, [session, refreshFamilies]);

  useEffect(() => {
    refreshBabies();
  }, [currentFamilyId, refreshBabies]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setCurrentFamilyId(null);
    setCurrentBabyId(null);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      session,
      initializing,
      families,
      currentFamily: families.find((f) => f.id === currentFamilyId) ?? null,
      setCurrentFamilyId,
      babies,
      currentBaby: babies.find((b) => b.id === currentBabyId) ?? null,
      setCurrentBabyId,
      refreshFamilies,
      refreshBabies,
      signOut,
    }),
    [
      session,
      initializing,
      families,
      currentFamilyId,
      babies,
      currentBabyId,
      refreshFamilies,
      refreshBabies,
      signOut,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
