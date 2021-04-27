import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { constants as C } from 'fs'

import Filesystem from '../src/filesystem.mjs'

// not really an exhaustive test, as these are done in the lower unit
// tests, but just aiming to get 100% coverage to check the wiring
//
test('general basic functions', () => {
  const fs = new Filesystem()
  fs.mkdir('/foo')
  assert.ok(fs.stat('/foo').isDirectory())
  fs.symlink('/foo', '/bar')
  assert.ok(fs.lstat('/bar').isSymbolicLink())
  assert.is(fs.readlink('/bar', 'utf8'), '/foo')
  fs.rename('/bar', '/baz')
  assert.is(fs.readlink('/baz'), '/foo')
  assert.throws(() => fs.readlink('/foo'))
  fs.lchmod('/baz', 0o755)
  fs.chmod('/foo', 0o0755)
  assert.throws(() => fs.chown('/foo', 123, 234))
  assert.throws(() => fs.lchown('/foo', 123, 234))
  fs.link('/baz', '/bar')
  fs.unlink('/baz')
  assert.is(fs.realpath('/bar'), '/foo')
  assert.is(fs.realpath('/bar', 'utf8'), '/foo')
  const now = new Date()
  fs.utimes('/foo', now, now)
  fs.lutimes('/bar', now, now)
  fs.unlink('/bar')

  fs.writeFile('/bar', 'foobar')
  fs.truncate('/bar', 3)
  assert.is(fs.readFile('/bar', 'utf8'), 'foo')
  assert.throws(() => fs.truncate('/foo'))

  assert.equal(fs.readdir('/', { encoding: 'utf8' }), ['bar', 'foo'])
  assert.throws(() => fs.readdir('/bar'))
  assert.ok(fs.access('/bar', C.R_OK))
  assert.not.ok(fs.access('/baz'))
  assert.ok(fs.exists('/bar'))
  assert.not.ok(fs.exists('/baz'))

  fs.unlink('/bar')
  fs.rmdir('/foo')
})

test('mkdir', () => {
  const fs = new Filesystem()
  fs.mkdir('/foo', 0o700)
  assert.is(fs.stat('/foo').mode & 0o777, 0o700)
  fs.rmdir('/foo')

  fs.mkdir('/foo/bar', { recursive: true, mode: 0o755 })
  assert.is(fs.stat('/foo/bar').mode & 0o777, 0o755)
  fs.rmdir('/foo/bar')
  fs.rmdir('/foo')

  assert.throws(
    () => fs.rmdir('/'),
    e => e.code === 'EPERM'
  )

  fs.writeFile('/foo', '')
  assert.throws(
    () => fs.mkdir('/foo/bar', { recursive: true }),
    e => e.code === 'ENOTDIR'
  )
  fs.unlink('/foo')
})

test('open', () => {
  const fs = new Filesystem()
  let fh
  fh = fs.open('/foo', 'w', 0o600)
  fh.close()
  fh = fs.open('/foo', C.O_RDONLY)
  fh.close()
  fh = fs.open('/foo', 'w')
  fh.close()

  assert.throws(() => fs.open('/foo', 'wx'))
  fs.unlink('/foo')
  fs.mkdir('/foo')
  assert.throws(() => fs.open('/foo', 'r'))
  assert.throws(() => fs.open('/foo', 'a+'))
  fs.rmdir('/foo')

  assert.throws(() => fs.open('/foo', 'zqq'))
})

test('whole files', () => {
  const fs = new Filesystem()
  fs.writeFile('/foo', 'foo')
  fs.appendFile('/foo', 'bar')
  assert.is(fs.readFile('/foo', 'utf8'), 'foobar')

  fs.copyFile('/foo', '/foo2', C.COPYFILE_EXCL)
  fs.copyFile('/foo', '/foo3')
  fs.unlink('/foo2')
  fs.unlink('/foo3')

  const fh = fs.open('/foo', 'r+')
  fs.writeFile(fh.fd, 'bar', 'utf8')
  fs.appendFile(fh.fd, 'baz', 'utf8')
  assert.is(fs.readFile(fh.fd, { encoding: 'utf8' }), 'barbaz')
  fh.close()
})

test('mkdtemp', () => {
  const fs = new Filesystem()
  const d = fs.mkdtemp('/foo-')
  assert.ok(d.startsWith('/foo-'))
  assert.ok(fs.stat(d).isDirectory())
  fs.rmdir(d)

  fs.writeFile('/foo', '')
  assert.throws(() => fs.mkdtemp('/foo/'))
})

test.run()
