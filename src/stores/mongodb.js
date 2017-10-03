// @flow
import Async from 'async';
import Store from '../interfaces/store';
import Common from '../classes/common';

export default class MongoDB extends Common implements Store {
  transaction: Array<any>;
  redis: {};

  constructor(db, prefix, useSingle, useRawCollectionNames = 'resources') {
    super();
    console.log(`=======> in MongoDB Store`)
    this.db = db;
    this.aclCollectionName = 'resources';
    this.prefix = typeof prefix !== 'undefined' ? prefix : '';
    this.useSingle = (typeof useSingle !== 'undefined') ? useSingle : false;
    this.useRawCollectionNames = useRawCollectionNames === false; // requires explicit boolean false value
  }

  /**
   * @description Begins a transaction. Returns a transaction object(just an array of functions will do here.)
   * @returns {Array}
   */
  begin() {
    this.transaction = [];
    return this.transaction;
  }

  /**
   * @description Ends a transaction (and executes it)
   * @param cb
   */
  end(cb) {
    Async.series(this.transaction, (err) => cb(err instanceof Error ? err : undefined));
  }

  /**
   * @description Cleans the whole storage.
   * @param cb
   */
  clean(cb) {
    this.db.collections((err, collections) => {
      if (err instanceof Error) return cb(err);
      Async.forEach(collections, (coll, innercb) => {
        coll.drop(() => innercb()); // ignores errors
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
      collection.findOne(searchParams, {_bucketname: 0}, (err, doc) => {
        if (err) return cb(err);
        if (!_.isObject(doc)) return cb(undefined, []);
        cb(undefined, _.without(_.keys(MongoDB.fixKeys(doc)), 'key', '_id'));
      });
    });
  }

  /**
   * @description Returns the union of the values in the given keys.
   * @param bucket
   * @param keys
   * @param cb
   */
  union(bucket, keys, cb) {
    const keysTmp = MongoDB.encodeAll(keys);
    const searchParams = (this.useSingle ? {_bucketname: bucket, key: {$in: keysTmp}} : {key: {$in: keysTmp}});
    const collName = (this.useSingle ? this.aclCollectionName : bucket);

    this.db.collection(this.prefix + this.removeUnsupportedChar(collName), (err, collection) => {
      if (err instanceof Error) return cb(err);
      // Excluding bucket field from search result
      collection.find(searchParams, {_bucketname: 0}).toArray((err, docs) => {
        if (err instanceof Error) return cb(err);
        if (!docs.length) return cb(undefined, []);

        const keyArrays = [];
        MongoDB.fixAllKeys(docs).forEach((doc) => {
          keyArrays.push.apply(keyArrays, _.keys(doc));
        });
        cb(undefined, _.without(_.union(keyArrays), 'key', '_id'));
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
    if (key === 'key') throw new Error(`Key name 'key' is not allowed.`);
    const keyTmp = MongoDB.encodeText(key);
    var self = this;
    var updateParams = (self.useSingle ? {_bucketname: bucket, key: keyTmp} : {key: keyTmp});
    var collName = (self.useSingle ? this.aclCollectionName : bucket);
    this.transaction.push((cb) => {
      values = MongoDB.makeArray(values);
      self.db.collection(self.prefix + self.removeUnsupportedChar(collName), (err, collection) => {
        if (err instanceof Error) return cb(err);

        // build doc from array values
        let doc = {};
        values.forEach((value) => {
          doc[value] = true;
        });

        // update document
        collection.update(updateParams, {$set: doc}, {safe: true, upsert: true}, (err) => {
          if (err instanceof Error) return cb(err);
          cb(undefined);
        });
      });
    });

    this.transaction.push((cb) => {
      self.db.collection(self.prefix + self.removeUnsupportedChar(collName), (err, collection) => {
        // Create index
        collection.ensureIndex({_bucketname: 1, key: 1}, (err) => {
          if (err instanceof Error) {
            return cb(err);
          } else {
            cb(undefined);
          }
        });
      });
    })
  }

  /**
   * @description Delete the given key(s) at the bucket
   * @param bucket
   * @param keys
   */
  del(bucket, keys) {
    const keysTmp = MongoDB.makeArray(keys);
    const self = this;
    const updateParams = (self.useSingle ? {_bucketname: bucket, key: {$in: keysTmp}} : {key: {$in: keysTmp}});
    const collName = (self.useSingle ? this.aclCollectionName : bucket);

    this.transaction.push((cb) => {
      self.db.collection(self.prefix + self.removeUnsupportedChar(collName), (err, collection) => {
        if (err instanceof Error) return cb(err);
        collection.remove(updateParams, {safe: true}, (err) => {
          if (err instanceof Error) return cb(err);
          cb(undefined);
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
    const self = this;
    const updateParams = (self.useSingle ? {_bucketname: bucket, key: keyTmp} : {key: keyTmp});
    const collName = (self.useSingle ? this.aclCollectionName : bucket);

    const valuesTmp = MongoDB.makeArray(values);
    this.transaction.push((cb) => {
      self.db.collection(self.prefix + self.removeUnsupportedChar(collName), (err, collection) => {
        if (err instanceof Error) return cb(err);

        // build doc from array values
        const doc = {};
        valuesTmp.forEach((value) => {
          doc[value] = true;
        });

        // update document
        collection.update(updateParams, {$unset: doc}, {safe: true, upsert: true}, (err) => {
          if (err instanceof Error) return cb(err);
          cb(undefined);
        });
      });
    });
  }

  /**
   * @description Remove unsupported char.
   * @param text
   * @returns {*}
   */
  removeUnsupportedChar(text) {
    let textTmp = text;
    if (!this.useRawCollectionNames && (typeof text === 'string' || text instanceof String)) {
      textTmp = decodeURIComponent(textTmp);
      textTmp = textTmp.replace(/[/\s]/g, '_');
    }
    return textTmp;
  }

  static encodeText(text) {
    let textTmp = text;
    if (typeof textTmp === 'string' || textTmp instanceof String) {
      textTmp = encodeURIComponent(textTmp);
      textTmp = textTmp.replace(/\./g, '%2E');
    }
    return textTmp;
  }

  static decodeText(text) {
    let textTmp = text;
    if (typeof textTmp === 'string' || textTmp instanceof String) {
      textTmp = decodeURIComponent(textTmp);
    }
    return textTmp;
  }

  static encodeAll(arr) {
    if (Array.isArray(arr)) {
      let ret = [];
      arr.forEach((aval) => {
        ret.push(MongoDB.encodeText(aval));
      });
      return ret;
    } else {
      return arr;
    }
  }

  static fixKeys(doc) {
    if (doc) {
      let ret = {};
      for (let key in doc) {
        if (doc.hasOwnProperty(key)) {
          ret[MongoDB.decodeText(key)] = doc[key];
        }
      }
      return ret;
    } else {
      return doc;
    }
  }

  static fixAllKeys(docs) {
    if (docs && docs.length) {
      let ret = [];
      docs.forEach((adoc) => {
        ret.push(MongoDB.fixKeys(adoc));
      });
      return ret;
    } else {
      return docs;
    }
  }

  static makeArray(arr) {
    return Array.isArray(arr) ? MongoDB.encodeAll(arr) : [MongoDB.encodeText(arr)];
  }
}
