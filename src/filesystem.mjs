import { constants as C } from 'fs'
import { dirname } from 'path'

import validate from 'aproba'

import Directory from './directory.mjs'
import File from './file.mjs'
import Symlink from './symlink.mjs'
import { makeError } from './errors.mjs'
import { encode } from './util.mjs'

export default class Filesystem {
  constructor () {
    this.root = new Directory()
    this.root.set('.', this.root)
    this.root.set('..', this.root)
  }

  mkdir (path, options = {}) {
    validate('S', [path])
    validate('N|O', [options])

    if (typeof options === 'number') options = { mode: options }
    const { recursive = false, mode } = options
    try {
      const { node: dir, name } = this.root.findDir(path)
      dir.mkdir(name, mode)
    } catch (err) {
      if (err.code === 'ENOENT' && recursive) {
        this.mkdir(dirname(path), options)
        return this.mkdir(path, options)
      }
      throw err
    }
  }

  rmdir (path) {
    validate('S', arguments)
    if (path === '/') throw makeError('EPERM')
    const { node: dir, name } = this.root.findDir(path)
    dir.rmdir(name)
  }

  symlink (target, path) {
    validate('SS', arguments)
    const { node: dir, name } = this.root.findDir(path)
    dir.symlink(name, target)
  }

  link (path, newPath) {
    validate('SS', arguments)
    const { node } = this.root.lfind(path)
    const { node: dir, name } = this.root.findDir(newPath)
    dir.link(name, node)
  }

  unlink (path) {
    validate('S', arguments)
    const { node: dir, name } = this.root.findDir(path)
    dir.unlink(name)
  }

  rename (path, newPath) {
    validate('SS', arguments)
    const { node: srcDir, name: srcName } = this.root.findDir(path)
    const { node: dstDir, name: dstName } = this.root.findDir(newPath)
    srcDir.move(srcName, dstDir, dstName)
  }

  stat (path) {
    validate('S', arguments)
    return this.root.find(path).node.stat()
  }

  lstat (path) {
    validate('S', arguments)
    return this.root.lfind(path).node.stat()
  }

  chmod (path, mode) {
    validate('SN', arguments)
    return this.root.find(path).node.chmod(mode)
  }

  lchmod (path, mode) {
    validate('SN', arguments)
    return this.root.lfind(path).node.chmod(mode)
  }

  chown (path, uid, gid) {
    validate('SNN', arguments)
    return this.root.find(path).node.chown(uid, gid)
  }

  lchown (path, uid, gid) {
    validate('SNN', arguments)
    return this.root.lfind(path).node.chown(uid, gid)
  }

  truncate (path, size = 0) {
    validate('S|SZ|SN', arguments)
    const { node: file } = this.root.find(path)
    if (!(file instanceof File)) throw makeError('EISDIR')
    file.truncate(size)
  }

  utimes (path, atime, mtime) {
    validate('S', [path])
    validate('S|N|O', [atime])
    validate('S|N|O', [mtime])
    return this.root.find(path).node.utimes(atime, mtime)
  }

  lutimes (path, atime, mtime) {
    validate('S', [path])
    validate('S|N|O', [atime])
    validate('S|N|O', [mtime])
    return this.root.lfind(path).node.utimes(atime, mtime)
  }

  readlink (path, options = {}) {
    validate('S', [path])
    validate('S|O', [options])
    if (typeof options === 'string') options = { encoding: options }
    const { node: symlink } = this.root.lfind(path)
    if (!(symlink instanceof Symlink)) throw makeError('EINVAL')
    return symlink.readlink(options)
  }

  readdir (path, options = {}) {
    validate('S', [path])
    validate('S|O', [options])
    /* c8 ignore next */
    if (typeof options === 'string') options = { encoding: options }
    const { node: dir } = this.root.find(path)
    if (!(dir instanceof Directory)) throw makeError('ENOTDIR')
    return dir.readdir(options)
  }

  realpath (path, options = {}) {
    validate('S', [path])
    validate('S|O', [options])
    if (typeof options === 'string') options = { encoding: options }
    const { encoding = 'utf8' } = options
    const { path: realpath } = this.root.find(path)
    return encode(realpath, encoding)
  }

  access (path, mode = C.F_OK) {
    validate('SN', [path, mode])
    try {
      const { node } = this.root.find(path)
      return node.access(mode)
    } catch (err) {
      return false
    }
  }

  exists (path) {
    validate('S', arguments)
    try {
      this.stat(path)
      return true
    } catch (err) {
      return false
    }
  }

  open (path, flags, mode) {
    validate('S', [path])
    validate('Z|N|S', [flags])
    validate('N|Z', [mode])
    flags = decodeOpenFlags(flags)

    if ((flags & C.O_CREAT) === 0) {
      // must already exist
      const { node: file } = this.root.find(path)
      if (!(file instanceof File)) throw makeError('EISDIR')
      return file.open(flags)
    }

    const { node: dir, name } = this.root.findDir(path)

    // create new
    if (!dir.has(name)) {
      return dir.mkfile(name, mode).open(flags)
    }

    // open existing
    const file = dir.get(name)
    if (!(file instanceof File)) throw makeError('EISDIR')
    if ((flags & C.O_EXCL) !== 0) throw makeError('EEXIST')
    return file.open(flags)
  }

  readFile (source, options = {}) {
    validate('S|N', [source])
    validate('S|O', [options])
    if (typeof options === 'string') options = { encoding: options }
    const { encoding, flag = 'r' } = options
    if (typeof source === 'number') {
      return File.get(source).readFile({ encoding })
    }
    const fh = this.open(source, flag)
    try {
      return fh.readFile({ encoding })
    } finally {
      fh.close()
    }
  }

  writeFile (source, data, options = {}) {
    validate('S|N', [source])
    validate('S|O', [options])
    if (typeof options === 'string') options = { encoding: options }
    const { encoding = 'utf8', flag = 'w', mode = 0o666 } = options

    if (typeof source === 'number') {
      return File.get(source).writeFile(data, { encoding })
    }
    const fh = this.open(source, flag, mode)
    try {
      return fh.writeFile(data, { encoding })
    } finally {
      fh.close()
    }
  }

  appendFile (dest, data, options = {}) {
    validate('S|N', [dest])
    validate('S|O', [data])
    validate('S|O', [options])
    if (typeof options === 'string') options = { encoding: options }
    const { encoding = 'utf8', flag = 'a', mode = 0o666 } = options
    if (typeof dest === 'number') {
      return File.get(dest).appendFile(data, { encoding })
    }
    const fh = this.open(dest, flag, mode)
    try {
      return fh.appendFile(data, { encoding })
    } finally {
      fh.close()
    }
  }

  copyFile (sourcePath, destinationPath, flags = 0) {
    validate('SS', [sourcePath, destinationPath])
    validate('N', [flags])
    const flag = flags & C.COPYFILE_EXCL ? 'wx' : 'w'
    const data = this.readFile(sourcePath)
    this.writeFile(destinationPath, data, { flag })
  }

  mkdtemp (prefix, options = {}) {
    validate('S', [prefix])
    while (true) {
      const path =
        prefix +
        Math.random()
          .toString(36)
          .slice(2, 10)
      try {
        this.mkdir(path)
        return this.realpath(path, options)
      } catch (err) {
        /* c8 ignore next */
        if (err.code !== 'EEXIST') throw err
      }
    }
  }
}

function decodeOpenFlags (flags) {
  if (typeof flags === 'number') return flags
  if (flags in OPEN_MODES) return OPEN_MODES[flags]
  throw new Error('Unknown file flags: ' + flags)
}

const OPEN_MODES = {
  r: C.O_RDONLY,
  'r+': C.O_RDWR,
  w: C.O_WRONLY | C.O_CREAT | C.O_TRUNC,
  wx: C.O_WRONLY | C.O_CREAT | C.O_TRUNC | C.O_EXCL,
  'w+': C.O_RDWR | C.O_CREAT | C.O_TRUNC,
  'wx+': C.O_RDWR | C.O_CREAT | C.O_TRUNC | C.O_EXCL,
  a: C.O_WRONLY | C.O_APPEND | C.O_CREAT,
  ax: C.O_WRONLY | C.O_APPEND | C.O_CREAT | C.O_EXCL,
  'a+': C.O_RDWR | C.O_APPEND | C.O_CREAT,
  'ax+': C.O_RDWR | C.O_APPEND | C.O_CREAT | C.O_EXCL
}
