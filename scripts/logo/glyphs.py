"""Converts text set in an installed font into one SVG path, so a logo needs no font at display time."""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONTS = "/usr/share/fonts/opentype/inter/"
_cache = {}


def font(name):
    if name not in _cache:
        _cache[name] = TTFont(FONTS + name)
    return _cache[name]


def text_path(text, fontname, size, x, y, tracking=0.0):
    """Returns (path d, advance width) for text whose baseline starts at (x, y); tracking is in em."""
    f = font(fontname)
    upm = f["head"].unitsPerEm
    scale = size / upm
    cmap = f.getBestCmap()
    gs = f.getGlyphSet()
    hmtx = f["hmtx"]
    pen = SVGPathPen(gs)
    cursor = 0.0
    for ch in text:
        gname = cmap.get(ord(ch))
        if gname is None:
            continue
        tpen = TransformPen(pen, (scale, 0, 0, -scale, x + cursor, y))
        gs[gname].draw(tpen)
        cursor += hmtx[gname][0] * scale + tracking * size
    width = cursor - tracking * size
    return pen.getCommands(), width
