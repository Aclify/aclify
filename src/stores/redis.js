import contract from '../contract'
import _ from 'lodash'

function noop(){}

class RedisBackend {
  constructor(redis, prefix) {
    this.redis = redis
    this.prefix = prefix || 'acl'
  }

  /**
   Begins a transaction
   */
  begin() {
    return this.redis.multi()
  }

  /**
   Ends a transaction (and executes it)
   */
  end(transaction, cb) {
    contract(arguments).params('object', 'function').end()
    transaction.exec(() => {cb()})
  }

  /**
   Cleans the whole storage.
   */
  clean(cb) {
    contract(arguments).params('function').end()
    const self = this
    self.redis.keys(`${self.prefix}*`, (err, keys) => {
      if(keys.length){
        self.redis.del(keys, () => {cb()})
      }else{
        cb()
      }
    })
  }

  /**
   Gets the contents at the bucket's key.
   */
  get(bucket, key, cb) {
    contract(arguments)
      .params('string', 'string|number', 'function')
      .end()

    key = this.bucketKey(bucket, key)

    this.redis.smembers(key, cb)
  }

  /**
   Gets an object mapping each passed bucket to the union of the specified keys inside that bucket.
   */
  unions(buckets, keys, cb) {
    contract(arguments)
      .params('array', 'array', 'function')
      .end()

    const redisKeys = {}
    const batch = this.redis.batch()
    const self = this

    buckets.forEach(bucket => {
      redisKeys[bucket] = self.bucketKey(bucket, keys)
      batch.sunion(redisKeys[bucket], noop)
    })

    batch.exec((err, replies) => {
      if (!Array.isArray(replies)) {
        return {}
      }

      const result = {}
      replies.forEach((reply, index) => {
        if (reply instanceof Error) {
          throw reply
        }

        result[buckets[index]] = reply
      })
      cb(err, result)
    })
  }

  /**
   Returns the union of the values in the given keys.
   */
  union(bucket, keys, cb) {
    contract(arguments)
      .params('string', 'array', 'function')
      .end()

    keys = this.bucketKey(bucket, keys)
    this.redis.sunion(keys, cb)
  }

  /**
   Adds values to a given key inside a bucket.
   */
  add(transaction, bucket, key, values) {
    contract(arguments)
      .params('object', 'string', 'string|number','string|array|number')
      .end()

    key = this.bucketKey(bucket, key)

    if (Array.isArray(values)){
      values.forEach(value => {
        transaction.sadd(key, value)
      })
    }else{
      transaction.sadd(key, values)
    }
  }

  /**
   Delete the given key(s) at the bucket
   */
  del(transaction, bucket, keys) {
    contract(arguments)
      .params('object', 'string', 'string|array')
      .end()

    const self = this

    keys = Array.isArray(keys) ? keys : [keys]

    keys = keys.map(key => self.bucketKey(bucket, key))

    transaction.del(keys)
  }

  /**
   Removes values from a given key inside a bucket.
   */
  remove(transaction, bucket, key, values) {
    contract(arguments)
      .params('object', 'string', 'string|number','string|array|number')
      .end()

    key = this.bucketKey(bucket, key)

    if (Array.isArray(values)){
      values.forEach(value => {
        transaction.srem(key, value)
      })
    }else{
      transaction.srem(key, values)
    }
  }

  //
  // Private methods
  //

  bucketKey(bucket, keys) {
    const self = this
    if(Array.isArray(keys)){
      return keys.map(key => `${self.prefix}_${bucket}@${key}`)
    }else{
      return `${self.prefix}_${bucket}@${keys}`
    }
  }
}

exports = module.exports = RedisBackend
