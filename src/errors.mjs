export const errorContext = {
  command: '',
  path: '',
  format () {
    if (!this.command) return ''
    return `, ${this.command} ${this.path}`
  },
  set (command, path) {
    this.command = command
    this.path = typeof path === 'number' ? '#' + path : path
  }
}

export function makeError (code) {
  /* c8 ignore next */
  const text = errorMessages[code] || errorMessages.UNKNOWN
  const msg = `${code}: ${text}${errorContext.format()}`
  const err = new Error(msg)
  err.code = code
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
}
