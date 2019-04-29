import { difference, flatten, pick, union, uniq, values as lValues } from 'lodash';
import { IStore } from '..';
import { Common } from '../classes/common';

/**
 * {@inheritDoc}
 * @description Memory store.
 */
export class MemoryStore extends Common implements IStore {
  public buckets: {};
  public transaction: Function[];

  constructor() {
    super();
    this.buckets = {};
  }

  /**
   * @description Begins a transaction.
   * @return Function[]
   */
  public begin(): Function[] {
    this.transaction = [];

    return this.transaction;
  }

  /**
   * @description Ends a transaction (and executes it).
   * @return Promise<void>
   */
  public async end(): Promise<void> {
    this.transaction.forEach((transaction: () => void) => transaction());

    return;
  }

  /**
   * @description Cleans the whole storage.
   * @return Promise<void>
   */
  public async clean(): Promise<void> {
    this.buckets = {};
  }

  /**
   * @description Gets the contents at the bucket's key.
   * @param bucket
   * @param key
   * @return Promise<string[]>
   */
  public async get(bucket: string, key: string | number): Promise<string[]> {
    if (this.buckets[bucket]) {
      return this.buckets[bucket][key] !== undefined ? this.buckets[bucket][key] : []; // tslint:disable-line no-unsafe-any
    }

    return [];
  }

  /**
   * @description Gets the union of the keys in each of the specified buckets.
   * @param buckets
   * @param keys
   * @return Promise<{}>
   */
  public async unions(buckets: string[], keys: string[]): Promise<{}> {
    const results = {};

    buckets.forEach((bucket: string) => {
      if (this.buckets[bucket]) {
        results[bucket] = uniq(flatten(lValues(pick(this.buckets[bucket], keys))));
      } else {
        results[bucket] = [];
      }
    }, this);

    return results;
  }

  /**
   * @description Returns the union of the values in the given keys.
   * @param bucket
   * @param keys
   * @return Promise<string[]>
   */
  public async union(bucket: string, keys: string[]): Promise<string[]> {
    let match: boolean;
    let re: RegExp;
    let bucketTmp = bucket;

    if (!this.buckets[bucketTmp]) {
      Object.keys(this.buckets).some((item: string) => {
        re = new RegExp(`^${item}$`);
        match = re.test(bucketTmp);
        if (match) { bucketTmp = item; }

        return match;
      });
    }

    if (this.buckets[bucketTmp]) {
      const keyArrays = [];
      keys.forEach((key: string) => {
        if (this.buckets[bucketTmp][key]) { // tslint:disable-line no-unsafe-any
          keyArrays.push(...this.buckets[bucketTmp][key]); // tslint:disable-line no-unsafe-any
        }
      }, this);

      return union(keyArrays);
    }

    return [];
  }

  /**
   * @description Adds values to a given key inside a bucket.
   * @param bucket
   * @param key
   * @param values
   * @return void
   */
  public add(bucket: string, key: string | number, values: string|[string]): void {
    const valuesArray = Common.MAKE_ARRAY(values);

    this.transaction.push(() => {
      if (!this.buckets[bucket]) {
        this.buckets[bucket] = {};
      }

      if (!this.buckets[bucket][key]) { // tslint:disable-line no-unsafe-any
        this.buckets[bucket][key] = valuesArray; // tslint:disable-line no-unsafe-any
      } else {
        this.buckets[bucket][key] = union(valuesArray, this.buckets[bucket][key]); // tslint:disable-line no-unsafe-any
      }
    });
  }

  /**
   * @description Delete the given key(s) at the bucket
   * @param bucket
   * @param keys
   * @return Promise<void>
   */
  public async del(bucket: string, keys: string[]): Promise<void> {
    const keysArray = Common.MAKE_ARRAY(keys);

    this.transaction.push(() => {
      if (this.buckets[bucket]) {
        keysArray.forEach((key: string) => delete this.buckets[bucket][key]); // tslint:disable-line no-unsafe-any no-dynamic-delete
      }
    });
  }

  /**
   * @description Removes values from a given key inside a bucket.
   * @param bucket
   * @param key
   * @param values
   * @return Promise<void>
   */
  public async remove(bucket: string, key: string | number, values: string[]): Promise<void> {
    const valuesArray = Common.MAKE_ARRAY(values);

    this.transaction.push(() => {
      const bucketKey = this.buckets[bucket][key]; // tslint:disable-line no-unsafe-any
      if (this.buckets[bucket] && bucketKey) {
        this.buckets[bucket][key] = difference(bucketKey, valuesArray); // tslint:disable-line no-unsafe-any
      }
    });
  }
}
