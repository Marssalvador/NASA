# AEGIS anatomy — attribution, provenance and redistribution

## Z-Anatomy-derived meshes

3D anatomy models: **Z-Anatomy — The libre 3D atlas of anatomy**, Gauthier Kervyn and contributors, derived from **BodyParts3D**, Kousaku Okubo / The Database Center for Life Science (DBCLS).

- Original atlas: https://github.com/Z-Anatomy/Models-of-human-anatomy
- Original licence and credits: https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/master/License.txt
- GLB conversion source: https://github.com/pernelluvsya/atlas-proto
- Conversion attribution: https://github.com/pernelluvsya/atlas-proto/blob/master/ATTRIBUTION.md
- Licence: **Creative Commons Attribution-ShareAlike 4.0 International** — https://creativecommons.org/licenses/by-sa/4.0/

The original Z-Anatomy credits also identify Brainder / White matter (University of Washington) and Cranial Nerves and Foramina (University of Dundee / CAHID). Their attribution is preserved in Z-Anatomy-LICENSE.txt. AEGIS uses cortical surface meshes from the atlas; it does not import Wikipedia definitions, upstream viewer code, female reproductive additions or external photographic textures.

The atlas licence explicitly lists exceptions for an inner-ear model (CC BY-NC-SA) and a kidney model (CC BY-NC). **AEGIS excludes all atlas kidney meshes and the inner-ear structures/hierarchies** from its derived GLB. Kidney geometry is independently sourced from original DBCLS data below. See anatomy-manifest.json → excluded for the actual filter log. Do not reinstate these exceptions assuming the umbrella CC BY-SA licence applies.

## Original BodyParts3D 4.0 meshes

**BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.**

- Source archive: https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_BP3D_4.0_obj_99.zip
- Element mapping: https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_element_parts.txt
- Official licence: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html (updated 2025-02-27; verified 2026-11-14)
- CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
- Selected original meshes: skin FMA7163 / FJ2810, right kidney FMA7204 / FJ3147, left kidney FMA7205 / FJ3145.

The historical Z-Anatomy attribution mentions BodyParts3D CC BY-SA 2.1 Japan; we preserve that original attribution. The independently downloaded DBCLS archive used for skin and kidneys is governed by the official current CC BY 4.0 notice above.

## AEGIS modifications

Selected anatomical structures; excluded licence exceptions and unneeded annotations; preserved original names in a manifest; consolidated meshes into independently controlled anatomical regions/tissues/zones; converted original OBJ millimetres / Z-up to metres / Y-up with a rigid offset checked against both kidney landmarks; generated smooth vertex normals for original OBJ meshes; simplified geometry; compressed using Meshopt; assigned runtime PBR materials and camera anchors.

The combined **humanoid.glb anatomy asset and AEGIS changes to its Z-Anatomy-derived meshes are distributed under CC BY-SA 4.0**. The original BodyParts3D contribution remains attributed under CC BY 4.0. This notice applies to anatomy assets; it does not purport to relicense unrelated dependencies or the entire software application. Source revisions, download hashes and derived files are recorded in source-manifest.json. Scripts are in scripts/extract_bodyparts.py and frontend/scripts/prepare-anatomy.mjs.

The reference illustrations supplied by the user are kept under references/ solely as design targets. No image has been projected onto the 3D body. No Sunra or external inference service was used.

The atlas is a generic male educational model. It is not a scan of an astronaut, patient-specific anatomy or evidence of medical validation. No anatomical displacement is inferred from physiological values.
