# AlphaPhold: handoff for the next agent

The project is **finished**: every scene was walked and checked in screenshots, the fixes are applied, the build passes and the step-through check is clean (see §5). This file contains everything you need. You do not have the earlier chat. Read the whole file before you change anything.

---

## 1. What the project is

This is a **Persian (RTL), light-mode, web-based presentation about AlphaFold**, built with **Vite + TypeScript + Three.js + GSAP**. It is not a slide deck in the usual sense. It is one continuous 3D world, and the camera flies between "scenes". Each scene has build steps that advance like slides.

- Owners: two students, **حسام جوادی و متین لطفی**. The course is **درس مباحثی در علوم کامپیوتر**, taught by **دکتر فرشته فلاح**.
- The content source is the students' PDF, `AlphaFold (3).pdf` (20 pages, Persian). It is **all built**. The user provides the content and has said the presentation is complete. **Do not invent new sections.**
- Visual concept: **«زنجیره» (Chain)**. A protein bead chain is the protagonist. The palette is lab-white background, navy ink, and the four AlphaFold pLDDT confidence hues (blue `#0053d6`, sky `#65cbf3`, sun `#ffdb13`, ember `#ff7d45`).

### Hard rules from the user (do not break them)

1. **Every scene has its own design plan.** No two scenes may look like the same template with different text. When you fix something, keep each scene's distinct visual idea.
2. **Display constraints:** light mode, RTL, big high-contrast text for a dim projector. Body text is never below about 2rem (≈20 px at 1080p).
3. **The Evoformer figure rule.** On every slide built from PDF pages 9–13 (the network chapter, scenes 21–29), the Evoformer block figure from the AlphaFold paper (PDF page 14) must stay on screen, and the content must be explained in terms of it. The figure may be restyled, but **its content must stay identical**: same boxes, labels, arrows, ⊕ joins, the "48 blocks (no shared weights)" frame, and the (s,r,c) and (r,r,c) tiles. It is implemented as a 3D board in `src/three/board.ts`.
4. **The first slide is the cover**, not «به نام خدا». It shows the large English word "AlphaFold" in particles, with «توسط حسام جوادی و متین لطفی» and «دکتر فرشته فلاح • درس مباحثی در علوم کامپیوتر» underneath. This is done.
5. Keep copy faithful to the PDF. Light grammar and half-space fixes are fine. Anything illustrative must be labelled «نمایشی» or «طرح‌واره» in its caption.

---

## 2. How to run it

```bash
npm install
npm run dev          # http://localhost:5173  (config "presentation" in .claude/launch.json)
npm run build        # tsc --noEmit && vite build  — must pass with no errors
npm run build:offline  # dist-offline/index.html: ONE self-contained file (4 MB) that opens from disk
```

**Running it on another computer:** run `npm run build:offline` and copy `dist-offline/index.html` (rename it freely, e.g. `AlphaFold.html`). Double-click it to open it in Chrome or Edge; no server, internet, Node or install is needed. Fonts, images, molecule data, JS and CSS are all inlined; `tools/inline.mjs` folds the Vite build into the one file. (The normal `dist/` build needs a web server, because browsers block module scripts loaded from `file://`.)

**Controls:**
- Space, PageDown, → or ↓: next step. PageUp, ← or ↑: back.
- Home / End: first / last scene. F: fullscreen. B or `.`: blank screen. Q: toggle the light renderer.
- The URL hash `#scene.step` (1-based, e.g. `#18.4`) keeps your place, and the user refers to slides that way.
- `?capture` is a URL flag for headless screenshots. It turns off GSAP lag smoothing, the start-up toast, the automatic quality fallback and the ambient-occlusion pass.

---

## 3. Architecture (where things live)

```
index.html                 canvas#gl + main.stage#overlay + loader
src/main.ts                boot: fonts → World/Chrome/Notes/Pins/Lens → build all scene modules → Deck
src/content.ts             ALL Persian copy, by section (cover, title, definition, …, confidence, closing). fa() = Persian digits
src/deck.ts                Scene interface {id,label,head?,chapter?,steps?,enter(step,dir),step?(step,dir),leave(dir)}; Deck (keys, hash, blank); `capture` flag
src/three/world.ts         renderer, N8AO ambient occlusion, fog, motes, camera rig (shot(), fly()), ANCHOR (world x-position of every part), palette C, spectrum()
src/ui/chrome.ts           running head, bead progress chain (bottom right), figure caption with live Å scale bar, toast
src/ui/notes.ts            leader-line annotations (HTML label at fixed rem position + SVG line to a 3D anchor)
src/ui/pins.ts             labels pinned to 3D points (no line); align/dx/dy in rem
src/ui/lens.ts             "magnifier" beam from a board box up to a panel (network chapter)
src/ui/braces.ts           curly braces over 3D groups (homology tree)
src/ui/math.ts             KaTeX: tex(), rich() for inline $…$ in Persian copy
src/ui/text.ts             section(), words(), reveal(), stepVis()/stepReset() (elements with data-s="a-b" show only for steps a..b)
src/scenes/ctx.ts          Ctx {world, chrome, notes, pins, lens, overlay, area(), register()}; pop()
src/three/*                reusable 3D: chain (bead chain, Dust particles, textPoints), cartoon (ribbons from real PDB backbone),
                           surface (molecular surface), ballstick, tiles (letter tiles), board (Evoformer figure), frames (N–Cα–C
                           backbone frames), links (curved arrows), props, puzzle
src/data/*.json            real structures (RCSB PDB 1UBQ,1HEW,4HHB,1CLL,1IEP,1ZNF), globins.json (UniProt MSA + α/β superposition),
                           af_p53.json / af_cam.json (AlphaFold DB v4 models via the AlphaFill mirror, with per-residue pLDDT)
src/assets/casp14_*.jpg    the paper's two CASP14 example overlays (cropped from PDF page 18)
src/style/base.css         1rem = 1/108 of the 16:9 stage height (1920×1080 design frame); reset; fonts
src/style/theme.css, part2.css, part3.css   all component and scene styles
tools/                     walk.mjs (screenshot walker), sheet.py (contact sheets), stepcheck.mjs (runtime-error check over every step)
```

**Patterns:**
- Each part of the talk lives at its own `ANCHOR` x-position in the world. A scene module creates a root group there, registers an **area** with `ctx.register(name, hide)`, and calls `ctx.area(name)` on enter. Jumping anywhere then tidies away the other parts.
- Network and part-3 scenes use a fixed camera, `shot(anchor, {pz:300})`, plus `at(xRem, yRem, z)` from `src/scenes/net/common.ts`. These map stage rem coordinates to world space, so 3D objects line up with the HTML text. The text column is on the **right** (`.n-panel`, right: 12rem, ~76–84rem wide). 3D content goes on the left. The free area is roughly x < 100rem.
- **GSAP gotcha:** `gsap.killTweensOf` does not reliably cancel a delayed tween that uses an object `stagger`. `Tiles.show()`, `Chain.show()` and `BeadRow.show()` keep a reference to their tween and `.kill()` it. Don't schedule `pins.show` or tweens from inside timeline callbacks. Schedule them up front with a delay, because callbacks inside timelines misbehave in this setup.
- Edits made with Python string replacement must preserve CRLF line endings. The files are CRLF. The helper in `tools/pending_fixes.py` handles this.

---

## 4. Scene list (45 scenes; the hash number is the scene index)

| # | id | content |
|---|---|---|
| 1 | cover | AlphaFold particle word + authors / teacher / course |
| 2 | title | آلفا فولد چیست… (particles become ubiquitin chain) |
| 3 | define | definition, sequence → fold, ribbon vs lab ghost |
| 4 | puzzle | 50-year puzzle: crystal lattice vs AlphaFold cloud |
| 5 | chapter-1 | chapter ۱ «مقدمات» opener + TOC |
| 6 | basics | protein = bead chain → atoms |
| 7–10 | function, active-site, regulation, drug | ۱-۱ why 3D structure matters (lysozyme, haemoglobin, calmodulin, ABL+imatinib) |
| 11 | routes | ۱-۲ two routes: lab vs AI |
| 12–13 | xray, cryo | ۱-۳ why experiments are slow |
| 14 | homology | ۱-۴ globin tree, orthologs/paralogs, α/β superposition |
| 15–16 | bioinformatics, msa | ۱-۵ BLASTP/BLASTX/PSI-BLAST/HMMER; MSA of 9 globins |
| 17–19 | conserved, coevolution, pipeline | ۱-۶ conserved residues (zinc finger 1ZNF), co-evolution salt bridge, inputs → AlphaFold2 → 3D |
| 20 | chapter-2 | chapter ۲ «شبکه‌ی عصبی AlphaFold» opener |
| 21–29 | net-overview … net-triangle | network chapter on the Evoformer board (overview f_θ, architecture, inputs M/Z, Evoformer ×48, self-attention, row/column attention, Transition, Outer Product Mean, triangle updates) |
| 30–34 | net-structure, net-frames, net-ipa, net-sidechain, net-recycling | PDF p.14–15: Structure Module (8 shared blocks), frames, IPA, side chains, Recycling |
| 35 | chapter-3 | chapter ۳ «آموزش شبکه» (voxel numeral) |
| 36–39 | training, fape, optimize, distill | objective/loss, FAPE (frame-aligned errors, clamp), loss landscape descent, self-distillation (356k Uniclust30) |
| 40 | chapter-4 | chapter ۴ «ارزیابی AlphaFold2» (bar-field numeral) |
| 41–42 | casp14, casp14-results | blind test, GDT_TS history chart (values read off the paper's figure), results table, 92 domains, RMSD to scale |
| 43 | metrics | GDT_TS / RMSD / lDDT computed live on haemoglobin α vs β (PDB 4HHB) |
| 44 | confidence | pLDDT on AlphaFold p53 model; PAE map (illustrative) with calmodulin two lobes |
| 45 | closing | «سپاس از توجه شما» in particles + credits |

Code for scenes 30–45 is in `src/scenes/part3/` (structure.ts, training.ts, evaluation.ts, stage.ts).

---

## 5. What was done most recently

1. Pages 14–20 of the PDF were built as scenes 30–45, plus the new cover and closing.
2. The progress chain moved to the bottom right with smaller beads (45 scenes). See the end of `part2.css`.
3. The first walkthrough review of scenes 30–45 found layout bugs. They were fixed and applied: Structure Module gas/blocks, frames layout and coordinates, IPA sizes, side-chain labels, Recycling legend, chapter numerals, FAPE panel, optimization landscape, distill gate, CASP crates and chart, results keys and rulers, metrics cards, confidence labels and scale. They were re-verified in the final walkthrough (item 5).
4. A review of steps 1–72 (scenes 1–24) found six fixes. They were staged in `tools/pending_fixes.py`, then applied and verified; the script has been removed (it is in the git history):
   - scene 11, routes: the camera framing put the neural net on the progress chain (`pz 212→240, oy −0.12→−0.06`);
   - scene 14, homology: the α/β superposition hero is too small (scale 1.05→1.75, and the stat pin moved);
   - scene 15, HMMER step: the "پایگاه داده" label sits on the delete states (hide `se-db`);
   - network lens panels wash out the 3D content (`.lens-panel` fill 0.32→0.1);
   - scene 20: more space between the numeral «۲» and the title;
   - scene 23: the A G L K letter tiles are small (`letters.unit` 2→2.5).
5. **Final walkthrough (all 140 steps, 1600×900).** Every step was screenshotted and checked. Scenes 25–45 were looked at most closely. The fixes below were applied, and the affected scenes were walked again to confirm them:
   - 11 routes: the methods card covered the cryo-EM grid after the wider framing (note moved up);
   - 25 self-attention: larger Q K V tiles (`qkv.unit` 6→7, wider row spacing);
   - 27 transition: the "residual connection" flag sat on the lens panel border (lens panel taller, flag lower);
   - 28 outer product mean: the MSA and its `s` label ran out of the lens panel (MSA moved right);
   - 29 triangle: larger residue beads, and a dark halo on the white i/j/k labels; tighter text spacing so the last line clears the board;
   - 32 IPA: the box label was too small (font size set);
   - 33 side chains: the three residue labels collided on the spinning protein. They are now leader-line notes in a fixed column;
   - 37 FAPE: the clamp card covered the protein (protein left, card up and right); the y-axis label no longer sits on the axis;
   - 38 optimisation: larger landscape; the start label no longer touches the loss read-out;
   - 39 self-distillation: «مدل آموزش‌دیده» ran off its box. The boxes are wider, and `labelTexture()` now shrinks any label that is wider than its plate;
   - 43 metrics: the 1/2/4/8 Å label ran into the GDT card (it now sits above the protein);
   - 44 confidence: the two domain labels collided on the rotating calmodulin. They are now leader-line notes above and below the protein.

   Afterwards, two more fixes were requested and verified: **31 frames** was hard to read (a rainbow tangle of plates and a tiny frame). It now has one calm colour for all residues with the marked residue in yellow; an enlarged residue showing its N, Cα and C atoms, bonds and labelled x/y/z axes; a scramble-then-correct loop in step 2 (misplaced frames glow ember and turn blue once corrected); and, in step 3, residue 40, a solid distance bar and larger global axes. **38.6 optimisation** used momentum, so the ball swung back and forth and stopped in a shallow side valley while the label said «کمینه‌ی زیان». It is now plain gradient descent (every update goes downhill) into the global minimum, resampled for a steady roll; the loss read-out is clamped to 0–1.

   `npm run build` passes (chunk-size note only). `node tools/stepcheck.mjs http://localhost:5173/` (forward through all 140 steps, back again, every step by `goto`, then 120 random jumps) reports no runtime errors. The only console message is a 404 for `/favicon.ico`.
6. Known data caveats, already disclosed to the user:
   - The AlphaFold DB (alphafold.ebi.ac.uk) was blocked from this network. The p53 and calmodulin models are AFDB **v4** taken from the AlphaFill mirror.
   - The **PAE heat map is hand-drawn (schematic)** and its caption says «نمایشی».
   - CASP history values are approximate readings from the paper's figure, and the caption says so.

---

## 6. How to check the deck after any change

The plan below was carried out in full (see §5). Repeat steps 2–7 after any future edit.

1. *(Done.)* The staged fixes have been applied.
2. **Start the dev server** (`npm run dev`) and leave it running. **Do not edit source files while a screenshot walk is running.** Vite hot-reloads the page and aborts the walk.
3. **Set up the screenshot tools once:**
   ```bash
   cd tools && npm i
   pip install pillow   # for sheet.py
   ```
   `walk.mjs` needs Google Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`, or set the `CHROME` env var (on Linux, e.g. `CHROME=/opt/pw-browsers/chromium`; it adds `--no-sandbox` when run as root). It uses SwiftShader software WebGL. Expect about 10 s per step and about 30 s to 3 minutes to boot. Two walkers on different scene ranges can run in parallel.
4. **Walk the full deck:**
   ```bash
   node walk.mjs http://localhost:5173/ ../.shots/all 1600x900 1 999 4800
   ```
   There are about 140 steps, so this takes about 15 minutes. Build contact sheets with `python sheet.py ../.shots/all ../.shots/sheets` and look at every sheet. You can walk a range with FROM/TO scene numbers, e.g. `… 30 45 4800`.
5. **Check each step for:**
   - text overlapping text or 3D objects;
   - labels or cards cut off at the frame edges;
   - 3D content running into the right-hand text column, the bottom-left caption or the bottom-right progress chain;
   - anything unreadable (too small or too faint);
   - leftovers from a previous step.

   Pay most attention to **scenes 25–45**. Scenes 25–29 have not been re-checked since the progress-chain move. Scenes 30–45 have not been re-checked since the fixes in §5.3.
6. **Fix and re-walk only the affected scenes.** Keep each scene's own design idea; nudge positions and sizes rather than redesigning.
7. **Finish:**
   - run `npm run build`. It must pass; a chunk-size warning is fine;
   - make sure the stepping-through-every-step check shows no runtime errors: `cd tools && node stepcheck.mjs http://localhost:5173/` (it uses `window.deck`, which is exposed in dev, and exits with code 1 if the page logs an error);
   - commit the work.

---

## 7. Useful facts

- `at(xRem, yRem)`: 1 rem ≈ 1.752 world units at z=0 for the fixed network/part-3 camera (pz = 300, vertical FOV 35°).
- `World.resize` widens the vertical FOV on windows taller than 16:9, so 3D stays locked to the rem grid.
- The bottom-left caption occupies roughly x 10–56rem, y 78–100rem. The progress chain occupies roughly x 70–180rem, y ≈ 96rem. The running head is at the top right.
- Pins: `pins.add(id, {anchor:()=>Vector3 world, html, cls, align:'center'|'left'|'right'|'above'|'below', dx, dy})`. `align:'left'` means the label's left edge touches the point. Show or hide with `pins.show(ids,on,delay,stagger)` and `pins.hide(prefix)`.
- Notes (leader lines): `notes.add(id,{anchor, html, at:[xRem,yRem], tone})`.
- Scripts that regenerate data (UniProt/PDB conversion) are not in the repo, and the data JSONs are final. If you need a new PDB structure, write a small converter to the same JSON shape (see `src/data/molecules.ts`).
