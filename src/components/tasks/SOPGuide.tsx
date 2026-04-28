import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BookOpen, Video, ExternalLink, PlusCircle } from "lucide-react";

interface SOPGuideProps {
  serviceType?: string | null;
  taskTemplateName?: string | null;
}

// Normalize service_type strings to DB keys
function normalizeServiceType(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (lower === "backlinks") return "backlinks";
  if (lower === "content writing") return "content_writing";
  if (lower === "on-page seo") return "onpage_seo";
  if (lower === "technical seo") return "technical_seo";
  if (lower.includes("google")) return "google_ads";
  if (lower.includes("meta") || lower.includes("facebook")) return "meta_ads";
  if (lower.includes("social")) return "social_media";
  if (lower === "web development" || lower.includes("web")) return "web_dev";
  if (lower.includes("email")) return "email_marketing";
  // Legacy fallback
  if (lower.includes("seo")) return "backlinks";
  return lower.replace(/\s+/g, "_");
}

// Map service_type DB key to a default template name
const DEFAULT_TEMPLATE: Record<string, string> = {
  backlinks:      "link_building",
  content_writing:"article_writing",
  onpage_seo:     "onpage_audit",
  technical_seo:  "technical_audit",
  google_ads:     "campaign_review",
  meta_ads:       "campaign_review",
  social_media:   "monthly_posts",
  web_dev:        "new_project",
};

function boldText(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-base font-bold mt-4 mb-2 text-foreground">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-sm font-semibold mt-3 mb-1 text-foreground">
          {line.slice(4)}
        </h3>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal list-inside space-y-1 my-2 ml-2">
          {listItems.map((item, j) => (
            <li
              key={j}
              className="text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: boldText(item) }}
            />
          ))}
        </ol>
      );
      continue;
    } else if (line.startsWith("- ")) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        listItems.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc list-inside space-y-1 my-2 ml-2">
          {listItems.map((item, j) => (
            <li
              key={j}
              className="text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: boldText(item) }}
            />
          ))}
        </ul>
      );
      continue;
    } else if (line.trim() !== "") {
      elements.push(
        <p
          key={i}
          className="text-sm leading-relaxed my-1"
          dangerouslySetInnerHTML={{ __html: boldText(line) }}
        />
      );
    }
    i++;
  }
  return <>{elements}</>;
}

export function SOPGuide({ serviceType, taskTemplateName }: SOPGuideProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const mappedType = serviceType ? normalizeServiceType(serviceType) : null;
  const mappedTemplate = taskTemplateName || (mappedType ? DEFAULT_TEMPLATE[mappedType] : null);

  const { data: sop, isLoading } = useQuery({
    queryKey: ["sop-guide", mappedType, mappedTemplate],
    queryFn: async () => {
      if (!mappedType) return null;
      // Try exact match
      const { data: exact } = await supabase
        .from("sop_guides")
        .select("*")
        .eq("service_type", mappedType)
        .eq("task_template_name", mappedTemplate || "")
        .maybeSingle();
      if (exact) return exact;
      // Fallback: any SOP for this service type
      const { data: fallback } = await supabase
        .from("sop_guides")
        .select("*")
        .eq("service_type", mappedType)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      return fallback || null;
    },
    enabled: !!mappedType,
  });

  const canManage =
    profile?.role === "owner" || profile?.role === "manager";

  if (!serviceType) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-7 text-xs text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300 shrink-0"
        >
          <BookOpen className="w-3.5 h-3.5" />
          How to do this
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            {isLoading ? "Loading…" : sop ? sop.title : "No SOP guide yet"}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        ) : sop ? (
          <div className="space-y-1 text-sm leading-relaxed">
            {renderMarkdown(sop.content)}

            {sop.video_url && (
              <a
                href={sop.video_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 mt-4"
                >
                  <Video className="h-3.5 w-3.5" />
                  Watch video guide
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <BookOpen className="w-10 h-10 text-muted-foreground/20 mb-3" />
            <p className="font-medium text-muted-foreground">
              No SOP guide available for this task type yet.
            </p>
            {canManage && (
              <>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  Add a guide in Settings → SOPs so your team always knows what to do.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => navigate("/settings?tab=sops")}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Add SOP Guide
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
