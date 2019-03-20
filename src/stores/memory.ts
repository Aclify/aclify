// @flow
import * as _ from 'lodash';
import { IStore } from '../interfaces/IStore';
import {Common} from '../classes/common';

export class MemoryStore extends Common implements IStore {
  public buckets: {};

  transaction: Array<any>;

  constructor() {
    super();
    this.buckets = {};
  }

  /**
   * @description Begins a transaction.
   * @returns {Array}
   */
  begin(): Array<[]> {
    this.transaction = [];
    return this.transaction;
  }

  /**
   * @description Ends a transaction (and executes it)
   */
  async end(): Promise<void> {
    this.transaction.forEach(async (transaction) => await Promise.resolve(transaction()));

    return;
  }

  // /**
  //  * @description Cleans the whole storage.
  //  * @param callback
  //  */
  // clean(callback: () => void) {
  //   this.buckets = {};
  //   callback();
  // }

  /**
   * @description Gets the contents at the bucket's key.
   * @param bucket
   * @param key
   */
  async get(bucket: string, key: string | number) {
    if(this.buckets[bucket]) {
      return this.buckets[bucket][key] || [];
    }

    return [];
  }

  // /**
  //  * @description Gets the union of the keys in each of the specified buckets
  //  * @param buckets
  //  * @param keys
  //  * @param callback
  //  */
  // unions(buckets: Array<any>, keys: Array<any>, callback: (key: null, value: {}) => void) {
  //   const results = {};
  //   for (let i = 0; i < buckets.length; i += 1) {
  //     if (this.buckets[buckets[i]]) {
  //       results[buckets[i]] = _.uniq(_.flatten(_.values(_.pick(this.buckets[buckets[i]], keys))));
  //     } else {
  //       results[buckets[i]] = [];
  //     }
  //   }
  //   callback(null, results);
  // }

  /**
   * @description Returns the union of the values in the given keys.
   * @param bucket
   * @param keys
   */
  async union(bucket: string, keys: Array<any>): Promise<string[]> {
    let match;
    let re;
    let bucketParam = bucket;
    if (!this.buckets[bucketParam]) {
      Object.keys(this.buckets).some((b) => {
        re = new RegExp(`^${b}$`);
        match = re.test(bucketParam);
        if (match) bucketParam = b;
        return match;
      });
    }

    if (this.buckets[bucketParam]) {
      const keyArrays = [];
      for (let i = 0, len = keys.length; i < len; i += 1) {
        if (this.buckets[bucketParam][keys[i]]) {
          keyArrays.push(...this.buckets[bucketParam][keys[i]]);
        }
      }
      return _.union(keyArrays);
    } else {

      return [];
    }
  }

  /**
   * @description Adds values to a given key inside a bucket.
   * @param bucket
   * @param key
   * @param values
   */
  async add(bucket: string, key: string | number, values: string|[string]): Promise<void> {
    const valuesArray = await Common.makeArray(values);

    this.transaction.push(() => {
      if (!this.buckets[bucket]) {
        // console.log('==== 1');

        this.buckets[bucket] = {};
      }
      if (!this.buckets[bucket][key]) {
        // console.log('==== 2');
        this.buckets[bucket][key] = valuesArray;
      } else {
        // console.log('==== union');
        this.buckets[bucket][key] = _.union(valuesArray, this.buckets[bucket][key]);
      }
    });


    // console.log('====>', this.buckets);
  }

  // /**
  //  * @description Delete the given key(s) at the bucket.
  //  * @param bucket
  //  * @param keys
  //  */
  // del(bucket: string, keys: string | Array<any>) {
  //   const keysArray = Common.makeArray(keys);
  //   this.transaction.push(() => {
  //     if (this.buckets[bucket]) {
  //       for (let i = 0, len = keysArray.length; i < len; i += 1) {
  //         delete this.buckets[bucket][keysArray[i]];
  //       }
  //     }
  //   });
  // }
  //
  // /**
  //  * @description Removes values from a given key inside a bucket.
  //  * @param bucket
  //  * @param key
  //  * @param values
  //  */
  // remove(bucket: string, key: string | number, values: mixed) {
  //   const valuesArray = Common.makeArray(values);
  //   this.transaction.push(() => {
  //     const bucketKey = this.buckets[bucket][key];
  //     if (this.buckets[bucket] && bucketKey) {
  //       this.buckets[bucket][key] = _.difference(bucketKey, valuesArray);
  //     }
  //   });
  // }
}
