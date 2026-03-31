import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "../../../../lib/rateLimiter";

const RENDER_BACKEND_URL = process.env.RENDER_BACKEND_URL; // Set this on Vercel

const MAX_CONCURRENT = 2;
let activeDownloads = 0;

export async function POST(req: NextRequest) {
  // ── 1. Get client IP ──────────────────────────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",").at(0)?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  // ── 2. Rate limit check ───────────────────────────────────────────────────
  const { allowed, remaining, retryAfterSeconds } = rateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many requests. Please wait ${retryAfterSeconds} seconds.` },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  // ── 3. Concurrency check ──────────────────────────────────────────────────
  if (activeDownloads >= MAX_CONCURRENT) {
    return NextResponse.json(
      { error: "Server is busy. Please try again in a moment." },
      { status: 503 }
    );
  }

  // ── 4. Validate body ──────────────────────────────────────────────────────
  const { url, quality } = await req.json();

  if (!url) {
    return NextResponse.json({ error: "URL is required." }, { status: 400 });
  }

  const isValidYouTubeUrl =
    /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/.test(url);

  if (!isValidYouTubeUrl) {
    return NextResponse.json(
      { error: "Invalid YouTube URL. Only youtube.com and youtu.be links are accepted." },
      { status: 400 }
    );
  }

  const ALLOWED_QUALITIES = ["best", "worst", "1080p", "720p", "480p", "360p", "audio_only"];
  const safeQuality = ALLOWED_QUALITIES.includes(quality) ? quality : "720p";

  // ── 5. Call Render backend & proxy the file back ──────────────────────────
  activeDownloads++;

  try {
    const backendRes = await fetch(`${RENDER_BACKEND_URL}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, quality: safeQuality }),
    });

    if (!backendRes.ok) {
      const err = await backendRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.detail ?? "Download failed on the backend." },
        { status: backendRes.status }
      );
    }

    // Extract filename from Content-Disposition header
    const disposition = backendRes.headers.get("content-disposition") ?? "";
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    const filename = match?.[1]?.replace(/['"]/g, "") ?? "video.mp4";

    const fileBuffer = await backendRes.arrayBuffer();

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": backendRes.headers.get("content-type") ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-RateLimit-Remaining": String(remaining),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the download server. Please try again later." },
      { status: 502 }
    );
  } finally {
    activeDownloads = Math.max(0, activeDownloads - 1);
  }
}