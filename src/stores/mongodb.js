// @flow
import Async from 'async';
import _ from 'lodash';
import Store from '../interfaces/store';
import Common from '../classes/common';

export default class MongoDB extends Common implements Store {
  transaction: Array<any>;

  redis: {};

  constructor(db, prefix, useSingle, useRawCollectionNames = 'resources') {
    super();
    this.db = db;
    this.aclCollectionName = 'resources';
    this.prefix = typeof prefix !== 'undefined' ? prefix : '';
    this.useSingle = (typeof useSingle !== 'undefined') ? useSingle : false;
    // Requires explicit boolean false value
    this.useRawCollectionNames = useRawCollectionNames === false;
  }

  /**
   * @description Begins a transaction. Returns a transaction object(just an array of functions will do here.)
   * @returns {Array}
   */
  begin(): Array<any> {
    this.transaction = [];
    return this.transaction;
  }

  /**
   * @description Ends a transaction (and executes it)
   * @param cb
   */
  end(cb): any {
    Async.series(this.transaction, (err) => cb(err instanceof Error ? err : undefined));
  }

  /**
   * @description Cleans the whole storage.
   * @param cb
   */
  clean(cb) {
    this.db.collections((err, collections) => {
      if (err instanceof Error) return cb(err);
      return Async.forEach(collections, (coll, innercb) => {
        // ignores errors
        coll.drop(() => innercb());
      }, cb);
    });
  }

  /**
   * @description Gets the contents at the bucket's key.
   * @param bucket
   * @param key
   * @param cb
   */
  get(bucket, key, cb) {
    const keyTmp = MongoDB.encodeText(key);
    const searchParams = (this.useSingle ? {_bucketname: bucket, key: keyTmp} : {key: keyTmp});
    const collName = (this.useSingle ? this.aclCollectionName : bucket);

    this.db.collection(this.prefix + this.removeUnsupportedChar(collName), (err, collection) => {
      if (err instanceof Error) return cb(err);
      // Excluding bucket field from search result
      return collection.findOne(searchParams, {_bucketname: 0}, (err2, doc) => {
        if (err2) return cb(err2);
        if (!_.isObject(doc)) return cb(undefined, []);
        return cb(undefined, _.without(_.keys(MongoDB.fixKeys(doc)), 'key', '_id'));
      });
    });
  }

  /**
   * @description Returns the union of the values in the given keys.
   * @param bucket
   * @param keys
   * @param cb
   */
  union(bucket, keys, cb): any {
    const keysTmp = MongoDB.encodeAll(keys);
    const searchParams = (this.useSingle ? {_bucketname: bucket, key: {$in: keysTmp}} : {key: {$in: keysTmp}});
    const collName = (this.useSingle ? this.aclCollectionName : bucket);

    return this.db.collection(this.prefix + this.removeUnsupportedChar(collName), (err, collection) => {
      if (err instanceof Error) return cb(err);
      // Excluding bucket field from search result
      return collection.find(searchParams, {_bucketname: 0}).toArray((err2, docs) => {
        if (err2 instanceof Error) return cb(err2);
        if (!docs.length) return cb(undefined, []);

        const keyArrays = [];
        MongoDB.fixAllKeys(docs).forEach((doc) => {
          keyArrays.push(..._.keys(doc));
        });
        return cb(undefined, _.without(_.union(keyArrays), 'key', '_id'));
      });
    });
  }

  /**
   * @description Adds values to a given key inside a bucket.
   * @param bucket
   * @param key
   * @param values
   */
  add(bucket, key, values) {
    if (key === 'key') throw new Error('Key name "key" is not allowed.');
    const keyTmp = MongoDB.encodeText(key);
    const updateParams = (this.useSingle ? {_bucketname: bucket, key: keyTmp} : {key: keyTmp});
    const collName = (this.useSingle ? this.aclCollectionName : bucket);
    this.transaction.push((cb) => {
      const valuesTmp = MongoDB.makeArray(values);
      return this.db.collection(this.prefix + this.removeUnsupportedChar(collName), (err, collection) => {
        if (err instanceof Error) return cb(err);

        // Build doc from array values
        const doc = {};
        valuesTmp.forEach((value) => {
          doc[value] = true;
        });

        // Update document
        return collection.update(updateParams, {$set: doc}, {safe: true, upsert: true}, (err2) => {
          if (err2 instanceof Error) return cb(err2);
          return cb(undefined);
        });
      });
    });

    this.transaction.push((cb) => {
      this.db.collection(this.prefix + this.removeUnsupportedChar(collName), (err, collection) => {
        // Create index
        collection.ensureIndex({_bucketname: 1, key: 1}, (err2) => {
          if (err2 instanceof Error) return cb(err2);
          return cb(undefined);
        });
      });
    });
  }

  /**
   * @description Delete the given key(s) at the bucket
   * @param bucket
   * @param keys
   */
  del(bucket, keys) {
    const keysTmp = MongoDB.makeArray(keys);
    const updateParams = (this.useSingle ? {_bucketname: bucket, key: {$in: keysTmp}} : {key: {$in: keysTmp}});
    const collName = (this.useSingle ? this.aclCollectionName : bucket);

    this.transaction.push((cb) => {
      this.db.collection(this.prefix + this.removeUnsupportedChar(collName), (err, collection) => {
        if (err instanceof Error) return cb(err);
        return collection.remove(updateParams, {safe: true}, (err2) => {
          if (err2 instanceof Error) return cb(err2);
          return cb(undefined);
        });
      });
    });
  }

  /**
   * @description Removes values from a given key inside a bucket.
   * @param bucket
   * @param key
   * @param values
   */
  remove(bucket, key, values) {
    const keyTmp = MongoDB.encodeText(key);
    const updateParams = (this.useSingle ? {_bucketname: bucket, key: keyTmp} : {key: keyTmp});
    const collName = (this.useSingle ? this.aclCollectionName : bucket);

    const valuesTmp = MongoDB.makeArray(values);
    this.transaction.push((cb) => {
      this.db.collection(this.prefix + this.removeUnsupportedChar(collName), (err, collection) => {
        if (err instanceof Error) return cb(err);

        // Build doc from array values
        const doc = {};
        valuesTmp.forEach((value) => {
          doc[value] = true;
        });

        // Update document
        return collection.update(updateParams, {$unset: doc}, {safe: true, upsert: true}, (err2) => {
          if (err2 instanceof Error) return cb(err2);
          return cb(undefined);
        });
      });
    });
  }

  /**
   * @description Remove unsupported char.
   * @param text
   * @returns {*}
   */
  removeUnsupportedChar(text): string {
    let textTmp = text;
    if (!this.useRawCollectionNames && (typeof text === 'string' || text instanceof String)) {
      textTmp = decodeURIComponent(textTmp);
      textTmp = textTmp.replace(/[/\s]/g, '_');
    }
    return textTmp;
  }

  /**
   * @description Encode text.
   * @param text
   * @returns {*}
   */
  static encodeText(text): string {
    let textTmp = text;
    if (typeof textTmp === 'string' || textTmp instanceof String) {
      textTmp = encodeURIComponent(textTmp);
      textTmp = textTmp.replace(/\./g, '%2E');
    }
    return textTmp;
  }

  /**
   * @description Decode text.
   * @param text
   * @returns {*}
   */
  static decodeText(text): string {
    let textTmp = text;
    if (typeof textTmp === 'string' || textTmp instanceof String) {
      textTmp = decodeURIComponent(textTmp);
    }
    return textTmp;
  }

  /**
   * @description Encode all values.
   * @param arr
   * @returns {*}
   */
  static encodeAll(arr): Array<any> | string {
    if (Array.isArray(arr)) {
      const ret = [];
      arr.forEach((aval) => {
        ret.push(MongoDB.encodeText(aval));
      });
      return ret;
    }
    return arr;
  }

  /**
   * @description Fix keys.
   * @param doc
   * @returns {*}
   */
  static fixKeys(doc): {} {
    if (doc) {
      const ret = {};
      Object.keys(doc).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(doc, key)) ret[MongoDB.decodeText(key)] = doc[key];
      });
      return ret;
    }
    return doc;
  }

  /**
   * @description Fix all keys.
   * @param docs
   * @returns {*}
   */
  static fixAllKeys(docs): Array<any> {
    if (docs && docs.length) {
      const ret = [];
      docs.forEach((adoc) => {
        ret.push(MongoDB.fixKeys(adoc));
      });
      return ret;
    }
    return docs;
  }

  /**
   * @description Return formated array.
   * @param arr
   * @returns {[null]}
   */
  static makeArray(arr): Array<any> | string {
    return Array.isArray(arr) ? MongoDB.encodeAll(arr) : [MongoDB.encodeText(arr)];
  }
}
