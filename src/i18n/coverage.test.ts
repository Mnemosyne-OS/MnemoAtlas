/**
 * Which keys each language actually carries.
 *
 * A missing key falls back to English and renders a perfectly good English
 * sentence in the middle of a French screen. Nothing throws, nothing turns
 * red, and the only person who can see it is a reader of that language — who
 * is usually not on the team. So the coverage is measured here, and the
 * measurement is printed rather than merely asserted: a language at 96% is a
 * fact somebody should decide about, not a build failure.
 */
import { describe, it, expect } from 'vitest';
import { LANGS, translate, type Key } from './strings';

/**
 * The English table is the source of truth. Reaching it requires translating
 * a key and comparing, which is exactly what a caller does — no private
 * export, no second list to keep in sync.
 */
function keysOf(): Key[] {
  // Every key used anywhere in the cartridge. Kept as a literal list on
  // purpose: a key nobody renders is a key nobody has to translate, and this
  // is the only place that difference is visible.
  return [
    'app.eyebrow', 'app.pieces', 'app.body.male', 'app.body.female', 'app.body.group',
    'app.caption.male', 'app.caption.female',
    'review.title', 'review.open', 'review.close', 'review.back', 'review.pick',
    'review.studied', 'review.due', 'review.mastered', 'review.best', 'review.mastered.of',
    'review.howMany', 'review.endless', 'review.scope', 'review.question', 'review.answerIs',
    'review.next', 'review.lookAt', 'review.finishHere', 'review.again', 'review.another',
    'review.comeBack', 'review.andMore', 'review.accuracy', 'review.time', 'review.record',
    'review.save', 'review.saving', 'review.retry', 'review.saved', 'review.savedLocked',
    'review.notWritten', 'review.why.noHost', 'review.why.noPermission', 'review.why.declined',
    'review.noHost', 'review.noLoad', 'review.tight', 'review.tooSmall', 'review.empty',
    'review.noQuestion',
    'rank.perfect', 'rank.excellent', 'rank.solid', 'rank.getting', 'rank.again',
    'memory.title', 'memory.ask', 'memory.note', 'memory.reading', 'memory.askAgain',
    'memory.nothing', 'memory.outside', 'memory.failed', 'memory.tryAgain',
    'system.skeletal', 'system.muscular', 'system.cardiac', 'system.sensory', 'system.arterial',
    'system.venous', 'system.nervous', 'system.respiratory', 'system.digestive', 'system.urinary',
    'system.lymphatic', 'system.endocrine', 'system.reproductive', 'system.integumentary',
    'system.connective', 'system.pregnancy',
    'sys.skeletal', 'sys.muscular', 'sys.cardiac', 'sys.sensory', 'sys.arterial', 'sys.venous',
    'sys.nervous', 'sys.respiratory', 'sys.digestive', 'sys.urinary', 'sys.lymphatic',
    'sys.endocrine', 'sys.reproductive', 'sys.integumentary', 'sys.connective', 'sys.pregnancy',
    'org.heart', 'org.liver', 'org.brain', 'org.stomach', 'org.spleen', 'org.pancreas',
    'org.bladder', 'org.trachea', 'org.diaphragm', 'org.lungLeft', 'org.lungRight',
    'ui.title', 'ui.find', 'ui.systems', 'ui.all', 'ui.skeletonPreset', 'ui.organsPreset',
    'ui.hideAll', 'ui.visible', 'ui.noMatch', 'ui.explode', 'ui.assembled', 'ui.everyPiece',
    'ui.reset', 'ui.credits', 'ui.preparing', 'ui.loading', 'ui.reload', 'ui.contextNote',
    'ui.atlasRef', 'ui.selectedPieces', 'ui.included', 'ui.andMorePieces', 'ui.viewSource',
    'ui.isolate', 'ui.showAround', 'ui.clear', 'ui.hideStructure', 'ui.restoreHidden', 'tour.group.organ', 'tour.group.nerve', 'tour.group.line', 'tour.lineNote', 'tour.name.trigeminal', 'tour.summary.trigeminal', 'tour.name.lineBack', 'tour.summary.lineBack', 'tour.name.lineFront', 'tour.summary.lineFront', 'tour.name.lineLateral', 'tour.summary.lineLateral', 'tour.name.lineDeep', 'tour.summary.lineDeep', 'org.trigeminal', 'org.ophthalmicNerve', 'org.maxillaryNerve', 'org.mandibularNerve', 'station.trigeminal.all', 'station.trigeminal.all.text', 'station.lineBack.sole', 'station.lineBack.sole.text', 'station.lineBack.calf', 'station.lineBack.calf.text', 'station.lineBack.hamstrings', 'station.lineBack.hamstrings.text', 'station.lineBack.spine', 'station.lineBack.spine.text', 'station.lineBack.all', 'station.lineBack.all.text', 'station.lineFront.shin', 'station.lineFront.shin.text', 'station.lineFront.thigh', 'station.lineFront.thigh.text', 'station.lineFront.neck', 'station.lineFront.neck.text', 'station.lineFront.all', 'station.lineFront.all.text', 'station.lineLateral.fibular', 'station.lineLateral.fibular.text', 'station.lineLateral.hip', 'station.lineLateral.hip.text', 'station.lineLateral.flank', 'station.lineLateral.flank.text', 'station.lineLateral.neck', 'station.lineLateral.neck.text', 'station.lineLateral.all', 'station.lineLateral.all.text', 'station.lineDeep.deepCalf', 'station.lineDeep.deepCalf.text', 'station.lineDeep.knee', 'station.lineDeep.knee.text', 'station.lineDeep.adductors', 'station.lineDeep.adductors.text', 'station.lineDeep.psoas', 'station.lineDeep.psoas.text', 'station.lineDeep.diaphragm', 'station.lineDeep.diaphragm.text', 'station.lineDeep.neck', 'station.lineDeep.neck.text', 'station.lineDeep.all', 'station.lineDeep.all.text', 'caption.selected', 'caption.inventory', 'caption.separated', 'tour.title', 'tour.open', 'tour.close', 'tour.pick', 'tour.stops', 'tour.prev', 'tour.next', 'tour.exit', 'tour.position', 'tour.name.heart', 'tour.name.respiratory', 'tour.name.digestive', 'tour.name.urinary', 'tour.name.reproductive', 'tour.summary.heart', 'tour.summary.respiratory', 'tour.summary.digestive', 'tour.summary.urinary', 'tour.summary.reproductive', 'org.rightAtrium', 'org.tricuspid', 'org.rightVentricle', 'org.pulmonaryValve', 'org.leftAtrium', 'org.mitral', 'org.leftVentricle', 'org.aorticValve', 'org.bronchus', 'org.lungs', 'org.esophagus', 'org.duodenum', 'org.smallIntestine', 'org.largeIntestine', 'org.cecum', 'org.rectum', 'org.gallbladder', 'org.kidney', 'org.ureter', 'org.urethra', 'org.testis', 'org.epididymis', 'org.deferentDuct', 'org.seminalVesicle', 'org.prostate', 'org.corpusCavernosum', 'org.ovary', 'org.fallopianTube', 'org.uterus', 'org.vagina', 'ui.regions', 'ui.areas', 'ui.wholeBody', 'region.head-neck', 'region.torso', 'region.abdomen', 'region.arm', 'region.pelvis', 'region.legs', 'area.orbit', 'area.willis', 'area.brainstem', 'area.larynx', 'area.heart', 'area.lung-root', 'area.porta', 'area.celiac', 'area.kidneys', 'area.brachial-plexus', 'area.axilla', 'area.cubital', 'area.wrist', 'area.hand', 'area.pelvic-viscera', 'area.popliteal', 'area.foot', 'ui.hintOrbit', 'ui.hintPan', 'ui.hintZoom',
    'ui.hintTap', 'ui.searchPlaceholder', 'ui.searchHintEmpty', 'ui.searchHintTyping',
    'ui.piece', 'ui.pieces',
    'a11y.panels', 'a11y.search', 'a11y.about', 'a11y.layers', 'a11y.closeSystems',
    'a11y.findAnatomy', 'a11y.closeSearch', 'a11y.searchInput', 'a11y.camera', 'a11y.autoRotate',
    'a11y.resetAll', 'a11y.openLayers', 'a11y.assembleReset', 'a11y.showOnly', 'a11y.show',
    'a11y.view', 'a11y.pause', 'a11y.rotate',
    'about.eyebrow', 'about.title', 'about.leadMale', 'about.leadFemale', 'about.headMale',
    'about.headFemale', 'about.bodyMale', 'about.bodyFemale', 'about.incomplete',
    'about.disclaimer', 'about.source', 'about.femaleRef', 'about.nervesRef', 'about.nervesLicense', 'about.datasetLicense',
    'about.originalGeometry', 'about.publication', 'about.femaleDoi',
    'names.title', 'names.body', 'names.pool', 'names.help', 'names.ok', 'names.loading',
    'level.all',
    'gest.open', 'gest.title', 'gest.lead', 'gest.asking', 'gest.granted', 'gest.refused', 'gest.speeds', 'gest.speed.orbit', 'gest.speed.depth', 'gest.speed.explode', 'gest.reset', 'gest.loading', 'gest.unsaved', 'gest.inAtlas', 'gest.orbit', 'gest.orbitFlat', 'gest.depth', 'gest.explode', 'gest.recenter', 'gest.select', 'gest.action', 'gest.os', 'gest.osFull', 'gest.osClose', 'gest.osWindow',
  ];
}

describe('language coverage', () => {
  it('every key resolves to something in every language', () => {
    // The floor: no key ever renders as its own name. English fallback makes
    // this true by construction, and the test exists so that stops being an
    // assumption.
    for (const lang of LANGS) {
      for (const key of keysOf()) {
        const s = translate(lang, key);
        expect(s, `${lang} / ${key}`).toBeTruthy();
        expect(s, `${lang} / ${key} rendered its own key`).not.toBe(key);
      }
    }
  });

  it('French and Spanish are complete, and says so if they stop being', () => {
    // These two are the shipped languages. A key added in English and
    // forgotten here would read as an English sentence inside a French panel,
    // which nobody on this team can see.
    const keys = keysOf();
    for (const lang of ['fr', 'es'] as const) {
      const untranslated = keys.filter((k) => translate(lang, k) === translate('en', k));
      // Some are legitimately identical across languages — proper nouns and
      // the dataset names. Anything else is a gap.
      // Legitimately identical: proper nouns, dataset names, and words that
      // are simply the same in the target language. Listing them here is what
      // keeps a REAL gap from hiding among them.
      const expected = new Set<string>([
        'about.headMale', 'about.headFemale', 'about.source', 'ui.reset',
        'rank.excellent',      // "Excellent" in English, French and Spanish
        'system.muscular',     // "Muscles" in English and French
        'region.abdomen',      // "Abdomen" in English, French and Spanish
        'area.larynx',         // "Larynx" in English and French
        'tour.name.digestive', // "Digestion" in English and French
      ]);
      const gaps = untranslated.filter((k) => !expected.has(k));
      expect(gaps, `${lang} is missing ${gaps.length} keys`).toEqual([]);
    }
  });
});
