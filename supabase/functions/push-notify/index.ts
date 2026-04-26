import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_EMAIL       = Deno.env.get("VAPID_EMAIL") ?? "mailto:admin@agencyos.app";

// ── VAPID helpers (no external library needed) ──────────────────────────────

function base64UrlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  return new Uint8Array([...bin].map((c) => c.charCodeAt(0)));
}

function base64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function buildVapidHeaders(audience: string): Promise<Record<string, string>> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 12 * 3600;

  const header  = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ aud: audience, exp, sub: VAPID_EMAIL })));
  const sigInput = `${header}.${payload}`;

  const privRaw = base64UrlDecode(VAPID_PRIVATE_KEY);
  const privKey = await crypto.subtle.importKey(
    "pkcs8",
    buildPkcs8(privRaw),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privKey,
    new TextEncoder().encode(sigInput),
  );

  const token = `${sigInput}.${base64UrlEncode(sig)}`;
  return {
    Authorization: `vapid t=${token},k=${VAPID_PUBLIC_KEY}`,
    "Content-Type": "application/octet-stream",
    TTL: "86400",
  };
}

/** Wrap a raw 32-byte EC private key in a minimal PKCS#8 DER envelope */
function buildPkcs8(rawKey: Uint8Array): ArrayBuffer {
  // OID for prime256v1 (P-256)
  const oid = new Uint8Array([0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]);
  const ecParams = new Uint8Array([0x30, oid.length, ...oid]);
  const algId = new Uint8Array([0x30, ecParams.length + 9,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    ...ecParams]);
  const privateKeyInfo = new Uint8Array([0x30, 2 + rawKey.length,
    0x02, 0x01, 0x01, 0x04, rawKey.length, ...rawKey]);
  const outer = new Uint8Array([0x30, algId.length + privateKeyInfo.length, ...algId, ...privateKeyInfo]);
  return outer.buffer;
}

async function encryptPayload(
  payload: string,
  p256dh: string,
  auth: string,
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const authBytes   = base64UrlDecode(auth);
  const receiverKey = base64UrlDecode(p256dh);

  // Generate ephemeral key pair
  const senderKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]);
  const senderPub  = new Uint8Array(await crypto.subtle.exportKey("raw", senderKeys.publicKey));

  const receiverCryptoKey = await crypto.subtle.importKey(
    "raw", receiverKey, { name: "ECDH", namedCurve: "P-256" }, false, [],
  );
  const sharedBits = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: receiverCryptoKey }, senderKeys.privateKey, 256));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc  = new TextEncoder();

  // HKDF extract
  const prk = await crypto.subtle.importKey("raw", sharedBits, "HKDF", false, ["deriveKey", "deriveBits"]);

  // Build ikm (input keying material)
  const authInfo = enc.encode("Content-Encoding: auth\0");
  const ikmBits  = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authBytes, info: authInfo }, prk, 256,
  ));

  const ikm = await crypto.subtle.importKey("raw", ikmBits, "HKDF", false, ["deriveKey", "deriveBits"]);

  // CEK
  const cekInfo = concatArrays(enc.encode("Content-Encoding: aesgcm\0"), authBytes, receiverKey, senderPub);
  const cek = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: cekInfo },
    ikm, { name: "AES-GCM", length: 128 }, false, ["encrypt"],
  );

  // Nonce
  const nonceInfo = concatArrays(enc.encode("Content-Encoding: nonce\0"), authBytes, receiverKey, senderPub);
  const nonceBits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo }, ikm, 96,
  ));

  const padded    = concatArrays(new Uint8Array(2), enc.encode(payload));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonceBits }, cek, padded));

  return { ciphertext: encrypted, salt, serverPublicKey: senderPub };
}

function concatArrays(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((s, a) => s + a.length, 0);
  const out   = new Uint8Array(total);
  let offset  = 0;
  for (const a of arrs) { out.set(a, offset); offset += a.length; }
  return out;
}

async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: string) {
  const url      = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const headers  = await buildVapidHeaders(audience);
  const { ciphertext, salt, serverPublicKey } = await encryptPayload(payload, sub.p256dh, sub.auth);

  headers["Content-Encoding"]  = "aesgcm";
  headers["Encryption"]        = `salt=${base64UrlEncode(salt)}`;
  headers["Crypto-Key"]        = `dh=${base64UrlEncode(serverPublicKey)};${headers.Authorization.split(",k=")[1] ? `p256ecdsa=${VAPID_PUBLIC_KEY}` : ""}`;

  const res = await fetch(sub.endpoint, { method: "POST", headers, body: ciphertext });
  return res.status;
}

// ── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } });
  }

  try {
    const { user_ids, title, body, url } = await req.json() as {
      user_ids: string[];
      title: string;
      body: string;
      url?: string;
    };

    if (!user_ids?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("user_id", user_ids);

    if (!subs?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });

    const payload = JSON.stringify({ title, body, url: url ?? "/" });
    let sent = 0;
    const stale: string[] = [];

    await Promise.all(
      subs.map(async (s) => {
        const status = await sendPush(s, payload);
        if (status === 201 || status === 200) {
          sent++;
        } else if (status === 410 || status === 404) {
          // Subscription expired — clean it up
          stale.push(s.endpoint);
        }
      }),
    );

    if (stale.length) {
      await supabase.from("push_subscriptions").delete().in("endpoint", stale);
    }

    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (err) {
    console.error("push-notify error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
