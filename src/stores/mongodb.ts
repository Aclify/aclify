import Bluebird from 'bluebird';
import * as _ from 'lodash';
import { IStore } from '..';

const aclCollectionName = 'resources';

export class MongoDBStore implements IStore {
  private transaction;
  private readonly db;
  private readonly prefix;
  private readonly useSingle;
  private readonly useRawCollectionNames;

  constructor(db, prefix, useSingle?, useRawCollectionNames?) {
    this.db = db;
    this.prefix = typeof prefix !== 'undefined' ? prefix : '';
    this.useSingle = (typeof useSingle !== 'undefined') ? useSingle : false;
    this.useRawCollectionNames = useRawCollectionNames === false; // requires explicit boolean false value
  }

  public begin(): void {
    this.transaction = [];
  }

  public async end(): Promise<void> {
    await Promise.all(this.transaction.map(async (fn) => {
      return fn instanceof Promise ? fn.then(() => Promise.resolve()) : Promise.resolve(fn())
    }));
  }

  public async clean(): Promise<void> {
    const collections = await this.db.collections();
    // @ts-ignore
    await Bluebird.map(collections, (collection) => collection.drop());
  }

  public async get(bucket: string, key: string | number): Promise<string[]> {
    key = encodeText(key);
    const searchParams = (this.useSingle? {_bucketname: bucket, key} : {key});
    const collName = (this.useSingle? aclCollectionName : bucket);

    const collection = await this.db.collection(this.prefix + this.removeUnsupportedChar(collName))


    const document = await collection.findOne(searchParams, {_bucketname: 0});

    if(! _.isObject(document) ) {
      // @ts-ignore
      return [];
    }

    // @ts-ignore
    return _.without(_.keys(fixKeys(document)),"key","_id");
  }

  public async union(bucket: string, keys: string[]): Promise<string[]> {
    keys = encodeAll(keys);
    const searchParams = (this.useSingle? {_bucketname: bucket, key: { $in: keys }} : {key: { $in: keys }});
    const collName = (this.useSingle? aclCollectionName : bucket);

    const collection = await this.db.collection(this.prefix + this.removeUnsupportedChar(collName));
    let docs = await collection.find(searchParams, {_bucketname: 0}).toArray();
    if( ! docs.length ) {
      return [];
    }

    const keyArrays = [];
    docs = fixAllKeys(docs);
    docs.forEach(doc => {
      keyArrays.push.apply(keyArrays, _.keys(doc));
    });

    return _.without(_.union(keyArrays),"key","_id");
  }

  public add(bucket: string, key: string | number, values: number | number[] | string | string[]): void {
    if(key === "key") {
      throw new Error("Key name 'key' is not allowed.");
    }
    key = encodeText(key);
    const self=this;
    const updateParams = (self.useSingle? {_bucketname: bucket, key} : {key});
    const collName = (self.useSingle? aclCollectionName : bucket);

    this.transaction.push(async () => {
      const valuesParam = makeArray(values);

      const collection = await self.db.collection(self.prefix + self.removeUnsupportedChar(collName));
      // build doc from array values
      const doc = {};
      // @ts-ignore
      valuesParam.forEach(value => {doc[value]=true;});

      // update document
      await collection.update(updateParams,{$set:doc},{safe:true,upsert:true});
    });

    this.transaction.push(async () => {
      const collection = await self.db.collection(self.prefix + self.removeUnsupportedChar(collName));
      // Create index
      await collection.ensureIndex({_bucketname: 1, key: 1});
    })
  }

  public async del(bucket: string, keys: string | string[]): Promise<void> {
    keys = makeArray(keys);
    const self= this;
    const updateParams = (self.useSingle? {_bucketname: bucket, key:{$in:keys}} : {key:{$in:keys}});
    const collName = (self.useSingle? aclCollectionName : bucket);

    this.transaction.push(async () => {
      const collection = await self.db.collection(self.prefix + self.removeUnsupportedChar(collName));
      await collection.remove(updateParams,{safe:true});
    });
  }

  public async remove(bucket: string, key: string | number, values: number | number[] | string | string[]): Promise<void> {
    key = encodeText(key);
    const self=this;
    const updateParams = (self.useSingle? {_bucketname: bucket, key} : {key});
    const collName = (self.useSingle? aclCollectionName : bucket);

    values = makeArray(values);
    this.transaction.push(async () => {
      const collection = await self.db.collection(self.prefix + self.removeUnsupportedChar(collName));
      // build doc from array values
      const doc = {};
      // @ts-ignore
      values.forEach(value => {doc[value]=true;});

      // update document
      await collection.update(updateParams,{$unset:doc},{safe:true,upsert:true});
    });
  }

  public removeUnsupportedChar(text: string) {
    if (!this.useRawCollectionNames) {
      text = decodeURIComponent(text);
      text = text.replace(/[/\s]/g, '_'); // replaces slashes and spaces
    }

    return text;
  }

  public async close(): Promise<void> {
    await this.db.close();
  }
}

function encodeText(text: string | number) {
  if (typeof text == 'string') {
    text = encodeURIComponent(text);
    text = text.replace(/\./g, '%2E');
  }

  return text;
}

function decodeText(text: string) {
  if (typeof text == 'string') {
    text = decodeURIComponent(text);
  }

  return text;
}

function encodeAll(arr) {
  if (Array.isArray(arr)) {
    const ret = [];
    arr.forEach(aval => {
      ret.push(encodeText(aval));
    });

    return ret;
  } else {
    return arr;
  }
}

function fixKeys(doc) {
  if (doc) {
    const ret = {};
    for (const key in doc) {
      if (doc.hasOwnProperty(key)) {
        ret[decodeText(key)] = doc[key];
      }
    }

    return ret;
  } else {
    return doc;
  }
}

function fixAllKeys(docs) {
  if (docs && docs.length) {
    const ret = [];
    docs.forEach(adoc => {
      ret.push(fixKeys(adoc));
    });

    return ret;
  } else {
    return docs;
  }
}

function makeArray(arr){
  return Array.isArray(arr) ? encodeAll(arr) : [encodeText(arr)];
}
