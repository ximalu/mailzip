"use strict";

/**
 * Safe replacement for the npm "setimmediate" package, which JSZip depends on.
 *
 * IMPORTANT: JSZip requires this package for its SIDE EFFECT — the original
 * package installs `setImmediate` as a GLOBAL, and JSZip's delay() calls the
 * bare global `setImmediate(...)` afterwards. The original polyfill contains
 * `new Function`, which trips the AMO validator's DANGEROUS_EVAL check, so we
 * install a setTimeout-based global instead (no eval, same semantics).
 */
function setImmediateShim(callback) {
  var args = Array.prototype.slice.call(arguments, 1);
  return setTimeout(function () {
    callback.apply(undefined, args);
  }, 0);
}

module.exports = setImmediateShim;

if (
  typeof globalThis !== "undefined" &&
  typeof globalThis.setImmediate === "undefined"
) {
  globalThis.setImmediate = setImmediateShim;
}
