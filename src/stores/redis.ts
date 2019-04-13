import { Multi, RedisClient } from 'redis';
import { IStore } from '..';
import { Common } from '../classes/common';
import { IBucket } from "../types";

/**
 * {@inheritDoc}
 * @description Redis store.
 */
export class RedisStore extends Common implements IStore {
  public buckets: {};
  private readonly redis: RedisClient;
  private transaction: Multi;

  /**
   * @description constructor
   * @param redis
   * @param prefix
   */
  constructor(redis: RedisClient, prefix?: string) {
    super();
    this.redis = redis;
    this.prefix = prefix !== undefined ? prefix : 'acl';
  }

  /**
   * @description Begins a transaction.
   * @return void
   */
  public begin(): void {
    this.transaction = this.redis.multi();
  }

  /**
   * @description Ends a transaction (and executes it).
   * @return Promise<void>
   */
  public async end(): Promise<void> {
    this.transaction.exec();
  }

  /**
   * @description Cleans the whole storage.
   * @return Promise<void>
   */
  public async clean(): Promise<void> {
    // @ts-ignore
    const keys: string[] = await this.redis.keysAsync(`${this.prefix}*`); // tslint:disable-line no-unsafe-any
    if (keys.length > 0) {
      // @ts-ignore
      await this.redis.delAsync(keys); // tslint:disable-line no-unsafe-any
    }
  }

  /**
   * @description Gets the contents at the bucket's key.
   * @param bucket
   * @param key
   * @return Promise<string[]>
   */
  public async get(bucket: IBucket, key: string | number): Promise<string[]> {
    const output: string[] = [];
    const keyParam = this.bucketKey(bucket, key);

    if (Array.isArray(keyParam)) {
      keyParam.forEach(async (keyItem: string) => {
        // @ts-ignore
        const smembers: string[] = await this.redis.smembersAsync(keyItem); // tslint:disable-line no-unsafe-any
        smembers.forEach((val: string) => output.push(val));
      });
    }

    // @ts-ignore
    const values: string[] = await this.redis.smembersAsync(keyParam as string); // tslint:disable-line no-unsafe-any
    values.forEach((val: string) => output.push(val));

    return output;
  }

  /**
   * @description Returns the union of the values in the given keys.
   * @param bucket
   * @param keys
   * @return Promise<string[]>
   */
  public async union(bucket: string, keys: string[]): Promise<string[]> {
    // @ts-ignore
    return this.redis.sunionAsync(this.bucketKey(bucket, keys)); // tslint:disable-line no-unsafe-any
  }

  /**
   * @description Adds values to a given key inside a bucket.
   * @param bucket
   * @param key
   * @param values
   * @return Promise<void>
   */
  public add(bucket: string, key: string | number, values: number | number[] | string | string[]): void {
    const keyParam = this.bucketKey(bucket, key);

    if (Array.isArray(values)) {
      values.forEach((value: number | string) => {
        this.transaction.sadd(keyParam as string, value as string);
      }, this);
    } else {
      this.transaction.sadd(keyParam as string, values as string);
    }
  }

  /**
   * @description Delete the given key(s) at the bucket.
   * @param bucket
   * @param keys
   * @return Promise<void>
   */
  public async del(bucket: string, keys: string | string[]): Promise<void> {
    const keysParam: string[] = Array.isArray(keys) ? keys : [keys];
    const keysToRemove = keysParam.map((keyItem: string) => this.bucketKey(bucket, keyItem) as string, this);
    this.transaction.del(keysToRemove);
  }

  /**
   * @description Removes values from a given key inside a bucket.
   * @param bucket
   * @param key
   * @param values
   * @return Promise<void>
   */
  public async remove(bucket: string, key: string | number, values: number | number[] | string | string[]): Promise<void> {
    const keyParam: string | string[] = this.bucketKey(bucket, key);

    if (Array.isArray(values)) {
      values.forEach((value: string | number) => {
        this.transaction.srem(keyParam as string, value as string);
      }, this);
    } else {
      this.transaction.srem(keyParam as string, values as string);
    }
  }

  /**
   * @description Returns bucket key(s).
   * @param bucket
   * @param keys
   * @return string|string[]
   */
  private bucketKey(bucket: string, keys: number | string) {
    if (Array.isArray(keys)) {
      return keys.map((keyItem: string) => `${this.prefix}_${bucket}@${keyItem}`, this);
    }

    return `${this.prefix}_${bucket}@${keys}`;
  }
}
