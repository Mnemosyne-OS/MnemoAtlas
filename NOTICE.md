# NOTICE

This cartridge redistributes three works that are not ours. Each line below is a
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
**Spanish 851 / 3,432**.

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
