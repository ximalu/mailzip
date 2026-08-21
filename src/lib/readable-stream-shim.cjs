"use strict";

/**
 * Empty shim for the "readable-stream" / "stream" packages.
 *
 * JSZip only uses readable-stream for Node.js stream feature detection
 * (support.nodestream = !!require("readable-stream").Readable) and in its
 * Node-only stream adapters. A Thunderbird extension has no Node stream
 * support, so exporting undefined makes nodestream evaluate to false and
 * JSZip falls back to its browser code paths.
 */
module.exports = {
  Readable: undefined,
  Writable: undefined,
  Duplex: undefined,
  Transform: undefined,
};
