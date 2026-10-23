"""Staged layout fixes found in the final walkthrough of slides 1-24 (NOT yet applied)."""
import os

# Run from anywhere: python tools/pending_fixes.py
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def edit(p, reps):
    p = f"{root}/{p}"
    s = open(p, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in s else "\n"
    s = s.replace("\r\n", "\n")
    for a, b in reps:
        if a not in s:
            print("MISSING in", p, ":", a[:100].replace("\n", "\\n"))
            continue
        s = s.replace(a, b)
    open(p, "w", encoding="utf-8", newline="").write(s.replace("\n", nl))


# Routes: the neural network sat on the (now right-aligned) progress chain.
edit("src/scenes/routes.ts", [
    ("      world.fly(shot(R, { py: 4, pz: 212, oy: -0.12 }), 3);", "      world.fly(shot(R, { py: 4, pz: 240, oy: -0.06 }), 3);"),
])
print("done")

# Homology: the α/β superposition was too small to read.
edit("src/scenes/part1b/homology.ts", [
    ("  const HERO = at(40, 50, 30);", "  const HERO = at(38, 48, 30);"),
    ("        gsap.to(h.scale, { x: 1.05, y: 1.05, z: 1.05, duration: 1.8, delay: 0.3 + k * 0.5, ease: 'power3.inOut' });",
     "        gsap.to(h.scale, { x: 1.75, y: 1.75, z: 1.75, duration: 1.8, delay: 0.3 + k * 0.5, ease: 'power3.inOut' });"),
    ("root.localToWorld(HERO.clone().add(new THREE.Vector3(27, 12, 0)))", "root.localToWorld(HERO.clone().add(new THREE.Vector3(42, 20, 0)))"),
])
print("done2")

# HMMER: the database label sat on the delete states.
edit("src/scenes/part1b/search.ts", [
    ("      pins.show(['se-q', 'se-dna'], false);", "      pins.show(['se-q', 'se-dna', 'se-db'], false);"),
])
print("done3")

# Lens panels washed out the 3D content inside them.
edit("src/style/part2.css", [
    (".lens-panel {\n  fill: rgb(255 255 255 / 0.32);", ".lens-panel {\n  fill: rgb(255 255 255 / 0.1);"),
])
# Chapter 2: a little more air between the numeral and the title.
edit("src/scenes/net/intro.ts", [
    ("C2.clone().add(new THREE.Vector3(13, 0, 0))", "C2.clone().add(new THREE.Vector3(17, 0, 0))"),
])
print("done4")

# Inputs: the A G L K tiles were small.
edit("src/scenes/net/intro.ts", [
    ("  letters.unit = 2;", "  letters.unit = 2.5;"),
])
print("done5")
