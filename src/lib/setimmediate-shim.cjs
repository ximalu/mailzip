"use strict";

/**
 * Safe replacement for the npm "setimmediate" package, which JSZip depends on
 * for its delay(). The original package's polyfill contains `new Function`,
 * which trips the AMO validator's DANGEROUS_EVAL check.
 *
 * setTimeout(cb, 0) is semantically equivalent for JSZip's usage (defer a
 * callback to the next tick). No eval, no MessageChannel gymnastics.
 */
module.exports = function setImmediateShim(callback) {
  var args = Array.prototype.slice.call(arguments, 1);
  return setTimeout(function () {
    callback.apply(undefined, args);
  }, 0);
};
