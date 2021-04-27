import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { constants as C } from 'fs'

import Symlink from '../src/symlink.mjs'

test('create', () => {
  const s = new Symlink('/foo/bar')
  assert.not.ok(s.isRelative)
  assert.equal(s.steps(), ['foo', 'bar'])
})

test('create with mode', () => {
  const s = new Symlink('foo/bar', 0o751)
  assert.ok(s.isRelative)
  assert.equal(s.steps(), ['foo', 'bar'])
  assert.is(s.mode, C.S_IFLNK | 0o751)
})

test('readlink', () => {
  let s = new Symlink('/foo/bar')
  assert.is(s.readlink(), '/foo/bar')

  s = new Symlink('foo/bar')
  assert.equal(s.readlink('buffer'), Buffer.from('foo/bar'))
  assert.is(s.readlink({ encoding: 'hex' }), '666f6f2f626172')
})

test.run()
