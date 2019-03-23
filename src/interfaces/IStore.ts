export interface IStore {
  /**
   * @description Store.
   */
  buckets: {};

  /**
   * @description Begins a transaction.
   * @return Function[]
   */
  begin(): Function[];

  /**
   * @description Ends a transaction (and executes it).
   * @return Promise<void>
   */
  end(): Promise<void>;

  /**
   * @description Cleans the whole storage.
   * @return Promise<void>
   */
  clean(): Promise<void>;

  /**
   * @description Gets the contents at the bucket's key.
   * @param bucket
   * @param key
   * @return Promise<string[]>
   */
  get(bucket: string, key: string | number): Promise<string[]>;

  /**
   * @description Gets the union of the keys in each of the specified buckets.
   * @param buckets
   * @param keys
   * @return Promise<{}>
   */
  unions(buckets: string[], keys: string[]): Promise<{}>;

  /**
   * @description Returns the union of the values in the given keys.
   * @param bucket
   * @param keys
   * @return Promise<string[]>
   */
  union(bucket: string, keys: string[]): Promise<string[]>;

  /**
   * @description Adds values to a given key inside a bucket.
   * @param bucket
   * @param key
   * @param values
   * @return void
   */
  add(bucket: string, key: string | number, values: number | number[] | string | string[]): void;

  /**
   * @description Delete the given key(s) at the bucket
   * @param bucket
   * @param keys
   * @return Promise<void>
   */
  del(bucket: string, keys: string | string[]): Promise<void>;

  /**
   * @description Removes values from a given key inside a bucket.
   * @param bucket
   * @param key
   * @param values
   * @return Promise<void>
   */
  remove(bucket: string, key: string | number, values: number | number[] | string | string[]): Promise<void>;
}
