/**
 * MemFS
 *
 * In-memory filesystem that supplies much of the node `fs` API
 *
 * The code is structured in three layers:
 *
 * 1. Node and the classes deriving from it - Directory, File and Symlink
 *
 *    These have the basic logic and CRUD methods. They are the building blocks
 *    from which everything comes
 *
 * 2. Filesystem and Filehandle (in file.js)
 *
 *    These assemble the underlying classes into an API resembling the core
 *    `fs` methods, while still being synchronous. The `Filehandle` API
 *    resembles the Filehandle in `fs.promises`
 *
 * 3. MemFS - in fs.js
 *
 *    Follows the `fs` API with all its quirks and sync/async separation
 *
 */

import MemFS from './fs.mjs'
const fs = new MemFS()

export { fs, MemFS }
