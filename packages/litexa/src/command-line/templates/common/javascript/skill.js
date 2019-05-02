'use strict';

module.exports = {
    manifest: {
        publishingInformation: {
            isAvailableWorldwide: false,
            distributionCountries: ['US'],
            distributionMode: 'PUBLIC',
            category: 'GAMES',
            testingInstructions: 'replace with testing instructions',
            locales: {
                'en-US': {
                    name: '{name}',
                    invocation: '{invocation}',
                    summary: 'replace with brief description, no longer than 120 characters',
                    description: 'Longer description, goes to the skill store. Line breaks are supported.',
                    examplePhrases: [
                        'Alexa, launch {name}',
                        'Alexa, open {name}',
                        'Alexa, play {name}',
                    ],
                    keywords: [
                        'game',
                        'fun',
                        'single player',
                        'modify this list as appropriate'
                    ]
                }
            }
        },
        privacyAndCompliance: {
            allowsPurchases: false,
            usesPersonalInfo: false,
            isChildDirected: false,
            isExportCompliant: true,
            containsAds: false,
            locales: {
                'en-US': {
                    privacyPolicyUrl: 'http://yoursite/privacy.html',
                    termsOfUseUrl: 'http://yoursite/terms.html'
                }
            }
        }
    }
};
