"""Bundle the 3D hero (src/hero/bean.js + three.js) into one local script.

Run from portfolio/: python -B tools/build_hero.py
Writes site/assets/bean-hero.js. script.js loads it once the page has loaded and the
hero is near the viewport; without JavaScript or WebGL the CSS reliability loop in
index.html stays in place.
"""

from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "site" / "assets" / "bean-hero.js"

subprocess.run(
    ["npx", "esbuild", "src/hero/bean.js", "--bundle", "--minify", "--format=iife", "--target=es2020",
     "--legal-comments=none", "--log-level=warning", f"--outfile={OUTPUT.relative_to(ROOT).as_posix()}"],
    cwd=ROOT, check=True, shell=True,
)
print(f"Built {OUTPUT.name}: {OUTPUT.stat().st_size:,} bytes")
