import os
import re
import json
import subprocess
from mutagen.mp3 import MP3
from mutagen.id3 import ID3, APIC

MUSIC_DIR = "music"
URL_FILE = "data/url.txt"
LIBRARY_FILE = os.path.join(MUSIC_DIR, "library.json")

def get_track_id(url):
    match = re.search(r"(?:spotify:track:|track\/)([a-zA-Z0-9]+)", url)
    return match.group(1) if match else None

def main():
    if not os.path.exists(MUSIC_DIR):
        os.makedirs(MUSIC_DIR)

    try:
        with open(URL_FILE, "r") as f:
            urls = [line.strip() for line in f if line.strip() and not line.startswith("#")]
    except FileNotFoundError:
        print(f"File {URL_FILE} not found.")
        return

    library = []

    for url in urls:
        track_id = get_track_id(url)
        if not track_id:
            print(f"Skipping invalid URL: {url}")
            continue

        output_file = os.path.join(MUSIC_DIR, f"{track_id}.mp3")

        # Download if missing
        if not os.path.exists(output_file):
            print(f"Downloading {url}...")
            # spotdl download [url] --output music/{track-id} --format mp3
            cmd = [
                "spotdl", "download", url,
                "--output", f"{MUSIC_DIR}/{{track-id}}",
                "--format", "mp3"
            ]
            try:
                subprocess.run(cmd, check=True)
            except subprocess.CalledProcessError as e:
                print(f"Failed to download {url}: {e}")
                continue
        else:
            print(f"Skipping {url} (already exists)")

        # Check if file exists now
        if not os.path.exists(output_file):
            print(f"File {output_file} not found after download attempt.")
            continue

        # Extract Metadata
        try:
            audio = MP3(output_file, ID3=ID3)

            # TIT2 is Title, TPE1 is Artist
            title = str(audio.tags.get("TIT2", "Unknown Title"))
            artist = str(audio.tags.get("TPE1", "Unknown Artist"))

            # Extract Cover
            cover_filename = f"{track_id}.jpg"
            cover_path = os.path.join(MUSIC_DIR, cover_filename)
            has_cover = False

            # Check if cover already extracted
            if os.path.exists(cover_path):
                has_cover = True
            else:
                # Extract APIC frame
                if audio.tags:
                    for tag in audio.tags.values():
                        if isinstance(tag, APIC):
                            with open(cover_path, "wb") as img:
                                img.write(tag.data)
                            has_cover = True
                            break

            library.append({
                "id": track_id,
                "title": title,
                "artist": artist,
                "url": url,
                "audioPath": f"{MUSIC_DIR}/{track_id}.mp3",
                "coverPath": f"{MUSIC_DIR}/{cover_filename}" if has_cover else None
            })

        except Exception as e:
            print(f"Error processing metadata for {output_file}: {e}")
            # Still add to library with minimal info if file exists?
            # Maybe safer to skip or use placeholders.
            library.append({
                "id": track_id,
                "title": "Unknown Title",
                "artist": "Unknown Artist",
                "url": url,
                "audioPath": f"{MUSIC_DIR}/{track_id}.mp3",
                "coverPath": None
            })

    with open(LIBRARY_FILE, "w") as f:
        json.dump(library, f, indent=2)
    print(f"Library updated with {len(library)} tracks.")

if __name__ == "__main__":
    main()
