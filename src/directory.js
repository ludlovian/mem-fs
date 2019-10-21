'use strict'

import Node from './node'
import Symlink from './symlink'
import File from './file'
import { constants as C, Dirent as fsDirent } from 'fs'
import { resolve } from 'path'
import { makeError } from './errors'
import { encode } from './util'
import ow from 'ow'

export const DEFAULT_DIR_MODE = 0o777 & ~process.umask()
export const DEFAULT_FILE_MODE = 0o666 & ~process.umask()

// a Directory is a node that contains a list of child nodes

export default class Directory extends Node {
  constructor (mode = DEFAULT_DIR_MODE) {
    ow(mode, ow.number)
    super((mode & 0o777) | C.S_IFDIR)
    this._links = new Map()
  }

  get (name) {
    ow(name, ow.string)
    this.ensureExecuteAccess()
    const node = this._links.get(name)
    if (!node) throw makeError('ENOENT')
    return node
  }

  has (name) {
    ow(name, ow.string)
    this.ensureReadAccess()
    return this._links.has(name)
  }

  set (name, node) {
    ow(name, ow.string.nonEmpty)
    ow(name, ow.string.not.matches(/\//))
    ow(node, ow.object.instanceOf(Node))

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
    ow(name, 'name', ow.string.nonEmpty)
    ow(mode, 'mode', ow.optional.number.integer)
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
    ow(name, ow.string.nonEmpty)
    ow(mode, ow.optional.number.integer)
    const file = new File(mode)
    this.set(name, file)
    return file
  }

  rmdir (name) {
    ow(name, 'name', ow.string.nonEmpty)
    const subdir = this.get(name)
    if (!(subdir instanceof Directory)) throw makeError('ENOTDIR')
    if (!subdir.isEmpty()) throw makeError('ENOTEMPTY')
    this.delete(name)
    subdir.delete('.')
    subdir.delete('..')
  }

  symlink (name, target) {
    ow(name, 'name', ow.string.nonEmpty)
    ow(target, 'target', ow.string.nonEmpty)
    const symlink = new Symlink(target)
    this.set(name, symlink)
  }

  link (name, node) {
    ow(name, 'name', ow.string.nonEmpty)
    ow(node, ow.object.instanceOf(Node))
    if (node instanceof Directory) throw makeError('EPERM')
    this.set(name, node)
  }

  unlink (name) {
    ow(name, 'name', ow.string.nonEmpty)
    const node = this.get(name)
    if (node instanceof Directory) throw makeError('EISDIR')
    this.delete(name)
  }

  move (name, newDir, newName) {
    ow(name, 'name', ow.string.nonEmpty)
    ow(newDir, 'newDir', ow.object.instanceOf(Directory))
    ow(newName, 'newName', ow.string.nonEmpty)

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
    ow(options, 'encodingOrOptions', ow.any(ow.string, ow.object))
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
