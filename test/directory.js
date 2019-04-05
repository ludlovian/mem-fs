'use strict'

import test from 'ava'

import Directory from '../src/directory'

test('create a directory', t => {
  const d = new Directory()
  t.true(d instanceof Directory)
  t.is(typeof d.mode, 'number')
  t.is(d.size, 512)
  t.true(d.stat().isDirectory())
})

test('mkdir', t => {
  const foo = new Directory()
  foo.mkdir('bar')
  const bar = foo.get('bar')
  t.is(bar.nlink, 2)
  t.deepEqual(foo.readdir(), ['bar'])
  t.true(foo.readdir({ withFileTypes: true })[0].isDirectory())
  t.throws(() => foo.mkdir('bar'), { code: 'EEXIST' })
  foo.rmdir('bar')
  t.throws(() => foo.rmdir('bar'), { code: 'ENOENT' })
  t.is(bar.nlink, 0)
})

test('rmdir', t => {
  const foo = new Directory()
  foo.mkdir('bar')
  const bar = foo.get('bar')
  bar.symlink('baz', 'quux')
  t.throws(() => foo.rmdir('bar'), { code: 'ENOTEMPTY' })
  t.throws(() => bar.rmdir('baz'), { code: 'ENOTDIR' })
  bar.unlink('baz')
  foo.rmdir('bar')
})

test('find', t => {
  const root = new Directory()
  root.mkdir('foo')
  const foo = root.find('/foo').node
  root.symlink('bar', '/foo')
  const bar = root.lfind('/bar').node

  let res
  res = root.find('/bar')
  t.deepEqual(res, { node: foo, path: '/foo' })

  res = root.lfind('/bar')
  t.deepEqual(res, { node: bar, path: '/bar' })

  res = root.findDir('/bar')
  t.deepEqual(res, { node: root, name: 'bar', path: '/' })

  t.throws(() => root.lfind('/bar/baz'), { code: 'ENOTDIR' })
  t.throws(() => root.find('/bar/baz'), { code: 'ENOENT' })

  root.symlink('baz', 'foo')
  res = root.find('/baz')
  t.deepEqual(res, { node: foo, path: '/foo' })

  root.symlink('quux', '/quux')
  t.throws(() => root.find('/quux', {}, 10), { code: 'ELOOP' })
})

test('mkfile', t => {
  const foo = new Directory()
  foo.mkfile('bar')
  t.true(
    foo
      .get('bar')
      .stat()
      .isFile()
  )
  foo.unlink('bar')
})

test('link', t => {
  const foo = new Directory()
  foo.mkfile('bar')
  const bar = foo.get('bar')
  t.is(bar.stat().nlink, 1)
  foo.link('baz', bar)
  t.is(bar.stat().nlink, 2)
  t.deepEqual(foo.readdir(), ['bar', 'baz'])
  foo.unlink('bar')
  foo.unlink('baz')
  t.is(bar.stat().nlink, 0)

  foo.mkdir('bar')
  t.throws(() => foo.link('baz', foo.get('bar')), { code: 'EPERM' })
  foo.rmdir('bar')
})

test('unlink', t => {
  const foo = new Directory()
  foo.mkfile('bar')
  t.notThrows(() => foo.unlink('bar'))

  foo.mkdir('bar')
  t.throws(() => foo.unlink('bar', { code: 'EISDIR' }))
})

test('move', t => {
  const foo = new Directory()
  const bar = new Directory()

  // move dir onto dir
  foo.mkdir('baz')
  bar.mkdir('quux')
  let baz = foo.get('baz')
  foo.move('baz', bar, 'quux')
  t.is(bar.get('quux'), baz)
  t.is(baz.stat().nlink, 2)
  t.is(foo.readdir().length, 0)

  // move dir onto empty
  bar.move('quux', foo, 'baz')
  t.is(foo.get('baz'), baz)
  t.deepEqual(foo.readdir(), ['baz'])
  t.is(bar.readdir().length, 0)
  foo.rmdir('baz')

  // move file onto file
  foo.mkfile('baz')
  bar.mkfile('quux')
  baz = foo.get('baz')
  foo.move('baz', bar, 'quux')
  t.is(bar.get('quux'), baz)
  t.is(baz.stat().nlink, 1)
  t.is(foo.readdir().length, 0)

  // move file onto empty
  bar.move('quux', foo, 'baz')
  t.is(foo.get('baz'), baz)
  t.deepEqual(foo.readdir(), ['baz'])
  t.is(bar.readdir().length, 0)
  foo.unlink('baz')
})

test('readdir', t => {
  const foo = new Directory()
  foo.mkfile('baz')
  foo.symlink('bar', '/baz')

  t.deepEqual(foo.readdir('hex'), ['626172', '62617a'])
  t.is(foo.readdir({ encoding: 'buffer' })[0].toString(), 'bar')
  t.true(foo.readdir({ withFileTypes: true })[1].isFile())

  foo.unlink('bar')
  foo.unlink('baz')
})
