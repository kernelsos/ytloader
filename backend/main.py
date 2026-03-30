import sys
import yt_dlp
import os
import argparse


sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def download_youtube_video(url: str, output_folder: str = ".", quality: str = "best"):
    """
    Download a YouTube video.

    Args:
        url           : YouTube video URL
        output_folder : Folder path where the video will be saved
        quality       : Video quality — options:
                          "best"       → best available quality (default)
                          "worst"      → smallest/lowest quality
                          "1080p"      → Full HD
                          "720p"       → HD
                          "480p"       → SD
                          "360p"       → Low
                          "audio_only" → MP3 audio only
    """

    
    os.makedirs(output_folder, exist_ok=True)

    
    quality_map = {
        "best":       "bestvideo+bestaudio/best",
        "worst":      "worstvideo+worstaudio/worst",
        "1080p":      "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[height<=1080]",
        "720p":       "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]",
        "480p":       "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]",
        "360p":       "bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best[height<=360]",
        "audio_only": "bestaudio/best",
    }

    selected_format = quality_map.get(quality, quality_map["best"])

    ydl_opts = {
        "format": selected_format,
        "outtmpl": os.path.join(output_folder, "%(title)s.%(ext)s"),
        "merge_output_format": "mp4",
        "noplaylist": True,
        "progress_hooks": [_progress_hook],
        "abort_on_error": False,
        "extractor_args": {
            "youtube": {
                "js_runtimes": ["nodejs"]   
            }
        },
        "postprocessors": (
            [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }]
            if quality == "audio_only"
            else []
        ),
    }

    print(f"\nDownloading: {url}")
    print(f"Save folder : {os.path.abspath(output_folder)}")
    print(f"Quality     : {quality}\n")

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    print("\nDownload complete!")


def _progress_hook(d: dict):
    if d["status"] == "downloading":
        percent = d.get("_percent_str", "N/A").strip()
        speed   = d.get("_speed_str",   "N/A").strip()
        eta     = d.get("_eta_str",     "N/A").strip()
        print(f"\r  {percent}  |  Speed: {speed}  |  ETA: {eta}   ", end="", flush=True)
    elif d["status"] == "finished":
        print(f"\n  Done: {d['filename']}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="YouTube Video Downloader")
    parser.add_argument("--url",     required=True,          help="YouTube video URL")
    parser.add_argument("--quality", default="720p",         help="Video quality (best/1080p/720p/480p/360p/worst/audio_only)")
    parser.add_argument("--folder",  default="./downloads",  help="Output folder path")
    args = parser.parse_args()

    download_youtube_video(
        url=args.url,
        output_folder=args.folder,
        quality=args.quality,
    )