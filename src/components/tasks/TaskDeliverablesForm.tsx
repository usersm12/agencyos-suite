import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Props {
  taskId: string;
  serviceType: string;
}

interface BacklinkRow {
  source_url: string;
  target_url: string;
  da: number | string;
  pa: number | string;
  dofollow: boolean;
  anchor_text: string;
  date_built: string;
  status: string;
}

interface SocialPostRow {
  platform: string;
  post_url: string;
  post_type: string;
  publish_date: string;
  likes: number | string;
  comments: number | string;
  reach: number | string;
  saves: number | string;
}

const emptyBacklink = (): BacklinkRow => ({
  source_url: '', target_url: '', da: '', pa: '', dofollow: true,
  anchor_text: '', date_built: format(new Date(), 'yyyy-MM-dd'), status: 'live'
});

const emptySocialPost = (): SocialPostRow => ({
  platform: '', post_url: '', post_type: '', publish_date: format(new Date(), 'yyyy-MM-dd'),
  likes: '', comments: '', reach: '', saves: ''
});

export function TaskDeliverablesForm({ taskId, serviceType }: Props) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<any>({});

  const { data: deliverables, isLoading } = useQuery({
    queryKey: ['task_service_deliverables', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_deliverables')
        .select('*')
        .eq('task_id', taskId)
        .eq('deliverable_name', 'Service Data')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!taskId
  });

  useEffect(() => {
    if (deliverables?.data) {
      const d = deliverables.data as Record<string, unknown>;
      setFormData(d);
    }
  }, [deliverables]);

  const saveDeliverables = useMutation({
    mutationFn: async () => {
      const payload = {
        task_id: taskId,
        deliverable_name: 'Service Data',
        deliverable_type: serviceType.toLowerCase(),
        status: 'completed',
        data: formData as import('@/integrations/supabase/types').Json
      };

      if (deliverables?.id) {
        const { error } = await supabase
          .from('task_deliverables')
          .update({ data: formData as import('@/integrations/supabase/types').Json, deliverable_type: serviceType.toLowerCase() })
          .eq('id', deliverables.id);
        if (error) throw error;
      } else {
         const { error } = await supabase
           .from('task_deliverables')
           .insert(payload);
         if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Deliverables saved");
      queryClient.invalidateQueries({ queryKey: ['task_service_deliverables', taskId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save deliverables");
    }
  });

  const handleChange = (key: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }));
  };

  // Backlink helpers
  const backlinks: BacklinkRow[] = formData.backlinks || [];
  const setBacklinks = (rows: BacklinkRow[]) => handleChange('backlinks', rows);
  const addBacklink = () => setBacklinks([...backlinks, emptyBacklink()]);
  const removeBacklink = (i: number) => setBacklinks(backlinks.filter((_, idx) => idx !== i));
  const updateBacklink = (i: number, field: keyof BacklinkRow, val: any) => {
    const updated = [...backlinks];
    (updated[i] as any)[field] = val;
    setBacklinks(updated);
  };

  // Social post helpers
  const posts: SocialPostRow[] = formData.posts || [];
  const setPosts = (rows: SocialPostRow[]) => handleChange('posts', rows);
  const addPost = () => setPosts([...posts, emptySocialPost()]);
  const removePost = (i: number) => setPosts(posts.filter((_, idx) => idx !== i));
  const updatePost = (i: number, field: keyof SocialPostRow, val: any) => {
    const updated = [...posts];
    (updated[i] as any)[field] = val;
    setPosts(updated);
  };

  const renderForm = () => {
    switch (serviceType?.toLowerCase()) {
      case 'seo':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Backlink Log</Label>
              <Button type="button" variant="outline" size="sm" onClick={addBacklink} className="gap-1">
                <Plus className="w-3 h-3" /> Add Row
              </Button>
            </div>

            {backlinks.length > 0 && (
              <div className="space-y-3">
                {backlinks.map((row, i) => (
                  <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 border rounded-lg bg-card relative">
                    <div>
                      <Label className="text-[10px]">Source URL</Label>
                      <Input value={row.source_url} onChange={e => updateBacklink(i, 'source_url', e.target.value)} placeholder="https://..." className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Target URL</Label>
                      <Input value={row.target_url} onChange={e => updateBacklink(i, 'target_url', e.target.value)} placeholder="https://..." className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">DA</Label>
                      <Input type="number" value={row.da} onChange={e => updateBacklink(i, 'da', e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">PA</Label>
                      <Input type="number" value={row.pa} onChange={e => updateBacklink(i, 'pa', e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Anchor Text</Label>
                      <Input value={row.anchor_text} onChange={e => updateBacklink(i, 'anchor_text', e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Date Built</Label>
                      <Input type="date" value={row.date_built} onChange={e => updateBacklink(i, 'date_built', e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Status</Label>
                      <Select value={row.status} onValueChange={v => updateBacklink(i, 'status', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="live">Live</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex items-center gap-1">
                        <Switch checked={row.dofollow} onCheckedChange={c => updateBacklink(i, 'dofollow', c)} />
                        <Label className="text-[10px]">DoFollow</Label>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeBacklink(i)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {backlinks.length > 0 && (
              <div className="flex gap-4 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                <span>Total: <strong>{backlinks.length}</strong></span>
                <span>Avg DA: <strong>{backlinks.length > 0 ? Math.round(backlinks.reduce((s, r) => s + (Number(r.da) || 0), 0) / backlinks.length) : 0}</strong></span>
                <span>Live: <strong>{backlinks.filter(r => r.status === 'live').length}</strong></span>
                <span>Pending: <strong>{backlinks.filter(r => r.status === 'pending').length}</strong></span>
                <span>Rejected: <strong>{backlinks.filter(r => r.status === 'rejected').length}</strong></span>
              </div>
            )}

            <div>
              <Label>Keyword Updates</Label>
              <Textarea 
                placeholder="Enter keyword ranking updates..." 
                value={formData.keyword_updates || ''} 
                onChange={e => handleChange('keyword_updates', e.target.value)}
              />
            </div>
            <div>
              <Label>Content Published</Label>
              <Input 
                placeholder="URLs of content published..." 
                value={formData.content_published || ''} 
                onChange={e => handleChange('content_published', e.target.value)}
              />
            </div>
          </div>
        );
      case 'google ads':
        return (
          <div className="grid grid-cols-2 gap-4">
             <div>
               <Label>CTR (%)</Label>
               <Input type="number" value={formData.ctr || ''} onChange={e => handleChange('ctr', e.target.value)} />
             </div>
             <div>
               <Label>CPC ($)</Label>
               <Input type="number" value={formData.cpc || ''} onChange={e => handleChange('cpc', e.target.value)} />
             </div>
             <div>
               <Label>Conversions</Label>
               <Input type="number" value={formData.conversions || ''} onChange={e => handleChange('conversions', e.target.value)} />
             </div>
             <div>
               <Label>Spend ($)</Label>
               <Input type="number" value={formData.spend || ''} onChange={e => handleChange('spend', e.target.value)} />
             </div>
             <div className="col-span-2">
               <Label>ROAS</Label>
               <Input type="number" value={formData.roas || ''} onChange={e => handleChange('roas', e.target.value)} />
             </div>
          </div>
        );
      case 'meta ads':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div>
               <Label>ROAS</Label>
               <Input type="number" value={formData.roas || ''} onChange={e => handleChange('roas', e.target.value)} />
             </div>
             <div>
               <Label>CPL ($)</Label>
               <Input type="number" value={formData.cpl || ''} onChange={e => handleChange('cpl', e.target.value)} />
             </div>
             <div>
               <Label>CTR (%)</Label>
               <Input type="number" value={formData.ctr || ''} onChange={e => handleChange('ctr', e.target.value)} />
             </div>
             <div>
               <Label>Spend ($)</Label>
               <Input type="number" value={formData.spend || ''} onChange={e => handleChange('spend', e.target.value)} />
             </div>
             <div className="col-span-2">
               <Label>Best Creative URL</Label>
               <Input value={formData.best_creative_url || ''} onChange={e => handleChange('best_creative_url', e.target.value)} />
             </div>
          </div>
        );
      case 'social media':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Social Media Posts Log</Label>
              <Button type="button" variant="outline" size="sm" onClick={addPost} className="gap-1">
                <Plus className="w-3 h-3" /> Add Post
              </Button>
            </div>

            {posts.length > 0 && (
              <div className="space-y-3">
                {posts.map((row, i) => (
                  <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 border rounded-lg bg-card">
                    <div>
                      <Label className="text-[10px]">Platform</Label>
                      <Select value={row.platform} onValueChange={v => updatePost(i, 'platform', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {['Instagram', 'Facebook', 'LinkedIn', 'Twitter/X', 'TikTok', 'YouTube'].map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px]">Post URL</Label>
                      <Input value={row.post_url} onChange={e => updatePost(i, 'post_url', e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Post Type</Label>
                      <Select value={row.post_type} onValueChange={v => updatePost(i, 'post_type', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                        <SelectContent>
                          {['Image', 'Video', 'Carousel', 'Reel', 'Story', 'Text'].map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px]">Publish Date</Label>
                      <Input type="date" value={row.publish_date} onChange={e => updatePost(i, 'publish_date', e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Likes</Label>
                      <Input type="number" value={row.likes} onChange={e => updatePost(i, 'likes', e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Comments</Label>
                      <Input type="number" value={row.comments} onChange={e => updatePost(i, 'comments', e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Reach</Label>
                      <Input type="number" value={row.reach} onChange={e => updatePost(i, 'reach', e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label className="text-[10px]">Saves</Label>
                        <Input type="number" value={row.saves} onChange={e => updatePost(i, 'saves', e.target.value)} className="h-8 text-xs" />
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removePost(i)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {posts.length > 0 && (() => {
              const totalReach = posts.reduce((s, r) => s + (Number(r.reach) || 0), 0);
              const bestPost = posts.reduce((best, r) => (Number(r.reach) || 0) > (Number(best.reach) || 0) ? r : best, posts[0]);
              return (
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                  <span>Total Posts: <strong>{posts.length}</strong></span>
                  <span>Total Reach: <strong>{totalReach.toLocaleString()}</strong></span>
                  <span>Best: <strong>{bestPost?.platform} ({Number(bestPost?.reach || 0).toLocaleString()} reach)</strong></span>
                </div>
              );
            })()}
          </div>
        );
      case 'web development':
        return (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch 
                checked={formData.completed_on_time || false} 
                onCheckedChange={checked => handleChange('completed_on_time', checked)} 
              />
              <Label>Completed on time</Label>
            </div>
            <div>
               <Label>Staging URL</Label>
               <Input value={formData.staging_url || ''} onChange={e => handleChange('staging_url', e.target.value)} />
             </div>
             <div>
               <Label>Notes</Label>
               <Textarea 
                 value={formData.notes || ''} 
                 onChange={e => handleChange('notes', e.target.value)}
                 className="min-h-[100px]"
               />
             </div>
          </div>
        );
      default:
        return (
          <div className="space-y-4">
            <div>
              <Label>General Notes</Label>
              <Textarea 
                value={formData.notes || ''} 
                onChange={e => handleChange('notes', e.target.value)}
                className="min-h-[100px]"
                placeholder="Enter deliverable notes..."
              />
            </div>
          </div>
        );
    }
  };

  if (isLoading) return <div className="animate-pulse h-32 bg-muted rounded"></div>;

  return (
    <div className="space-y-4 bg-muted/20 border rounded-lg p-5">
      {renderForm()}
      <div className="flex justify-end pt-2">
        <Button onClick={() => saveDeliverables.mutate()} disabled={saveDeliverables.isPending} className="gap-2">
          <Save className="w-4 h-4" /> Save Deliverables
        </Button>
      </div>
    </div>
  );
}
