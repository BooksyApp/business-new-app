#!/usr/bin/env python3
"""Mechanically convert artifact frames (_ref/frames/BF*.html) into React TSX.

Frame = every outermost element carrying class `mz` (mobile 390) or `dz` (desktop 1440).
Output (all generated, never hand-edit; re-run to regenerate, idempotent):
  src/bz-static/<BFxx-NN>.tsx   one component per frame
  src/bz-static/Sprite.tsx      artifact SVG sprite (hidden inline <svg>)
  src/bz-static/index.ts        frame meta + React.lazy map
  public/bz-static-img/*        referenced images (jpg compressed <=120 KB via sips)
Usage: python3 _ref/tools/frames_to_tsx.py   (stdlib only; sips used for jpg shrink on macOS)
"""
import glob, json, os, re, shutil, subprocess, sys
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.abspath(os.path.join(HERE, "..", ".."))
FRAMES = os.path.join(WEB, "_ref", "frames")
OUT = os.path.join(WEB, "src", "bz-static")
IMG_OUT = os.path.join(WEB, "public", "bz-static-img")
ARTIFACT = os.environ.get("BIZ_ARTIFACT", os.path.abspath(os.path.join(WEB, "..", "..", "..", "artifacts", "business-final")))
ARTIFACT_HTML = os.path.join(ARTIFACT, "index.html")
IMG_SRC = os.path.join(ARTIFACT, "img")
MAX_IMG = 120 * 1024

VOID = {"img", "br", "hr", "input", "meta", "link", "source", "wbr", "col", "area", "embed", "track", "base"}
TAGCASE = {t.lower(): t for t in ["linearGradient", "radialGradient", "clipPath", "feGaussianBlur", "feOffset", "feBlend",
           "feColorMatrix", "feFlood", "feComposite", "feMerge", "feMergeNode", "foreignObject", "textPath", "animateTransform"]}
ATTR_RENAME = {
    "class": "className", "for": "htmlFor", "tabindex": "tabIndex", "readonly": "readOnly", "maxlength": "maxLength",
    "minlength": "minLength", "colspan": "colSpan", "rowspan": "rowSpan", "contenteditable": "contentEditable",
    "autocomplete": "autoComplete", "autofocus": "autoFocus", "srcset": "srcSet", "crossorigin": "crossOrigin",
    "datetime": "dateTime", "enctype": "encType", "novalidate": "noValidate", "inputmode": "inputMode",
    "spellcheck": "spellCheck", "frameborder": "frameBorder", "allowfullscreen": "allowFullScreen", "cellpadding": "cellPadding",
    "cellspacing": "cellSpacing", "usemap": "useMap", "hreflang": "hrefLang", "accesskey": "accessKey", "playsinline": "playsInline",
    "viewbox": "viewBox", "preserveaspectratio": "preserveAspectRatio", "gradientunits": "gradientUnits",
    "gradienttransform": "gradientTransform", "patternunits": "patternUnits", "stddeviation": "stdDeviation",
    "xlink:href": "href", "xml:space": "xmlSpace", "xmlns:xlink": None, "pathlength": "pathLength", "markerwidth": "markerWidth",
    "markerheight": "markerHeight", "refx": "refX", "refy": "refY", "spreadmethod": "spreadMethod", "maskunits": "maskUnits",
    "clippathunits": "clipPathUnits", "filterunits": "filterUnits", "textlength": "textLength", "baseprofile": "baseProfile",
}
BOOL = {"disabled", "checked", "selected", "readonly", "required", "multiple", "autofocus", "open", "hidden", "autoplay",
        "controls", "loop", "muted", "reversed", "novalidate", "playsinline", "allowfullscreen", "default", "defer", "async"}
HYPH = re.compile(r"-([a-z])")


def jstr(s):
    return json.dumps(s, ensure_ascii=False).replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def split_style(s):
    out, cur, depth, q = [], "", 0, ""
    for ch in s:
        if q:
            cur += ch
            if ch == q:
                q = ""
        elif ch in "\"'":
            q = ch; cur += ch
        elif ch == "(":
            depth += 1; cur += ch
        elif ch == ")":
            depth -= 1; cur += ch
        elif ch == ";" and depth == 0:
            out.append(cur); cur = ""
        else:
            cur += ch
    out.append(cur)
    return [x for x in out if x.strip()]


def style_obj(s):
    d = {}
    for decl in split_style(s):
        if ":" not in decl:
            continue
        k, v = decl.split(":", 1)
        k, v = k.strip(), v.strip()
        if not k:
            continue
        if k.startswith("--"):
            key = k
        else:
            kk = k.lower()
            if kk.startswith("-ms-"):
                kk = kk[1:]
            key = HYPH.sub(lambda m: m.group(1).upper(), kk)
            if kk.startswith("-"):
                key = key[0].upper() + key[1:]
        d.pop(key, None)
        d[key] = v
    return "{" + ",".join("%s:%s" % (jstr(k) if k.startswith("--") else k, jstr(v)) for k, v in d.items()) + "}"


class Tag:
    __slots__ = ("name", "cls", "frame", "lines", "attrs")


class Conv(HTMLParser):
    """Parses one snippet; emits JSX for each outermost mz/dz element."""

    def __init__(self, images):
        super().__init__(convert_charrefs=True)
        self.images = images
        self.stack = []        # (tag, frame_open_bool)
        self.frames = []       # dicts: kind, jsx(list), label
        self.cur = None        # list of jsx chunks while inside a frame
        self.depth_in = 0
        self.group = ""
        self.h4 = None
        self.figframes = []
        self.in_fig = False
        self.cap = None
        self.capb = None
        self.warn = []
        self.in_pre = 0
        self.uses_style = False

    # attrs -> jsx
    def attrs_jsx(self, tag, attrs):
        parts = []
        cs = False
        for k, v in attrs:
            k = k.lower()
            if k.startswith("on"):
                continue
            if k == "style":
                if v and v.strip():
                    parts.append("style={%s as C}" % style_obj(v)); cs = True
                continue
            name = ATTR_RENAME.get(k, k)
            if name is None:
                continue
            if k == "checked" and tag == "input":
                name = "defaultChecked"
            if k == "value" and tag in ("input", "textarea"):
                name = "defaultValue"
            if k == "selected":
                continue
            if "-" in name and not name.startswith(("data-", "aria-")):
                name = HYPH.sub(lambda m: m.group(1).upper(), name)
            if not re.match(r"^[A-Za-z_][\w:.-]*$", name):
                continue
            if v is None or (v == "" and k in BOOL):
                parts.append(name)
                continue
            if k in ("src",) and tag == "img":
                v = self.rewrite_img(v)
            if k in ("href", "src") and v.startswith("/_ref/img/"):
                v = self.rewrite_img(v)
            parts.append("%s=%s" % (name, jstr(v) if re.search(r'["\\{}&<>\n]', v) else '"%s"' % v))
        if cs:
            self.uses_style = True
        return (" " + " ".join(parts)) if parts else ""

    def rewrite_img(self, v):
        m = re.match(r"^(?:/_ref/img/|img/|\./img/)([^/?#]+)$", v)
        if m:
            self.images.add(m.group(1))
            return "/bz-static-img/" + m.group(1)
        return v

    def emit(self, s):
        if self.cur is not None:
            self.cur.append(s)

    def classes(self, attrs):
        for k, v in attrs:
            if k == "class":
                return (v or "").split()
        return []

    def handle_starttag(self, tag, attrs, selfclose=False):
        cl = self.classes(attrs)
        opens_frame = False
        if self.cur is None and tag == "div" and ("mz" in cl or "dz" in cl):
            opens_frame = True
            self.cur = []
            self.frames.append({"kind": "m" if "mz" in cl else "d", "label": self.group, "fig": self.in_fig})
            if self.in_fig:
                self.figframes.append(self.frames[-1])
        if tag == "figure":
            self.in_fig = True; self.figframes = []
        if tag == "h4":
            self.h4 = ""
        if tag == "figcaption":
            self.capb = None; self.cap = ""
        if tag == "b" and self.cap is not None and self.capb is None:
            self.capb = ""
        if tag == "pre":
            self.in_pre += 1
        name = TAGCASE.get(tag, tag)
        void = tag in VOID
        if self.cur is not None:
            j = "<%s%s%s>" % (name, self.attrs_jsx(tag, attrs), "/" if (void or selfclose) else "")
            self.emit(j)
        if not (void or selfclose):
            self.stack.append((tag, opens_frame))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs, selfclose=True)

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        # find matching open tag
        idx = None
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                idx = i; break
        if idx is None:
            self.warn.append("stray </%s>" % tag)
            return
        while len(self.stack) - 1 > idx:  # implicitly close unclosed tags
            t, of = self.stack.pop()
            self.warn.append("unclosed <%s>" % t)
            self.emit("</%s>" % TAGCASE.get(t, t))
            if of:
                self.cur_done()
        t, of = self.stack.pop()
        self.emit("</%s>" % TAGCASE.get(t, t))
        if of:
            self.cur_done()
        if tag == "b" and self.cap is not None and self.capb is not None and not self.capb.endswith("\0"):
            self.capb += "\0"
        if tag == "h4" and self.h4 is not None:
            self.group = re.sub(r"\s+", " ", self.h4).strip()
            self.h4 = None
        if tag == "pre":
            self.in_pre -= 1
        if tag == "figcaption":
            lab = (self.capb or "").replace("\0", "").strip()
            for f in self.figframes:
                if not f["label"] or f["label"] == self.group:
                    f["label"] = lab or f["label"]
            self.cap = None
        if tag == "figure":
            self.in_fig = False

    def cur_done(self):
        self.frames[-1]["jsx"] = "".join(self.cur)
        self.cur = None

    def handle_data(self, data):
        if self.h4 is not None:
            self.h4 += data
        if self.cap is not None:
            self.cap += data
            if self.capb is not None and not self.capb.endswith("\0"):
                self.capb += data
        if self.cur is None:
            return
        if data == "":
            return
        if not self.in_pre and data.strip() == "":
            self.emit('{" "}' if " " in data or "\n" in data else "")
            return
        if not self.in_pre:
            data = re.sub(r"[ \t\r\n]+", " ", data)
        if re.search(r'[{}<>&\\\n]', data) or data != data.strip() or self.in_pre or "\u00a0" in data:
            self.emit("{%s}" % jstr(data))
        else:
            self.emit(data)

    def handle_comment(self, data):
        pass

    def handle_decl(self, d):
        pass


def sh(*a):
    return subprocess.run(a, capture_output=True, text=True)


def copy_image(name):
    src = os.path.join(IMG_SRC, name)
    dst = os.path.join(IMG_OUT, name)
    if not os.path.exists(src):
        return False
    shutil.copyfile(src, dst)
    if name.lower().endswith((".jpg", ".jpeg")) and os.path.getsize(dst) > MAX_IMG:
        for dim, q in ((900, 72), (800, 62), (700, 52), (600, 45), (480, 40)):
            sh("sips", "-Z", str(dim), "-s", "format", "jpeg", "-s", "formatOptions", str(q), src, "--out", dst)
            if os.path.getsize(dst) <= MAX_IMG:
                break
    return True


def build_sprite():
    h = open(ARTIFACT_HTML, encoding="utf-8").read()
    m = re.search(r'<svg[^>]*aria-hidden="true"[^>]*>(.*?)</svg>', h, re.S)
    if not m or "<symbol" not in m.group(1):
        raise SystemExit("sprite not found in artifact")
    inner = m.group(1)

    class S(Conv):
        pass
    c = S(set())
    c.cur = []
    c.frames.append({"kind": "s", "label": ""})
    c.feed("<g>" + inner + "</g>")
    c.close()
    jsx = "".join(c.cur)
    jsx = jsx[3:-4] if jsx.startswith("<g>") else jsx
    n = jsx.count("<symbol")
    body = '/* eslint-disable */\n// GENERATED by _ref/tools/frames_to_tsx.py - do not edit.\nimport type { CSSProperties as C } from "react";\n\n/** Artifact SVG sprite: mount once so <use href="#i-xxx"/> inside static frames resolves. */\nexport default function Sprite() {\n  return (\n    <svg width="0" height="0" style={{ position: "absolute" } as C} aria-hidden="true">\n%s\n    </svg>\n  );\n}\n' % jsx
    return body, n


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(IMG_OUT, exist_ok=True)
    for f in glob.glob(os.path.join(OUT, "*")):
        os.remove(f)
    for f in glob.glob(os.path.join(IMG_OUT, "*")):
        os.remove(f)
    images = set()
    metas, failed_parse, total = [], [], 0
    for path in sorted(glob.glob(os.path.join(FRAMES, "BF*.html"))):
        block = os.path.basename(path)[:-5]
        c = Conv(images)
        c.feed(open(path, encoding="utf-8").read())
        c.close()
        if c.warn:
            print("warn %s: %s" % (block, "; ".join(sorted(set(c.warn)))[:200]))
        for i, fr in enumerate(c.frames, 1):
            fid = "%s-%02d" % (block, i)
            comp = fid.replace("-", "_")
            jsx = fr.get("jsx")
            if jsx is None:
                failed_parse.append(fid); continue
            src = ('/* eslint-disable */\n// GENERATED by _ref/tools/frames_to_tsx.py from _ref/frames/%s.html - do not edit.\n'
                   'import type { CSSProperties as C } from "react";\nimport type { StaticProps } from "./types";\n\n'
                   'export default function %s(props: StaticProps) {\n  return (\n'
                   '    <div className={"bz bz-frame" + (props.className ? " " + props.className : "")}>\n'
                   '<div className="aa ab ac" style={{ display: "contents" } as C}>\n%s\n</div>\n    </div>\n  );\n}\n') % (block, comp, jsx)
            with open(os.path.join(OUT, fid + ".tsx"), "w", encoding="utf-8") as fh:
                fh.write(src)
            total += len(src.encode())
            metas.append({"id": fid, "block": block, "kind": fr["kind"], "w": 390 if fr["kind"] == "m" else 1440,
                          "label": (fr["label"] or "")[:80]})
    sprite, nsym = build_sprite()
    open(os.path.join(OUT, "Sprite.tsx"), "w", encoding="utf-8").write(sprite)
    open(os.path.join(OUT, "types.ts"), "w").write(
        "// GENERATED by _ref/tools/frames_to_tsx.py - do not edit.\nexport interface StaticProps {\n  className?: string;\n}\n")
    idx = ['// GENERATED by _ref/tools/frames_to_tsx.py - do not edit.', 'import { lazy, type ComponentType, type LazyExoticComponent } from "react";',
           'import type { StaticProps } from "./types";', '',
           'export interface StaticFrameMeta {\n  id: string;\n  block: string;\n  kind: "m" | "d";\n  w: number;\n  label: string;\n}', '',
           'export const staticFrames: StaticFrameMeta[] = %s;' % json.dumps(metas, ensure_ascii=False, indent=1), '',
           'export const staticFrameComponents: Record<string, LazyExoticComponent<ComponentType<StaticProps>>> = {']
    for m in metas:
        idx.append('  %s: lazy(() => import("./%s")),' % (jstr(m["id"]), m["id"]))
    idx.append("};\n")
    open(os.path.join(OUT, "index.ts"), "w", encoding="utf-8").write("\n".join(idx))
    missing = [n for n in sorted(images) if not copy_image(n)]
    img_total = sum(os.path.getsize(f) for f in glob.glob(os.path.join(IMG_OUT, "*")))
    print("frames:", len(metas), "tsx_bytes:", total, "sprite_symbols:", nsym, "parse_failed:", failed_parse,
          "images:", len(images) - len(missing), "missing_img:", missing, "img_bytes:", img_total)


if __name__ == "__main__":
    main()
