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

[x] access/(path\[, mode\], callback)/
[x] accessSync/(path\[, mode\])/
[x] appendFile/(path, data\[, options\], callback)/
[x] appendFileSync/(path, data\[, options\])/
[x] chmod/(path, mode, callback)/
[x] chmodSync/(path, mode)/
[x] chown/(path, uid, gid, callback)/ - see note 1
[x] chownSync/(path, uid, gid)/ - see note 1
[x] close/(fd, callback)/
[x] closeSync/(fd)/
[x] constants
[x] copyFile/(src, dst\[, flags\], callback)/ - see note 2
[x] copyFileSync/(src, dst\[, flags\])/ - see note 2
[ ] createReadStream/(path\[, options\])/ - see note 3
[ ] createWriteStream/(path\[, options\])/ - see note 3
[x] exists/(path, callback)/
[x] existsSync/(path)/
[x] fchmod/(fd, mode, callback)/
[x] fchmodSync/(fd, mode)/
[x] fchown/(fd, uid, gid, callback)/ - see note 1
[x] fchownSync/(fd, uid, gid)/ - see note 1
[x] fdatasync/(fd, callback)/ - see note 4
[x] fdatasyncSync/(fd)/ - see note 4
[x] fstat/(fd\[, options\], callback)/ - see note 5
[x] fstatSync/(fd\[, options\])/ - see note 5
[x] fsync/(fd, callback)/ - see note 4
[x] fsyncSync/(fd)/ - see note 4
[x] ftruncate/(fd\[, len\], callback)/
[x] ftruncateSync/(fd\[, len\])/
[x] futimes/(fd, atime, mtime, callback)/
[x] futimesSync/(fd, atime, mtime)/
[x] lchmod/(path, mode, callback)/
[x] lchmodSync/(path, mode)/
[x] lchown/(path, uid, gid, callback)/
[x] lchownSync/(path, uid, gid)/
[x] link/(path, newPath, callback)/
[x] linkSync/(path, newPath)/
[x] lstat/(path\[, options\], callback)/
[x] lstatSync/(path\[, options\])/
[x] mkdir/(path,\[, options\], callback)/
[x] mkdirSync/(path,\[, options\])/
[x] mkdtemp/(prefix\[, options\], callback)/
[x] mkdtempSync/(prefix\[, options\])/
[x] open/(path\[, flags\[, mode\]\], callback)/
[x] openSync/(path\[, flags\[, mode\]\])/
[ ] promises
[x] read/(fd, buffer, offset, length, position, callback)/
[x] readdir/(path\[, options\], callback)/
[x] readdirSync/(path\[, options\])/
[x] readFile/(path\[, options\], callback)/
[x] readFileSync/(path\[, options\])/
[x] readlink/(path\[, options\], callback)/
[x] readlinkSync/(path\[, options\])/
[x] readSync/(fd, buffer, offset, length, position)/
[x] realpath/(path\[, options\], callback)/
[ ] realpath.native/(path\[, options\], callback)/
[x] realpathSync/(path\[, options\])/
[ ] realpathSync.native/(path\[, options\])/
[x] rename/(oldPath, newPath, callback)/
[x] renameSync/(oldPath, newPath)/
[x] rmdir/(path, callback)/
[x] rmdirSync/(path)/
[x] stat/(path\[, options\], callback)/
[x] statSync/(path\[, options\])/
[x] symlink/(target, path\[, type\], callback)/
[x] symlinkSync/(target, path\[, type\])/
[x] truncate/(path\[, len\], callback)/
[x] truncateSync/(path\[, len\])/
[x] unlink/(path, callback)/
[x] unlinkSync/(path)/
[ ] unwatchFile/(filename\[, listener\])/
[x] utimes/(path, atime, mtime, callback)/
[x] utimesSync/(path, atime, mtime)/
[ ] watch/(filename\[, options\]\[, listener\])/
[ ] watchFile/(filename\[, options\], listener)/
[x] write/(fd, buffer\[, offset\[, length[\, position\]\]\], callback)/
[x] write/(fd, string\[, position\[, encoding\]\], callback)/
[x] writeFile/(file, data\[, options\], callback)/
[x] writeFileSync/(file, data\[, options\])/
[x] writeSync/(fd, buffer\[, offset\[, length[\, position\]\]\])/
[x] writeSync/(fd, string\[, position\[, encoding\]\])/
[x] Dirent
[ ] FileHandle
[ ] FSWatcher
[ ] ReadStream
[x] Stats
[ ] WriteStream


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

