import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { constants as C, Stats } from 'fs'

import Node from '../src/node.mjs'

test('create a node', () => {
  const n = new Node(0o765 | C.S_IFREG)
  n.addref()
  n.addref()
  assert.ok(n instanceof Node)
  assert.is(typeof n.ino, 'number')
  assert.is(typeof n.mode, 'number')
  assert.is(typeof n.nlink, 'number')
  assert.is(n.perms, 0o765)
  assert.is(n.nlink, 2)
  assert.ok(n.stat() instanceof Stats)
  assert.ok(n.stat().isFile())
  n.decref()
  n.decref()
  assert.is(n.nlink, 0)
})

test('permissions', () => {
  const n = new Node(0o234 | C.S_IFREG)

  assert.is(n.perms, 0o234)

  n.setPerms(0o4321)

  assert.is(n.mode, C.S_IFREG | 0o321)

  n.setPerms(0o770)
  n.uid++
  n.gid++

  assert.not.ok(n.checkReadAccess())
  assert.not.ok(n.checkWriteAccess())
  assert.not.ok(n.checkExecuteAccess())

  n.setPerms(0o004)
  assert.ok(n.checkReadAccess())
  n.setPerms(0o002)
  assert.ok(n.checkWriteAccess())
  n.setPerms(0o001)
  assert.ok(n.checkExecuteAccess())

  n.gid--

  n.setPerms(0o040)
  assert.ok(n.checkReadAccess())
  n.setPerms(0o020)
  assert.ok(n.checkWriteAccess())
  n.setPerms(0o010)
  assert.ok(n.checkExecuteAccess())

  n.gid++
  n.uid--

  n.setPerms(0o400)
  assert.ok(n.checkReadAccess())
  n.setPerms(0o200)
  assert.ok(n.checkWriteAccess())
  n.setPerms(0o100)
  assert.ok(n.checkExecuteAccess())

  n.gid--

  n.setPerms(0o000)
  assert.throws(
    () => n.ensureReadAccess(),
    e => e.code === 'EACCES'
  )
  assert.throws(
    () => n.ensureWriteAccess(),
    e => e.code === 'EACCES'
  )
  assert.throws(
    () => n.ensureExecuteAccess(),
    e => e.code === 'EACCES'
  )

  n.setPerms(0o777)
  assert.not.throws(() => n.ensureReadAccess())
  assert.not.throws(() => n.ensureWriteAccess())
  assert.not.throws(() => n.ensureExecuteAccess())

  assert.ok(n.checkOwner())
  assert.not.throws(() => n.ensureOwner())
})

test('touching', () => {
  const now = Date.now()
  let stat
  const n = new Node(0o777 | C.S_IFREG)
  function reset () {
    n.atimeMs = n.ctimeMs = n.mtimeMs = now - 1000
  }

  reset()

  n.atouch()
  stat = n.stat()
  assert.ok(stat.atime >= now)
  assert.not.ok(stat.ctime >= now)
  assert.not.ok(stat.mtime >= now)

  reset()
  n.ctouch()
  stat = n.stat()
  assert.ok(stat.atime >= now)
  assert.ok(stat.ctime >= now)
  assert.not.ok(stat.mtime >= now)

  reset()
  n.mtouch()
  stat = n.stat()
  assert.ok(stat.atime >= now)
  assert.ok(stat.mtime >= now)
  assert.not.ok(stat.ctime >= now)

  reset()
  n.touch()
  stat = n.stat()
  assert.ok(stat.atime >= now)
  assert.ok(stat.mtime >= now)
  assert.ok(stat.ctime >= now)
})

test('chmod', () => {
  const n = new Node(0o777 | C.S_IFREG)
  n.chmod(0o531)
  assert.is(n.perms, 0o531)
})

test('chown', () => {
  const n = new Node(0o777 | C.S_IFREG)
  assert.throws(
    () => n.chown(123, 234),
    e => e.code === 'ENOSYS'
  )
})

test('utimes', () => {
  const atime = new Date(Date.now() - 1000)
  const mtime = new Date(Date.now() - 2000)
  const n = new Node(0o777 | C.S_IFREG)

  n.utimes(atime, mtime)
  assert.is(+n.stat().atime, +atime)
  assert.is(+n.stat().mtime, +mtime)

  n.utimes(atime.getTime() / 1000, mtime.getTime() / 1000)
  assert.is(+n.stat().atime, +atime)
  assert.is(+n.stat().mtime, +mtime)

  n.utimes('' + +atime / 1000, '' + +mtime / 1000)
  assert.is(+n.stat().atime, +atime)
  assert.is(+n.stat().mtime, +mtime)
})

test('access', () => {
  const n = new Node(0o777 | C.S_IFREG)
  n.chmod(0o400)
  assert.ok(n.access(C.R_OK))
  n.chmod(0o333)
  assert.not.ok(n.access(C.R_OK))

  n.chmod(0o200)
  assert.ok(n.access(C.W_OK))
  n.chmod(0o555)
  assert.not.ok(n.access(C.W_OK))

  n.chmod(0o100)
  assert.ok(n.access(C.X_OK))
  n.chmod(0o666)
  assert.not.ok(n.access(C.X_OK))

  assert.ok(n.access(C.F_OK))
})

test.run()
