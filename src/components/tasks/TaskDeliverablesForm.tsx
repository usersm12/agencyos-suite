import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save } from "lucide-react";

interface Props {
  taskId: string;
  serviceType: string;
}

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
      setFormData(deliverables.data);
    }
  }, [deliverables]);

  const saveDeliverables = useMutation({
    mutationFn: async () => {
      if (deliverables?.id) {
        const { error } = await supabase
          .from('task_deliverables')
          .update({ data: formData })
          .eq('id', deliverables.id);
        if (error) throw error;
      } else {
         const { error } = await supabase
           .from('task_deliverables')
           .insert({
              task_id: taskId,
              deliverable_name: 'Service Data',
              status: 'completed',
              data: formData
           });
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
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const renderForm = () => {
    switch (serviceType?.toLowerCase()) {
      case 'seo':
        return (
          <div className="space-y-4">
             <div>
               <Label>Backlink Log (Source URL, Target URL, DA, PA, etc.)</Label>
               <Textarea 
                 placeholder="Enter backlink data as list..." 
                 value={formData.backlink_log || ''} 
                 onChange={e => handleChange('backlink_log', e.target.value)}
                 className="min-h-[100px]"
               />
             </div>
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
             <div>
               <Label>Posts Log (Platform, URL, Type, Likes, Comments, Reach)</Label>
               <Textarea 
                 placeholder="Enter posts data log..." 
                 value={formData.posts_log || ''} 
                 onChange={e => handleChange('posts_log', e.target.value)}
                 className="min-h-[150px]"
               />
             </div>
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
          <div className="text-sm text-muted-foreground italic">
            No specific deliverable form defined for {serviceType}.
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
