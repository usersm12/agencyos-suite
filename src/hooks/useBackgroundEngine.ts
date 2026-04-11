import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Lightweight background engine that checks for overdue tasks
export function useBackgroundEngine() {
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const now = new Date();

        // Check for overdue tasks (tasks with due_date in the past that aren't completed)
        const { data: overdueTasks } = await supabase
          .from('tasks')
          .select('id, title, due_date, project_id')
          .lt('due_date', now.toISOString().split('T')[0])
          .neq('status', 'completed');

        if (overdueTasks && overdueTasks.length > 0) {
          console.log(`[Engine] Found ${overdueTasks.length} overdue tasks`);
        }
      } catch (err) {
        console.error("[Engine] Background check failed:", err);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);
}
