import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flag, ShieldCheck, Activity } from "lucide-react";
import { formatCurrency } from "@/lib/currencies";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ClientCardProps {
  id: string;
  name: string;
  industry: string;
  healthScore: number; // 0-100
  managerName?: string;
  activeServices: string[];
  openFlagsCount: number;
  monthlyRetainer: number;
  currency?: string;
}

export function ClientCard({
  id,
  name,
  industry,
  healthScore,
  managerName,
  activeServices,
  openFlagsCount,
  monthlyRetainer,
  currency = 'USD',
}: ClientCardProps) {
  const navigate = useNavigate();

  // Determine health badge color based on score
  const getHealthColor = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-800 hover:bg-green-100";
    if (score >= 50) return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
    return "bg-red-100 text-red-800 hover:bg-red-100";
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow group"
      onClick={() => navigate(`/clients/${id}`)}
    >
      <CardHeader className="pb-3 border-b">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl group-hover:text-primary transition-colors">{name}</CardTitle>
            <CardDescription className="mt-1">{industry || "No industry specified"}</CardDescription>
          </div>
          <Badge className={`${getHealthColor(healthScore)} flex items-center gap-1`}>
            <Activity className="h-3 w-3" />
            {healthScore}% Health
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="flex justify-between items-center text-sm">
           <div className="flex items-center text-muted-foreground">
             <Avatar className="h-6 w-6 mr-2">
                <AvatarFallback className="text-[10px]">
                  {managerName?.substring(0, 2).toUpperCase() || 'M'}
                </AvatarFallback>
             </Avatar>
             <span>{managerName || "Unassigned"}</span>
           </div>
           
           <span className="font-semibold text-sm">
             {formatCurrency(monthlyRetainer, currency)}
           </span>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-1.5 flex-wrap max-w-[60%]">
             {activeServices.slice(0, 3).map((service, i) => {
               // Map service names to icons or generic badge
               let icon = "S";
               if (service.toLowerCase().includes('seo')) icon = "S";
               else if (service.toLowerCase().includes('ads')) icon = "A";
               else if (service.toLowerCase().includes('social')) icon = "SM";
               else if (service.toLowerCase().includes('web')) icon = "W";
               
               return (
                 <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-center h-6 w-6 text-[10px] font-bold text-muted-foreground bg-secondary/80 rounded-full border border-border/50">
                      {icon}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{service}</p>
                  </TooltipContent>
                </Tooltip>
               );
             })}
             {activeServices.length > 3 && (
               <div className="flex items-center justify-center h-6 w-6 text-[10px] font-bold text-muted-foreground bg-secondary/80 rounded-full border border-border/50">
                 +{activeServices.length - 3}
               </div>
             )}
             {activeServices.length === 0 && (
               <span className="text-xs text-muted-foreground">No active services</span>
             )}
          </div>
          
          {openFlagsCount > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive" className="flex items-center gap-1 cursor-help">
                  <Flag className="h-3 w-3" />
                  {openFlagsCount}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{openFlagsCount} active flags need attention</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-200 cursor-help">
                  <ShieldCheck className="h-3 w-3" />
                  Clear
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>No active flags</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
