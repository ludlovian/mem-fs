# API

Most of the v11 `fs` API is covered, with the main exceptions being:
- URL support for paths
- streams
- watches
- the experimental promises API
- anything strange that happens once you deviate from Linux

Permissions are included, but no change of ownership capabilities, which
don't really make sense in an in-process memory filesystem

The code is structured so as to allow the new `fs.promises` API once this
becomes accepted and more generally used.

## Functions covered

- [x] access <i>(path\[, mode\], callback)</i>
- [x] accessSync <i>(path\[, mode\])</i>
- [x] appendFile <i>(path, data\[, options\], callback)</i>
- [x] appendFileSync <i>(path, data\[, options\])</i>
- [x] chmod <i>(path, mode, callback)</i>
- [x] chmodSync <i>(path, mode)</i>
- [x] chown <i>(path, uid, gid, callback)/ - see note 1
- [x] chownSync <i>(path, uid, gid)/ - see note 1
- [x] close <i>(fd, callback)</i>
- [x] closeSync <i>(fd)</i>
- [x] constants
- [x] copyFile <i>(src, dst\[, flags\], callback)/ - see note 2
- [x] copyFileSync <i>(src, dst\[, flags\])/ - see note 2
- [ ] createReadStream <i>(path\[, options\])/ - see note 3
- [ ] createWriteStream <i>(path\[, options\])/ - see note 3
- [x] exists <i>(path, callback)</i>
- [x] existsSync <i>(path)</i>
- [x] fchmod <i>(fd, mode, callback)</i>
- [x] fchmodSync <i>(fd, mode)</i>
- [x] fchown <i>(fd, uid, gid, callback)/ - see note 1
- [x] fchownSync <i>(fd, uid, gid)/ - see note 1
- [x] fdatasync <i>(fd, callback)/ - see note 4
- [x] fdatasyncSync <i>(fd)/ - see note 4
- [x] fstat <i>(fd\[, options\], callback)/ - see note 5
- [x] fstatSync <i>(fd\[, options\])/ - see note 5
- [x] fsync <i>(fd, callback)/ - see note 4
- [x] fsyncSync <i>(fd)/ - see note 4
- [x] ftruncate <i>(fd\[, len\], callback)</i>
- [x] ftruncateSync <i>(fd\[, len\])</i>
- [x] futimes <i>(fd, atime, mtime, callback)</i>
- [x] futimesSync <i>(fd, atime, mtime)</i>
- [x] lchmod <i>(path, mode, callback)</i>
- [x] lchmodSync <i>(path, mode)</i>
- [x] lchown <i>(path, uid, gid, callback)</i>
- [x] lchownSync <i>(path, uid, gid)</i>
- [x] link <i>(path, newPath, callback)</i>
- [x] linkSync <i>(path, newPath)</i>
- [x] lstat <i>(path\[, options\], callback)</i>
- [x] lstatSync <i>(path\[, options\])</i>
- [x] mkdir <i>(path,\[, options\], callback)</i>
- [x] mkdirSync <i>(path,\[, options\])</i>
- [x] mkdtemp <i>(prefix\[, options\], callback)</i>
- [x] mkdtempSync <i>(prefix\[, options\])</i>
- [x] open <i>(path\[, flags\[, mode\]\], callback)</i>
- [x] openSync <i>(path\[, flags\[, mode\]\])</i>
- [ ] promises
- [x] read <i>(fd, buffer, offset, length, position, callback)</i>
- [x] readdir <i>(path\[, options\], callback)</i>
- [x] readdirSync <i>(path\[, options\])</i>
- [x] readFile <i>(path\[, options\], callback)</i>
- [x] readFileSync <i>(path\[, options\])</i>
- [x] readlink <i>(path\[, options\], callback)</i>
- [x] readlinkSync <i>(path\[, options\])</i>
- [x] readSync <i>(fd, buffer, offset, length, position)</i>
- [x] realpath <i>(path\[, options\], callback)</i>
- [ ] realpath.native <i>(path\[, options\], callback)</i>
- [x] realpathSync <i>(path\[, options\])</i>
- [ ] realpathSync.native <i>(path\[, options\])</i>
- [x] rename <i>(oldPath, newPath, callback)</i>
- [x] renameSync <i>(oldPath, newPath)</i>
- [x] rmdir <i>(path, callback)</i>
- [x] rmdirSync <i>(path)</i>
- [x] stat <i>(path\[, options\], callback)</i>
- [x] statSync <i>(path\[, options\])</i>
- [x] symlink <i>(target, path\[, type\], callback)</i>
- [x] symlinkSync <i>(target, path\[, type\])</i>
- [x] truncate <i>(path\[, len\], callback)</i>
- [x] truncateSync <i>(path\[, len\])</i>
- [x] unlink <i>(path, callback)</i>
- [x] unlinkSync <i>(path)</i>
- [ ] unwatchFile <i>(filename\[, listener\])</i>
- [x] utimes <i>(path, atime, mtime, callback)</i>
- [x] utimesSync <i>(path, atime, mtime)</i>
- [ ] watch <i>(filename\[, options\]\[, listener\])</i>
- [ ] watchFile <i>(filename\[, options\], listener)</i>
- [x] write <i>(fd, buffer\[, offset\[, length[\, position\]\]\], callback)</i>
- [x] write <i>(fd, string\[, position\[, encoding\]\], callback)</i>
- [x] writeFile <i>(file, data\[, options\], callback)</i>
- [x] writeFileSync <i>(file, data\[, options\])</i>
- [x] writeSync <i>(fd, buffer\[, offset\[, length[\, position\]\]\])</i>
- [x] writeSync <i>(fd, string\[, position\[, encoding\]\])</i>
- [x] Dirent
- [ ] FileHandle
- [ ] FSWatcher
- [ ] ReadStream
- [x] Stats
- [ ] WriteStream


## Notes

- Whilst the `chmod` API is there, it will throw `ENOSYS` if called 
- Only `COPYFILE_EXCL` is honoured by `copyfile`. `COPYFILE_FICLONE` is ignored
- Streams are not implemented
- `sync` and `datasync` are no-ops
- `stat` has no support for `bigint`
- `read`, `write` and similar only support `Buffer` and not `TypedArray` or `DataView`
- The experimental `promises` API is not yet exposed
- Paths can be expressed as `string`s, and sometimes `fd`s. No support for `URL` paths.
- `symlink` ignores the `type` param.
- Watch is not implemented

