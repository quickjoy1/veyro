import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/store/appStore";
import { supabase } from "@/utils/supabaseClient";
import { computeTaskStudyTime, type SessionTaskLink } from "@/utils/taskStudyTime";

/** Study time per task, from the user's sessions. Call refresh() after a session changes. */
export const useTaskStudyTime = () => {
  const laps = useAppStore((s) => s.laps.laps);
  const [links, setLinks] = useState<SessionTaskLink[]>([]);

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("session_tasks").select("session_id, task_id");
      if (!error && data) setLinks(data as SessionTaskLink[]);
    } catch {
      // links stay as they were
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, laps.length]);

  const totals = useMemo(() => computeTaskStudyTime(laps as any[], links), [laps, links]);
  return { totals, refresh };
};
