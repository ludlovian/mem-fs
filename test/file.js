'use strict'

import test from 'ava'

import File from '../src/file'
import { constants as C } from 'fs'

test('create a file', t => {
  const f = new File()
  t.true(f instanceof File)
})

test('create a file with mode', t => {
  const f = new File(0o765)
  t.is(f.perms, 0o765)
  t.is(f.mode, 0o765 | C.S_IFREG)
})

test('truncate data', t => {
  const f = new File()
  f.data = Buffer.from('foobar')

  f.truncate(3)
  t.deepEqual(f.data, Buffer.from('foo'))

  f.truncate(6)
  t.deepEqual(f.data, Buffer.from([0x66, 0x6f, 0x6f, 0x00, 0x00, 0x00]))
})

test('basic read and write', t => {
  const f = new File(0o765)
  const fh = f.open(C.O_CREAT | C.O_RDWR)
  t.is(typeof fh.fd, 'number')
  t.is(File.get(fh.fd), fh)
  t.is(fh.write(Buffer.from('foobarbaz'), 3, 6), 6)
  t.deepEqual(f.data, Buffer.from('barbaz'))
  const b = Buffer.alloc(4)
  t.is(fh.read(b, 0, 3, 1), 3)
  t.deepEqual(b, Buffer.from('arb\u0000'))
  fh.close()
})

test('write', t => {
  const f = new File(0o765)
  const fh = f.open(C.O_CREAT | C.O_RDWR)
  const s = () => f.data.toString('utf8')
  fh.write('foo')
  t.is(s(), 'foo')
  fh.write('bar', 3)
  t.is(s(), 'foobar')
  fh.write('626172', 0, 'hex')
  t.is(s(), 'barbar')

  fh.write(Buffer.from('foo'))
  t.is(s(), 'barfoo')
  fh.write(Buffer.from('barbaz'), 3)
  t.is(s(), 'barfoobaz')
  fh.close()
})

test('realloc fd', t => {
  const f = new File(0o765)
  const mode = C.O_CREAT | C.O_RDWR
  const h1 = f.open(mode)
  const { fd: fd1 } = h1
  const h2 = f.open(mode)
  t.false(h1.fd === h2.fd)
  h1.close()

  const h3 = f.open(mode)
  t.is(h3.fd, fd1)
  h2.close()
  h3.close()
})

test('truncate', t => {
  const f = new File(0o765)
  f.data = Buffer.from('foo')
  const h = f.open(C.O_TRUNC)
  h.close()
  t.is(f.size, 0)
})

test('append', t => {
  const f = new File(0o765)
  f.data = Buffer.from('foo')
  const h = f.open(C.O_APPEND | C.O_RDWR)
  h.write(Buffer.from('bar'), 0, 3)
  h.close()
  t.deepEqual(f.data, Buffer.from('foobar'))
})

test('overwrite', t => {
  const f = new File(0o765)
  f.data = Buffer.from('foobar')
  const h = f.open(C.O_WRONLY)
  t.is(h.write(Buffer.from('quuxbaz'), 4, 3, 3), 3)
  h.close()
  t.deepEqual(f.data, Buffer.from('foobaz'))
})

test('part read', t => {
  const f = new File(0o765)
  f.data = Buffer.from('foobar')
  const h = f.open(C.O_RDONLY)
  const b = Buffer.alloc(3)
  t.is(h.read(b, 0, 3), 3)
  t.is(b.toString(), 'foo')
  t.is(h._pos, 3)
  t.is(h.read(b, 0, 3), 3)
  t.is(b.toString(), 'bar')
  h.close()
})

test('fail access', t => {
  const f = new File(0o765)
  let h = f.open(C.O_WRONLY)
  t.throws(() => h.read(Buffer.from(''), 0, 0), { code: 'EACCES' })
  h.close()
  h = f.open(C.O_RDONLY)
  t.throws(() => h.write(Buffer.from(''), 0, 0), { code: 'EACCES' })
  h.close()
})

test('appendFile', t => {
  const f = new File(0o765)
  const h = f.open(C.O_RDWR)
  h.appendFile('foo')
  h.appendFile('626172', 'hex')
  h.appendFile(Buffer.from('baz'))
  h.close()
  t.is(f.data.toString(), 'foobarbaz')
})

test('readFile', t => {
  const f = new File(0o765)
  f.data = Buffer.from('foobar')
  const h = f.open(C.O_RDWR)
  t.is(h.readFile({ encoding: 'utf8' }), 'foobar')
  t.is(h.readFile('hex'), '666f6f626172')
  t.deepEqual(h.readFile(), Buffer.from('foobar'))
  h.close()
})

test('writeFile', t => {
  const f = new File(0o765)
  f.data = Buffer.from('foobar')
  const h = f.open(C.O_RDWR)
  h.writeFile('foo')
  t.deepEqual(f.data, Buffer.from('foo'))
  h.writeFile('626172', 'hex')
  t.deepEqual(f.data, Buffer.from('bar'))
  h.writeFile('baz', { encoding: 'utf8' })
  t.deepEqual(f.data, Buffer.from('baz'))
  h.writeFile(Buffer.from('foobar'))
  t.deepEqual(f.data, Buffer.from('foobar'))
})

test('chmod', t => {
  const f = new File(0o765)
  const h = f.open(C.O_RDWR)
  h.chmod(0o753)
  t.is(h.stat().mode & 0o777, 0o753)
  h.close()
})

test('chown', t => {
  const f = new File(0o765)
  const h = f.open(C.O_RDWR)
  t.throws(() => h.chown(123, 234), { code: 'ENOSYS' })
  h.close()
})

test('sync', t => {
  const f = new File(0o765)
  const h = f.open(C.O_RDWR)
  t.notThrows(() => h.sync())
  t.notThrows(() => h.datasync())
  h.close()
})

test('utimes', t => {
  const f = new File(0o765)
  const h = f.open(C.O_RDWR)
  t.notThrows(() => h.utimes(new Date(), new Date()))
  h.close()
})

test('bad fd', t => {
  t.throws(() => File.get(17), { code: 'EBADF' })
})
