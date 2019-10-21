'use strict'

import { Stats, constants as C } from 'fs'
import { makeError } from './errors'
import { inodes } from './id'
import ow from 'ow'

export default class Node {
  constructor (mode) {
    const now = Date.now()

    this.ino = inodes.allocate(this)
    this.mode = mode
    this.uid = process.getuid()
    this.gid = process.getgid()
    this.atimeMs = now
    this.ctimeMs = now
    this.mtimeMs = now
    this.birthMs = now
    this.nlink = 0
  }

  release () {
    inodes.release(this.ino)
  }

  get size () {
    return 512
  }

  get perms () {
    return this.mode & 0o777
  }

  addref () {
    this.nlink++
  }

  decref () {
    if (--this.nlink === 0) this.release()
  }

  stat () {
    this.ensureReadAccess()
    const dev = 0
    const rdev = 0
    const blksize = 2048
    return new Stats(
      dev,
      this.mode,
      this.nlink,
      this.uid,
      this.gid,
      rdev,
      blksize,
      this.ino,
      this.size,
      Math.ceil(this.size / blksize),
      this.atimeMs,
      this.mtimeMs,
      this.ctimeMs,
      this.birthMs
    )
  }

  setPerms (perms) {
    ow(perms, ow.number)

    this.mode = (this.mode & ~0o777) | (perms & 0o777)
  }

  atouch () {
    this.atimeMs = Date.now()
  }

  ctouch () {
    this.atimeMs = this.ctimeMs = Date.now()
  }

  mtouch () {
    this.atimeMs = this.mtimeMs = Date.now()
  }

  touch () {
    this.atimeMs = this.mtimeMs = this.ctimeMs = Date.now()
  }

  checkReadAccess () {
    return checkAccess(
      this.perms,
      C.S_IRUSR,
      C.S_IRGRP,
      C.S_IROTH,
      this.uid,
      this.gid
    )
  }

  checkWriteAccess () {
    return checkAccess(
      this.perms,
      C.S_IWUSR,
      C.S_IWGRP,
      C.S_IWOTH,
      this.uid,
      this.gid
    )
  }

  checkExecuteAccess () {
    return checkAccess(
      this.perms,
      C.S_IXUSR,
      C.S_IXGRP,
      C.S_IXOTH,
      this.uid,
      this.gid
    )
  }

  // we could add ownership checks (or root) here, but in this implementation
  // the files are always owned by the current user and cannot be changed
  checkOwner () {
    return true
  }

  ensureReadAccess () {
    if (!this.checkReadAccess()) throw makeError('EACCES')
  }

  ensureWriteAccess () {
    if (!this.checkWriteAccess()) throw makeError('EACCES')
  }

  ensureExecuteAccess () {
    if (!this.checkExecuteAccess()) throw makeError('EACCES')
  }

  ensureOwner () {}

  chmod (mode) {
    ow(mode, 'mode', ow.number.integer)
    this.ensureOwner()
    this.setPerms(mode)
    this.ctouch()
  }

  chown (uid, gid) {
    ow(uid, 'uid', ow.number.integer)
    ow(gid, 'gid', ow.number.integer)
    throw makeError('ENOSYS')
  }

  utimes (atime, mtime) {
    const validTime = ow.any(ow.string.matches(/^[\d.]+$/), ow.number, ow.date)
    ow(atime, 'atime', validTime)
    ow(mtime, 'mtime', validTime)
    this.ensureOwner()
    this.atimeMs = timeInMs(atime)
    this.mtimeMs = timeInMs(mtime)
    this.ctimeMs = Date.now()
  }

  access (mode) {
    ow(mode, 'accessMode', ow.number.integer.inRange(0, 7))
    if ((mode & C.R_OK) !== 0 && !this.checkReadAccess()) return false
    if ((mode & C.W_OK) !== 0 && !this.checkWriteAccess()) return false
    if ((mode & C.X_OK) !== 0 && !this.checkExecuteAccess()) return false
    return true
  }
}

function checkAccess (perms, ubit, gbit, obit, uid, gid) {
  if (perms & ubit && process.getuid() === uid) return true
  if (perms & gbit && process.getgid() === gid) return true
  if (perms & obit) return true
  return false
}

function timeInMs (v) {
  return v instanceof Date ? v.getTime() : +v * 1000
}
