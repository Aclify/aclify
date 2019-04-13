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
    this.prefix = prefix || 'acl';
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
    this.redis.keys(`${this.prefix}*`, (_err, keys: string[]) => {
      if (keys.length) {
        this.redis.del(keys);
      }
    });
  }

  /**
   * @description Gets the contents at the bucket's key.
   * @param bucket
   * @param key
   * @return Promise<string[]>
   */
  public async get(bucket: IBucket, key): Promise<string[]> {
    const output: string[] = [];
    const keyParam = this.bucketKey(bucket, key);

    if (Array.isArray(keyParam)) {
      keyParam.forEach(async (key: string) => {
        // @ts-ignore
        const values = await this.redis.smembersAsync(key);
        values.forEach((val: string) => output.push(val));
      });
    }

    // @ts-ignore
    const values = await this.redis.smembersAsync(keyParam as string);
    values.forEach((val: string) => output.push(val));

    return output;
  }

  /**
   * @description Returns the union of the values in the given keys.
   * @param bucket
   * @param keys
   * @return Promise<string[]>
   */
  public async union(bucket, keys) {
    // @ts-ignore
    return this.redis.sunionAsync(this.bucketKey(bucket, keys));
  }

  /**
   * @description Adds values to a given key inside a bucket.
   * @param bucket
   * @param key
   * @param values
   * @return Promise<void>
   */
  public add(bucket, key, values) {
    key = this.bucketKey(bucket, key);

    if (Array.isArray(values)) {
      values.forEach(value => {
        this.transaction.sadd(key, value);
      }, this);
    } else {
      this.transaction.sadd(key, values);
    }
  }

  /**
   * @description Delete the given key(s) at the bucket.
   * @param bucket
   * @param keys
   * @return Promise<void>
   */
  public async del(bucket, keys) {
    keys = Array.isArray(keys) ? keys : [keys];
    keys = keys.map((key) => this.bucketKey(bucket, key), this);
    this.transaction.del(keys);
  }

  /**
   * @description Removes values from a given key inside a bucket.
   * @param bucket
   * @param key
   * @param values
   * @return Promise<void>
   */
  public async remove(bucket, key, values) {
    key = this.bucketKey(bucket, key);

    if (Array.isArray(values)) {
      values.forEach(value => {
        this.transaction.srem(key, value);
      }, this);
    } else {
      this.transaction.srem(key, values);
    }
  }

  /**
   * @description Returns bucket key(s).
   * @param bucket
   * @param keys
   * @return string|string[]
   */
  private bucketKey(bucket, keys) {
    if (Array.isArray(keys)) {
      return keys.map((key) => `${this.prefix}_${bucket}@${key}`, this);
    }

    return `${this.prefix}_${bucket}@${keys}`;
  }
}
