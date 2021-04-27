import { constants as C, Dirent as fsDirent } from 'fs'
import { resolve } from 'path'

import validate from 'aproba'

import Node from './node.mjs'
import Symlink from './symlink.mjs'
import File from './file.mjs'
import { makeError } from './errors.mjs'
import { encode } from './util.mjs'

export const DEFAULT_DIR_MODE = 0o777 & ~process.umask()
export const DEFAULT_FILE_MODE = 0o666 & ~process.umask()

// a Directory is a node that contains a list of child nodes

export default class Directory extends Node {
  constructor (mode = DEFAULT_DIR_MODE) {
    validate('|N|Z', arguments)
    super((mode & 0o777) | C.S_IFDIR)
    this._links = new Map()
  }

  get (name) {
    validate('S', arguments)
    this.ensureExecuteAccess()
    const node = this._links.get(name)
    if (!node) throw makeError('ENOENT')
    return node
  }

  has (name) {
    validate('S', arguments)
    this.ensureReadAccess()
    return this._links.has(name)
  }

  set (name, node) {
    validate('SO', arguments)

    this.ensureWriteAccess()
    if (this._links.has(name)) throw makeError('EEXIST')
    this._links.set(name, node)
    this.mtouch()
    node.addref()
    node.ctouch()
  }

  isEmpty () {
    return !Array.from(this._links.keys()).some(
      name => name !== '.' && name !== '..'
    )
  }

  delete (name) {
    validate('S', arguments)
    const node = this.get(name)
    this.ensureWriteAccess()
    this._links.delete(name)
    this.mtouch()
    node.decref()
    node.ctouch()
  }

  find (path, { toDir = false, followLinks = true } = {}, limit = 100) {
    let node = this
    let step
    let stepsLeft = resolve(path)
      .slice(1)
      .split('/')
      .filter(Boolean)
    let stepsTaken = []

    while (stepsLeft.length) {
      if (!--limit) throw makeError('ELOOP')
      if (stepsLeft.length === 1 && toDir) break

      step = stepsLeft.shift()
      const next = node.get(step)

      if (followLinks && next instanceof Symlink) {
        if (!next.isRelative) {
          node = this
          stepsTaken = []
        }
        stepsLeft = [...next.steps(), ...stepsLeft]
      } else if (next instanceof Directory) {
        stepsTaken.push(step)
        node = next
      } else {
        if (stepsLeft.length) throw makeError('ENOTDIR')
        stepsTaken.push(step)
        node = next
      }
    }

    path = '/' + stepsTaken.join('/')
    if (toDir) {
      return { path, node, name: stepsLeft[0] }
    } else {
      return { path, node }
    }
  }

  lfind (path, options = {}) {
    return this.find(path, { ...options, followLinks: false })
  }

  findDir (path, options = {}) {
    return this.find(path, { ...options, toDir: true })
  }

  mkdir (name, mode) {
    validate('S|SZ|SN', arguments)
    const subdir = new Directory(mode)
    try {
      this.set(name, subdir)
    } catch (err) {
      subdir.release()
      throw err
    }
    subdir.set('.', subdir)
    subdir.set('..', this)
  }

  mkfile (name, mode) {
    validate('S|SZ|SN', arguments)
    const file = new File(mode)
    this.set(name, file)
    return file
  }

  rmdir (name) {
    validate('S', arguments)
    const subdir = this.get(name)
    if (!(subdir instanceof Directory)) throw makeError('ENOTDIR')
    if (!subdir.isEmpty()) throw makeError('ENOTEMPTY')
    this.delete(name)
    subdir.delete('.')
    subdir.delete('..')
  }

  symlink (name, target) {
    validate('SS', arguments)
    const symlink = new Symlink(target)
    this.set(name, symlink)
  }

  link (name, node) {
    validate('SO', arguments)
    if (node instanceof Directory) throw makeError('EPERM')
    this.set(name, node)
  }

  unlink (name) {
    validate('S', arguments)
    const node = this.get(name)
    if (node instanceof Directory) throw makeError('EISDIR')
    this.delete(name)
  }

  move (name, newDir, newName) {
    validate('SOS', arguments)

    this.ensureWriteAccess()
    newDir.ensureWriteAccess()
    const node = this.get(name)

    // remove anything at the target
    if (node instanceof Directory) {
      // a directory can be moved over an existing empty directory
      if (newDir.has(newName)) newDir.rmdir(newName)
    } else {
      // a file/symlink can replace a file/symlink
      if (newDir.has(newName)) newDir.unlink(newName)
    }

    // add in the new first to ensure refcounts stay > 0
    newDir.set(newName, node)
    this.delete(name)
  }

  readdir (options = {}) {
    validate('|O|S', arguments)
    if (typeof options === 'string') options = { encoding: options }
    const { encoding = 'utf8', withFileTypes = false } = options
    return Array.from(this._links.keys())
      .filter(name => name !== '.' && name !== '..')
      .sort()
      .map(name => encode(name, encoding))
      .map(name =>
        withFileTypes ? new Dirent(name, this._links.get(name).stat()) : name
      )
  }
}

const kStats = Symbol('stats')

class Dirent extends fsDirent {
  constructor (name, stats) {
    super(name, null)
    this[kStats] = stats
  }
}

for (const name of Reflect.ownKeys(fsDirent.prototype)) {
  if (name === 'constructor') continue
  Dirent.prototype[name] = function () {
    return this[kStats][name]()
  }
}
