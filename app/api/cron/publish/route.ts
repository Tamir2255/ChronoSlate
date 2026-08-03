/**
 * POST /api/cron/publish
 *
 * Hardened cron endpoint with CRON_SECRET header validation.
 * See README for configuration instructions. This handler expects the
 * scheduler to POST with header `x-chronoslate-cron: <CRON_SECRET>`.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const AYRSHARE_API_KEY = process.env.AYRSHARE_API_KEY!;
const CRON_SECRET = process.env.CRON_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !AYRSHARE_API_KEY) {
  console.warn("Missing required environment variables in cron/publish/route.ts");
}

const supabaseAdmin = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function postToAyrshare(content: string) {
  const res = await fetch("https://app.ayrshare.com/api/post", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AYRSHARE_API_KEY}`
    },
    body: JSON.stringify({ content, platforms: ["linkedin"] })
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = { raw: text };
  }

  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, body: json }));
  }
  return json;
}

export async function POST(req: Request) {
  try {
    // Validate secret header if configured
    if (CRON_SECRET) {
      const header = req.headers.get("x-chronoslate-cron");
      if (!header || header !== CRON_SECRET) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
    }

    const nowISO = new Date().toISOString();
    const { data: posts, error } = await supabaseAdmin
      .from("posts")
      .select("id, user_id, content, scheduled_for")
      .lte("scheduled_for", nowISO)
      .eq("status", "pending");

    if (error) {
      console.error("Error fetching pending posts:", error);
      return NextResponse.json({ error: "error_fetching_posts" }, { status: 500 });
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({ message: "no_pending_posts" });
    }

    const results: any[] = [];

    for (const post of posts) {
      const postId = post.id;
      const userId = post.user_id;

      const { data: profile, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("created_at, subscription_status")
        .eq("id", userId)
        .single();

      if (pErr || !profile) {
        await supabaseAdmin
          .from("posts")
          .update({ status: "failed", error_message: "user_profile_missing" })
          .eq("id", postId);

        results.push({ postId, status: "failed", reason: "user_profile_missing" });
        continue;
      }

      const createdAt = new Date(profile.created_at);
      const subscriptionStatus = profile.subscription_status;
      const expiresAt = new Date(createdAt.getTime() + 72 * 3600 * 1000);
      const now = new Date();
      const isExpired = now > expiresAt && subscriptionStatus !== "premium";

      if (isExpired) {
        const msg = "trial_expired: please upgrade to publish queued posts";
        await supabaseAdmin
          .from("posts")
          .update({ status: "failed", error_message: msg })
          .eq("id", postId);

        results.push({ postId, status: "failed", reason: "trial_expired" });
        continue;
      }

      try {
        const publishResp = await postToAyrshare(post.content);

        await supabaseAdmin
          .from("posts")
          .update({ status: "published", error_message: null })
          .eq("id", postId);

        results.push({ postId, status: "published", remote: publishResp });
      } catch (publishError: any) {
        const errStr = publishError?.message ?? String(publishError);
        await supabaseAdmin
          .from("posts")
          .update({ status: "failed", error_message: errStr })
          .eq("id", postId);

        results.push({ postId, status: "failed", reason: errStr });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error("cron publish error:", err);
    return NextResponse.json({ error: "unexpected_error", detail: String(err) }, { status: 500 });
  }
}
