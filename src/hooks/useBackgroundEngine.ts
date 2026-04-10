import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Simulation of a backend Edge Function that triggers on a cron schedule
export function useBackgroundEngine() {
  
  useEffect(() => {
    // Run exactly once roughly 5 seconds after app boot to allow primary queries to settle
    const timer = setTimeout(async () => {
      console.log("[Engine] Running scheduled rule checks...");
      try {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const threeDaysAgo = new Date(now);
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        // 1. Check for tasks overdue
        const { data: overdueTasks } = await supabase
          .from('tasks')
          .select('id, title, client_id, service_id, due_date')
          .lt('due_date', now.toISOString())
          .neq('status', 'completed');

        if (overdueTasks && overdueTasks.length > 0) {
          for (const task of overdueTasks) {
            const taskDate = new Date(task.due_date);
            
            // Check if a flag already exists for this task to avoid spamming
            const { data: existingFlags } = await supabase
              .from('flags')
              .select('id')
              .eq('description', `Task Overdue: ${task.title}`)
              .eq('resolved', false);
              
            if (!existingFlags || existingFlags.length === 0) {
               let severity = 'warning';
               if (taskDate < threeDaysAgo) severity = 'critical';
               
               await supabase.from('flags').insert({
                 client_id: task.client_id,
                 service_id: task.service_id,
                 flag_type: 'sla_breach',
                 severity: severity,
                 title: 'SLA Breach: Overdue Task',
                 description: `Task Overdue: ${task.title}`,
                 seen_by_owner: false
               });
            }
          }
        }
        
        // Similarly we could check targets for backlinks, social posts etc. via task_deliverables
        // For simulation purposes, the engine assumes the cron task processed perfectly.
      } catch (err) {
        console.error("[Engine] Analytics sync failed:", err);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);
}
