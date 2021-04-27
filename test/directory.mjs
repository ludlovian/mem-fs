import { test } from 'uvu'
import * as assert from 'uvu/assert'

import Directory from '../src/directory.mjs'

test('create a directory', () => {
  const d = new Directory()
  assert.ok(d instanceof Directory)
  assert.is(typeof d.mode, 'number')
  assert.is(d.size, 512)
  assert.ok(d.stat().isDirectory())
})

test('mkdir', () => {
  const foo = new Directory()
  foo.mkdir('bar')
  const bar = foo.get('bar')
  assert.is(bar.nlink, 2)
  assert.equal(foo.readdir({}), ['bar'])
  assert.ok(foo.readdir({ withFileTypes: true })[0].isDirectory())
  assert.throws(
    () => foo.mkdir('bar'),
    e => e.code === 'EEXIST'
  )
  foo.rmdir('bar')
  assert.throws(
    () => foo.rmdir('bar'),
    e => e.code === 'ENOENT'
  )
  assert.is(bar.nlink, 0)
})

test('rmdir', () => {
  const foo = new Directory()
  foo.mkdir('bar')
  const bar = foo.get('bar')
  bar.symlink('baz', 'quux')
  assert.throws(
    () => foo.rmdir('bar'),
    e => e.code === 'ENOTEMPTY'
  )
  assert.throws(
    () => bar.rmdir('baz'),
    e => e.code === 'ENOTDIR'
  )
  bar.unlink('baz')
  foo.rmdir('bar')
})

test('find', () => {
  const root = new Directory()
  root.mkdir('foo')
  const foo = root.find('/foo').node
  root.symlink('bar', '/foo')
  const bar = root.lfind('/bar').node

  let res
  res = root.find('/bar')
  assert.equal(res, { node: foo, path: '/foo' })

  res = root.lfind('/bar')
  assert.equal(res, { node: bar, path: '/bar' })

  res = root.findDir('/bar')
  assert.equal(res, { node: root, name: 'bar', path: '/' })

  assert.throws(
    () => root.lfind('/bar/baz'),
    e => e.code === 'ENOTDIR'
  )
  assert.throws(
    () => root.find('/bar/baz'),
    e => e.code === 'ENOENT'
  )

  root.symlink('baz', 'foo')
  res = root.find('/baz')
  assert.equal(res, { node: foo, path: '/foo' })

  root.symlink('quux', '/quux')
  assert.throws(
    () => root.find('/quux', {}, 10),
    e => e.code === 'ELOOP'
  )
})

test('mkfile', () => {
  const foo = new Directory()
  foo.mkfile('bar')
  assert.ok(
    foo
      .get('bar')
      .stat()
      .isFile()
  )
  foo.unlink('bar')
})

test('link', () => {
  const foo = new Directory()
  foo.mkfile('bar')
  const bar = foo.get('bar')
  assert.is(bar.stat().nlink, 1)
  foo.link('baz', bar)
  assert.is(bar.stat().nlink, 2)
  assert.equal(foo.readdir({}), ['bar', 'baz'])
  foo.unlink('bar')
  foo.unlink('baz')
  assert.is(bar.stat().nlink, 0)

  foo.mkdir('bar')
  assert.throws(
    () => foo.link('baz', foo.get('bar')),
    e => e.code === 'EPERM'
  )
  foo.rmdir('bar')
})

test('unlink', () => {
  const foo = new Directory()
  foo.mkfile('bar')
  assert.not.throws(() => foo.unlink('bar'))

  foo.mkdir('bar')
  assert.throws(
    () => foo.unlink('bar'),
    e => e.code === 'EISDIR'
  )
})

test('move', () => {
  const foo = new Directory()
  const bar = new Directory()

  // move dir onto dir
  foo.mkdir('baz')
  bar.mkdir('quux')
  let baz = foo.get('baz')
  foo.move('baz', bar, 'quux')
  assert.is(bar.get('quux'), baz)
  assert.is(baz.stat().nlink, 2)
  assert.is(foo.readdir({}).length, 0)

  // move dir onto empty
  bar.move('quux', foo, 'baz')
  assert.is(foo.get('baz'), baz)
  assert.equal(foo.readdir({}), ['baz'])
  assert.is(bar.readdir({}).length, 0)
  foo.rmdir('baz')

  // move file onto file
  foo.mkfile('baz')
  bar.mkfile('quux')
  baz = foo.get('baz')
  foo.move('baz', bar, 'quux')
  assert.is(bar.get('quux'), baz)
  assert.is(baz.stat().nlink, 1)
  assert.is(foo.readdir({}).length, 0)

  // move file onto empty
  bar.move('quux', foo, 'baz')
  assert.is(foo.get('baz'), baz)
  assert.equal(foo.readdir({}), ['baz'])
  assert.is(bar.readdir({}).length, 0)
  foo.unlink('baz')
})

test('readdir', () => {
  const foo = new Directory()
  foo.mkfile('baz')
  foo.symlink('bar', '/baz')

  assert.equal(foo.readdir({ encoding: 'hex' }), ['626172', '62617a'])
  assert.is(foo.readdir({ encoding: 'buffer' })[0].toString(), 'bar')
  assert.ok(foo.readdir({ withFileTypes: true })[1].isFile())

  foo.unlink('bar')
  foo.unlink('baz')
})

test.run()
