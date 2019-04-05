'use strict'

import { constants as C } from 'fs'
import Node from './node'
import { encode } from './util'
import ow from 'ow'

const DEFAULT_FILE_MODE = 0o666 & ~process.umask()

export default class Symlink extends Node {
  constructor (target, mode = DEFAULT_FILE_MODE) {
    ow(target, ow.string.nonEmpty)
    ow(mode, ow.number.integer)

    super((mode & 0o777) | C.S_IFLNK)
    this.isRelative = target[0] !== '/'
    this._steps = target.split('/').filter(Boolean)
  }

  steps () {
    this.ensureReadAccess()
    return [...this._steps]
  }

  readlink (options = {}) {
    ow(options, 'encodingOrOptions', ow.any(ow.string, ow.object))
    if (typeof options === 'string') options = { encoding: options }
    const { encoding = 'utf8' } = options
    const target = (this.isRelative ? '' : '/') + this._steps.join('/')
    return encode(target, encoding)
  }
}
