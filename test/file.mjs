import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { constants as C } from 'fs'

import File from '../src/file.mjs'

test('create a file', () => {
  const f = new File()
  assert.ok(f instanceof File)
})

test('create a file with mode', () => {
  const f = new File(0o765)
  assert.is(f.perms, 0o765)
  assert.is(f.mode, 0o765 | C.S_IFREG)
})

test('truncate data', () => {
  const f = new File()
  f.data = Buffer.from('foobar')

  f.truncate(3)
  assert.equal(f.data, Buffer.from('foo'))

  f.truncate(6)
  assert.equal(f.data, Buffer.from([0x66, 0x6f, 0x6f, 0x00, 0x00, 0x00]))
})

test('basic read and write', () => {
  const f = new File(0o765)
  const fh = f.open(C.O_CREAT | C.O_RDWR)
  assert.is(typeof fh.fd, 'number')
  assert.is(File.get(fh.fd), fh)
  assert.is(fh.write(Buffer.from('foobarbaz'), 3, 6), 6)
  assert.equal(f.data, Buffer.from('barbaz'))
  const b = Buffer.alloc(4)
  assert.is(fh.read(b, 0, 3, 1), 3)
  assert.equal(b, Buffer.from('arb\u0000'))
  fh.close()
})

test('write', () => {
  const f = new File(0o765)
  const fh = f.open(C.O_CREAT | C.O_RDWR)
  const s = () => f.data.toString('utf8')
  fh.write('foo')
  assert.is(s(), 'foo')
  fh.write('bar', 3)
  assert.is(s(), 'foobar')
  fh.write('626172', 0, 'hex')
  assert.is(s(), 'barbar')

  fh.write(Buffer.from('foo'))
  assert.is(s(), 'barfoo')
  fh.write(Buffer.from('barbaz'), 3)
  assert.is(s(), 'barfoobaz')
  fh.close()
})

test('realloc fd', () => {
  const f = new File(0o765)
  const mode = C.O_CREAT | C.O_RDWR
  const h1 = f.open(mode)
  const { fd: fd1 } = h1
  const h2 = f.open(mode)
  assert.not.ok(h1.fd === h2.fd)
  h1.close()

  const h3 = f.open(mode)
  assert.is(h3.fd, fd1)
  h2.close()
  h3.close()
})

test('truncate', () => {
  const f = new File(0o765)
  f.data = Buffer.from('foo')
  const h = f.open(C.O_TRUNC)
  h.close()
  assert.is(f.size, 0)
})

test('append', () => {
  const f = new File(0o765)
  f.data = Buffer.from('foo')
  const h = f.open(C.O_APPEND | C.O_RDWR)
  h.write(Buffer.from('bar'), 0, 3)
  h.close()
  assert.equal(f.data, Buffer.from('foobar'))
})

test('overwrite', () => {
  const f = new File(0o765)
  f.data = Buffer.from('foobar')
  const h = f.open(C.O_WRONLY)
  assert.is(h.write(Buffer.from('quuxbaz'), 4, 3, 3), 3)
  h.close()
  assert.equal(f.data, Buffer.from('foobaz'))
})

test('part read', () => {
  const f = new File(0o765)
  f.data = Buffer.from('foobar')
  const h = f.open(C.O_RDONLY)
  const b = Buffer.alloc(3)
  assert.is(h.read(b, 0, 3), 3)
  assert.is(b.toString(), 'foo')
  assert.is(h._pos, 3)
  assert.is(h.read(b, 0, 3), 3)
  assert.is(b.toString(), 'bar')
  h.close()
})

test('fail access', () => {
  const f = new File(0o765)
  let h = f.open(C.O_WRONLY)
  assert.throws(
    () => h.read(Buffer.from(''), 0, 0),
    e => e.code === 'EACCES'
  )
  h.close()
  h = f.open(C.O_RDONLY)
  assert.throws(
    () => h.write(Buffer.from(''), 0, 0),
    e => e.code === 'EACCES'
  )
  h.close()
})

test('appendFile', () => {
  const f = new File(0o765)
  const h = f.open(C.O_RDWR)
  h.appendFile('foo')
  h.appendFile('626172', 'hex')
  h.appendFile(Buffer.from('baz'))
  h.close()
  assert.is(f.data.toString(), 'foobarbaz')
})

test('readFile', () => {
  const f = new File(0o765)
  f.data = Buffer.from('foobar')
  const h = f.open(C.O_RDWR)
  assert.is(h.readFile({ encoding: 'utf8' }), 'foobar')
  assert.is(h.readFile('hex'), '666f6f626172')
  assert.equal(h.readFile(), Buffer.from('foobar'))
  h.close()
})

test('writeFile', () => {
  const f = new File(0o765)
  f.data = Buffer.from('foobar')
  const h = f.open(C.O_RDWR)
  h.writeFile('foo')
  assert.equal(f.data, Buffer.from('foo'))
  h.writeFile('626172', 'hex')
  assert.equal(f.data, Buffer.from('bar'))
  h.writeFile('baz', { encoding: 'utf8' })
  assert.equal(f.data, Buffer.from('baz'))
  h.writeFile(Buffer.from('foobar'))
  assert.equal(f.data, Buffer.from('foobar'))
})

test('chmod', () => {
  const f = new File(0o765)
  const h = f.open(C.O_RDWR)
  h.chmod(0o753)
  assert.is(h.stat().mode & 0o777, 0o753)
  h.close()
})

test('chown', () => {
  const f = new File(0o765)
  const h = f.open(C.O_RDWR)
  assert.throws(
    () => h.chown(123, 234),
    e => e.code === 'ENOSYS'
  )
  h.close()
})

test('sync', () => {
  const f = new File(0o765)
  const h = f.open(C.O_RDWR)
  assert.not.throws(() => h.sync())
  assert.not.throws(() => h.datasync())
  h.close()
})

test('utimes', () => {
  const f = new File(0o765)
  const h = f.open(C.O_RDWR)
  assert.not.throws(() => h.utimes(new Date(), new Date()))
  h.close()
})

test('bad fd', () => {
  assert.throws(
    () => File.get(17),
    e => (e.code = 'EBADF')
  )
})

test.run()
