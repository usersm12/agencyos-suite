import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const VAPID_PUBLIC_KEY = "BB6S1tLSHQ5Cv_UP5VsSHOOCtphO8JO1kR0wyqEab6bWJ3NEmQzz576Ejs4HOv-F9qJCchdU_pBeA_KeOWtCLBI";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
}

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export function usePushNotifications() {
  const { profile } = useAuth();
  const [permission, setPermission] = useState<PushPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const isSupported =
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  // Sync current state on mount
  useEffect(() => {
    if (!isSupported) { setPermission("unsupported"); return; }
    setPermission(Notification.permission as PushPermission);
  }, [isSupported]);

  // Check if this browser already has a stored subscription
  useEffect(() => {
    if (!profile || !isSupported) return;
    (async () => {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (!reg) return;
      const existing = await reg.pushManager.getSubscription();
      if (existing) setSubscribed(true);
    })();
  }, [profile, isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !profile) return false;
    setLoading(true);
    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);
      if (perm !== "granted") return false;

      // Register service worker
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      // Create push subscription
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };

      // Save to Supabase
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: profile.id,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          user_agent: navigator.userAgent.slice(0, 200),
        },
        { onConflict: "user_id,endpoint" },
      );

      if (error) throw error;
      setSubscribed(true);
      return true;
    } catch (err) {
      console.error("[push] subscribe error:", err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported, profile]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!profile) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          await sub.unsubscribe();
        }
      }
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  return { isSupported, permission, subscribed, loading, subscribe, unsubscribe };
}
