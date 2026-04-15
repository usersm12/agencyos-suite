import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, BookOpen, Video, ExternalLink } from "lucide-react";

interface SOPGuideProps {
  serviceType?: string | null;
  taskTemplateName?: string | null;
}

// Map service_type values to sop_guides service_type column
const SERVICE_TYPE_MAP: Record<string, string> = {
  seo_backlink: "seo",
  seo_keywords: "seo",
  seo_technical: "seo",
  seo_content: "seo",
  google_ads: "google_ads",
  meta_ads: "meta_ads",
  social_media: "social_media",
  web_dev: "web_dev",
};

const TEMPLATE_NAME_MAP: Record<string, string> = {
  seo_backlink: "backlink_building",
  seo_keywords: "keyword_rankings",
  seo_technical: "technical_audit",
  seo_content: "content_publishing",
  google_ads: "campaign_review",
  meta_ads: "campaign_review",
  social_media: "monthly_posts",
  web_dev: "new_project",
};

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="text-base font-bold mt-4 mb-2 text-foreground">{line.slice(3)}</h2>);
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="text-sm font-semibold mt-3 mb-1 text-foreground">{line.slice(4)}</h3>);
    } else if (/^\d+\.\s/.test(line)) {
      // Numbered list — collect consecutive numbered items
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal list-inside space-y-1 my-2 ml-2">
          {listItems.map((item, j) => (
            <li key={j} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: boldText(item) }} />
          ))}
        </ol>
      );
      continue;
    } else if (line.startsWith("- ")) {
      // Bullet list
      const listItems: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        listItems.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc list-inside space-y-1 my-2 ml-2">
          {listItems.map((item, j) => (
            <li key={j} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: boldText(item) }} />
          ))}
        </ul>
      );
      continue;
    } else if (line.trim() === "") {
      // skip blank lines
    } else {
      elements.push(
        <p key={i} className="text-sm leading-relaxed my-1" dangerouslySetInnerHTML={{ __html: boldText(line) }} />
      );
    }
    i++;
  }

  return <>{elements}</>;
}

function boldText(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export function SOPGuide({ serviceType, taskTemplateName }: SOPGuideProps) {
  const [collapsed, setCollapsed] = useState(true);

  const mappedServiceType = serviceType ? (SERVICE_TYPE_MAP[serviceType] || serviceType) : null;
  const mappedTemplateName = serviceType ? (TEMPLATE_NAME_MAP[serviceType] || taskTemplateName) : taskTemplateName;

  const { data: sop } = useQuery({
    queryKey: ["sop-guide", mappedServiceType, mappedTemplateName],
    queryFn: async () => {
      if (!mappedServiceType) return null;
      const { data } = await supabase
        .from("sop_guides")
        .select("*")
        .eq("service_type", mappedServiceType)
        .eq("task_template_name", mappedTemplateName || "")
        .maybeSingle();
      return data;
    },
    enabled: !!mappedServiceType,
  });

  if (!sop) return null;

  return (
    <div className="rounded-lg border bg-blue-50/40 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900">
      <button
        className="flex items-center gap-2 w-full text-left p-3"
        onClick={() => setCollapsed(!collapsed)}
      >
        <BookOpen className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="font-medium text-sm flex-1 text-blue-800 dark:text-blue-300">How to do this task</span>
        {collapsed
          ? <ChevronRight className="h-4 w-4 text-blue-500" />
          : <ChevronDown className="h-4 w-4 text-blue-500" />
        }
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 border-t border-blue-100 dark:border-blue-900 pt-3">
          <div className="prose prose-sm max-w-none">
            {renderMarkdown(sop.content)}
          </div>
          {sop.video_url && (
            <a
              href={sop.video_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2"
            >
              <Button variant="outline" size="sm" className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50">
                <Video className="h-3.5 w-3.5" />
                Watch video guide
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
