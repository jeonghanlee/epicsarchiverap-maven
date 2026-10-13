"""Generates the Archiver Appliance header logo and its narrow form as self-contained SVG files.

Outputs, both 44 px high in the page header (viewBox height 64):
  archiverheader.svg  mark, wordmark, maven tag and the official EPICS logo: the header logo
  wordmark.svg        mark and wordmark only: the header logo below 360 px

Text is set as outlines of Inter Display (SIL OFL 1.1), so no font is needed where the files are shown.
Requires fontTools and the Inter Display OTF files (Debian package fonts-inter).

Usage: python3 make_header_logo.py [output folder]; the default folder is the static content img folder."""
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from glyphs import text_path  # noqa: E402

DEFAULT_OUT = os.path.join(HERE, "..", "..", "src", "main", "org", "epics", "archiverappliance", "staticcontent", "img")
H = 64
WHITE, BRIGHT, MID, DIM = "#ffffff", "#7fd1d6", "#3fa9b2", "#1f6f78"
EPICS_SVG = os.path.join(HERE, "epics-logo-green-rgb-v03.svg")


def tidy(d):
    return re.sub(r"-?\d+\.\d+", lambda m: ("%.1f" % float(m.group())).rstrip("0").rstrip("."), d)


def path(d, fill):
    return f'<path d="{tidy(d)}" fill="{fill}"/>'


def svg(width, title, body, comment=""):
    w = math.ceil(width)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {H}" width="{round(w * 44 / H)}" height="44" '
            f'role="img" aria-label="{title}"><title>{title}</title>{comment}{body}</svg>\n')


def mark():
    """One period of a sine sampled into six dots that grow and brighten toward now."""
    colors = [DIM, MID, MID, BRIGHT, BRIGHT, WHITE]
    dots = []
    for i in range(6):
        x = 7 + i * 10.4
        y = 32 - 16 * math.sin(i * (2 * math.pi / 5) * 0.9 + 0.3)
        dots.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{3.0 + i * 0.7:.1f}" fill="{colors[i]}"/>')
    return "".join(dots)


def wordmark():
    """'archiver' in white and 'appliance' in the bright accent; returns (svg, right edge)."""
    d1, w1 = text_path("archiver", "InterDisplay-Medium.otf", 31, 80, 42, tracking=-0.01)
    d2, w2 = text_path("appliance", "InterDisplay-Medium.otf", 31, 80 + w1 + 9, 42, tracking=-0.01)
    return path(d1, WHITE) + path(d2, BRIGHT), 80 + w1 + 9 + w2


def maven_tag(x):
    """A small outlined pill reading 'maven', centred on the lowercase letters; returns (svg, right edge)."""
    size, height, pad = 17, 24, 9
    top = 34 - height / 2
    d, w = text_path("maven", "InterDisplay-Medium.otf", size, x + pad, top + 17, tracking=0.02)
    pill = (f'<rect x="{x:.1f}" y="{top:.1f}" width="{w + 2 * pad:.1f}" height="{height}" rx="{height / 2}" '
            f'fill="none" stroke="{MID}" stroke-width="1.6"/>')
    return pill + path(d, BRIGHT), x + w + 2 * pad


def epics_logo(x):
    """The official EPICS logo with its paths unchanged; only the empty canvas is left out. The clear space of its
    safety_zone layer (302.721 units, about 0.8 of the artwork height) is kept to the left; returns (svg, right edge)."""
    src = open(EPICS_SVG).read()
    group = re.sub(r"\s+", " ", re.search(r'<g id="logo">(.*?)</g>', src, re.S).group(1)).strip()
    ax, ay, aw, ah = 302.721, 306.263, 1024.268 - 302.721, 683.702 - 306.263
    eh = 30
    ew = eh * aw / ah
    ex = x + 302.721 / ah * eh + 2
    return (f'<svg x="{ex:.1f}" y="{(H - eh) / 2:.1f}" width="{ew:.1f}" height="{eh}" viewBox="{ax} {ay} {aw:.3f} {ah:.3f}">'
            f'{group}</svg>'), ex + ew


def header():
    words, end = wordmark()
    tag, end = maven_tag(end + 10)
    logo, end = epics_logo(end)
    comment = ('<!-- Mark and wordmark: outlines of Inter Display (SIL OFL 1.1). EPICS logo: on-screen RGB v03 (green) from '
               'https://epics-controls.org/download/documents/EPICS_logo_on_screen_(RGB).zip, paths unchanged. -->')
    return svg(end + 2, "EPICS Archiver Appliance, Maven edition", mark() + words + tag + logo, comment)


def wordmark_only():
    words, end = wordmark()
    comment = '<!-- Mark and wordmark: outlines of Inter Display (SIL OFL 1.1). -->'
    return svg(end + 4, "Archiver Appliance", mark() + words, comment)


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUT
    for name, text in (("archiverheader.svg", header()), ("wordmark.svg", wordmark_only())):
        with open(os.path.join(out, name), "w") as f:
            f.write(text)
        print(name, len(text), "bytes")
