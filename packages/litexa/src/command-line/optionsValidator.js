/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/*
 * options is the object containing the options
 * toValidate is a lift of objects with the option name to validate and a collection of valid examples
 *
 * e.g.
 * toValidate = [{
 *   name: 'myOptions'
 *   valid: ['yes', 'no']
 *   message: 'my Options has to be "yes" or "no"'
 * }]
 *
 * and returns a list of error objects with option name and error message
 * e.g.
 *
 * errors = [{
 *   name: 'myOptions'
 *   message : 'my Options has to be "yes" or "no"'
 * }]
 */
export default function optionsValidator(options, toValidate, removeInvalid) {
  if (!toValidate) {
    toValidate = [];
  }
  if (!removeInvalid) {
    removeInvalid = false;
  }
  const errors = [];
  toValidate.forEach(validate => {
    const option = options[validate.name];
    if (!option) {
      return;
    }
    if (!validate.valid.includes(option)) {
      if (removeInvalid) {
        delete options[validate.name];
      }
      errors.push({
        name: validate.name,
        message: validate.message
      });
    }
  });
  return errors;
}
