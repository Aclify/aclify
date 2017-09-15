// @flow
import _ from 'lodash';
import Store from '../interfaces/store';
import Common from '../classes/common';

export default class Memory extends Common implements Store {
  buckets: {};

  constructor() {
    super();
    this.buckets = {}
  }

  /**
   * @description Begins a transaction.
   * @return {Array}
   */
  begin() {
    return [];
  }

  /**
   * @description Ends a transaction (and executes it)
   * @param transaction
   * @param callback
   */
  end(transaction: Array<any>, callback: () => void) {
    for (let i = 0, len = transaction.length; i < len; i++) {
      transaction[i]();
    }
    callback();
  }

  /**
   * @description Cleans the whole storage.
   * @param callback
   */
  clean(callback: () => void) {
    this.buckets = {};
    callback();
  }

  /**
   * @description Gets the contents at the bucket's key.
   * @param bucket
   * @param key
   * @param callback
   */
  get (bucket: string, key: string | number, callback: (key: null, value: Array<any>) => void) {
    if (this.buckets[bucket]) {
      callback(null, this.buckets[bucket][key] || []);
    } else {
      callback(null, []);
    }
  }

  /**
   * @description Gets the union of the keys in each of the specified buckets
   * @param buckets
   * @param keys
   * @param callback
   */
  unions(buckets: Array<any>, keys: Array<any>, callback: (key: null, value: {}) => void) {
    let results = {};
    buckets.forEach(function (bucket) {
      if (this.buckets[bucket]) {
        results[bucket] = _.uniq(_.flatten(_.values(_.pick(this.buckets[bucket], keys))));
      } else {
        results[bucket] = [];
      }
    });
    callback(null, results);
  }

  /**
   * @description Returns the union of the values in the given keys.
   * @param bucket
   * @param keys
   * @param callback
   */
  union(bucket: string, keys: Array<any>, callback: (key: null, value: Array<any>) => void) {
    let match, re;
    if (!this.buckets[bucket]) {
      Object.keys(this.buckets).some((b) => {
        re = new RegExp(`^${b}$`);
        match = re.test(bucket);
        if (match) bucket = b;
        return match;
      });
    }

    if (this.buckets[bucket]) {
      let keyArrays = [];
      for (let i = 0, len = keys.length; i < len; i++) {
        if (this.buckets[bucket][keys[i]]) {
          keyArrays.push.apply(keyArrays, this.buckets[bucket][keys[i]]);
        }
      }
      callback(null, _.union(keyArrays));
    } else {
      callback(null, []);
    }
  }

  /**
   * @description Adds values to a given key inside a bucket.
   * @param transaction
   * @param bucket
   * @param key
   * @param values
   */
  // add(transaction: Array<any>, bucket: string, key: string | number, values: mixed) {
  //   values = this.makeArray(values);
  //
  //   transaction.push(() => {
  //     if (!this.buckets[bucket]) {
  //       this.buckets[bucket] = {};
  //     }
  //     if (!this.buckets[bucket][key]) {
  //       this.buckets[bucket][key] = values;
  //     } else {
  //       this.buckets[bucket][key] = _.union(values, this.buckets[bucket][key]);
  //     }
  //   });
  // }


  add(transaction, bucket, key, values) {
    values = this.makeArray(values);
    transaction.push(() => {
      if (!this.buckets[bucket]) {
        this.buckets[bucket] = {};
      }
      if (!this.buckets[bucket][key]) {
        this.buckets[bucket][key] = values;
      } else {
        this.buckets[bucket][key] = _.union(values, this.buckets[bucket][key]);
      }
    });
  }

  /**
   * @description Delete the given key(s) at the bucket.
   * @param transaction
   * @param bucket
   * @param keys
   */
  del(transaction: Array<any>, bucket: string, keys: string | Array<any>) {
    keys = this.makeArray(keys);
    transaction.push(() => {
      if (this.buckets[bucket]) {
        for (let i = 0, len = keys.length; i < len; i++) {
          delete this.buckets[bucket][keys[i]];
        }
      }
    });
  }

  /**
   * @description Removes values from a given key inside a bucket.
   * @param transaction
   * @param bucket
   * @param key
   * @param values
   */
  remove(transaction: Array<any>, bucket: string, key: string | number, values: mixed) {
    values = this.makeArray(values);
    transaction.push(() => {
      let old;
      if (this.buckets[bucket] && (old = this.buckets[bucket][key])) {
        this.buckets[bucket][key] = _.difference(old, values);
      }
    });
  }
}
