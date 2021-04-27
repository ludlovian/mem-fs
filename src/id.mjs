class IdPool {
  constructor (start) {
    this.next = start
    this.unused = []
    this.map = new Map()
  }

  allocate (item) {
    const id = this.unused.length ? this.unused.shift() : this.next++
    this.map.set(id, item)
    return id
  }

  get (id) {
    return this.map.get(id)
  }

  release (id) {
    this.map.delete(id)
    this.unused.push(id)
  }
}

export const fds = new IdPool(1001)
export const inodes = new IdPool(10001)
