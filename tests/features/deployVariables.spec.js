/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com (http://amazon.com/), Inc. or its affiliates. All Rights Reserved.
 * These materials are licensed as "Restricted Program Materials" under the Program Materials
 * License Agreement (the "Agreement") in connection with the Amazon Alexa voice service.
 * The Agreement is available at https://developer.amazon.com/public/support/pml.html.
 * See the Agreement for the specific terms and conditions of the Agreement. Capitalized
 * terms not defined in this file have the meanings given to them in the Agreement.
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const assert = require('assert');
const preamble = require('../preamble');

describe('supports deploy variables and excluding blocks with them', () => {
  it('runs the deploy variables integration test', () => {
    return preamble.runSkill('deploy-variables');
  });

  it('builds the model taking into account postfix conditionals on intent handlers', async () => {
    const languageModel = await preamble.buildSkillModel('deploy-variables', 'default');
    const nameIsIncludedCorrectly = intent => [
      'HELLO',
      'HELLO_BOB',
      'POSITIVE_INCLUSION',
      'GO_TO_TUNNEL',
      'HELLO_UNLESS_ROGER',
      'AMAZON.StopIntent',
      'AMAZON.CancelIntent',
      'AMAZON.StartOverIntent',
      'AMAZON.NavigateHomeIntent'
    ].includes(intent.name);

    const nameIsExcludedCorrectly = intent => ![ 'HELLO_ROGER', 'NEGATIVE_INCLUSION', 'HELLO_UNLESS_BOB' ].includes(intent.name);

    assert(languageModel.languageModel.intents.every(nameIsIncludedCorrectly), 'No included intents were left out of the model');
    assert(languageModel.languageModel.intents.every(nameIsExcludedCorrectly), 'No excluded intents were in the model');
  });
});
