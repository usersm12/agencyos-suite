import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface ClientCredentialsProps {
  clientId: string;
  initialData?: Record<string, string>;
}

export function ClientCredentials({ clientId, initialData }: ClientCredentialsProps) {
  const [formData, setFormData] = useState({
    ga4_property_id: initialData?.ga4_property_id || "",
    gsc_property_url: initialData?.gsc_property_url || "",
    google_ads_account_id: initialData?.google_ads_account_id || "",
    meta_business_manager_id: initialData?.meta_business_manager_id || "",
    general_notes: initialData?.general_notes || "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // Credentials storage is not yet connected to a database table.
    // This is a placeholder UI for future implementation.
    toast.info("Credentials storage coming soon — requires a dedicated table.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Platform Credentials</CardTitle>
        <CardDescription>
          Store sensitive URLs, IDs, and access notes for this client.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>GA4 Property ID</Label>
              <Input placeholder="123456789" value={formData.ga4_property_id} onChange={(e) => handleChange('ga4_property_id', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Search Console URL</Label>
              <Input placeholder="sc-domain:example.com" value={formData.gsc_property_url} onChange={(e) => handleChange('gsc_property_url', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Google Ads ID</Label>
              <Input placeholder="123-456-7890" value={formData.google_ads_account_id} onChange={(e) => handleChange('google_ads_account_id', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Meta BM ID</Label>
              <Input placeholder="123456789012345" value={formData.meta_business_manager_id} onChange={(e) => handleChange('meta_business_manager_id', e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>General Access Notes</Label>
            <Textarea className="min-h-[100px]" placeholder="Any other credentials context..." value={formData.general_notes} onChange={(e) => handleChange('general_notes', e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave}>Save Credentials</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
