/**
 * source.ts — where « View anatomical source » sends a structure.
 *
 * Three datasets live in this cartridge, and the link used to send every one
 * of them to BodyParts3D: a female organ or a Z-Anatomy nerve credited the
 * wrong people. The id prefix says which dataset a concept came from.
 */
export const SOURCE_URL = {
  bodyparts3d: 'https://lifesciencedb.jp/bp3d/',
  hra: 'https://doi.org/10.48539/HBM352.BTSQ.586',
  zAnatomy: 'https://www.z-anatomy.com',
} as const;

export function sourceUrlOf(conceptId: string): string {
  if (conceptId.startsWith('ZN')) return SOURCE_URL.zAnatomy;
  if (conceptId.startsWith('HRA:')) return SOURCE_URL.hra;
  return SOURCE_URL.bodyparts3d;
}
