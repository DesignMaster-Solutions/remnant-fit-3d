#!/usr/bin/env python3
# Runs every Lux3D job below: text-to-3D, image generation, image-to-3D and material transfer.
# Jobs that need another job's output wait for it. State lives in tasks.json, every event in gen.log.
# Raw files land in lux3d/raw (GLB) and lux3d/img (PNG); public/models gets the optimised copies.
import json, os, subprocess, time, urllib.request

API = "https://api.aholo.ai/global/lux3d/v1/generate"
HERE = os.path.dirname(os.path.abspath(__file__))
KEY = subprocess.check_output(["cld", "vault", "get", "lux3d-api:dms"], text=True).strip()
STONE = "Single flat broken-off offcut of polished {stone} countertop stone, 3 cm thick, {shape}, rough sawn edges, seen whole, plain background, photorealistic product shot"
CABS = "kitchen base cabinets in {finish}, {extra}, cabinets only with a bare flat plywood top and no countertop, single object, photorealistic"
# Mesh used as the carrier for material transfer: the round-1 marble offcut as Lux3D returned it.
CARRIER = "https://qhsmodel.kujiale.com/lux3dPbrEmbedResult/9a782f2db14d4674a406f5070aace62e/textured.glb"
G1 = {"version": "G1", "faceCount": 30000}

def t3d(prompt): return {"kind": "text-to-3d", "body": {"prompt": prompt, **G1}}
def img(prompt): return {"kind": "multimodal-to-image", "body": {"prompt": prompt}}

JOBS = {
    # Round 1 (Version 1)
    "remnant-a": t3d(STONE.format(stone="white Calacatta marble with grey veins", shape="irregular trapezoid outline with one diagonal broken corner")),
    "remnant-b": t3d(STONE.format(stone="black Absolute granite with fine sparkle", shape="long narrow L shaped outline")),
    "remnant-c": t3d(STONE.format(stone="warm beige travertine", shape="rounded chipped rectangle outline")),
    "kitchen": t3d("Small L-shaped " + CABS.format(finish="matte sage green with brass handles", extra="sink cut-out")),
    # Round 2: one kitchen per level
    "kitchen-run": t3d("Single straight run of " + CABS.format(finish="matte navy blue with long steel bar handles", extra="about two and a half metres long")),
    "kitchen-galley": t3d("Galley kitchen with two separate parallel straight runs of " + CABS.format(finish="warm oak veneer", extra="an open walkway between the two runs, sink cut-out in one run")),
    "kitchen-u": t3d("U-shaped " + CABS.format(finish="glossy white lacquer with black handles", extra="sink cut-out in the middle run")),
    "kitchen-island": t3d("Freestanding rectangular kitchen island of " + CABS.format(finish="charcoal grey with brass knobs", extra="large rectangular cooktop cut-out in the top")),
    # Round 2: same U layout from an Aholo image, to compare image-to-3D against text-to-3D
    "kitchen-u-ref": img("Three-quarter top view product photo of U-shaped kitchen base cabinets in glossy white lacquer, bare flat plywood top with no countertop, rectangular sink cut-out in the middle run, isolated on plain light grey background"),
    "kitchen-u-img": {"kind": "img-to-3d", "needs": "kitchen-u-ref", "body": {**G1}},
    # Round 2: more offcuts
    "remnant-d": t3d(STONE.format(stone="green Verde quartzite with white streaks", shape="irregular pentagon outline")),
    "remnant-e": t3d(STONE.format(stone="grey terrazzo with white and black chips", shape="long straight strip with one rectangular notch cut out of a long side")),
    "remnant-f": t3d(STONE.format(stone="brown Emperador marble with cream veins", shape="right-angled triangle outline with a chipped tip")),
    # Round 2: new stones on the same offcut shape by material transfer
    "swatch-azul": img("Flat top-down close-up photo of a polished Azul Bahia blue granite slab surface, even light, fills the frame, no objects"),
    "remnant-azul": {"kind": "material-transfer", "needs": "swatch-azul", "body": {"meshUrl": CARRIER, "version": "v3.0-standard"}},
    "swatch-rosa": img("Flat top-down close-up photo of a polished Rosa Portogallo pink granite slab surface, even light, fills the frame, no objects"),
    "remnant-rosa": {"kind": "material-transfer", "needs": "swatch-rosa", "body": {"meshUrl": CARRIER, "version": "v3.0-standard"}},
}

def call(url, body=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body else None,
                                 headers={"Authorization": KEY, "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=40))

def log(*a):
    line = time.strftime("%Y-%m-%d %H:%M:%S ") + " ".join(str(x) for x in a)
    print(line, flush=True)
    open(os.path.join(HERE, "gen.log"), "a").write(line + "\n")

state_file = os.path.join(HERE, "tasks.json")
tasks = json.load(open(state_file)) if os.path.exists(state_file) else {}
tasks = {k: (v if isinstance(v, dict) else {"id": v, "status": 3}) for k, v in tasks.items()}
save = lambda: json.dump(tasks, open(state_file, "w"), indent=1)
os.makedirs(os.path.join(HERE, "raw"), exist_ok=True)
os.makedirs(os.path.join(HERE, "img"), exist_ok=True)

def fetch(url, path):
    for attempt in range(4):
        try:
            return urllib.request.urlretrieve(url, path)
        except Exception as e:
            log("download retry", attempt + 1, os.path.basename(path), e)
            time.sleep(5 * (attempt + 1))
    raise RuntimeError("download failed " + path)

def finish(name, d):
    outs = [o["content"] for o in d.get("outputs", [])]
    if JOBS[name]["kind"] == "multimodal-to-image":
        url = outs[0]
        fetch(url, os.path.join(HERE, "img", f"{name}.png"))
    else:
        url = next(o for o in outs if ".glb" in o)
        fetch(url, os.path.join(HERE, "raw", f"{name}.glb"))
    tasks[name].update(status=3, url=url)
    log(name, "done", url)

deadline = time.time() + 3600
while time.time() < deadline:
    open_jobs = [n for n in JOBS if tasks.get(n, {}).get("status") not in (3, 4, 6)]
    if not open_jobs:
        break
    for name in open_jobs:
        job, t = JOBS[name], tasks.get(name)
        if t is None:
            body = dict(job["body"])
            if "needs" in job:
                dep = tasks.get(job["needs"], {})
                if dep.get("status") in (4, 6):
                    tasks[name] = {"status": 4, "error": "needs " + job["needs"]}
                    log(name, "SKIPPED, input job failed")
                if dep.get("status") != 3:
                    continue
                body["img"] = dep["url"]
            r = call(f"{API}/{job['kind']}/task/create", body)
            if r["c"] == "0":
                tasks[name] = {"id": r["d"], "status": 0, "kind": job["kind"], "body": body}
                log(name, "created", r["d"], job["kind"])
            elif r["c"] != "GENERATION_CONCURRENCY_LIMIT_EXCEEDED":
                tasks[name] = {"status": 4, "error": r}
                log(name, "REJECTED", r)
            save()
            continue
        try:
            d = call(f"{API}/task/get?taskid={t['id']}")["d"]
        except Exception as e:
            log(name, "poll error", e)
            continue
        if d["status"] == 3:
            try:
                finish(name, d)
            except Exception as e:
                log(name, "download failed, will retry next round", e)
        elif d["status"] in (4, 6):
            t["status"] = d["status"]
            log(name, "FAILED", json.dumps(d)[:400])
        save()
    time.sleep(15)
log("left", [n for n in JOBS if tasks.get(n, {}).get("status") != 3])
