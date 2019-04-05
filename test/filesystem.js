'use strict'

import test from 'ava'

import { constants as C } from 'fs'
import Filesystem from '../src/filesystem'

// not really an exhaustive test, as these are done in the lower unit
// tests, but just aiming to get 100% coverage to check the wiring
//
test('general basic functions', t => {
  const fs = new Filesystem()
  fs.mkdir('/foo')
  t.true(fs.stat('/foo').isDirectory())
  fs.symlink('/foo', '/bar')
  t.true(fs.lstat('/bar').isSymbolicLink())
  t.is(fs.readlink('/bar', 'utf8'), '/foo')
  fs.rename('/bar', '/baz')
  t.is(fs.readlink('/baz'), '/foo')
  t.throws(() => fs.readlink('/foo'))
  fs.lchmod('/baz', 0o755)
  fs.chmod('/foo', 0o0755)
  t.throws(() => fs.chown('/foo', 123, 234))
  t.throws(() => fs.lchown('/foo', 123, 234))
  fs.link('/baz', '/bar')
  fs.unlink('/baz')
  t.is(fs.realpath('/bar'), '/foo')
  t.is(fs.realpath('/bar', 'utf8'), '/foo')
  const now = new Date()
  fs.utimes('/foo', now, now)
  fs.lutimes('/bar', now, now)
  fs.unlink('/bar')

  fs.writeFile('/bar', 'foobar')
  fs.truncate('/bar', 3)
  t.is(fs.readFile('/bar', 'utf8'), 'foo')
  t.throws(() => fs.truncate('/foo'))

  t.deepEqual(fs.readdir('/', { encoding: 'utf8' }), ['bar', 'foo'])
  t.throws(() => fs.readdir('/bar'))
  t.true(fs.access('/bar', C.R_OK))
  t.false(fs.access('/baz'))
  t.true(fs.exists('/bar'))
  t.false(fs.exists('/baz'))

  fs.unlink('/bar')
  fs.rmdir('/foo')
})

test('mkdir', t => {
  const fs = new Filesystem()
  fs.mkdir('/foo', 0o700)
  t.is(fs.stat('/foo').mode & 0o777, 0o700)
  fs.rmdir('/foo')

  fs.mkdir('/foo/bar', { recursive: true, mode: 0o755 })
  t.is(fs.stat('/foo/bar').mode & 0o777, 0o755)
  fs.rmdir('/foo/bar')
  fs.rmdir('/foo')

  t.throws(() => fs.rmdir('/'), { code: 'EPERM' })

  fs.writeFile('/foo', '')
  t.throws(() => fs.mkdir('/foo/bar', { recursive: true }), { code: 'ENOTDIR' })
  fs.unlink('/foo')
})

test('open', t => {
  const fs = new Filesystem()
  let fh
  fh = fs.open('/foo', 'w', 0o600)
  fh.close()
  fh = fs.open('/foo', C.O_RDONLY)
  fh.close()
  fh = fs.open('/foo', 'w')
  fh.close()

  t.throws(() => fs.open('/foo', 'wx'))
  fs.unlink('/foo')
  fs.mkdir('/foo')
  t.throws(() => fs.open('/foo', 'r'))
  t.throws(() => fs.open('/foo', 'a+'))
  fs.rmdir('/foo')

  t.throws(() => fs.open('/foo', 'zqq'))
})

test('whole files', t => {
  const fs = new Filesystem()
  fs.writeFile('/foo', 'foo')
  fs.appendFile('/foo', 'bar')
  t.is(fs.readFile('/foo', 'utf8'), 'foobar')

  fs.copyFile('/foo', '/foo2', C.COPYFILE_EXCL)
  fs.copyFile('/foo', '/foo3')
  fs.unlink('/foo2')
  fs.unlink('/foo3')

  const fh = fs.open('/foo', 'r+')
  fs.writeFile(fh.fd, 'bar', 'utf8')
  fs.appendFile(fh.fd, 'baz', 'utf8')
  t.is(fs.readFile(fh.fd, { encoding: 'utf8' }), 'barbaz')
  fh.close()
})

test('mkdtemp', t => {
  const fs = new Filesystem()
  const d = fs.mkdtemp('/foo-')
  t.true(d.startsWith('/foo-'))
  t.true(fs.stat(d).isDirectory())
  fs.rmdir(d)

  fs.writeFile('/foo', '')
  t.throws(() => fs.mkdtemp('/foo/'))
})
