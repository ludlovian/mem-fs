'use strict'

import test from 'ava'
import Node from '../src/node'
import { constants as C, Stats } from 'fs'

test('create a node', t => {
  const n = new Node(0o765 | C.S_IFREG)
  n.addref()
  n.addref()
  t.true(n instanceof Node)
  t.is(typeof n.ino, 'number')
  t.is(typeof n.mode, 'number')
  t.is(typeof n.nlink, 'number')
  t.is(n.perms, 0o765)
  t.is(n.nlink, 2)
  t.true(n.stat() instanceof Stats)
  t.true(n.stat().isFile())
  n.decref()
  n.decref()
  t.is(n.nlink, 0)
})

test('permissions', t => {
  const n = new Node(0o234 | C.S_IFREG)

  t.is(n.perms, 0o234)

  n.setPerms(0o4321)

  t.is(n.mode, C.S_IFREG | 0o321)

  n.setPerms(0o770)
  n.uid++
  n.gid++

  t.false(n.checkReadAccess())
  t.false(n.checkWriteAccess())
  t.false(n.checkExecuteAccess())

  n.setPerms(0o004)
  t.true(n.checkReadAccess())
  n.setPerms(0o002)
  t.true(n.checkWriteAccess())
  n.setPerms(0o001)
  t.true(n.checkExecuteAccess())

  n.gid--

  n.setPerms(0o040)
  t.true(n.checkReadAccess())
  n.setPerms(0o020)
  t.true(n.checkWriteAccess())
  n.setPerms(0o010)
  t.true(n.checkExecuteAccess())

  n.gid++
  n.uid--

  n.setPerms(0o400)
  t.true(n.checkReadAccess())
  n.setPerms(0o200)
  t.true(n.checkWriteAccess())
  n.setPerms(0o100)
  t.true(n.checkExecuteAccess())

  n.gid--

  n.setPerms(0o000)
  t.throws(() => n.ensureReadAccess(), { code: 'EACCES' })
  t.throws(() => n.ensureWriteAccess(), { code: 'EACCES' })
  t.throws(() => n.ensureExecuteAccess(), { code: 'EACCES' })

  n.setPerms(0o777)
  t.notThrows(() => n.ensureReadAccess())
  t.notThrows(() => n.ensureWriteAccess())
  t.notThrows(() => n.ensureExecuteAccess())

  t.true(n.checkOwner())
  t.notThrows(() => n.ensureOwner())
})

test('touching', t => {
  const now = Date.now()
  let stat
  const n = new Node(0o777 | C.S_IFREG)
  function reset () {
    n.atimeMs = n.ctimeMs = n.mtimeMs = now - 1000
  }

  reset()

  n.atouch()
  stat = n.stat()
  t.true(stat.atime >= now)
  t.false(stat.ctime >= now)
  t.false(stat.mtime >= now)

  reset()
  n.ctouch()
  stat = n.stat()
  t.true(stat.atime >= now)
  t.true(stat.ctime >= now)
  t.false(stat.mtime >= now)

  reset()
  n.mtouch()
  stat = n.stat()
  t.true(stat.atime >= now)
  t.true(stat.mtime >= now)
  t.false(stat.ctime >= now)

  reset()
  n.touch()
  stat = n.stat()
  t.true(stat.atime >= now)
  t.true(stat.mtime >= now)
  t.true(stat.ctime >= now)
})

test('chmod', t => {
  const n = new Node(0o777 | C.S_IFREG)
  n.chmod(0o531)
  t.is(n.perms, 0o531)
})

test('chown', t => {
  const n = new Node(0o777 | C.S_IFREG)
  t.throws(() => n.chown(123, 234), { code: 'ENOSYS' })
})

test('utimes', t => {
  const atime = new Date(Date.now() - 1000)
  const mtime = new Date(Date.now() - 2000)
  const n = new Node(0o777 | C.S_IFREG)

  n.utimes(atime, mtime)
  t.is(+n.stat().atime, +atime)
  t.is(+n.stat().mtime, +mtime)

  n.utimes(atime.getTime() / 1000, mtime.getTime() / 1000)
  t.is(+n.stat().atime, +atime)
  t.is(+n.stat().mtime, +mtime)

  n.utimes('' + +atime / 1000, '' + +mtime / 1000)
  t.is(+n.stat().atime, +atime)
  t.is(+n.stat().mtime, +mtime)
})

test('access', t => {
  const n = new Node(0o777 | C.S_IFREG)
  n.chmod(0o400)
  t.true(n.access(C.R_OK))
  n.chmod(0o333)
  t.false(n.access(C.R_OK))

  n.chmod(0o200)
  t.true(n.access(C.W_OK))
  n.chmod(0o555)
  t.false(n.access(C.W_OK))

  n.chmod(0o100)
  t.true(n.access(C.X_OK))
  n.chmod(0o666)
  t.false(n.access(C.X_OK))

  t.true(n.access(C.F_OK))
})
