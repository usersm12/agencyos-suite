import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Mail, Edit2, Bell, BellOff, BellRing, Loader2, RefreshCw, Unlink } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ServicesMaster from "@/components/settings/ServicesMaster";
import { SOPSettings } from "@/components/settings/SOPSettings";
import { EditProfileModal } from "@/components/team/EditProfileModal";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  connectAgencyGoogle,
  disconnectAgencyGoogle,
  getAgencyGoogleToken,
  isAgencyTokenExpired,
  formatTokenExpiry,
  type AgencyOAuthToken,
} from "@/integrations/agencyOAuth";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("services");
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const { isSupported, permission, subscribed, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [googleDisconnecting, setGoogleDisconnecting] = useState(false);

  // Support ?tab=sops deep-link (e.g. from SOPGuide "Add SOP" button)
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) {
      setActiveTab(tab);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: teamMembers, isLoading: isLoadingTeam } = useQuery({
    queryKey: ['settings-team'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      if (error) throw error;
      return data || [];
    }
  });

  // ── Agency Google OAuth token ────────────────────────────────────────────
  const { data: googleToken, isLoading: googleTokenLoading } = useQuery<AgencyOAuthToken | null>({
    queryKey: ['agency-google-token'],
    queryFn: getAgencyGoogleToken,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const googleIsConnected = !!googleToken && !isAgencyTokenExpired(googleToken.expires_at);
  const googleIsExpired   = !!googleToken && isAgencyTokenExpired(googleToken.expires_at);

  async function handleConnectGoogle() {
    if (!profile?.id) return;
    setGoogleConnecting(true);
    try {
      await connectAgencyGoogle(profile.id);
      queryClient.invalidateQueries({ queryKey: ['agency-google-token'] });
      toast.success("Google account connected — Search Console & GA4 are ready.");
    } catch (err: any) {
      toast.error("Google OAuth failed: " + (err.message || "Unknown error"));
    } finally {
      setGoogleConnecting(false);
    }
  }

  async function handleDisconnectGoogle() {
    setGoogleDisconnecting(true);
    try {
      await disconnectAgencyGoogle();
      queryClient.invalidateQueries({ queryKey: ['agency-google-token'] });
      toast.success("Google account disconnected.");
    } catch (err: any) {
      toast.error("Failed to disconnect: " + (err.message || "Unknown error"));
    } finally {
      setGoogleDisconnecting(false);
    }
  }

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "owner": return "bg-purple-50 text-purple-700 border-purple-200";
      case "manager": return "bg-blue-50 text-blue-700 border-blue-200";
      default: return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground mt-1">Manage global agency preferences, integrations, and services mapping.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full bg-muted/50 p-1">
          <TabsTrigger value="services">Services Master</TabsTrigger>
          <TabsTrigger value="sops">SOPs</TabsTrigger>
          <TabsTrigger value="team">Team Auth</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="adhoc">Task Rules</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="services">
          <ServicesMaster />
        </TabsContent>

        <TabsContent value="sops">
          <SOPSettings />
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>Team Roster</CardTitle>
                <CardDescription>Manage active members and roles. Click the edit button to change a member's name or role.</CardDescription>
              </div>
              <Button className="gap-2 shrink-0"><Mail className="w-4 h-4" /> Invite by Email</Button>
            </CardHeader>
            <CardContent>
              {isLoadingTeam ? (
                <div className="h-40 bg-muted/20 animate-pulse border rounded-xl" />
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <table className="min-w-full divide-y divide-border">
                    <thead>
                      <tr className="bg-muted/50 text-left text-sm font-medium text-muted-foreground">
                        <th className="px-4 py-3">Member</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Joined</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card">
                      {teamMembers?.map((tm: any) => (
                        <tr key={tm.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                                {tm.full_name?.substring(0, 2).toUpperCase() || '??'}
                              </div>
                              <span className="font-semibold">{tm.full_name || 'Unnamed'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <Badge variant="outline" className={`uppercase text-[10px] ${getRoleBadgeClass(tm.role)}`}>
                              {tm.role?.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {new Date(tm.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1.5 text-xs"
                              onClick={() => setEditingMember(tm)}
                            >
                              <Edit2 className="w-3.5 h-3.5" /> Edit
                            </Button>
                          </td>
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
          {/* Web Push */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BellRing className="w-5 h-5" /> Browser Push Notifications
              </CardTitle>
              <CardDescription>
                Get OS-level notifications for task assignments, approvals, and mentions — even when this tab is in the background.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              {!isSupported ? (
                <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
                  <BellOff className="w-5 h-5 shrink-0" />
                  Your browser doesn't support web push notifications.
                </div>
              ) : permission === "denied" ? (
                <div className="flex items-center gap-3 p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
                  <BellOff className="w-5 h-5 shrink-0" />
                  Notifications are blocked. Enable them in your browser site settings and reload.
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable push notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      {subscribed
                        ? "This browser will receive push notifications."
                        : "Click to enable — your browser will ask for permission."}
                    </p>
                  </div>
                  {subscribed ? (
                    <Button variant="outline" size="sm" onClick={unsubscribe} disabled={pushLoading} className="gap-2">
                      <BellOff className="w-4 h-4" /> Disable
                    </Button>
                  ) : (
                    <Button size="sm" onClick={subscribe} disabled={pushLoading} className="gap-2">
                      <Bell className="w-4 h-4" /> {pushLoading ? "Enabling…" : "Enable"}
                    </Button>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Notifications are sent for: task assignments, approval requests, approvals / rejections, and @mentions.
                Each team member enables this individually per device.
              </p>
            </CardContent>
          </Card>

          {/* Global alerts */}
          <Card>
            <CardHeader>
              <CardTitle>Global Alerts</CardTitle>
              <CardDescription>Control how the system dispatches email digests and severe flags.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 max-w-lg">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Daily Executive Briefing</Label>
                  <p className="text-sm text-muted-foreground">Receive an 8AM digest of yesterday's deliverables.</p>
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
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Check className="w-3 h-3 mr-1" /> Connected
                  </Badge>
                  <Button variant="ghost" size="sm" className="h-8 hover:bg-destructive/10 hover:text-destructive">Revoke</Button>
                </div>
              </div>

              <div className={`flex items-center justify-between border rounded-lg p-4 ${googleIsConnected ? "bg-card" : "bg-muted/30"}`}>
                <div className="flex flex-col">
                  <span className="font-semibold flex items-center gap-2">
                    {/* Google "G" logo */}
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Google Identity
                  </span>
                  <span className="text-muted-foreground text-xs mt-1">
                    {googleTokenLoading
                      ? "Checking…"
                      : googleIsConnected
                        ? `Connected · ${formatTokenExpiry(googleToken!.expires_at)}`
                        : googleIsExpired
                          ? "Token expired — reconnect to resume data syncing"
                          : "Grants access to Search Console & GA4 for all clients"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {googleIsConnected && (
                    <>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <Check className="w-3 h-3 mr-1" /> Connected
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        disabled={googleDisconnecting}
                        onClick={handleDisconnectGoogle}
                      >
                        {googleDisconnecting
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Unlink className="w-3.5 h-3.5" />}
                        Disconnect
                      </Button>
                    </>
                  )}

                  {(googleIsExpired || !googleToken) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={googleConnecting || googleTokenLoading}
                      onClick={handleConnectGoogle}
                    >
                      {googleConnecting
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : googleIsExpired
                          ? <RefreshCw className="w-3.5 h-3.5" />
                          : null}
                      {googleConnecting
                        ? "Connecting…"
                        : googleIsExpired
                          ? "Reconnect"
                          : "Connect OAuth"}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {editingMember && (
        <EditProfileModal
          member={editingMember}
          open={!!editingMember}
          onClose={() => setEditingMember(null)}
        />
      )}
    </div>
  );
}
