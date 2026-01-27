import os
import sys
import json
import re
import time
import requests
from bs4 import BeautifulSoup
from pathlib import Path
from urllib.parse import urlparse

# Configuration
DATA_FILE = Path('data/url.txt')
MUSIC_DIR = Path('music')
COVERS_DIR = MUSIC_DIR / 'covers'
LIBRARY_FILE = MUSIC_DIR / 'library.json'
SPOTDL_API = "https://spotdl.zeabur.app/"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

def ensure_dirs():
    MUSIC_DIR.mkdir(parents=True, exist_ok=True)
    COVERS_DIR.mkdir(parents=True, exist_ok=True)

def parse_spotify_url(url):
    if 'spotify:track:' in url:
        return url.split(':')[-1]
    parsed = urlparse(url)
    path_segments = parsed.path.split('/')
    if 'track' in path_segments:
        return path_segments[path_segments.index('track') + 1]
    return None

def download_file(url, filepath):
    try:
        response = requests.get(url, stream=True, timeout=60, headers=HEADERS)
        response.raise_for_status()
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        return True
    except Exception as e:
        print(f"Error downloading {url} to {filepath}: {e}")
        return False

def fetch_metadata(spotify_url):
    try:
        api_url = f"{SPOTDL_API}?url={spotify_url}"
        response = requests.get(api_url, timeout=30, headers=HEADERS)
        if response.status_code != 200:
            print(f"API Error {response.status_code} for {spotify_url}")
            return None

        soup = BeautifulSoup(response.text, 'html.parser')

        if soup.title and soup.title.string:
            page_title = soup.title.string
        else:
            page_title = ""

        if ' - ' in page_title:
            title, artist = page_title.split(' - ', 1)
        else:
            title = page_title if page_title else "Unknown Title"
            artist = "Unknown Artist"

        source = soup.find('source')
        audio_url = source['src'] if source else None

        cover_match = re.search(r'https://i\.scdn\.co/image/[a-zA-Z0-9]+', response.text)
        cover_url = cover_match.group(0) if cover_match else None

        if not audio_url:
            print(f"No audio source found for {spotify_url}")
            return None

        return {
            'title': title.strip(),
            'artist': artist.strip(),
            'audio_url': audio_url,
            'cover_url': cover_url
        }
    except Exception as e:
        print(f"Error scraping metadata for {spotify_url}: {e}")
        return None

def load_existing_library():
    if LIBRARY_FILE.exists():
        try:
            with open(LIBRARY_FILE, 'r') as f:
                return {item['id']: item for item in json.load(f)}
        except Exception as e:
            print(f"Error loading existing library: {e}")
    return {}

def main():
    ensure_dirs()

    if not DATA_FILE.exists():
        print(f"Data file {DATA_FILE} not found.")
        return

    with open(DATA_FILE, 'r') as f:
        urls = [line.strip() for line in f if line.strip() and not line.startswith('#')]

    existing_library = load_existing_library()
    new_library = []

    for url in urls:
        track_id = parse_spotify_url(url)
        if not track_id:
            print(f"Invalid Spotify URL: {url}")
            continue

        print(f"Processing {track_id}...")

        audio_filename = f"{track_id}.mp3"
        cover_filename = f"{track_id}.jpg"
        local_audio_path = MUSIC_DIR / audio_filename
        local_cover_path = COVERS_DIR / cover_filename

        entry = {
            'id': track_id,
            'spotify_url': url,
            'title': '',
            'artist': '',
            'audio_path': f"music/{audio_filename}",
            'cover_path': f"music/covers/{cover_filename}",
            'downloaded': False
        }

        audio_exists = local_audio_path.exists() and local_audio_path.stat().st_size > 0
        cover_exists = local_cover_path.exists() and local_cover_path.stat().st_size > 0

        # Reuse existing metadata if files exist and metadata is available
        cached_entry = existing_library.get(track_id)

        if audio_exists and cover_exists and cached_entry and cached_entry.get('title'):
             print("  Files and metadata exist. Skipping download.")
             entry.update(cached_entry)
             entry['downloaded'] = True
        else:
            print("  Fetching metadata...")
            meta = fetch_metadata(url)
            if meta:
                entry['title'] = meta['title']
                entry['artist'] = meta['artist']

                if not audio_exists:
                    print(f"  Downloading audio...")
                    if download_file(meta['audio_url'], local_audio_path):
                        entry['downloaded'] = True
                    else:
                        print("  Audio download failed.")
                else:
                    entry['downloaded'] = True

                if not cover_exists and meta['cover_url']:
                    print(f"  Downloading cover...")
                    download_file(meta['cover_url'], local_cover_path)
            else:
                print("  Failed to fetch metadata.")
                # If we have cached metadata but files were missing, we might have lost the metadata if fetch failed
                # But if fetch failed, maybe we should keep old metadata if available?
                if cached_entry:
                    entry.update(cached_entry)

        new_library.append(entry)
        # Sleep to be polite
        time.sleep(1)

    with open(LIBRARY_FILE, 'w') as f:
        json.dump(new_library, f, indent=2)
    print(f"Library updated with {len(new_library)} tracks.")

if __name__ == "__main__":
    main()
