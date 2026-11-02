#!/usr/bin/env python3
"""Gameplay render + Lux3D stills + end card, captions and sound timed from the game's own events.
Usage: python3 video/finish.py  (after video/build.sh, the HyperFrames render and video/record.mjs)
Output: video/out/remnant-fit-3d.mp4"""
import glob, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = f"{ROOT}/video/out"
FF = os.path.expanduser("~/.local/bin/ffmpeg-full")  # brew ffmpeg has no libass
sys.path.insert(0, os.path.expanduser("~/Dev/clauditor/scripts"))
from video_make import pick_song  # Apple Loops song picker (EULA allows commercial use)

events = [json.loads(l) for l in open(f"{OUT}/events.jsonl") if l.strip()]
start = 0
for i in range(1, len(events)):  # the render host may reopen the page and replay from 0: keep the last run
    if events[i]["at"] < events[i - 1]["at"] - 5:
        start = i
events = events[start:]
with open(f"{OUT}/events-final.jsonl", "w") as f:
    f.writelines(json.dumps(e) + "\n" for e in events)


def first(t, after=0.0, **kw):
    for e in events:
        if e["t"] == t and e["at"] >= after and all(e.get(k) == v for k, v in kw.items()):
            return e["at"]
    raise SystemExit(f"no event {t} {kw} after {after}")


end = first("end")
cut_a = first("finish", n=1) + 3.6          # job 1 result card, then the Lux3D part
resume = first("job", n=3) - 0.2            # back to the game on job 3
SLIDE, CARD = 5.0, 5.0
slides = sorted(glob.glob(f"{OUT}/slides/s[0-9].png"))
lux = SLIDE * len(slides)
total = cut_a + lux + (end - resume) + CARD
B = cut_a                                   # film time where the stills start
C = cut_a + lux - resume                    # offset added to game time after the stills

subprocess.run(["node", f"{ROOT}/video/soundtrack.mjs", f"{OUT}/events-final.jsonl", f"{OUT}/sfx.wav", str(end + 1)], check=True)
subprocess.run(["magick", "-size", "1920x1080", "xc:#1d2023",
                "-fill", "#f4c430", "-font", f"{ROOT}/video/fonts/Barlow-Bold.ttf", "-pointsize", "140", "-gravity", "center", "-annotate", "+0-140", "Remnant Fit 3D",
                "-fill", "#eceae4", "-font", f"{ROOT}/video/fonts/Barlow-Medium.ttf", "-pointsize", "48", "-annotate", "+0+0", "Five Lux3D kitchens. A yard of offcuts. Beat the foreman.",
                "-pointsize", "40", "-fill", "#f4c430", "-annotate", "+0+110", "remnant-fit-3d.designmaster.workers.dev",
                "-pointsize", "30", "-fill", "#eceae4", "-annotate", "+0+190", "Built with Aholo Lux3D · Design Master Solutions", f"{OUT}/card.png"], check=True)

caps = [
    (first("job", n=1) + 0.3, first("job", n=1) + 4.3, "Job 1. Every slab in the yard is a Lux3D offcut."),
    (first("saw") + 0.1, first("saw") + 3.6, "Orange is what the saw cuts off. That stone is lost."),
    (first("finish", n=1) + 0.2, cut_a, "Match the foreman's plan and you earn three stars."),
    (first("job", n=3) + C + 0.3, first("mistake") + C + 0.2, "Job 3, a U with a sink."),
    (first("mistake") + C + 0.2, first("mistake") + C + 3.4, "Drop a slab on another one and it goes back to the yard."),
    (first("finish", n=3) + C + 0.2, first("job", n=5) + C - 0.2, "Every slab you place is stone kept out of the skip."),
    (first("job", n=5) + C + 0.3, first("job", n=5) + C + 4.3, "Job 5, an island with a cooktop hole."),
    (first("finish", n=5) + C + 0.2, end + C, "Five kitchens, free in the browser, on phone and desktop."),
]
fmt = lambda t: f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"
ass = ["[Script Info]", "PlayResX: 1920", "PlayResY: 1080", "ScaledBorderAndShadow: yes", "[V4+ Styles]",
       "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
       "Style: Cap,Barlow,52,&H00E4EAEC,&H0,&H00231F1D,&HC0231F1D,1,0,0,0,100,100,0,0,4,16,0,2,80,80,150,1",
       "Style: Note,Barlow,24,&H90E4EAEC,&H0,&H0,&H0,0,0,0,0,100,100,0,0,1,1,0,9,30,30,24,1",
       "[Events]", "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text"]
for a, b, t in caps:
    ass.append(f"Dialogue: 0,{fmt(a)},{fmt(b)},Cap,,0,0,0,,{{\\fad(200,200)}}{t}")
for a, b in ((0, cut_a), (B + lux, total - CARD)):
    ass.append(f"Dialogue: 0,{fmt(a)},{fmt(b)},Note,,0,0,0,,Real game footage, played through its own controls")
open(f"{OUT}/captions.ass", "w").write("\n".join(ass) + "\n")

song = pick_song(glob.glob("/Library/Audio/Apple Loops/Apple/07 Chillwave/*.caf"), "remnant-fit-3d")
cmd = [FF, "-v", "error", "-y", "-i", f"{OUT}/gameplay.mp4"]
for s in slides:  # one frame in; zoompan makes the SLIDE seconds
    cmd += ["-i", s]
cmd += ["-loop", "1", "-t", str(CARD), "-i", f"{OUT}/card.png", "-i", f"{OUT}/sfx.wav"]
for f in song:
    cmd += ["-stream_loop", "-1", "-i", f]
n = len(slides)
sfx_i, song_i = n + 2, n + 3
v = [f"[0:v]trim=0:{cut_a:.3f},setpts=PTS-STARTPTS,fps=30,format=yuv420p[a]"]
for k in range(n):  # slow push-in on each still
    v.append(f"[{k + 1}:v]scale=2112:-1,zoompan=z='1+0.06*on/{int(SLIDE * 30)}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={int(SLIDE * 30)}:s=1920x1080:fps=30,format=yuv420p[s{k}]")
v.append(f"[0:v]trim={resume:.3f}:{end:.3f},setpts=PTS-STARTPTS,fps=30,format=yuv420p[c]")
v.append(f"[{n + 1}:v]fps=30,format=yuv420p,fade=t=in:d=0.6[d]")
v.append("[a]" + "".join(f"[s{k}]" for k in range(n)) + f"[c][d]concat=n={n + 3}:v=1:a=0,subtitles={OUT}/captions.ass:fontsdir={ROOT}/video/fonts[vout]")
a = [f"[{sfx_i}:a]atrim=0:{cut_a:.3f},asetpts=PTS-STARTPTS[x1]",
     f"[{sfx_i}:a]atrim={resume:.3f}:{end:.3f},asetpts=PTS-STARTPTS,adelay={int((cut_a + lux) * 1000)}|{int((cut_a + lux) * 1000)}[x2]",
     "[x1][x2]amix=inputs=2:normalize=0:duration=longest[sfx]"]
a += [f"[{song_i + k}:a]volume={0.9 if k == 0 else 0.55}[m{k}]" for k in range(len(song))]
a.append("".join(f"[m{k}]" for k in range(len(song))) + f"amix=inputs={len(song)}:normalize=0:duration=first,atrim=0:{total:.3f},volume=0.22,afade=t=in:d=1.5,afade=t=out:st={total - 3:.3f}:d=3[mus]")
a.append(f"[sfx][mus]amix=inputs=2:normalize=0:duration=longest,atrim=0:{total:.3f},loudnorm=I=-14:TP=-1.5:LRA=11[aout]")
cmd += ["-filter_complex", ";".join(v + a), "-map", "[vout]", "-map", "[aout]", "-t", f"{total:.3f}",
        "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
        "-movflags", "+faststart", f"{OUT}/remnant-fit-3d.mp4"]
subprocess.run(cmd, check=True)
print(f"film {total:.1f} s -> {OUT}/remnant-fit-3d.mp4 ; music: {', '.join(os.path.basename(f) for f in song)}")
