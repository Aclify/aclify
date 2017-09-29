// @flow
import _ from 'lodash';
import Store from '../interfaces/store';
import Common from '../classes/common';

export default class Memory extends Common implements Store {
  buckets: {};
  transaction: Array;

  constructor() {
    super();
    this.buckets = {};
  }

  /**
   * @description Begins a transaction.
   * @returns {Array}
   */
  begin(): Array {
    this.transaction = [];
    return this.transaction;
  }

  /**
   * @description Ends a transaction (and executes it)
   * @param callback
   */
  end(callback: () => void) {
    for (let i = 0; i < this.transaction.length; i += 1) {
      this.transaction[i]();
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
  get(bucket: string, key: string | number, callback: (key: null, value: Array<any>) => void) {
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
    const results = {};
    buckets.map((bucket) => {
      if (this.buckets[bucket]) {
        results[bucket] = _.uniq(_.flatten(_.values(_.pick(this.buckets[bucket], keys))));
      } else {
        results[bucket] = [];
      }
    }, this);
    callback(null, results);
  }

  /**
   * @description Returns the union of the values in the given keys.
   * @param bucket
   * @param keys
   * @param callback
   */
  union(bucket: string, keys: Array<any>, callback: (key: null, value: Array<any>) => void) {
    let match;
    let re;
    if (!this.buckets[bucket]) {
      Object.keys(this.buckets).some((b) => {
        re = new RegExp(`^${b}$`);
        match = re.test(bucket);
        if (match) bucket = b;
        return match;
      });
    }

    if (this.buckets[bucket]) {
      const keyArrays = [];
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
   * @param bucket
   * @param key
   * @param values
   */
  add(bucket: string, key: string | number, values: mixed) {
    const valuesArray = Common.makeArray(values);
    this.transaction.push(() => {
      if (!this.buckets[bucket]) {
        this.buckets[bucket] = {};
      }
      if (!this.buckets[bucket][key]) {
        this.buckets[bucket][key] = valuesArray;
      } else {
        this.buckets[bucket][key] = _.union(valuesArray, this.buckets[bucket][key]);
      }
    });
  }

  /**
   * @description Delete the given key(s) at the bucket.
   * @param bucket
   * @param keys
   */
  del(bucket: string, keys: string | Array<any>) {
    const keysArray = Common.makeArray(keys);
    this.transaction.push(() => {
      if (this.buckets[bucket]) {
        for (let i = 0, len = keysArray.length; i < len; i++) {
          delete this.buckets[bucket][keysArray[i]];
        }
      }
    });
  }

  /**
   * @description Removes values from a given key inside a bucket.
   * @param bucket
   * @param key
   * @param values
   */
  remove(bucket: string, key: string | number, values: mixed) {
    const valuesArray = Common.makeArray(values);
    this.transaction.push(() => {
      let old;
      if (this.buckets[bucket] && (old = this.buckets[bucket][key])) {
        this.buckets[bucket][key] = _.difference(old, valuesArray);
      }
    });
  }
}
