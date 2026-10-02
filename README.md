# Dushyant Chetiwal

**Reliable AI. Measurable impact.**

Personal portfolio for my work in Python engineering, agent evaluation and data
platforms, with selected work from Turing, Paytm and independent projects.

Website: **https://dushyantchetiwal.github.io/**

## Design

A lightweight, responsive static site. Black accents, neutral grays, clean system
sans-serif typography, and case studies that explain the problem, contribution
and measured result. Headings use upright semibold text, without decorative italics.

- Native, keyboard-accessible case-study disclosures.
- Public one-page résumé with selectable text and working links.
- No trackers, external fonts, runtime frameworks or third-party asset requests.
- Essential content and navigation work without JavaScript.
- Reduced-motion support and a print stylesheet.

## Structure

```text
site/                    # the entire public website
  index.html
  styles.css
  script.js
  assets/                # résumé, favicon and social-preview card
.github/workflows/       # GitHub Pages deployment
checks and tooling:
  tools/check_site.py     # standard-library validation of the public artifact
  tools/build_resume.py  # reviewed résumé generation (ReportLab)
  tools/build_social_preview.py  # share card generation (Pillow, local fonts)
tests/                   # Playwright browser tests, not served
```

Only `site/` is uploaded to GitHub Pages. Keep this repository separate from
private career records, credentials, application files and personal databases.
The public file allowlist in `tools/check_site.py` must be reviewed when adding an
asset; arbitrary files and directories fail validation.

## Local preview

Open `site/index.html` directly, or run:

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory site
```

Visit `http://127.0.0.1:8000/`. Stop the server with Ctrl+C.

## Validation

```sh
python tools/check_site.py
npm ci
npm test
```

The static checks require Python 3.10+ and no packages. Browser tests use Playwright
with installed Microsoft Edge, check five viewport sizes (320–1440px), exercise
keyboard and clipboard behavior, and test the no-JavaScript and reduced-motion
experiences. Screenshots are written under ignored `test-results/`.

Résumé and social-preview generation are development-only steps. Their generated
assets are checked in; the deployment does not install Python packages or npm
dependencies. The social-preview generator uses locally installed Windows fonts.

## Publishing

The repository root is this directory, **not an enclosing workspace**. Enable
**Settings → Pages → Build and deployment → GitHub Actions**. Pushes to `main`
and manual workflow dispatch validate and deploy only the `site/` artifact.
The existing `master` branch preserves the earlier map/X-ray project and its
history. The portfolio is maintained on `main`; legacy root-level files are not
included in its Pages artifact.

Use the personal `DushyantChetiwal` account for this repository. Do not upload
private source material or credentials. Changes to contact details, employment,
metrics and résumé copy should be reviewed before publishing. Keep approximate
results approximate, distinguish evaluation results from general claims, and
identify personal projects and non-record challenge submissions accurately.

The static validator is a regression guard, not a complete secret scanner or
factual review. Inspect new PDFs, images and rendered content before publication.
