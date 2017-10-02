// @flow
import RedisClient from 'redis';
import Store from '../interfaces/store';
import Common from '../classes/common';

function noop() {
};


export default class Redis extends Common implements Store {
  buckets: {};
  transaction: Array<any>;
  redis: {};
  redisPrefix: string;

  constructor(rds: RedisClient) {
    super();
    this.buckets = {};
    this.redis = rds;
    this.redisPrefix = 'acl';
  }

  /**
   * @description Begins a transaction
   * @returns {*}
   */
  begin() {
    this.transaction = this.redis.multi();
    return this.transaction;
  }

  /**
   * @description Ends a transaction (and executes it)
   * @param cb
   */
  end(cb) {
    this.transaction.exec(() => cb());
  }

  /**
   * @description Cleans the whole storage.
   * @param cb
   */
  clean(cb) {
    this.redis.keys(`${this.redisPrefix}*`, (err, keys) => {
      if (keys.length) this.redis.del(keys, () => cb());
      else cb();
    });
  }

  /**
   * @description Gets the contents at the bucket's key.
   * @param bucket
   * @param key
   * @param cb
   */
  get(bucket, key, cb) {
    this.redis.smembers(this.bucketKey(bucket, key), cb);
  }

  /**
   * @description Gets an object mapping each passed bucket to the union of the specified keys inside that bucket.
   * @param buckets
   * @param keys
   * @param cb
   */
  unions(buckets, keys, cb) {
    // console.log(`================================================================================================`)
    // console.log(buckets)
    // console.log(keys)
    // console.log(`==========//========`)
    const redisKeys = {};
    const batch = this.redis.batch();



    for (let i = 0; i < buckets.length; i += 1) {
      redisKeys[buckets[i]] = this.bucketKey(buckets[i], keys);
      batch.sunion(redisKeys[buckets[i]], noop);
    }

    batch.exec((err, replies) => {
      if (!Array.isArray(replies)) return {};
      const result = {};
      for (let i = 0; i < replies.length; i += 1) {
        if (replies[i] instanceof Error) throw replies[i];
        result[buckets[i]] = replies[i];
      }
      return cb(err, result);
    });
  }

  /**
   * @description Returns the union of the values in the given keys.
   * @param bucket
   * @param keys
   * @param cb
   */
  union(bucket, keys, cb) {
    this.redis.sunion(this.bucketKey(bucket, keys), cb);
  }

  /**
   * @description Adds values to a given key inside a bucket.
   * @param bucket
   * @param key
   * @param values
   */
  add(bucket, key, values) {
    const keyTmp = this.bucketKey(bucket, key);

    if (Array.isArray(values)) {
      for (let i = 0; i < values.length; i += 1) {
        this.redis.sadd(keyTmp, values[i]);
      }
    } else {
      this.redis.sadd(keyTmp, values);
    }
  }

  /**
   * @description Delete the given key(s) at the bucket.
   * @param bucket
   * @param keys
   */
  del(bucket, keys) {
    let keysTmp = Array.isArray(keys) ? keys : [keys];
    keysTmp = keysTmp.map((key) => this.bucketKey(bucket, key), this);
    this.redis.del(keysTmp);
  }

  /**
   * @description Removes values from a given key inside a bucket.
   * @param bucket
   * @param key
   * @param values
   */
  remove(bucket, key, values) {
    const keyTmp = this.bucketKey(bucket, key);
    if (Array.isArray(values)) {
      for (let i = 0; i < values.length; i += 1) {
        this.redis.srem(keyTmp, values[i]);
      }
    } else {
      this.redis.srem(keyTmp, values);
    }
  }

  /**
   * @description
   * @param bucket
   * @param keys
   * @returns {string}
   */
  bucketKey(bucket, keys) {
    if (Array.isArray(keys)) return this.map((key) => `${this.redisPrefix}_${bucket}@${key}`, this);
    return `${this.redisPrefix}_${bucket}@${keys}`;
  }
}
