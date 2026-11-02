#!/usr/bin/env python3
"""Stills for the Lux3D part of the film, made only from real generations: video/out/slides/s1..s4.png."""
import json, os, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = f"{ROOT}/video/out/slides"
R = f"{ROOT}/public/report"
IMG = f"{ROOT}/lux3d/img"
BOLD, MED = f"{ROOT}/video/fonts/Barlow-Bold.ttf", f"{ROOT}/video/fonts/Barlow-Medium.ttf"
tasks = json.load(open(f"{ROOT}/lux3d/tasks.json"))
done = sum(1 for t in tasks.values() if t.get("status") == 3)
failed = sum(1 for t in tasks.values() if t.get("status") in (4, 6))


def slide(name, title, sub, items, labels=()):
    """items: (path, x, y, w, h) fitted inside the box; labels: (text, x, y, size)."""
    cmd = ["magick", "-size", "1920x1080", "xc:#1d2023"]
    for path, x, y, w, h in items:
        cmd += ["(", path, "-resize", f"{w}x{h}", ")", "-geometry", f"+{x}+{y}", "-composite"]
    cmd += ["-fill", "#f4c430", "-font", BOLD, "-pointsize", "64", "-annotate", "+120+150", title]
    cmd += ["-fill", "#eceae4", "-font", MED, "-pointsize", "34", "-annotate", "+120+210", sub]
    for text, x, y, size in labels:
        cmd += ["-fill", "#eceae4", "-font", MED, "-pointsize", str(size), "-annotate", f"+{x}+{y}", text]
    cmd.append(f"{OUT}/{name}.png")
    subprocess.run(cmd, check=True)


os.makedirs(OUT, exist_ok=True)
kitchens = ["kitchen-run", "kitchen-galley", "kitchen-u", "kitchen", "kitchen-island"]
stones = ["remnant-a", "remnant-b", "remnant-c", "remnant-d", "remnant-e", "remnant-f", "remnant-azul", "remnant-rosa"]
slide("s1", "Every kitchen and every stone is a Lux3D generation",
      f"Text-to-3D, image-to-3D, image generation and material transfer: {done} tasks, {failed} failed",
      [(f"{R}/{k}.jpg", 120 + i * 340, 290, 330, 260) for i, k in enumerate(kitchens)]
      + [(f"{R}/{s}.jpg", 120 + i * 212, 640, 205, 160) for i, s in enumerate(stones)],
      [("5 kitchens, one per level", 120, 590, 30), ("8 stones in the yard", 120, 850, 30)])
slide("s2", "The level is the mesh",
      "The game reads each counter top-down from the generated GLB, in 10 cm cells. Sinks and floor drop out.",
      [(f"{R}/kitchen-u.jpg", 120, 300, 820, 640), (f"{OUT}/grid-kitchen-u.png", 1060, 330, 740, 580)],
      [("Lux3D kitchen-u.glb", 120, 990, 30), ("What the game reads: 422 cells of counter", 1060, 990, 30)])
slide("s3", "Same U brief, two routes",
      "Image route: Aholo image, then image-to-3D. It reads a false gap and a ragged sink, so the game keeps text-to-3D.",
      [(f"{IMG}/kitchen-u-ref.png", 120, 300, 420, 420), (f"{R}/kitchen-u-img.jpg", 580, 300, 540, 420),
       (f"{OUT}/grid-kitchen-u-img.png", 1160, 300, 300, 420), (f"{R}/kitchen-u.jpg", 1500, 300, 300, 230),
       (f"{OUT}/grid-kitchen-u.png", 1500, 560, 300, 240)],
      [("Aholo image", 120, 780, 28), ("Image-to-3D", 580, 780, 28), ("its grid", 1160, 780, 28),
       ("Text-to-3D and its grid", 1500, 850, 28)])
slide("s4", "Material transfer: one offcut, new stones",
      "The Calacatta offcut mesh, retextured from an Aholo swatch. Same shape, a different stone in the yard.",
      [(f"{R}/remnant-a.jpg", 120, 380, 460, 360), (f"{IMG}/swatch-azul.png", 700, 300, 220, 220),
       (f"{R}/remnant-azul.jpg", 960, 300, 300, 230), (f"{IMG}/swatch-rosa.png", 700, 620, 220, 220),
       (f"{R}/remnant-rosa.jpg", 960, 620, 300, 230)],
      [("Calacatta offcut", 120, 800, 30), ("Azul Bahia swatch", 1300, 420, 30), ("Rosa Portogallo swatch", 1300, 740, 30)])
print("slides in", OUT, "tasks", done, "failed", failed)
