import { constants as C } from 'fs'

import Node from './node.mjs'
import { encode } from './util.mjs'

const DEFAULT_FILE_MODE = 0o666 & ~process.umask()

export default class Symlink extends Node {
  constructor (target, mode = DEFAULT_FILE_MODE) {
    super((mode & 0o777) | C.S_IFLNK)
    this.isRelative = target[0] !== '/'
    this._steps = target.split('/').filter(Boolean)
  }

  steps () {
    this.ensureReadAccess()
    return [...this._steps]
  }

  readlink ({ encoding = 'utf8' }) {
    const target = (this.isRelative ? '' : '/') + this._steps.join('/')
    return encode(target, encoding)
  }
}
