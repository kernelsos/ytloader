import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import os from "os";
import { rateLimit } from "../../../../lib/rateLimiter";


// ── Config ────────────────────────────────────────────────────────────────────
const DOWNLOAD_FOLDER    = path.join(os.homedir(), "Downloads");
const TIMEOUT_MS         = 5 * 60 * 1000;  
const MAX_CONCURRENT     = 2;               

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
      { error: `Too many requests. Please wait ${retryAfterSeconds} seconds before trying again.` },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  // ── 3. Concurrency check ──────────────────────────────────────────────────
  if (activeDownloads >= MAX_CONCURRENT) {
    return NextResponse.json(
      { error: "Server is busy with other downloads. Please try again in a moment." },
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

  // ── 5. Spawn Python script ────────────────────────────────────────────────
  const scriptPath = path.join(process.cwd(), "..","backend", "main.py");
  activeDownloads++;

  return new Promise<NextResponse>((resolve) => {
    const proc = spawn("python", [
      scriptPath,
      "--url",     url,
      "--quality", safeQuality,
      "--folder",  DOWNLOAD_FOLDER,
    ]);

    let stderr = "";
    proc.stdout.on("data", () => {});   // drain stdout so buffer doesn't block
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    // Fix 1: Kill process if it exceeds the timeout
    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
    }, TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timer);
      activeDownloads = Math.max(0, activeDownloads - 1);
    };

    proc.on("close", (code) => {
      cleanup();
      if (code === 0) {
        resolve(
          NextResponse.json(
            { message: "Download completed successfully!", remainingRequests: remaining },
            { headers: { "X-RateLimit-Remaining": String(remaining) } }
          )
        );
      } else if (code === null) {
        resolve(
          NextResponse.json(
            { error: "Download timed out after 5 minutes. Try a shorter video or lower quality." },
            { status: 504 }
          )
        );
      } else {
        console.error("[yt-downloader] stderr:", stderr.trim());
        resolve(
          NextResponse.json(
            { error: "Download failed. The video may be unavailable or restricted." },
            { status: 500 }
          )
        );
      }
    });

    proc.on("error", () => {
      cleanup();
      resolve(
        NextResponse.json(
          { error: "Could not start Python. Make sure Python is installed and accessible." },
          { status: 500 }
        )
      );
    });
  });
}