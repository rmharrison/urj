var childProcess = require('child_process'),
    async = require('async'),
    compress = require('./compress'),
    _ = require('underscore');

var execWithInheritedStdio = function (command, callback) {
    var child = childProcess.spawn(command, { shell: true, stdio: 'inherit' });

    // Guard against invoking the callback more than once.
    // https://nodejs.org/api/child_process.html#child_process_event_error
    var done = false;

    child.on('error', function (err) {
        if (! done) {
            callback(err);
            done = true;
        }
    });

    child.on('exit', function (code, signal) {
        if (! done) {
            if (code === 0) {
                callback(null);
            } else {
                callback(Error(code));
            }
            done = true;
        }
    });
};

var Publisher = function (options) {
    options = options || {};
    this.compress = options.compress === undefined ? true : options.compress;
};

Publisher.prototype.publish = function (srcPath, dstPath, doneCallback) {
    var fns = [];

    if (this.compress) {
        fns.push(_(compress).partial(srcPath));
    } else {
        fns.push(function (callback) { callback(srcPath); });
    }

    fns.push(function (tmpPath, callback) {
        var command = [
            's3 sync',
            '--guess-content-type',
            '--encoding gzip',
            '--no-encrypt',
            '--policy public-read',
            '--progress',
            tmpPath,
            dstPath,
        ].join(' ');

        execWithInheritedStdio(command, callback);
    });

    async.waterfall(fns, function (err) {
        // Discard other arguments.
        doneCallback(err);
    });
};

module.exports = Publisher;