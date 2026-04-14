import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ClientCredentialsProps {
  clientId: string;
}

interface CredentialsForm {
  ga4_property_id: string;
  gsc_property_url: string;
  google_ads_account_id: string;
  meta_business_manager_id: string;
  website_cms_url: string;
  website_cms_notes: string;
  general_notes: string;
}

const EMPTY: CredentialsForm = {
  ga4_property_id: "",
  gsc_property_url: "",
  google_ads_account_id: "",
  meta_business_manager_id: "",
  website_cms_url: "",
  website_cms_notes: "",
  general_notes: "",
};

export function ClientCredentials({ clientId }: ClientCredentialsProps) {
  const [formData, setFormData] = useState<CredentialsForm>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // ── Load existing credentials ────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("client_credentials")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();

      if (!error && data) {
        setFormData({
          ga4_property_id: data.ga4_property_id ?? "",
          gsc_property_url: data.gsc_property_url ?? "",
          google_ads_account_id: data.google_ads_account_id ?? "",
          meta_business_manager_id: data.meta_business_manager_id ?? "",
          website_cms_url: data.website_cms_url ?? "",
          website_cms_notes: data.website_cms_notes ?? "",
          general_notes: data.general_notes ?? "",
        });
      }
      setIsLoading(false);
    }
    load();
  }, [clientId]);

  const handleChange = (field: keyof CredentialsForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // ── Save / upsert ────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from("client_credentials")
      .upsert(
        {
          client_id: clientId,
          ga4_property_id: formData.ga4_property_id || null,
          gsc_property_url: formData.gsc_property_url || null,
          google_ads_account_id: formData.google_ads_account_id || null,
          meta_business_manager_id: formData.meta_business_manager_id || null,
          website_cms_url: formData.website_cms_url || null,
          website_cms_notes: formData.website_cms_notes || null,
          general_notes: formData.general_notes || null,
        },
        { onConflict: "client_id" }
      );

    setIsSaving(false);

    if (error) {
      toast.error("Failed to save credentials: " + error.message);
    } else {
      toast.success("Credentials saved");
    }
  };

  if (isLoading) {
    return <Card className="h-48 animate-pulse bg-muted/20" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Platform Credentials</CardTitle>
        <CardDescription>
          Store property IDs and access notes for this client's integrations.
          GA4 Property ID and Search Console URL are required to connect those integrations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Google */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Google
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  GA4 Property ID
                  <span className="text-muted-foreground font-normal ml-1">(e.g. 123456789)</span>
                </Label>
                <Input
                  placeholder="123456789"
                  value={formData.ga4_property_id}
                  onChange={e => handleChange("ga4_property_id", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Search Console URL
                  <span className="text-muted-foreground font-normal ml-1">(e.g. sc-domain:example.com)</span>
                </Label>
                <Input
                  placeholder="sc-domain:example.com"
                  value={formData.gsc_property_url}
                  onChange={e => handleChange("gsc_property_url", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Google Ads Account ID</Label>
                <Input
                  placeholder="123-456-7890"
                  value={formData.google_ads_account_id}
                  onChange={e => handleChange("google_ads_account_id", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Meta */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Meta
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Meta Business Manager ID</Label>
                <Input
                  placeholder="123456789012345"
                  value={formData.meta_business_manager_id}
                  onChange={e => handleChange("meta_business_manager_id", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* CMS */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Website CMS
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CMS Login URL</Label>
                <Input
                  placeholder="https://example.com/wp-admin"
                  value={formData.website_cms_url}
                  onChange={e => handleChange("website_cms_url", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>CMS Notes</Label>
                <Input
                  placeholder="Username, notes..."
                  value={formData.website_cms_notes}
                  onChange={e => handleChange("website_cms_notes", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* General notes */}
          <div className="space-y-2">
            <Label>General Access Notes</Label>
            <Textarea
              className="min-h-[80px]"
              placeholder="Any other credentials or context..."
              value={formData.general_notes}
              onChange={e => handleChange("general_notes", e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving…" : "Save Credentials"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
