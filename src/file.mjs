import { constants as C } from 'fs'

import validate from 'aproba'

import Node from './node.mjs'
import { fds } from './id.mjs'
import { makeError } from './errors.mjs'

export const DEFAULT_FILE_MODE = 0o666 & ~process.umask()

export default class File extends Node {
  constructor (mode = DEFAULT_FILE_MODE) {
    validate('N|Z|', arguments)

    super((mode & 0o777) | C.S_IFREG)
    this.data = Buffer.allocUnsafe(0)
  }

  get size () {
    return this.data.length
  }

  truncate (size = 0) {
    validate('N|', arguments)

    if (size <= this.size) {
      this.data = this.data.slice(0, size)
    } else {
      this.data = Buffer.concat([this.data, Buffer.alloc(size - this.size)])
    }
    this.mtouch()
  }

  open (flags) {
    validate('N', arguments)

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
    validate('S|O', [buffer])

    let offset
    let length
    let position
    let encoding
    if (typeof buffer === 'string') {
      validate('|N|NS', args)
      ;[position, encoding = 'utf8'] = args
      buffer = Buffer.from(buffer, encoding)
      length = buffer.length
      offset = 0
    } else {
      validate('|N|NN|NNN', args)
      ;[offset, length, position] = args
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
    validate('ONNN|ONNZ|ONN', arguments)
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
    validate('O|S', [data])
    validate('O|S', [options])

    if (typeof options === 'string') options = { encoding: options }
    const { encoding = 'utf8' } = options
    if (typeof data === 'string') data = Buffer.from(data, encoding)
    this.write(data, 0, data.length, this.file.size)
  }

  readFile (options = {}) {
    validate('O|S|', arguments)

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
