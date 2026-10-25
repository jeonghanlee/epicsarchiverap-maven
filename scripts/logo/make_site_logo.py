"""Generates the default site logo of the page header: a filled jar with a labelled wave and its lid ajar, beside
the words "store signals" and "analyze in place". 44 px high; text set as outlines of Inter Display (SIL OFL 1.1),
so no font is needed where the file is shown. A site replaces it through the site_logo block of its template.
Requires fontTools and the Inter Display OTF files (Debian package fonts-inter).

Usage: python3 make_site_logo.py [output folder]; the default folder is the static content img folder."""
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from glyphs import text_path  # noqa: E402

DEFAULT_OUT = os.path.join(HERE, "..", "..", "src", "main", "org", "epics", "archiverappliance", "staticcontent", "img")
H = 44
WHITE, TEAL, BRAND, SOFT = "#ffffff", "#007681", "#00313c", "#d9eef0"
LINE = 'stroke="#ffffff" fill="none" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round"'


def tidy(d):
    return re.sub(r"-?\d+\.\d+", lambda m: ("%.1f" % float(m.group())).rstrip("0").rstrip("."), d)


def jar():
    """The lid ajar on its left hinge, the content filled to a wave, the jar outline and a label with a wave."""
    return (
        f'<g transform="translate(13 11) rotate(-20)"><rect x="-1" y="-4.5" width="20" height="4.5" rx="1.5" {LINE}/></g>'
        f'<path d="M11.2 22 C14.5 18.5, 18.5 18.5, 22 22 S29 25.5, 32.8 22 V35 C32.8 37.5, 30.5 39.2, 28.5 39.2 '
        f'H15.5 C13.5 39.2, 11.2 37.5, 11.2 35 Z" fill="{TEAL}"/>'
        f'<path d="M14 11 V14 C8 17, 8 37, 14 40 H30 C36 37, 36 17, 30 14 V11" {LINE}/>'
        f'<rect x="16" y="27" width="12" height="8" rx="1.5" fill="{BRAND}" stroke="{WHITE}" stroke-width="1.5"/>'
        f'<path d="M17.6 31 C18.6 29, 19.8 29, 20.8 31 S23 33, 24 31 S25.8 29, 26.4 30" stroke="{WHITE}" fill="none" '
        f'stroke-width="1.2" stroke-linecap="round"/>'
    )


def words(x):
    """Two lines of text; returns (svg, right edge)."""
    d1, w1 = text_path("store signals", "InterDisplay-SemiBold.otf", 13.5, x, 19)
    d2, w2 = text_path("analyze in place", "InterDisplay-Regular.otf", 13.5, x, 35)
    return f'<path d="{tidy(d1)}" fill="{WHITE}"/><path d="{tidy(d2)}" fill="{SOFT}"/>', x + max(w1, w2)


def site_logo():
    text, end = words(46)
    w = math.ceil(end + 2)
    title = "Archiver Appliance: store signals, analyze in place"
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {H}" width="{w}" height="{H}" role="img" '
            f'aria-label="{title}"><title>{title}</title>'
            f'<!-- Text: outlines of Inter Display (SIL OFL 1.1). -->{jar()}{text}</svg>\n')


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUT
    text = site_logo()
    with open(os.path.join(out, "sitelogo.svg"), "w") as f:
        f.write(text)
    print("sitelogo.svg", len(text), "bytes")
