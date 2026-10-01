"""Build the reviewed, public one-page resume using only stdlib and ReportLab.

Run: python portfolio/tools/build_resume.py
Copy reviewed against master/career-data.yaml and AGENTS.md. This intentionally
uses a public-copy allowlist, not a YAML export; private source fields never enter
the document. Re-review claims against the master before changing this copy.
"""

from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph


OUTPUT = (
    Path(__file__).resolve().parents[1]
    / "site" / "assets" / "dushyant-chetiwal-resume.pdf"
)
EMAIL = "dushyantchetiwal24@gmail.com"
GITHUB = "https://github.com/DushyantChetiwal"
LINKEDIN = "https://www.linkedin.com/in/dushyantchetiwal/"
PARAMETER_GOLF = (
    "https://github.com/DushyantChetiwal/parameter-golf/tree/"
    "submission/annealed-muon-1.58bit-8kv"
)
GREEN = "#1e3832"
INK = "#222b28"
MUTED = "#4c5954"
PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN = 40
WIDTH = PAGE_WIDTH - 2 * MARGIN


class Resume:
    """Single-column layout that fails before publishing an overflowing page."""

    def __init__(self):
        self.buffer = BytesIO()
        self.canvas = Canvas(
            self.buffer, pagesize=A4, invariant=1, pageCompression=1,
            initialFontName="Helvetica", initialFontSize=10.5,
        )
        self.canvas.setTitle("Dushyant Chetiwal | LLM & Python Engineer")
        self.canvas.setAuthor("Dushyant Chetiwal")
        self.canvas.setSubject("LLM evaluation, Python engineering and data platforms")
        self.canvas.setCreator("ReportLab public resume generator")
        self.y = PAGE_HEIGHT - MARGIN

    def paragraph(self, text, size=10.5, leading=14, color=INK,
                  bold=False, after=0, bullet=False):
        style = ParagraphStyle(
            "resume", fontName="Helvetica-Bold" if bold else "Helvetica",
            fontSize=size, leading=leading, textColor=HexColor(color),
            alignment=TA_LEFT, leftIndent=11 if bullet else 0,
            firstLineIndent=0, bulletIndent=0, bulletFontName="Helvetica",
            bulletFontSize=size, splitLongWords=False,
        )
        paragraph = Paragraph(text, style, bulletText="\u2022" if bullet else None)
        _, height = paragraph.wrap(WIDTH, PAGE_HEIGHT)
        if self.y - height < MARGIN:
            raise ValueError("Resume exceeds one page; edit copy rather than shrinking type.")
        paragraph.drawOn(self.canvas, MARGIN, self.y - height)
        self.y -= height + after

    def section(self, title):
        self.y -= 10
        self.paragraph(title.upper(), size=10, leading=13, color=GREEN,
                       bold=True, after=5)

    def role(self, employer, title, dates):
        self.paragraph(escape(employer), size=11.5, leading=15,
                       color=GREEN, bold=True)
        self.canvas.setFillColor(HexColor(MUTED))
        self.canvas.setFont("Helvetica", 9.5)
        self.canvas.drawRightString(PAGE_WIDTH - MARGIN, self.y + 3, dates)
        self.paragraph(escape(title), size=10.5, leading=14, bold=True, after=4)

    def bullet(self, text):
        self.paragraph(text, bullet=True, after=4)

    def finish(self):
        self.canvas.showPage()
        self.canvas.save()
        return self.buffer.getvalue()


def link(url, label):
    return f'<link href="{escape(url, {chr(34): "&quot;"})}" color="{GREEN}">{escape(label)}</link>'


def build_resume():
    resume = Resume()
    resume.paragraph("Dushyant Chetiwal", size=24, leading=29,
                     color=GREEN, bold=True, after=2)
    resume.paragraph("LLM &amp; Python Engineer", size=13, leading=17,
                     color=GREEN, after=6)
    resume.paragraph(link(f"mailto:{EMAIL}", EMAIL), size=10, leading=14)
    resume.paragraph(
        link(GITHUB, "GitHub: DushyantChetiwal") + " &nbsp; | &nbsp; "
        + link(LINKEDIN, "LinkedIn: dushyantchetiwal"),
        size=10, leading=14, after=2,
    )

    resume.section("Experience")
    resume.role("Turing", "LLM Python Engineer & Team Lead", "Sep 2024 – Present")
    # turing-qc-framework + turing-evals-pipeline; no unconfirmed numeric scale.
    resume.bullet(
        "Enabled reproducible LLM evaluation by leading a cross-functional team on "
        "RL Gym quality control and building a Dockerized Python evaluation pipeline. "
        "RL Gym combines simulated services and curated tasks through Model Context Protocol (MCP)."
    )
    # turing-benchmark-mutation
    resume.bullet(
        "Broadened LLM evaluation coverage with <b>15+ runtime input and interaction mutations</b> "
        "in a <b>benchmark-agnostic framework</b> with benchmark-specific adapters."
    )
    # turing-world-state-generator
    resume.bullet(
        "Made multi-service evaluation environments reproducible and auditable with a "
        "<b>deterministic world-state generator</b>, using declarative specifications, "
        "typed validation and full data lineage."
    )
    # turing-ai-bug-analyzer; relative, approximate, same ground-truth set.
    resume.bullet(
        "Reduced false positives by <b>approximately 32% relative to the non-RAG baseline "
        "on 500 ground-truth cases</b> with a local hybrid-RAG bug analyzer using "
        "FTS5, FAISS, BGE embeddings and reranking."
    )

    resume.y -= 4
    resume.role("Paytm", "Senior Data Engineer", "Mar 2022 – Sep 2024")
    # paytm-zstd
    resume.bullet(
        "Cut S3 data size by <b>37%</b> and saved <b>about $11,800/month</b> "
        "by integrating Zstandard compression into data storage."
    )
    # paytm-sharded-ingestion
    resume.bullet(
        "Saved <b>$2,100/month</b> by replacing Debezium with a custom "
        "sharded-database ingestion framework for Amazon S3."
    )
    # paytm-auto-repartitioning and paytm-long-running-spark are distinct work.
    resume.bullet(
        "Reduced Spark runtime by <b>72%</b> with <b>44% fewer resources</b> "
        "through automatic partition tuning."
    )
    resume.bullet(
        "Cut a separate Spark flow from <b>12 hours to under 30 minutes</b> "
        "through processing-flow optimization."
    )
    resume.paragraph("<b>Paytm awards:</b> Rising Star (2022) · Technology Star (2023)",
                     size=10, leading=14, after=6)

    resume.role("Clarivate Analytics", "Associate Software Engineer", "Jul 2021 – Mar 2022")
    # clarivate-catalog-products
    resume.bullet(
        "Delivered copyright and trademark cataloging functionality through Java "
        "backend services and customer-facing JavaScript interfaces and APIs."
    )

    resume.section("Selected project")
    resume.paragraph(
        "<b>OpenAI Parameter Golf Challenge</b> · "
        + link(PARAMETER_GOLF, "Public submission branch"),
        leading=14, after=4,
    )
    # parameter-golf; explicitly a non-record entry, not a competition win.
    resume.bullet(
        "Achieved <b>1.22 BPB (bits per byte) on FineWeb validation</b> in a "
        "non-record submission using 1.58-bit quantization and base-3 weight packing, "
        "under a <b>16 MB artifact and 10-minute training limit on 8 H100 GPUs</b>."
    )

    resume.section("Education")
    resume.paragraph(
        "<b>Indian Institute of Technology Goa</b> · 2017–2021<br/>"
        "Bachelor of Technology in Computer Science", leading=14,
    )

    resume.section("Core skills")
    resume.paragraph(
        "<b>AI &amp; backend:</b> Python, LLM evaluation, MCP, RAG, LangGraph, PyTorch, FastAPI<br/>"
        "<b>Data &amp; infrastructure:</b> SQL, Spark, Kafka, Flink, Amazon S3, Docker, GitHub Actions",
        size=10, leading=14,
    )
    return resume.finish()


def main():
    pdf = build_resume()
    # Render in memory first so a layout failure leaves the existing PDF intact.
    OUTPUT.write_bytes(pdf)
    print(f"Built {OUTPUT.name}: 1 A4 page, {len(pdf):,} bytes")


if __name__ == "__main__":
    main()
