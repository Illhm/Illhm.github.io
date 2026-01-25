import os
import requests
import json
import re
import sys
from bs4 import BeautifulSoup

DATA_FILE = 'data/url.txt'
MUSIC_DIR = 'music'
COVERS_DIR = os.path.join(MUSIC_DIR, 'covers')
LIBRARY_FILE = os.path.join(MUSIC_DIR, 'library.json')
API_ENDPOINT = 'https://spotdl.zeabur.app/'

def ensure_directories():
    if not os.path.exists(MUSIC_DIR):
        os.makedirs(MUSIC_DIR)
    if not os.path.exists(COVERS_DIR):
        os.makedirs(COVERS_DIR)

def read_urls():
    if not os.path.exists(DATA_FILE):
        print(f"File not found: {DATA_FILE}")
        return []
    with open(DATA_FILE, 'r') as f:
        lines = f.readlines()
    urls = [line.strip() for line in lines if line.strip() and not line.strip().startswith('#')]
    # Return unique URLs while preserving order
    seen = set()
    return [x for x in urls if not (x in seen or seen.add(x))]

def get_track_id(url):
    # Support spotify:track:ID and https://open.spotify.com/track/ID
    match = re.search(r'(?:spotify:track:|track\/)([a-zA-Z0-9]+)', url)
    if match:
        return match.group(1)
    return None

def download_file(url, filepath):
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        return True
    except Exception as e:
        print(f"Error downloading {url}: {e}")
        return False

def process_track(url):
    track_id = get_track_id(url)
    if not track_id:
        print(f"Invalid URL: {url}")
        return None

    mp3_path = os.path.join(MUSIC_DIR, f"{track_id}.mp3")
    cover_path = os.path.join(COVERS_DIR, f"{track_id}.jpg")

    print(f"Processing {track_id}...")

    try:
        api_url = f"{API_ENDPOINT}?url={requests.utils.quote(url)}"
        response = requests.get(api_url)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        # Extract Title
        title_tag = soup.find('h2')
        title = title_tag.text.strip() if title_tag else "Unknown Title"

        # Extract Artist
        p_tag = soup.find('p')
        artist = p_tag.text.strip() if p_tag else "Unknown Artist"

        # Extract Audio URL
        source = soup.find('source')
        audio_url = source['src'] if source else None

        # Extract Cover URL
        cover_url = None
        style_tags = soup.find_all('style')
        for style in style_tags:
            if style.string:
                # Match url('...'), url("..."), or url(...)
                match = re.search(r"\.album-art\s*{[^}]*background-image:\s*url\(['\"]?([^'\")]+)['\"]?\)", style.string)
                if match:
                    cover_url = match.group(1)
                    break

        if not cover_url:
            for style in style_tags:
                if style.string:
                     match = re.search(r"\.bg-image\s*{[^}]*background-image:\s*url\(['\"]?([^'\")]+)['\"]?\)", style.string)
                     if match:
                        cover_url = match.group(1)
                        break

        if not audio_url:
            print(f"Could not find audio URL for {track_id}")
            return None

        # Download Audio
        if not os.path.exists(mp3_path):
            print(f"Downloading audio for {title}...")
            if not download_file(audio_url, mp3_path):
                print("Failed to download audio")
                return None
        else:
            print(f"Audio already exists for {title}")

        # Download Cover
        if cover_url and not os.path.exists(cover_path):
            print(f"Downloading cover for {title}...")
            download_file(cover_url, cover_path)
        elif cover_url:
             print(f"Cover already exists for {title}")

        return {
            "id": track_id,
            "url": url,
            "title": title,
            "artist": artist,
            "audio_path": mp3_path,
            "cover_path": cover_path
        }

    except Exception as e:
        print(f"Error processing {url}: {e}")
        return None

def main():
    ensure_directories()
    urls = read_urls()
    library = []

    print(f"Found {len(urls)} URLs.")

    for url in urls:
        track_data = process_track(url)
        if track_data:
            library.append(track_data)
        else:
            print(f"Failed to process {url}")

    with open(LIBRARY_FILE, 'w') as f:
        json.dump(library, f, indent=2)

    print(f"Library updated with {len(library)} tracks.")

if __name__ == "__main__":
    main()
