import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, Plus, Settings2, Trash2, Mail } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("services");

  const { data: teamMembers, isLoading: isLoadingTeam } = useQuery({
    queryKey: ['settings-team'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          profiles:manager_id (full_name)
        `)
        .order('full_name');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: services, isLoading: isLoadingServices } = useQuery({
    queryKey: ['services-master'],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const toggleServiceActive = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase.from('services').update({ is_active: !current }).eq('id', id);
      if (error) throw error;
      toast.success("Service status updated");
      // Optionally invalidate query
    } catch (err) {
      toast.error("Failed to update service status");
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground mt-1">Manage global agency preferences, integrations, and services mapping.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 md:grid-cols-5 w-full bg-muted/50 p-1">
          <TabsTrigger value="services">Services Master</TabsTrigger>
          <TabsTrigger value="team">Team Auth</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="adhoc">Task Rules</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>
        
        <TabsContent value="services" className="space-y-4">
          <div className="flex justify-between items-center bg-muted/20 p-4 border rounded-xl shadow-sm">
            <div>
              <h3 className="font-semibold">Core Services Map</h3>
              <p className="text-sm text-muted-foreground">Define what deliverables you offer. This configures the entire platform.</p>
            </div>
            <Button className="gap-2 shrink-0"><Plus className="w-4 h-4" /> Add Service</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoadingServices ? (
               [1,2,3].map(i => <div key={i} className="h-40 bg-muted/20 animate-pulse border rounded-xl" />)
            ) : services?.map(service => (
               <Card key={service.id} className={!service.is_active ? "opacity-60 grayscale" : ""}>
                 <CardHeader className="pb-3 border-b border-border/40">
                   <div className="flex justify-between items-start">
                     <CardTitle className="text-lg">{service.name}</CardTitle>
                     <Switch 
                       checked={service.is_active || false} 
                       onCheckedChange={() => toggleServiceActive(service.id, !!service.is_active)}
                     />
                   </div>
                 </CardHeader>
                 <CardContent className="pt-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {service.name.toLowerCase().includes('seo') && (
                           <>
                             <Badge variant="secondary" className="text-xs">Keywords</Badge>
                             <Badge variant="secondary" className="text-xs">Backlinks</Badge>
                           </>
                         )}
                        {service.name.toLowerCase().includes('ad') && (
                           <>
                             <Badge variant="secondary" className="text-xs">ROAS</Badge>
                             <Badge variant="secondary" className="text-xs">Spend</Badge>
                           </>
                         )}
                         <Badge variant="outline" className="text-xs border-dashed"><Plus className="w-3 h-3 mr-1" /> Variable</Badge>
                      </div>
                    </div>
                 </CardContent>
                 <CardFooter className="bg-muted/10 pt-4 flex justify-between">
                    <span className="text-xs text-muted-foreground font-medium">Global mapping synced</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6"><Settings2 className="w-3 h-3" /></Button>
                 </CardFooter>
               </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>Team Roster</CardTitle>
                <CardDescription>Manage active members, roles, capacities, and line managers.</CardDescription>
              </div>
              <Button className="gap-2 shrink-0"><Mail className="w-4 h-4" /> Invite by Email</Button>
            </CardHeader>
            <CardContent>
              {isLoadingTeam ? (
                <div className="h-40 bg-muted/20 animate-pulse border rounded-xl" />
              ) : (
                <div className="rounded-md border">
                  <table className="min-w-full divide-y divide-border">
                    <thead>
                      <tr className="bg-muted/50 text-left text-sm font-medium text-muted-foreground">
                        <th className="px-4 py-3">Member</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Capacity</th>
                        <th className="px-4 py-3">Manager</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card">
                      {teamMembers?.map((tm: any) => (
                         <tr key={tm.id}>
                           <td className="px-4 py-3 text-sm flex items-center gap-3">
                             <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-[10px]">{tm.full_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                             </Avatar>
                             <div className="flex flex-col">
                               <span className="font-semibold">{tm.full_name}</span>
                               <span className="text-xs text-muted-foreground">{tm.email || 'No email onboarded'}</span>
                             </div>
                           </td>
                           <td className="px-4 py-3 text-sm">
                             <Badge variant="outline" className="uppercase text-[10px]">{tm.role?.replace('_', ' ')}</Badge>
                           </td>
                           <td className="px-4 py-3 text-sm">{tm.capacity} tasks MTD</td>
                           <td className="px-4 py-3 text-sm text-muted-foreground">{tm.profiles?.full_name || 'Owner'}</td>
                         </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Global Alerts</CardTitle>
              <CardDescription>Control how the system dispatches email digests and severe flags.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 max-w-lg">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Daily Executive Briefing</Label>
                  <p className="text-sm text-muted-foreground">Receive a 8AM digest of yesterday's deliverables.</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Critical Flag Forwarding</Label>
                  <p className="text-sm text-muted-foreground">Immediately email Owners whenever a Critical system flag triggers.</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="adhoc" className="space-y-4">
           <Card>
            <CardHeader>
              <CardTitle>Ad-Hoc Task Constraints</CardTitle>
              <CardDescription>Rules surrounding custom tasks initiated outside templated onboarding flows.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 max-w-lg">
              <div className="flex items-center justify-between bg-muted/40 p-4 rounded-lg border">
                <div className="space-y-0.5 max-w-[280px]">
                  <Label>Manager Approval Required</Label>
                  <p className="text-xs text-muted-foreground leading-snug mt-1">If enabled, Teammates cannot execute Custom Tasks without a Manager acknowledging the queue injection.</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5 max-w-[280px]">
                  <Label>Cross-Assignment Open</Label>
                  <p className="text-xs text-muted-foreground leading-snug mt-1">Allow Teammates to assign Custom tasks directly to other Teammates (bypassing management funnels).</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
           <Card>
             <CardHeader>
               <CardTitle>External Providers</CardTitle>
               <CardDescription>Configure API keys and connect your identity to Google services.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4 max-w-xl">
               <div className="flex items-center justify-between border rounded-lg p-4 bg-card shadow-sm">
                 <div className="flex flex-col">
                   <span className="font-semibold">Resend Mail</span>
                   <span className="text-muted-foreground text-xs">Used for magic links & digests.</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><Check className="w-3 h-3 mr-1" /> Connected</Badge>
                   <Button variant="ghost" size="sm" className="h-8 hover:bg-destructive/10 hover:text-destructive">Revoke</Button>
                 </div>
               </div>
               
               <div className="flex items-center justify-between border rounded-lg p-4 bg-muted/30">
                 <div className="flex flex-col opacity-60">
                   <span className="font-semibold flex items-center gap-2">
                     <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                     Google Identity
                   </span>
                   <span className="text-muted-foreground text-xs mt-1">Allows automatic syncing of GA4/Search Console</span>
                 </div>
                 <Button variant="outline" size="sm">Connect OAuth</Button>
               </div>
             </CardContent>
           </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
