import sys
import yt_dlp
import os
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DOWNLOAD_FOLDER = "/tmp/downloads"

class DownloadRequest(BaseModel):
    url: str
    quality: str = "720p"

quality_map = {
    "best":       "bestvideo+bestaudio/best",
    "worst":      "worstvideo+worstaudio/worst",
    "1080p":      "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]",
    "720p":       "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]",
    "480p":       "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]",
    "360p":       "bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360]",
    "audio_only": "bestaudio/best",
}

@app.get("/")
def health_check():
    return {"status": "ok"}

@app.post("/download")
def download_video(req: DownloadRequest):
    session_folder = os.path.join(DOWNLOAD_FOLDER, str(uuid.uuid4()))
    os.makedirs(session_folder, exist_ok=True)

    selected_format = quality_map.get(req.quality, quality_map["720p"])

    ydl_opts = {
        "format": selected_format,
        "outtmpl": os.path.join(session_folder, "%(title)s.%(ext)s"),
        "merge_output_format": "mp4",
        "noplaylist": True,
        "abort_on_error": False,
        "postprocessors": (
            [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }]
            if req.quality == "audio_only"
            else []
        ),
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(req.url, download=True)
            filename = ydl.prepare_filename(info)
            if req.quality == "audio_only":
                filename = os.path.splitext(filename)[0] + ".mp3"
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not os.path.exists(filename):
        raise HTTPException(status_code=404, detail="File not found after download")

    return FileResponse(
        path=filename,
        filename=os.path.basename(filename),
        media_type="application/octet-stream"
    )
