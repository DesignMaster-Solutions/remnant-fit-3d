#!/usr/bin/env python3
# Creates Lux3D text-to-3D tasks, polls them and downloads each GLB to public/models.
import json, os, subprocess, sys, time, urllib.request

API = "https://api.aholo.ai/global/lux3d/v1/generate"
KEY = subprocess.check_output(["cld", "vault", "get", "lux3d-api:dms"], text=True).strip()
STONE = "Single flat broken-off offcut of polished {stone} countertop stone, 3 cm thick, {shape}, rough sawn edges, seen whole, plain background, photorealistic product shot"
JOBS = {
    "remnant-a": {"prompt": STONE.format(stone="white Calacatta marble with grey veins", shape="irregular trapezoid outline with one diagonal broken corner")},
    "remnant-b": {"prompt": STONE.format(stone="black Absolute granite with fine sparkle", shape="long narrow L shaped outline")},
    "remnant-c": {"prompt": STONE.format(stone="warm beige travertine", shape="rounded chipped rectangle outline")},
    "kitchen": {"prompt": "Small L-shaped kitchen base cabinets in matte sage green with brass handles, sink cut-out, cabinets only with a bare flat plywood top and no countertop, single object, photorealistic"},
}

def call(url, body=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body else None,
                                 headers={"Authorization": KEY, "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=40))

state_file = os.path.join(os.path.dirname(__file__), "tasks.json")
tasks = json.load(open(state_file)) if os.path.exists(state_file) else {}
for name, job in JOBS.items():
    if name not in tasks:
        r = call(API + "/text-to-3d/task/create", {**job, "version": "G1", "faceCount": 30000})
        print(name, r, flush=True)
        if r["c"] == "0":
            tasks[name] = r["d"]
            json.dump(tasks, open(state_file, "w"))

deadline = time.time() + 1500
pending = dict(tasks)
while pending and time.time() < deadline:
    time.sleep(15)
    for name, tid in list(pending.items()):
        try:
            d = call(f"{API}/task/get?taskid={tid}")["d"]
        except Exception as e:
            print(name, "poll error", e, flush=True)
            continue
        if d["status"] == 3:
            url = next(o["content"] for o in d["outputs"] if ".glb" in o["content"])
            urllib.request.urlretrieve(url, f"public/models/{name}.glb")
            print(name, "done", url, flush=True)
            del pending[name]
        elif d["status"] in (4, 6):
            print(name, "FAILED", d, flush=True)
            del pending[name]
print("left", list(pending), flush=True)
