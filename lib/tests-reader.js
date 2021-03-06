'use strict';

var pathUtils = require('./path-utils'),
    logger = require('./utils').logger,
    chalk = require('chalk'),
    _ = require('lodash'),
    q = require('q'),
    format = require('util').format;

module.exports = function(testPaths, browsers, config) {
    var specs = config.specs,
        configBrowsers = _.keys(config.browsers);

    validateUnknownBrowsers(getBrowsersFromSpecs(specs), browsers, configBrowsers);

    return q.all([
            expandSpecs(specs, configBrowsers),
            pathUtils.expandPaths(testPaths)
        ])
        .spread(function(specs, testFiles) {
            return filterSpecs(specs, testFiles, browsers);
        })
        .then(assignBrowsersToTestFiles);
};

function validateUnknownBrowsers(specsBrowsers, cliBrowsers, configBrowsers) {
    var unknownBrowsers = getUnknownBrowsers_();

    if (_.isEmpty(unknownBrowsers)) {
        return;
    }

    logger.warn(format(
        '%s Unknown browsers id: %s. Use one of the browser ids specified in config file: %s',
        chalk.yellow('WARNING:'), unknownBrowsers.join(', '), configBrowsers.join(', ')
    ));

    function getUnknownBrowsers_() {
        return _(specsBrowsers)
            .concat(cliBrowsers)
            .compact()
            .uniq()
            .difference(configBrowsers)
            .value();
    }
}

function expandSpecs(specs, configBrowsers) {
    return _(specs)
        .map(revealSpec_)
        .thru(q.all)
        .value();

    function revealSpec_(spec) {
        if (!_.isString(spec) && !_.isPlainObject(spec)) {
            throw new TypeError('config.specs must be an array of strings or/and plain objects');
        }

        var paths = _.isString(spec) ? [spec] : spec.files;

        return pathUtils.expandPaths(paths)
            .then(function(files) {
                return {
                    files: files,
                    browsers: spec.browsers ? _.intersection(spec.browsers, configBrowsers) : configBrowsers
                };
            });
    }
}

function filterSpecs(specs, testFiles, browsers) {
    return specs.map(function(spec) {
        return {
            files: filterSpec_(spec.files, testFiles),
            browsers: filterSpec_(spec.browsers, browsers)
        };
    });

    function filterSpec_(specValue, value) {
        return _.isEmpty(value) ? specValue : _.intersection(specValue, value);
    }
}

function assignBrowsersToTestFiles(specs) {
    var browsers = getBrowsersFromSpecs(specs);

    return _(browsers)
        .map(getTestFilesForBrowser_)
        .thru(_.zipObject.bind(null, browsers))
        .omit(_.isEmpty)
        .value();

    function getTestFilesForBrowser_(browser) {
        return _(specs)
            .filter(function(spec) {
                return _.contains(spec.browsers, browser);
            })
            .thru(getFilesFromSpecs)
            .value();
    }
}

function getFilesFromSpecs(specs) {
    return getDataFromSpecs(specs, 'files');
}

function getBrowsersFromSpecs(specs) {
    return getDataFromSpecs(specs, 'browsers');
}

function getDataFromSpecs(specs, prop) {
    return _(specs)
        .map(prop)
        .flatten()
        .uniq()
        .value();
}
