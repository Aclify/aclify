export interface IStore {
  buckets: {};
  //
  // /**
  //  * @description Begins a transaction.
  //  * @return Array<any>
  //  */
  begin(): Array<any>;
  //
  // /**
  //  * @description Ends a transaction.
  //  * @return Promise<any>
  //  */
  end(): Promise<void>;
  //
  // /**
  //  * @description Cleans the whole storage.
  //  * @return Promise<any>
  //  */
  // clean(): Promise<any>;
  //
  // /**
  //  * @description Gets contents from bucket's key.
  //  * @return Promise<any>
  //  */
  get(bucket: string, key: string | number): Promise<[string]>;
  //
  // /**
  //  * @description Gets union of contents of the specified keys in each of the specified buckets
  //  * and returns a mapping of bucket to union.
  //  * @return Promise<any>
  //  */
  unions(bucket: Array<any>, keys: Array<any>): Promise<any>;
  //
  // /**
  //  * @description Gets union of contents of the specified keys in each of the specified buckets
  //  * and returns a mapping of bucket to union.
  //  * @return Promise<any>
  //  */
  union(bucket: string, keys: string[]): Promise<string[]>;
  //
  // /**
  //  * @description Adds values to a given key inside a bucket.
  //  * @return Promise<any>
  //  */
  add(bucket: string, key: string | number, values: string | number | Array<any>): any;

  // /**
  //  * @description Deletes given key(s) at the bucket.
  //  * @return Promise<any>
  //  */
  del(bucket: string, keys: string | Array<any>): Promise<any>;

  // /**
  //  * @description Deletes values from a given key inside a bucket.
  //  * @return Promise<any>
  //  */
  remove(bucket: string, key: string | number, values: string | number | Array<any>): Promise<any>;

}
