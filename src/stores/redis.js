// @flow
import _ from 'lodash';
import Redis from 'redis';
import Store from '../interfaces/store';
import Common from '../classes/common';

export default class Redis extends Common implements Store {
  buckets: {};
  transaction: Array<any>;
  redis: {};
  redisPrefix: string;

  constructor(redis: Redis) {
    super();
    this.buckets = {};
    this.redis = redis;
  }

  /**
   * @description Begins a transaction
   * @returns {*}
   */
  begin() {
    return this.redis.multi();
  }

  /**
   * @description Ends a transaction (and executes it)
   * @param transaction
   * @param cb
   */
  end(transaction, cb) {
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
   Adds values to a given key inside a bucket.
   */
  add(transaction, bucket, key, values) {
    let key = this.bucketKey(bucket, key);

    if (Array.isArray(values)) {
      values.forEach(function (value) {
        transaction.sadd(key, value);
      });
    } else {
      transaction.sadd(key, values);
    }
  }

  /**
   Delete the given key(s) at the bucket
   */
  del(transaction, bucket, keys) {
    var self = this;

    keys = Array.isArray(keys) ? keys : [keys]

    keys = keys.map(function (key) {
      return self.bucketKey(bucket, key);
    });

    transaction.del(keys);
  }

  /**
   Removes values from a given key inside a bucket.
   */
  remove(transaction, bucket, key, values) {
    key = this.bucketKey(bucket, key);

    if (Array.isArray(values)) {
      values.forEach(function (value) {
        transaction.srem(key, value);
      });
    } else {
      transaction.srem(key, values);
    }
  }

  bucketKey(bucket, keys) {
    var self = this;
    if (Array.isArray(keys)) {
      return keys.map(function (key) {
        return self.redisPrefix + '_' + bucket + '@' + key;
      });
    } else {
      return self.redisPrefix + '_' + bucket + '@' + keys;
    }


  }
}





