# NOTICE

This cartridge redistributes four works that are not ours. Each line below is a
licence condition, not a courtesy.

## Viewer code — MIT

Human Atlas, Copyright (c) 2026 ashemag. https://github.com/ashemag/human-atlas

The MIT licence text is preserved verbatim in `LICENSE.human-atlas`, and the
copyright line is carried in `LICENSE` alongside ours. The 3D scene, geometry
batching, exploded layout, system layers, search and styling are from that
project.

## Male anatomy — CC BY 4.0

> BodyParts3D, © The Database Center for Life Science licensed under
> CC Attribution 4.0 International.

- Licence: https://creativecommons.org/licenses/by/4.0/
- Verified at source: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html
- Dataset: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- Publication: https://doi.org/10.1093/nar/gkn613

⚠️ The OBJ files in the original archive carry a legacy **CC BY-SA 2.1 Japan**
comment in their headers. The database's current published licence (linked
above) is CC BY 4.0 and supersedes it. Anyone reading the raw archive will reach
the opposite conclusion, which is why this is written down.

## Female anatomy — CC BY 4.0

> Kristen Browne; Heidi Schlehlein. 2023. *3D Reference Organ Set for Female,
> v1.5.* https://doi.org/10.48539/HBM352.BTSQ.586

- Licence: https://creativecommons.org/licenses/by/4.0/
- Verified at source (HRA digital-object metadata, publisher HuBMAP):
  https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.5/metadata.json
- The `humanatlas.io` and `purl.humanatlas.io` landing URLs return 404 to a
  browser; the metadata JSON above is what actually carries the licence field.

Both attributions are rendered in the app's "Source & credits" panel, and both
are shown whichever body is selected — the cartridge distributes both datasets,
so both credits are owed regardless of what is on screen.

## What was changed

| Change | Why |
|---|---|
| `base: './'` and `assetUrl()` on the two runtime fetches | An installed cartridge is served from `mnemo-plugin://app/<id>/`, where a root-absolute asset URL matches no plugin id and 404s. |
| Only the `.bin.gz` chunks ship | `decodeModelResponse` sniffs the gzip magic number and decompresses in-browser when the server sets no `Content-Encoding`, which is our case. Halves the install. |
| `vinext` / RSC / Cloudflare / wrangler dropped | `web/main.tsx` is a three-line client root; none of it was load-bearing. |
| One dead local removed in `scene.tsx` | `const aspect=camera.aspect` was never read; our `noUnusedLocals` is stricter. |
| Explode slider made visible | Upstream issue #174. The shadcn slider expects `data-horizontal`; the pinned base-ui 1.7 emits `data-orientation="horizontal"`, so the Tailwind variant never matched and the track rendered at zero height (measured 351x0). Styled on the attribute base-ui actually sets. |
| Explode slider thumb made to appear at all | Second half of the same control, and a different mechanism. `thumbAlignment="edge"` makes base-ui hide the thumb (`visibility:hidden`, inline) until it has divided the thumb's offset by the control's width. A cartridge is an iframe that mounts before it has a width, so that division is not finite, the position stays undefined, and the ResizeObserver meant to catch up never fires — measured: laid out at 325px with the thumb still hidden three seconds after the frame was sized. Clicking the track re-runs the measurement, which is why the thumb "comes back". Dropped the edge alignment: the position then comes from the value alone, and there is nothing left to measure. |
| Search panel decoupled from the combobox | Pressing the input reads as an `outside-press` for the popup, and the panel closed on any close reason — so it tore itself down the moment anyone clicked to type. Now only Escape, its X, or a real click outside dismisses it. |
| Female body restored | Present in upstream's git history (`e6743fa`), removed at publication (`264faee`). Different dataset, its own licence, credited above. |
| `pregnancy` added to `SYSTEMS` | The female atlas uses that system id. `scene.tsx` builds its material map by mapping `SYSTEMS`, so an unknown id leaves 8 meshes with no material. It is deliberately absent from `DEFAULT_VISIBLE`. |
| Added: `src/mnemo/AtlasMemory.tsx` | The only new surface — asks the user's own memory about the selected structure. |
| Added: `src/mnemo/review.ts` + `levels.ts` + `session.ts` + `ReviewPanel.tsx` | Spaced-repetition review, with one level per system derived from the loaded atlas. Cards are filed against the FMA id, which is stable across languages, spellings and datasets. The schedule lives in the host-side state mirror; a session is written to the cartridge's own vault as one chronicle, on a gesture. |
| `pregnancy` kept out of `DEFAULT_VISIBLE`, body surface switched on when muscle coverage is under 5% | Two defaults derived from what an atlas actually contains, measured: male 18% muscular, female 1.8%. |

## Structure names in other languages — CC0, and not certified

Names outside English come from **Wikidata**, joined on the ontology identifiers
the atlases already carry: `P1402` for FMA and `P1554` for UBERON. Wikidata is
CC0; no attribution is required, and it is credited here because knowing where a
medical term came from is part of judging it.

⚠️ **They are not reviewed by anatomists.** Wikidata renders `thorax` as
`torse` in French, which is a different structure. The app shows a notice
before anything can be studied in a translated language, names English as the
reference, and says how many structures the language actually covers.

Coverage measured on the full corpus, 2026-09-09: **French 1,381 / 3,432**,
**Spanish 851 / 3,432**. Since 2026-10-03 the male corpus is 3,486 concepts and
the 54 nerve names are added by hand: French 1,435, Spanish 905.
Female concepts that carry exactly the English name of a male one borrow its
label (`scripts/borrow-female-names.mjs`, no ambiguous borrow possible): 144 in
French, 123 in Spanish. The other female names stay English rather than be
translated by a machine.

The female body is partly covered, which is not obvious and was nearly missed:
its CONCEPTS are `HRA:VH_F_*` and carry no ontology id at all, but 266 of its
parts carry an FMA id and 256 an UBERON one, and the detail sheet shows a part
id whenever a mesh is clicked. Reading only the concept list left that whole
body in English for no reason. 150 of its 1,581 ids now resolve in French.

⛔ Its remaining concepts are deliberately left untranslated. Borrowing the id of
a concept's first mesh was measured and refused: `VH F`, `integumentary system`
and `skin of body` all came back as "peau humaine", so a quiz would offer the
same answer three times, which is worse than English. A strict rule (one mesh
only, an ontology id claimed by no other concept) is sound and yields no
duplicates, but covers 89 structures of 1,073.

🚨 A question never mixes two languages. The quiz asks only about structures
that have a name in the current language, and the tiles count that pool — so
the number on screen is the number that will be asked. Regenerate with
`node scripts/fetch-names.mjs`.

## Peripheral nerves — CC BY-SA 4.0

The 54 peripheral nerves of the male body (sciatic, median, ulnar, radial,
brachial plexus, trigeminal branches, facial nerve…) come from Z-Anatomy.

> "Z-Anatomy" – CC-BY-SA 4.0. https://www.z-anatomy.com ·
> https://github.com/LluisV/Z-Anatomy

- Licence: https://creativecommons.org/licenses/by-sa/4.0/
- Verified at source: the `LICENSE` and README of `LluisV/Z-Anatomy`, and the
  project's licence document (linked from that `LICENSE`), read 2026-10-03.
- Z-Anatomy asks that derived human-model content credit, in its own words:
  "BodyParts3D" – The Database Center for Life Science – CC-BY 4.0;
  "Z-Anatomy" – CC-BY-SA 4.0; and its reference models: "Brainder" and
  "White matter" – University of Washington; "Cranial Nerves and Foramina" –
  University of Dundee, CAHID – CC-BY 4.0. (Its list also names an inner-ear
  and a kidney reference under non-commercial licences; no inner-ear or kidney
  geometry is used here, only nerves.)
- Authors of the 3D models, per the same document: Kousaku Okubo, Gauthier
  Kervyn, Colline Brassard, Christophe Céleste.
- Adaptation, by Rayzi0417 in upstream human-atlas #283: nerve curves resampled
  with Catmull-Rom splines, registered onto the BodyParts3D frame by a
  similarity solve on six landmark bones, swept into tube meshes. Pipeline in
  `scripts/peripheral-nerves/` (never run here: it needs Blender and the
  Z-Anatomy `.blend`).

🚨 **Share-alike scope.** Covered by CC BY-SA 4.0: `public/models/nerves-0.bin.gz`
AND the 54 `ZN*` part and concept entries in `public/models/atlas.json`. Anyone
may reuse them, commercially too, as long as they stay under CC BY-SA 4.0.
Everything else in this cartridge keeps its own licence.

⚠️ Z-Anatomy's licence document adds a reading of its own: "the integration of
(a part of) the model inside an app made to read it requires sharing the code
of this app". This cartridge's code is public under MIT
(https://github.com/Mnemosyne-OS/MnemoAtlas). Whether that reading reaches the
host application that loads the cartridge is a question for a decision, not
for this file.

The nerves exist for the male body only. They have no ontology id, so
Wikidata cannot name them: their French and Spanish names (27 nerves, left and
right) are written by hand in `scripts/curated-names.json`, which
`fetch-names.mjs` merges over its output so a regeneration keeps them.

## Fixes drawn from upstream pull requests

These were proposed to Human Atlas and left unmerged there. Each was rewritten
for this cartridge rather than applied as a patch; the idea and the credit are
theirs. Upstream contributions are MIT, like the rest of the viewer code.

- #176, Oğuz Gençer (drader): the wheel zooms toward the pointer.
- #214 and #216, Oğuz Gençer (drader): the camera no longer jumps while the
  body opens, and gets its view back when it closes.
- #421, PHPLego (phplego): hide one structure and bring it back.
- #429, rajasekhar (rajasekharponakala): searching « lung » finds the organ's
  bronchial and pulmonary pieces.
- #435, Cocoon-Break (kuishou68): the iliotibial tracts are connective tissue.
- #283, Rayzi0417: the 54 peripheral nerves (data taken as is, see above).
- #1, Steven Frohlich (StevenRonnyFrohlich): body regions and study areas.
- #434 and #234 (Sagar Dixit, Akshat Srivastava) both asked for a dark theme. Not
  their code: here the atlas follows the app's theme instead of adding its own toggle.
- #5, Carson Rodrigues (rodriguescarson): guided visits. Their stops, plus the male
  reproductive tract, the female heart and gut stops, and a camera that frames the organ.
- Issue #430 asked for the three sensory zones of the trigeminal nerve. The zones
  are not drawn; a visit shows the three branches and each stop names its zone.
- #236 / #237, CYU (calvinyu94-debug): fascial lines. Not their code or data: four
  lines rebuilt here as visits from the muscles this atlas has, after Thomas Myers'
  model, presented as a model that anatomists still debate.
  The areas here also catch the nerves, and only what a body has is offered.

#174 (the explode slider's missing track) had already been fixed here.
