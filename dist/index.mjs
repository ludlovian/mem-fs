import { Stats, constants, Dirent as Dirent$1, ReadStream, WriteStream } from 'fs';
import ow from 'ow';
import { resolve, dirname } from 'path';

const errorContext = {
  command: '',
  path: '',
  format () {
    if (!this.command) return ''
    return `, ${this.command} ${this.path}`
  },
  set (command, path) {
    this.command = command;
    this.path = typeof path === 'number' ? '#' + path : path;
  }
};
function makeError (code) {
  const text = errorMessages[code] || errorMessages.UNKNOWN;
  const msg = `${code}: ${text}${errorContext.format()}`;
  const err = new Error(msg);
  err.code = code;
  return err
}
const errorMessages = {
  ENOENT: 'No such file or directory',
  ENOTDIR: 'Not a directory',
  EEXIST: 'Already exists',
  EACCES: 'Permission denied',
  EPERM: 'Operation not permitted',
  ENOTEMPTY: 'Directory not empty',
  ELOOP: 'Too many levels of smybolic links',
  EBADF: 'Bad file descriptor',
  ENFILE: 'Too many files open',
  EISDIR: 'Is a directrory',
  EINVAL: 'Invalid argument',
  ENOSYS: 'Operation not supported',
  UNKNOWN: 'Unknown error'
};

class IdPool {
  constructor (start) {
    this.next = start;
    this.unused = [];
    this.map = new Map();
  }
  allocate (item) {
    const id = this.unused.length ? this.unused.shift() : this.next++;
    this.map.set(id, item);
    return id
  }
  get (id) {
    return this.map.get(id)
  }
  release (id) {
    this.map.delete(id);
    this.unused.push(id);
  }
}
const fds = new IdPool(1001);
const inodes = new IdPool(10001);

class Node {
  constructor (mode) {
    const now = Date.now();
    this.ino = inodes.allocate(this);
    this.mode = mode;
    this.uid = process.getuid();
    this.gid = process.getgid();
    this.atimeMs = now;
    this.ctimeMs = now;
    this.mtimeMs = now;
    this.birthMs = now;
    this.nlink = 0;
  }
  release () {
    inodes.release(this.ino);
  }
  get size () {
    return 512
  }
  get perms () {
    return this.mode & 0o777
  }
  addref () {
    this.nlink++;
  }
  decref () {
    if (--this.nlink === 0) this.release();
  }
  stat () {
    this.ensureReadAccess();
    const dev = 0;
    const rdev = 0;
    const blksize = 2048;
    return new Stats(
      dev,
      this.mode,
      this.nlink,
      this.uid,
      this.gid,
      rdev,
      blksize,
      this.ino,
      this.size,
      Math.ceil(this.size / blksize),
      this.atimeMs,
      this.mtimeMs,
      this.ctimeMs,
      this.birthMs
    )
  }
  setPerms (perms) {
    ow(perms, ow.number);
    this.mode = (this.mode & ~0o777) | (perms & 0o777);
  }
  atouch () {
    this.atimeMs = Date.now();
  }
  ctouch () {
    this.atimeMs = this.ctimeMs = Date.now();
  }
  mtouch () {
    this.atimeMs = this.mtimeMs = Date.now();
  }
  touch () {
    this.atimeMs = this.mtimeMs = this.ctimeMs = Date.now();
  }
  checkReadAccess () {
    return checkAccess(
      this.perms,
      constants.S_IRUSR,
      constants.S_IRGRP,
      constants.S_IROTH,
      this.uid,
      this.gid
    )
  }
  checkWriteAccess () {
    return checkAccess(
      this.perms,
      constants.S_IWUSR,
      constants.S_IWGRP,
      constants.S_IWOTH,
      this.uid,
      this.gid
    )
  }
  checkExecuteAccess () {
    return checkAccess(
      this.perms,
      constants.S_IXUSR,
      constants.S_IXGRP,
      constants.S_IXOTH,
      this.uid,
      this.gid
    )
  }
  checkOwner () {
    return true
  }
  ensureReadAccess () {
    if (!this.checkReadAccess()) throw makeError('EACCES')
  }
  ensureWriteAccess () {
    if (!this.checkWriteAccess()) throw makeError('EACCES')
  }
  ensureExecuteAccess () {
    if (!this.checkExecuteAccess()) throw makeError('EACCES')
  }
  ensureOwner () {}
  chmod (mode) {
    ow(mode, 'mode', ow.number.integer);
    this.ensureOwner();
    this.setPerms(mode);
    this.ctouch();
  }
  chown (uid, gid) {
    ow(uid, 'uid', ow.number.integer);
    ow(gid, 'gid', ow.number.integer);
    throw makeError('ENOSYS')
  }
  utimes (atime, mtime) {
    const validTime = ow.any(ow.string.matches(/^[\d.]+$/), ow.number, ow.date);
    ow(atime, 'atime', validTime);
    ow(mtime, 'mtime', validTime);
    this.ensureOwner();
    this.atimeMs = timeInMs(atime);
    this.mtimeMs = timeInMs(mtime);
    this.ctimeMs = Date.now();
  }
  access (mode) {
    ow(mode, 'accessMode', ow.number.integer.inRange(0, 7));
    if ((mode & constants.R_OK) !== 0 && !this.checkReadAccess()) return false
    if ((mode & constants.W_OK) !== 0 && !this.checkWriteAccess()) return false
    if ((mode & constants.X_OK) !== 0 && !this.checkExecuteAccess()) return false
    return true
  }
}
function checkAccess (perms, ubit, gbit, obit, uid, gid) {
  if (perms & ubit && process.getuid() === uid) return true
  if (perms & gbit && process.getgid() === gid) return true
  if (perms & obit) return true
  return false
}
function timeInMs (v) {
  return v instanceof Date ? v.getTime() : +v * 1000
}

function encode (data, encoding) {
  if (encoding === 'utf8') return data
  if (encoding === 'buffer') return Buffer.from(data, 'utf8')
  return Buffer.from(data, 'utf8').toString(encoding)
}

const DEFAULT_FILE_MODE = 0o666 & ~process.umask();
class Symlink extends Node {
  constructor (target, mode = DEFAULT_FILE_MODE) {
    ow(target, ow.string.nonEmpty);
    ow(mode, ow.number.integer);
    super((mode & 0o777) | constants.S_IFLNK);
    this.isRelative = target[0] !== '/';
    this._steps = target.split('/').filter(Boolean);
  }
  steps () {
    this.ensureReadAccess();
    return [...this._steps]
  }
  readlink (options = {}) {
    ow(options, 'encodingOrOptions', ow.any(ow.string, ow.object));
    if (typeof options === 'string') options = { encoding: options };
    const { encoding = 'utf8' } = options;
    const target = (this.isRelative ? '' : '/') + this._steps.join('/');
    return encode(target, encoding)
  }
}

const DEFAULT_FILE_MODE$1 = 0o666 & ~process.umask();
class File extends Node {
  constructor (mode = DEFAULT_FILE_MODE$1) {
    ow(mode, ow.number.integer);
    super((mode & 0o777) | constants.S_IFREG);
    this.data = Buffer.allocUnsafe(0);
  }
  get size () {
    return this.data.length
  }
  truncate (size = 0) {
    ow(size, ow.number.integer);
    if (size <= this.size) {
      this.data = this.data.slice(0, size);
    } else {
      this.data = Buffer.concat([this.data, Buffer.alloc(size - this.size)]);
    }
    this.mtouch();
  }
  open (flags) {
    ow(flags, ow.number.integer);
    if ((flags & 3) === constants.O_RDONLY) {
      this.ensureReadAccess();
    } else if ((flags & 3) === constants.O_WRONLY) {
      this.ensureWriteAccess();
    } else {
      this.ensureReadAccess();
      this.ensureWriteAccess();
    }
    return new Filehandle(this, flags)
  }
  static get (fd) {
    const fh = fds.get(fd);
    if (!fh) throw makeError('EBADF')
    return fh
  }
}
class Filehandle {
  constructor (file, flags) {
    this.file = file;
    this._flags = flags;
    this.fd = fds.allocate(this);
    if ((this._flags & constants.O_TRUNC) !== 0) this.file.truncate(0);
    this._pos = (this._flags & constants.O_APPEND) !== 0 ? this.file.size : 0;
  }
  close () {
    fds.release(this.fd);
    this.file = this.fd = null;
  }
  _setPos (pos) {
    this._pos = minmax(pos, 0, this.file.size);
  }
  _ensureReadble () {
    if ((this._flags & 3) === constants.O_WRONLY) throw makeError('EACCES')
  }
  _ensureWritable () {
    if ((this._flags & 3) === constants.O_RDONLY) throw makeError('EACCES')
  }
  write (buffer, ...args) {
    ow(buffer, 'stringOrBuffer', ow.any(ow.buffer, ow.string));
    let offset;
    let length;
    let position;
    let encoding;
    if (typeof buffer === 'string') {
[position, encoding = 'utf8'] = args;
      ow(position, 'position', ow.optional.number.integer);
      ow(encoding, 'encoding', ow.string.nonEmpty);
      buffer = Buffer.from(buffer, encoding);
      length = buffer.length;
      offset = 0;
    } else {
[offset, length, position] = args;
      ow(offset, 'offset', ow.optional.number.integer);
      ow(length, 'length', ow.optional.number.integer);
      ow(position, 'position', ow.optional.number.integer);
      if (offset == null) offset = 0;
      if (length == null) length = buffer.length - offset;
    }
    this._ensureWritable();
    if (position != null) this._setPos(position);
    const newPos = this._pos + length;
    const preData = this.file.data.slice(0, this._pos);
    const newData = buffer.slice(offset, length + offset);
    const postData = this.file.data.slice(newPos, this.file.size);
    this.file.data = Buffer.concat([preData, newData, postData]);
    this.file.mtouch();
    this._setPos(newPos);
    return length
  }
  read (buffer, offset, length, position) {
    ow(buffer, 'buffer', ow.buffer);
    ow(offset, 'offset', ow.number.integer);
    ow(length, 'length', ow.number.integer);
    ow(position, 'position', ow.optional.number.integer);
    this._ensureReadble();
    const start =
      position == null ? this._pos : minmax(position, 0, this.file.size);
    const end = minmax(start + length, 0, this.file.size);
    const nbytes = this.file.data.copy(buffer, offset, start, end);
    this.file.atouch();
    if (position == null) this._setPos(this._pos + length);
    return nbytes
  }
  appendFile (data, options = {}) {
    ow(options, 'encodingOrOptions', ow.any(ow.string.nonEmpty, ow.object));
    ow(data, 'data', ow.any(ow.buffer, ow.string));
    if (typeof options === 'string') options = { encoding: options };
    const { encoding = 'utf8' } = options;
    if (typeof data === 'string') data = Buffer.from(data, encoding);
    this.write(data, 0, data.length, this.file.size);
  }
  readFile (options = {}) {
    ow(options, 'encodingOrOptions', ow.any(ow.string.nonEmpty, ow.object));
    if (typeof options === 'string') options = { encoding: options };
    const { encoding } = options;
    const buffer = Buffer.alloc(this.file.size);
    this.read(buffer, 0, this.file.size, 0);
    if (encoding) return buffer.toString(encoding)
    return buffer
  }
  writeFile (data, options) {
    this.truncate();
    this.appendFile(data, options);
  }
  stat (...args) {
    return this.file.stat(...args)
  }
  chmod (...args) {
    return this.file.chmod(...args)
  }
  chown (...args) {
    return this.file.chown(...args)
  }
  sync () {}
  datasync () {}
  truncate (...args) {
    return this.file.truncate(...args)
  }
  utimes (...args) {
    return this.file.utimes(...args)
  }
}
function minmax (n, min, max) {
  return Math.max(min, Math.min(max, n))
}

const DEFAULT_DIR_MODE = 0o777 & ~process.umask();
const DEFAULT_FILE_MODE$2 = 0o666 & ~process.umask();
class Directory extends Node {
  constructor (mode = DEFAULT_DIR_MODE) {
    ow(mode, ow.number);
    super((mode & 0o777) | constants.S_IFDIR);
    this._links = new Map();
  }
  get (name) {
    ow(name, ow.string);
    this.ensureExecuteAccess();
    const node = this._links.get(name);
    if (!node) throw makeError('ENOENT')
    return node
  }
  has (name) {
    ow(name, ow.string);
    this.ensureReadAccess();
    return this._links.has(name)
  }
  set (name, node) {
    ow(name, ow.string.nonEmpty);
    ow(name, ow.string.not.matches(/\//));
    ow(node, ow.object.instanceOf(Node));
    this.ensureWriteAccess();
    if (this._links.has(name)) throw makeError('EEXIST')
    this._links.set(name, node);
    this.mtouch();
    node.addref();
    node.ctouch();
  }
  isEmpty () {
    return !Array.from(this._links.keys()).some(
      name => name !== '.' && name !== '..'
    )
  }
  delete (name) {
    const node = this.get(name);
    this.ensureWriteAccess();
    this._links.delete(name);
    this.mtouch();
    node.decref();
    node.ctouch();
  }
  find (path, { toDir = false, followLinks = true } = {}, limit = 100) {
    let node = this;
    let step;
    let stepsLeft = resolve(path)
      .slice(1)
      .split('/')
      .filter(Boolean);
    let stepsTaken = [];
    while (stepsLeft.length) {
      if (!--limit) throw makeError('ELOOP')
      if (stepsLeft.length === 1 && toDir) break
      step = stepsLeft.shift();
      const next = node.get(step);
      if (followLinks && next instanceof Symlink) {
        if (!next.isRelative) {
          node = this;
          stepsTaken = [];
        }
        stepsLeft = [...next.steps(), ...stepsLeft];
      } else if (next instanceof Directory) {
        stepsTaken.push(step);
        node = next;
      } else {
        if (stepsLeft.length) throw makeError('ENOTDIR')
        stepsTaken.push(step);
        node = next;
      }
    }
    path = '/' + stepsTaken.join('/');
    if (toDir) {
      return { path, node, name: stepsLeft[0] }
    } else {
      return { path, node }
    }
  }
  lfind (path, options = {}) {
    return this.find(path, { ...options, followLinks: false })
  }
  findDir (path, options = {}) {
    return this.find(path, { ...options, toDir: true })
  }
  mkdir (name, mode) {
    ow(name, 'name', ow.string.nonEmpty);
    ow(mode, 'mode', ow.optional.number.integer);
    const subdir = new Directory(mode);
    try {
      this.set(name, subdir);
    } catch (err) {
      subdir.release();
      throw err
    }
    subdir.set('.', subdir);
    subdir.set('..', this);
  }
  mkfile (name, mode) {
    ow(name, ow.string.nonEmpty);
    ow(mode, ow.optional.number.integer);
    const file = new File(mode);
    this.set(name, file);
    return file
  }
  rmdir (name) {
    ow(name, 'name', ow.string.nonEmpty);
    const subdir = this.get(name);
    if (!(subdir instanceof Directory)) throw makeError('ENOTDIR')
    if (!subdir.isEmpty()) throw makeError('ENOTEMPTY')
    this.delete(name);
    subdir.delete('.');
    subdir.delete('..');
  }
  symlink (name, target) {
    ow(name, 'name', ow.string.nonEmpty);
    ow(target, 'target', ow.string.nonEmpty);
    const symlink = new Symlink(target);
    this.set(name, symlink);
  }
  link (name, node) {
    ow(name, 'name', ow.string.nonEmpty);
    ow(node, ow.object.instanceOf(Node));
    if (node instanceof Directory) throw makeError('EPERM')
    this.set(name, node);
  }
  unlink (name) {
    ow(name, 'name', ow.string.nonEmpty);
    const node = this.get(name);
    if (node instanceof Directory) throw makeError('EISDIR')
    this.delete(name);
  }
  move (name, newDir, newName) {
    ow(name, 'name', ow.string.nonEmpty);
    ow(newDir, 'newDir', ow.object.instanceOf(Directory));
    ow(newName, 'newName', ow.string.nonEmpty);
    this.ensureWriteAccess();
    newDir.ensureWriteAccess();
    const node = this.get(name);
    if (node instanceof Directory) {
      if (newDir.has(newName)) newDir.rmdir(newName);
    } else {
      if (newDir.has(newName)) newDir.unlink(newName);
    }
    newDir.set(newName, node);
    this.delete(name);
  }
  readdir (options = {}) {
    ow(options, 'encodingOrOptions', ow.any(ow.string, ow.object));
    if (typeof options === 'string') options = { encoding: options };
    const { encoding = 'utf8', withFileTypes = false } = options;
    return Array.from(this._links.keys())
      .filter(name => name !== '.' && name !== '..')
      .sort()
      .map(name => encode(name, encoding))
      .map(name =>
        withFileTypes ? new Dirent(name, this._links.get(name).stat()) : name
      )
  }
}
const kStats = Symbol('stats');
class Dirent extends Dirent$1 {
  constructor (name, stats) {
    super(name, null);
    this[kStats] = stats;
  }
}
for (const name of Reflect.ownKeys(Dirent$1.prototype)) {
  if (name === 'constructor') continue
  Dirent.prototype[name] = function () {
    return this[kStats][name]()
  };
}

class Filesystem {
  constructor () {
    this.root = new Directory();
    this.root.set('.', this.root);
    this.root.set('..', this.root);
  }
  mkdir (path, options = {}) {
    ow(path, 'path', ow.string.nonEmpty);
    ow(options, 'modeOrOptions', ow.any(ow.number.integer, ow.object));
    if (typeof options === 'number') options = { mode: options };
    const { recursive = false, mode } = options;
    try {
      const { node: dir, name } = this.root.findDir(path);
      dir.mkdir(name, mode);
    } catch (err) {
      if (err.code === 'ENOENT' && recursive) {
        this.mkdir(dirname(path), options);
        return this.mkdir(path, options)
      }
      throw err
    }
  }
  rmdir (path) {
    ow(path, 'path', ow.string.nonEmpty);
    if (path === '/') throw makeError('EPERM')
    const { node: dir, name } = this.root.findDir(path);
    dir.rmdir(name);
  }
  symlink (target, path) {
    ow(path, 'path', ow.string.nonEmpty);
    const { node: dir, name } = this.root.findDir(path);
    dir.symlink(name, target);
  }
  link (path, newPath) {
    ow(path, 'path', ow.string.nonEmpty);
    ow(newPath, 'newPath', ow.string.nonEmpty);
    const { node } = this.root.lfind(path);
    const { node: dir, name } = this.root.findDir(newPath);
    dir.link(name, node);
  }
  unlink (path) {
    ow(path, 'path', ow.string.nonEmpty);
    const { node: dir, name } = this.root.findDir(path);
    dir.unlink(name);
  }
  rename (path, newPath) {
    ow(path, 'path', ow.string.nonEmpty);
    ow(newPath, 'newPath', ow.string.nonEmpty);
    const { node: srcDir, name: srcName } = this.root.findDir(path);
    const { node: dstDir, name: dstName } = this.root.findDir(newPath);
    srcDir.move(srcName, dstDir, dstName);
  }
  stat (path) {
    ow(path, 'path', ow.string.nonEmpty);
    return this.root.find(path).node.stat()
  }
  lstat (path) {
    ow(path, 'path', ow.string.nonEmpty);
    return this.root.lfind(path).node.stat()
  }
  chmod (path, mode) {
    ow(path, 'path', ow.string.nonEmpty);
    return this.root.find(path).node.chmod(mode)
  }
  lchmod (path, mode) {
    ow(path, 'path', ow.string.nonEmpty);
    return this.root.lfind(path).node.chmod(mode)
  }
  chown (path, uid, gid) {
    ow(path, 'path', ow.string.nonEmpty);
    return this.root.find(path).node.chown(uid, gid)
  }
  lchown (path, uid, gid) {
    ow(path, 'path', ow.string.nonEmpty);
    return this.root.lfind(path).node.chown(uid, gid)
  }
  truncate (path, size = 0) {
    ow(path, 'path', ow.string.nonEmpty);
    const { node: file } = this.root.find(path);
    if (!(file instanceof File)) throw makeError('EISDIR')
    file.truncate(size);
  }
  utimes (path, atime, mtime) {
    ow(path, 'path', ow.string.nonEmpty);
    return this.root.find(path).node.utimes(atime, mtime)
  }
  lutimes (path, atime, mtime) {
    ow(path, 'path', ow.string.nonEmpty);
    return this.root.lfind(path).node.utimes(atime, mtime)
  }
  readlink (path, options) {
    ow(path, 'path', ow.string.nonEmpty);
    const { node: symlink } = this.root.lfind(path);
    if (!(symlink instanceof Symlink)) throw makeError('EINVAL')
    return symlink.readlink(options)
  }
  readdir (path, options) {
    ow(path, 'path', ow.string.nonEmpty);
    const { node: dir } = this.root.find(path);
    if (!(dir instanceof Directory)) throw makeError('ENOTDIR')
    return dir.readdir(options)
  }
  realpath (path, options = {}) {
    ow(path, 'path', ow.string.nonEmpty);
    ow(options, 'encodingOrOptions', ow.any(ow.string, ow.object));
    if (typeof options === 'string') options = { encoding: options };
    const { encoding = 'utf8' } = options;
    const { path: realpath } = this.root.find(path);
    return encode(realpath, encoding)
  }
  access (path, mode = constants.F_OK) {
    ow(path, 'path', ow.string.nonEmpty);
    try {
      const { node } = this.root.find(path);
      return node.access(mode)
    } catch (err) {
      return false
    }
  }
  exists (path) {
    try {
      this.stat(path);
      return true
    } catch (err) {
      return false
    }
  }
  open (path, flags, mode) {
    ow(path, 'path', ow.string.nonEmpty);
    flags = decodeOpenFlags(flags);
    if ((flags & constants.O_CREAT) === 0) {
      const { node: file } = this.root.find(path);
      if (!(file instanceof File)) throw makeError('EISDIR')
      return file.open(flags)
    }
    const { node: dir, name } = this.root.findDir(path);
    if (!dir.has(name)) {
      return dir.mkfile(name, mode).open(flags)
    }
    const file = dir.get(name);
    if (!(file instanceof File)) throw makeError('EISDIR')
    if ((flags & constants.O_EXCL) !== 0) throw makeError('EEXIST')
    return file.open(flags)
  }
  readFile (source, options = {}) {
    ow(
      source,
      'fileNameOrDescriptor',
      ow.any(ow.number.integer, ow.string.nonEmpty)
    );
    ow(options, 'encodingOrOptions', ow.any(ow.string.nonEmpty, ow.object));
    if (typeof options === 'string') options = { encoding: options };
    const { encoding, flag = 'r' } = options;
    if (typeof source === 'number') {
      return File.get(source).readFile({ encoding })
    }
    const fh = this.open(source, flag);
    try {
      return fh.readFile({ encoding })
    } finally {
      fh.close();
    }
  }
  writeFile (source, data, options = {}) {
    ow(
      source,
      'fileNameOrDescriptor',
      ow.any(ow.number.integer, ow.string.nonEmpty)
    );
    ow(options, 'encodingOrOptions', ow.any(ow.string.nonEmpty, ow.object));
    if (typeof options === 'string') options = { encoding: options };
    const { encoding = 'utf8', flag = 'w', mode = 0o666 } = options;
    if (typeof source === 'number') {
      return File.get(source).writeFile(data, { encoding })
    }
    const fh = this.open(source, flag, mode);
    try {
      return fh.writeFile(data, { encoding })
    } finally {
      fh.close();
    }
  }
  appendFile (source, data, options = {}) {
    ow(
      source,
      'fileNameOrDescriptor',
      ow.any(ow.number.integer, ow.string.nonEmpty)
    );
    ow(options, 'encodingOrOptions', ow.any(ow.string.nonEmpty, ow.object));
    if (typeof options === 'string') options = { encoding: options };
    const { encoding = 'utf8', flag = 'a', mode = 0o666 } = options;
    if (typeof source === 'number') {
      return File.get(source).appendFile(data, { encoding })
    }
    const fh = this.open(source, flag, mode);
    try {
      return fh.appendFile(data, { encoding })
    } finally {
      fh.close();
    }
  }
  copyFile (sourcePath, destinationPath, flags = 0) {
    ow(sourcePath, 'sourcePath', ow.string.nonEmpty);
    ow(destinationPath, 'destinationPath', ow.string.nonEmpty);
    ow(flags, ow.number.integer);
    const flag = flags & constants.COPYFILE_EXCL ? 'wx' : 'w';
    const data = this.readFile(sourcePath);
    this.writeFile(destinationPath, data, { flag });
  }
  mkdtemp (prefix, options) {
    ow(prefix, 'prefix', ow.string.nonEmpty);
    while (true) {
      const path =
        prefix +
        Math.random()
          .toString(36)
          .slice(2, 10);
      try {
        this.mkdir(path);
        return this.realpath(path, options)
      } catch (err) {
        if (err.code !== 'EEXIST') throw err
      }
    }
  }
}
function decodeOpenFlags (flags) {
  if (typeof flags === 'number') return flags
  if (flags in OPEN_MODES) return OPEN_MODES[flags]
  throw new Error('Unknown file flags: ' + flags)
}
const OPEN_MODES = {
  r: constants.O_RDONLY,
  'r+': constants.O_RDWR,
  w: constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC,
  wx: constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_EXCL,
  'w+': constants.O_RDWR | constants.O_CREAT | constants.O_TRUNC,
  'wx+': constants.O_RDWR | constants.O_CREAT | constants.O_TRUNC | constants.O_EXCL,
  a: constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT,
  ax: constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_EXCL,
  'a+': constants.O_RDWR | constants.O_APPEND | constants.O_CREAT,
  'ax+': constants.O_RDWR | constants.O_APPEND | constants.O_CREAT | constants.O_EXCL
};

class MemFS {
  constructor () {
    const fs = new Filesystem();
    this.constants = constants;
    this.Stats = Stats;
    this.ReadStream = ReadStream;
    this.WriteStream = WriteStream;
    for (const name of fsMethods) {
      this[name + 'Sync'] = makeMethod(fs, name);
    }
    for (const name of fdMethods) {
      this[name + 'Sync'] = makeFdMethod(fs, name);
    }
    this.openSync = (...args) => fs.open(...args).fd;
    for (const name of Object.keys(this)) {
      if (!name.endsWith('Sync')) continue
      this[name.replace(/Sync$/, '')] = makeAsync(this[name]);
    }
    this.exists = (...args) => {
      const cb = getCallback(args);
      exec(() => this.existsSync(...args)).then(cb);
    };
    this.read = (...args) => {
      const cb = getCallback(args);
      const buffer = args[1];
      exec(() => this.readSync(...args)).then(
        res => cb(null, res, buffer),
        err => cb(err)
      );
    };
    this.write = (...args) => {
      const cb = getCallback(args);
      const buffer = args[1];
      exec(() => this.writeSync(...args)).then(
        res => cb(null, res, buffer),
        err => cb(err)
      );
    };
    Object.defineProperties(
      this,
      Object.entries(this).reduce((obj, [name, value]) => {
        obj[name] = {
          configurable: true,
          enumerable: false,
          writable: true,
          value
        };
        return obj
      }, {})
    );
  }
}
const fdMethods = [
  'read',
  'write',
  'close',
  'fstat',
  'fchmod',
  'fchown',
  'fsync',
  'fdatasync',
  'ftruncate',
  'futimes'
];
const fsMethods = [
  'mkdir',
  'stat',
  'lstat',
  'rmdir',
  'chmod',
  'lchmod',
  'chown',
  'lchown',
  'symlink',
  'link',
  'rename',
  'unlink',
  'truncate',
  'utimes',
  'lutimes',
  'readlink',
  'realpath',
  'readdir',
  'access',
  'exists',
  'appendFile',
  'readFile',
  'writeFile',
  'copyFile'
];
function makeMethod (fs, name) {
  return (...args) => {
    errorContext.set(name, args[0]);
    return fs[name](...args)
  }
}
function makeFdMethod (fs, name) {
  const methName = name.replace(/^f/, '');
  return (fd, ...args) => {
    errorContext.set(name, fd);
    return File.get(fd)[methName](...args)
  }
}
function makeAsync (fn) {
  return (...args) => {
    const cb = getCallback(args);
    exec(() => fn(...args)).then(result => cb(null, result), error => cb(error));
  }
}
function exec (fn) {
  return new Promise(resolve => resolve(fn()))
}
function getCallback (args) {
  while (args.length) {
    const cb = args.pop();
    if (typeof cb === 'function') return cb
  }
  throw new Error('No callback supplied')
}

const fs = new MemFS();

export { MemFS, fs };
