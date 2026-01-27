import json
import os
from pathlib import Path

# Configuration
GALLERY_DIR = Path('gallery')
OUTPUT_FILE = Path('gallery.json')
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}

def main():
    if not GALLERY_DIR.exists():
        print(f"Gallery directory {GALLERY_DIR} not found.")
        return

    images = []
    # Sort files for consistent order
    for filepath in sorted(GALLERY_DIR.iterdir()):
        if filepath.is_file() and filepath.suffix.lower() in IMAGE_EXTENSIONS:
            images.append({
                "name": filepath.name,
                "path": str(filepath).replace(os.sep, '/')
            })

    try:
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(images, f, indent=2)
        print(f"Successfully generated {OUTPUT_FILE} with {len(images)} images.")
    except Exception as e:
        print(f"Error writing to {OUTPUT_FILE}: {e}")

if __name__ == "__main__":
    main()
