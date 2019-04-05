'use strict'

import test from 'ava'

import MemFS from '../src/fs'
import { promisify } from 'util'

test('basic sync methods', t => {
  const fs = new MemFS()
  fs.mkdirSync('/foo')
  fs.symlinkSync('/foo', '/quux')
  const fd = fs.openSync('/bar', 'w')
  fs.writeSync(fd, 'baz')
  fs.closeSync(fd)
  fs.unlinkSync('/quux')
  fs.unlinkSync('/bar')
  fs.rmdirSync('/foo')
  t.pass()
})

test('basic async methods', async t => {
  const fs = new MemFS()
  const fd = await promisify(fs.open)('/foo', 'w+')
  await promisify(fs.write)(fd, 'bar')
  const buffer = Buffer.alloc(3)
  t.is(await promisify(fs.read)(fd, buffer, 0, 3, 0), 3)
  t.is(buffer.toString(), 'bar')
  await promisify(fs.close)(fd)
  t.true(await new Promise(resolve => fs.exists('/foo', resolve)))
})

test('read/write errors', async t => {
  const fs = new MemFS()
  let fd = await promisify(fs.open)('/foo', 'w')
  await t.throwsAsync(() => promisify(fs.read)(fd, Buffer.alloc(10), 0, 3, 0), {
    code: 'EACCES'
  })
  await promisify(fs.close)(fd)

  fd = await promisify(fs.open)('/foo', 'r')
  await t.throwsAsync(() => promisify(fs.write)(fd, 'bar'), { code: 'EACCES' })
  await promisify(fs.close)(fd)
})

test('async error', async t => {
  const fs = new MemFS()
  await t.throwsAsync(() => promisify(fs.rmdir)('/foo'), { code: 'ENOENT' })

  t.throws(() => fs.rmdir('/foo'), /No callback/)
})
