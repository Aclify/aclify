import { isObject, keys as lodashKeys, union, without } from 'lodash';
import { Db } from 'mongodb';
import { IStore } from '..';

const aclCollectionName = 'resources';

/**
 * {@inheritDoc}
 * @description MongoDB store.
 */
export class MongoDBStore implements IStore {
  private transaction: (Function | Promise<void>)[];
  private readonly db: Db;
  private readonly prefix: string;
  private readonly useSingle: boolean;
  private readonly useRawCollectionNames: boolean;

  /**
   * @description Constructor.
   * @param db
   * @param prefix
   * @param useSingle?
   * @param useRawCollectionNames?
   */
  constructor(db: Db, prefix: string, useSingle?: boolean, useRawCollectionNames?: boolean) {
    this.db = db;
    this.prefix = prefix !== undefined ? prefix : '';
    this.useSingle = useSingle !== undefined ? useSingle : false;
    this.useRawCollectionNames = useRawCollectionNames === false;
  }

  /**
   * @description Encodes value.
   * @param value
   * @return string | number
   */
  private static encodeValue(value: string | number): string | number {
    if (typeof value === 'string') {
      return encodeURIComponent(value).replace(/\./g, '%2E');
    }

    return value;
  }

  /**
   * @description Decodes value.
   * @param value
   * @return string | number
   */
  private static decodeValue(value: string | number): string | number {
    if (typeof value === 'string') {
      return decodeURIComponent(value);
    }

    return value;
  }

  /**
   * @description Encodes all array values.
   * @param values
   */
  private static encodeAll(values) { // tslint:disable-line typedef
    return values.map((item: string | number) => MongoDBStore.encodeValue(item)); // tslint:disable-line no-unsafe-any
  }

  /**
   * @description Decodes object keys.
   * @param document
   * @return Object
   */
  private static fixKeys(document: Object): Object {
    const ret = {};
    Object.keys(document).forEach((key: string) => {
      if (document.hasOwnProperty(key)) {
        ret[MongoDBStore.decodeValue(key)] = document[key];
      }
    });

    return ret;
  }

  /**
   * @description Decodes all object keys.
   * @param documents
   * @return Object[]
   */
  private static fixAllKeys(documents: Object[]): Object[] {
    return documents.map((item: Object) => MongoDBStore.fixKeys(item));
  }

  /**
   * @description Makes an array.
   * @param array
   * @return string[]
   */
  private static makeArray(array: number | number[] | string | string[]): string[] {
    return Array.isArray(array) ? MongoDBStore.encodeAll(array) : [MongoDBStore.encodeValue(array)]; // tslint:disable-line no-unsafe-any
  }

  /**
   * @description Begins a transaction.
   * @return void
   */
  public begin(): void {
    this.transaction = [];
  }

  /**
   * @description Ends a transaction (and executes it).
   * @return Promise<void>
   */
  public async end(): Promise<void> {
    await Promise.all(this.transaction.map(async (fn: Function | Promise<void>) => {
      return fn instanceof Promise ? fn.then(() => Promise.resolve()) : fn()
    }));
  }

  /**
   * @description Cleans the whole storage.
   * @return Promise<void>
   */
  public async clean(): Promise<void> {
    const collections = await this.db.collections(); // tslint:disable-line no-unsafe-any
    await Promise.all(collections.map((collection) => collection.drop())); // tslint:disable-line typedef no-unsafe-any
  }

  /**
   * @description Gets the contents at the bucket's keyParam.
   * @param bucket
   * @param key
   * @return Promise<string[]>
   */
  public async get(bucket: string, key: string | number): Promise<string[]> {
    const keyParam = MongoDBStore.encodeValue(key);
    const searchParams = (this.useSingle? {_bucketname: bucket, key: keyParam} : {key: keyParam});
    const collName = (this.useSingle? aclCollectionName : bucket);

    const collection = await this.db.collection(this.prefix + this.removeUnsupportedChar(collName)); // tslint:disable-line no-unsafe-any

    const document = await collection.findOne(searchParams, {_bucketname: 0}); // tslint:disable-line no-unsafe-any

    if(! isObject(document) ) {
      // @ts-ignore
      return [];
    }

    return without(lodashKeys(MongoDBStore.fixKeys(document)),'key','_id');
  }

  /**
   * @description Returns the union of the values in the given keys.
   * @param bucket
   * @param keys
   * @return Promise<string[]>
   */
  public async union(bucket: string, keys: string[]): Promise<string[]> {
    const keysParam = MongoDBStore.encodeAll(keys);
    const searchParams = (this.useSingle? {_bucketname: bucket, key: { $in: keysParam }} : {key: { $in: keysParam }});
    const collName = (this.useSingle? aclCollectionName : bucket);

    const collection = await this.db.collection(this.prefix + this.removeUnsupportedChar(collName)); // tslint:disable-line no-unsafe-any
    let documents: Object[] = await collection.find(searchParams, {_bucketname: 0}).toArray(); // tslint:disable-line no-unsafe-any
    if(documents.length === 0) {
      return [];
    }

    const keyArrays = [];
    documents = MongoDBStore.fixAllKeys(documents);
    documents.forEach((document: Object) => {
      keyArrays.push.apply(keyArrays, lodashKeys(document));
    });

    return without(union(keyArrays),'key','_id');
  }

  /**
   * @description Adds values to a given keyParam inside a bucket.
   * @param bucket
   * @param key
   * @param values
   * @return void
   */
  public add(bucket: string, key: string | number, values: number | number[] | string | string[]): void {
    if(key === 'key') {
      throw new Error('Key name \'key\' is not allowed.');
    }

    const keyParam = MongoDBStore.encodeValue(key);
    const updateParams = (this.useSingle? {_bucketname: bucket, key: keyParam} : {key: keyParam});
    const collName = (this.useSingle? aclCollectionName : bucket);

    this.transaction.push(async () => {
      const valuesParam = MongoDBStore.makeArray(values);

      const collection = await this.db.collection(this.prefix + this.removeUnsupportedChar(collName)); // tslint:disable-line no-unsafe-any
      // build doc from array values
      const document = {};
      // @ts-ignore
      valuesParam.forEach((value: string) => { document[value]=true; });

      // update document
      await collection.update(updateParams,{ $set:document },{ safe: true, upsert: true }); // tslint:disable-line no-unsafe-any
    });

    this.transaction.push(async () => {
      const collection = await this.db.collection(this.prefix + this.removeUnsupportedChar(collName)); // tslint:disable-line no-unsafe-any
      // Create index
      await collection.ensureIndex({ _bucketname: 1, key: 1 }); // tslint:disable-line no-unsafe-any
    })
  }

  /**
   * @description Delete the given key(s) at the bucket
   * @param bucket
   * @param keys
   * @return Promise<void>
   */
  public async del(bucket: string, keys: string | string[]): Promise<void> {
    const keysParam = MongoDBStore.makeArray(keys);
    const updateParams = this.useSingle ? { _bucketname: bucket, key: { $in: keysParam } } : { key: { $in: keysParam } };
    const collName = this.useSingle ? aclCollectionName : bucket;

    this.transaction.push(async () => {
      const collection = await this.db.collection(this.prefix + this.removeUnsupportedChar(collName)); // tslint:disable-line no-unsafe-any
      await collection.remove(updateParams,{ safe: true }); // tslint:disable-line no-unsafe-any
    });
  }

  /**
   * @description Removes values from a given keyParam inside a bucket.
   * @param bucket
   * @param key
   * @param values
   * @return Promise<void>
   */
  public async remove(bucket: string, key: string | number, values: number | number[] | string | string[]): Promise<void> {
    const keyParam = MongoDBStore.encodeValue(key);
    const updateParams = (this.useSingle? {_bucketname: bucket, key: keyParam} : {key: keyParam});
    const collName = (this.useSingle? aclCollectionName : bucket);

    const valuesParam = MongoDBStore.makeArray(values);
    if (valuesParam.length === 0) {
      return;
    }

    this.transaction.push(async () => {
      const collection = await this.db.collection(this.prefix + this.removeUnsupportedChar(collName)); // tslint:disable-line no-unsafe-any
      // Build doc from array values
      const document = {};
      // @ts-ignore
      valuesParam.forEach((value: Object) => { document[value]=true; });

      // Update document
      await collection.update(updateParams,{ $unset: document },{ safe: true, upsert: true }); // tslint:disable-line no-unsafe-any
    });
  }

  /**
   * @description Replaces slashes and spaces.
   * @param value
   * @return string
   */
  public removeUnsupportedChar(value: string): string {
    if (!this.useRawCollectionNames) {
      return decodeURIComponent(value).replace(/[/\s]/g, '_');
    }

    return value;
  }
}
