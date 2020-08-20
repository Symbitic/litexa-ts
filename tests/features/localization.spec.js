/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import assert from 'assert';
import preamble from '../preamble';

describe('supports languages folder overrides', () => {
  function testCompleteSlotValuesForIntent(actualSlots, expectedSlots) {
    for (let slotValue of actualSlots.values) {
      assert(expectedSlots.includes(slotValue.name.value));
      expectedSlots.splice(expectedSlots.indexOf(slotValue.name.value), 1);
    }
    assert(expectedSlots.length === 0);
  };

  it('runs the localization integration test', () => {
    return preamble.runSkill('localization')
  });

  it('builds model with overridden slots correctly', async () => {
    const enUSModel = await preamble.buildSkillModel('localization', 'en-US');
    const usCatBreeds = enUSModel.languageModel.types[0];
    let expectedUsCatBreeds = [ 'american shorthair', 'american curl', 'maine coon' ];
    testCompleteSlotValuesForIntent(usCatBreeds, expectedUsCatBreeds);

    const enGBModel = await preamble.buildSkillModel('localization', 'en-GB');
    const ukCatBreeds = enGBModel.languageModel.types[0];
    const expectedUkCatBreeds = [ 'british shorthair', 'british longhair', 'scottish fold' ];
    testCompleteSlotValuesForIntent(ukCatBreeds, expectedUkCatBreeds);

    const frModel = await preamble.buildSkillModel('localization', 'fr');
    const frCatBreeds = frModel.languageModel.types[0];
    expectedUsCatBreeds = [ 'american shorthair', 'american curl', 'maine coon' ];
    testCompleteSlotValuesForIntent(frCatBreeds, expectedUsCatBreeds);
  });

  it('eliminates intent handlers that do not exist in the overridden state', async () => {
    const frModel = await preamble.buildSkillModel('localization', 'fr');
    const intents = frModel.languageModel.intents.map(intent => intent.name);
    // TODO ???
    !intents.includes('CAT');
  });

  it('includes intents defined in multi-intent handlers from default language', async () => {
    const frModel = await preamble.buildSkillModel('localization', 'fr');
    const intents = frModel.languageModel.intents.map(intent => intent.name);
    assert(intents.includes('AMAZON.HelpIntent'));
  });
});
