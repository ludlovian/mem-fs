'use strict'

import test from 'ava'
import { constants as C } from 'fs'
import Symlink from '../src/symlink'

test('create', t => {
  const s = new Symlink('/foo/bar')
  t.false(s.isRelative)
  t.deepEqual(s.steps(), ['foo', 'bar'])
})

test('create with mode', t => {
  const s = new Symlink('foo/bar', 0o751)
  t.true(s.isRelative)
  t.deepEqual(s.steps(), ['foo', 'bar'])
  t.is(s.mode, C.S_IFLNK | 0o751)
})

test('readlink', t => {
  let s = new Symlink('/foo/bar')
  t.is(s.readlink(), '/foo/bar')

  s = new Symlink('foo/bar')
  t.deepEqual(s.readlink('buffer'), Buffer.from('foo/bar'))
  t.is(s.readlink({ encoding: 'hex' }), '666f6f2f626172')
})
