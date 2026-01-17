#!/usr/bin/env bash
set -euo pipefail

python - <<'PY'
from pathlib import Path
import sys

html_path = Path("index.html")
if not html_path.exists():
    print("index.html not found")
    sys.exit(1)

html = html_path.read_text(encoding="utf-8")
required_markers = [
    'id="year"',
    'id="gallery"',
    'href="styles.css"',
]
missing = [marker for marker in required_markers if marker not in html]
if missing:
    print("Missing required markers:", ", ".join(missing))
    sys.exit(1)

print("Smoke test passed.")
PY
