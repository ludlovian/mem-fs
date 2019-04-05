'use strict'

import Node from './node'
import { fds } from './id'
import { constants as C } from 'fs'
import { makeError } from './errors'
import ow from 'ow'

export const DEFAULT_FILE_MODE = 0o666 & ~process.umask()

export default class File extends Node {
  constructor (mode = DEFAULT_FILE_MODE) {
    ow(mode, ow.number.integer)

    super((mode & 0o777) | C.S_IFREG)
    this.data = Buffer.allocUnsafe(0)
  }

  get size () {
    return this.data.length
  }

  truncate (size = 0) {
    ow(size, ow.number.integer)

    if (size <= this.size) {
      this.data = this.data.slice(0, size)
    } else {
      this.data = Buffer.concat([this.data, Buffer.alloc(size - this.size)])
    }
    this.mtouch()
  }

  open (flags) {
    ow(flags, ow.number.integer)
    if ((flags & 3) === C.O_RDONLY) {
      this.ensureReadAccess()
    } else if ((flags & 3) === C.O_WRONLY) {
      this.ensureWriteAccess()
    } else {
      this.ensureReadAccess()
      this.ensureWriteAccess()
    }
    return new Filehandle(this, flags)
  }

  static get (fd) {
    const fh = fds.get(fd)
    if (!fh) throw makeError('EBADF')
    return fh
  }
}

class Filehandle {
  constructor (file, flags) {
    this.file = file
    this._flags = flags
    this.fd = fds.allocate(this)
    if ((this._flags & C.O_TRUNC) !== 0) this.file.truncate(0)
    this._pos = (this._flags & C.O_APPEND) !== 0 ? this.file.size : 0
  }

  close () {
    fds.release(this.fd)
    this.file = this.fd = null
  }

  _setPos (pos) {
    this._pos = minmax(pos, 0, this.file.size)
  }

  _ensureReadble () {
    if ((this._flags & 3) === C.O_WRONLY) throw makeError('EACCES')
  }

  _ensureWritable () {
    if ((this._flags & 3) === C.O_RDONLY) throw makeError('EACCES')
  }

  write (buffer, ...args) {
    ow(buffer, 'stringOrBuffer', ow.any(ow.buffer, ow.string))
    let offset
    let length
    let position
    let encoding
    if (typeof buffer === 'string') {
      ;[position, encoding = 'utf8'] = args
      ow(position, 'position', ow.optional.number.integer)
      ow(encoding, 'encoding', ow.string.nonEmpty)
      buffer = Buffer.from(buffer, encoding)
      length = buffer.length
      offset = 0
    } else {
      ;[offset, length, position] = args
      ow(offset, 'offset', ow.optional.number.integer)
      ow(length, 'length', ow.optional.number.integer)
      ow(position, 'position', ow.optional.number.integer)
      if (offset == null) offset = 0
      if (length == null) length = buffer.length - offset
    }

    this._ensureWritable()
    if (position != null) this._setPos(position)
    const newPos = this._pos + length
    const preData = this.file.data.slice(0, this._pos)
    const newData = buffer.slice(offset, length + offset)
    const postData = this.file.data.slice(newPos, this.file.size)
    this.file.data = Buffer.concat([preData, newData, postData])
    this.file.mtouch()
    this._setPos(newPos)
    return length
  }

  read (buffer, offset, length, position) {
    ow(buffer, 'buffer', ow.buffer)
    ow(offset, 'offset', ow.number.integer)
    ow(length, 'length', ow.number.integer)
    ow(position, 'position', ow.optional.number.integer)
    this._ensureReadble()
    const start =
      position == null ? this._pos : minmax(position, 0, this.file.size)
    const end = minmax(start + length, 0, this.file.size)
    const nbytes = this.file.data.copy(buffer, offset, start, end)
    this.file.atouch()
    if (position == null) this._setPos(this._pos + length)
    return nbytes
  }

  appendFile (data, options = {}) {
    ow(options, 'encodingOrOptions', ow.any(ow.string.nonEmpty, ow.object))
    ow(data, 'data', ow.any(ow.buffer, ow.string))

    if (typeof options === 'string') options = { encoding: options }
    const { encoding = 'utf8' } = options
    if (typeof data === 'string') data = Buffer.from(data, encoding)
    this.write(data, 0, data.length, this.file.size)
  }

  readFile (options = {}) {
    ow(options, 'encodingOrOptions', ow.any(ow.string.nonEmpty, ow.object))
    if (typeof options === 'string') options = { encoding: options }
    const { encoding } = options
    const buffer = Buffer.alloc(this.file.size)
    this.read(buffer, 0, this.file.size, 0)
    if (encoding) return buffer.toString(encoding)
    return buffer
  }

  writeFile (data, options) {
    this.truncate()
    this.appendFile(data, options)
  }

  stat (...args) {
    return this.file.stat(...args)
  }

  chmod (...args) {
    return this.file.chmod(...args)
  }

  chown (...args) {
    return this.file.chown(...args)
  }

  sync () {}
  datasync () {}

  truncate (...args) {
    return this.file.truncate(...args)
  }

  utimes (...args) {
    return this.file.utimes(...args)
  }
}

function minmax (n, min, max) {
  return Math.max(min, Math.min(max, n))
}
