import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { promisify } from 'util'

import MemFS from '../src/fs.mjs'

test('basic sync methods', () => {
  const fs = new MemFS()
  fs.mkdirSync('/foo')
  fs.symlinkSync('/foo', '/quux')
  const fd = fs.openSync('/bar', 'w')
  fs.writeSync(fd, 'baz')
  fs.closeSync(fd)
  fs.unlinkSync('/quux')
  fs.unlinkSync('/bar')
  fs.rmdirSync('/foo')
  assert.ok(true)
})

test('basic async methods', async () => {
  const fs = new MemFS()
  const fd = await promisify(fs.open)('/foo', 'w+')
  await promisify(fs.write)(fd, 'bar')
  const buffer = Buffer.alloc(3)
  assert.is(await promisify(fs.read)(fd, buffer, 0, 3, 0), 3)
  assert.is(buffer.toString(), 'bar')
  await promisify(fs.close)(fd)
  assert.ok(await new Promise(resolve => fs.exists('/foo', resolve)))
})

test('read/write errors', async () => {
  const fs = new MemFS()
  let fd = await promisify(fs.open)('/foo', 'w')
  await promisify(fs.read)(fd, Buffer.alloc(10), 0, 3, 0).then(
    assert.unreachable,
    e => assert.is(e.code, 'EACCES')
  )
  await promisify(fs.close)(fd)

  fd = await promisify(fs.open)('/foo', 'r')
  await promisify(fs.write)(fd, 'bar').then(assert.unreachable, e =>
    assert.is(e.code, 'EACCES')
  )
  await promisify(fs.close)(fd)
})

test('async error', async () => {
  const fs = new MemFS()
  await promisify(fs.rmdir)('/foo').then(assert.unreachable, e =>
    assert.is(e.code, 'ENOENT')
  )

  assert.throws(() => fs.rmdir('/foo'), /No callback/)
})

test.run()
