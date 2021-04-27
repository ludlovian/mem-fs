export function encode (data, encoding) {
  if (encoding === 'utf8') return data
  if (encoding === 'buffer') return Buffer.from(data, 'utf8')
  return Buffer.from(data, 'utf8').toString(encoding)
}
