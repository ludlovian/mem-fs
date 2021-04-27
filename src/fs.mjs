import { constants, Stats, ReadStream, WriteStream } from 'fs'

import Filesystem from './filesystem.mjs'
import File from './file.mjs'
import { errorContext } from './errors.mjs'

export default class MemFS {
  constructor () {
    const fs = new Filesystem()

    this.constants = constants
    this.Stats = Stats
    this.ReadStream = ReadStream
    this.WriteStream = WriteStream

    // normal 'fs' methods
    //
    for (const name of fsMethods) {
      this[name + 'Sync'] = makeMethod(fs, name)
    }

    // methods that take an fd
    for (const name of fdMethods) {
      this[name + 'Sync'] = makeFdMethod(fs, name)
    }

    // exceptions
    //
    // open - return the fd, not the filehandle
    this.openSync = (...args) => fs.open(...args).fd

    for (const name of Object.keys(this)) {
      if (!name.endsWith('Sync')) continue
      this[name.replace(/Sync$/, '')] = makeAsync(this[name])
    }

    // async exceptions
    //
    // exists - uses cb(result) not cb(err, result)
    this.exists = (...args) => {
      const cb = getCallback(args)
      exec(() => this.existsSync(...args)).then(cb)
    }
    // read - cb(err, bytes, buffer)
    this.read = (...args) => {
      const cb = getCallback(args)
      const buffer = args[1]
      exec(() => this.readSync(...args)).then(
        res => cb(null, res, buffer),
        err => cb(err)
      )
    }
    // write - cb(err , bytes, buffer)
    this.write = (...args) => {
      const cb = getCallback(args)
      const buffer = args[1]
      exec(() => this.writeSync(...args)).then(
        res => cb(null, res, buffer),
        err => cb(err)
      )
    }

    // make 'em all hidden for cosmetic reasons
    Object.defineProperties(
      this,
      Object.entries(this).reduce((obj, [name, value]) => {
        obj[name] = {
          configurable: true,
          enumerable: false,
          writable: true,
          value
        }
        return obj
      }, {})
    )
  }
}

const fdMethods = [
  'read',
  'write',
  'close',
  'fstat',
  'fchmod',
  'fchown',
  'fsync',
  'fdatasync',
  'ftruncate',
  'futimes'
]

const fsMethods = [
  'mkdir',
  'stat',
  'lstat',
  'rmdir',
  'chmod',
  'lchmod',
  'chown',
  'lchown',
  'symlink',
  'link',
  'rename',
  'unlink',
  'truncate',
  'utimes',
  'lutimes',
  'readlink',
  'realpath',
  'readdir',
  'access',
  'exists',
  'appendFile',
  'readFile',
  'writeFile',
  'copyFile'
]

function makeMethod (fs, name) {
  return (...args) => {
    errorContext.set(name, args[0])
    return fs[name](...args)
  }
}

function makeFdMethod (fs, name) {
  const methName = name.replace(/^f/, '')
  return (fd, ...args) => {
    errorContext.set(name, fd)
    return File.get(fd)[methName](...args)
  }
}

function makeAsync (fn) {
  return (...args) => {
    const cb = getCallback(args)
    exec(() => fn(...args)).then(
      result => cb(null, result),
      error => cb(error)
    )
  }
}

function exec (fn) {
  return new Promise(resolve => resolve(fn()))
}

function getCallback (args) {
  while (args.length) {
    const cb = args.pop()
    if (typeof cb === 'function') return cb
  }
  throw new Error('No callback supplied')
}
