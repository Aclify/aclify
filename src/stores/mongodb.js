// @flow
import RedisClient from 'redis';
import Async from 'async';
import Store from '../interfaces/store';
import Common from '../classes/common';

export default class MongoDB extends Common implements Store {
  transaction: Array<any>;
  redis: {};

  constructor(db, prefix, useSingle, useRawCollectionNames) {
    super();
    this.db = db;
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
    const keyTmp = encodeText(key);
    const searchParams = (this.useSingle ? {_bucketname: bucket, key: keyTmp} : {key: keyTmp});
    const collName = (this.useSingle ? aclCollectionName : bucket);

    this.db.collection(this.prefix + this.removeUnsupportedChar(collName), (err, collection) => {
      if (err instanceof Error) return cb(err);
      // Excluding bucket field from search result
      collection.findOne(searchParams, {_bucketname: 0}, (err, doc) => {
        if (err) return cb(err);
        if (!_.isObject(doc)) return cb(undefined, []);
        cb(undefined, _.without(_.keys(fixKeys(doc)), 'key', '_id'));
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
    const keysTmp = encodeAll(keys);
    const searchParams = (this.useSingle ? {_bucketname: bucket, key: {$in: keysTmp}} : {key: {$in: keysTmp}});
    const collName = (this.useSingle ? aclCollectionName : bucket);

    this.db.collection(this.prefix + this.removeUnsupportedChar(collName), (err, collection) => {
      if (err instanceof Error) return cb(err);
      // Excluding bucket field from search result
      collection.find(searchParams, {_bucketname: 0}).toArray((err, docs) => {
        if (err instanceof Error) return cb(err);
        if (!docs.length) return cb(undefined, []);

        const keyArrays = [];
        fixAllKeys(docs).forEach((doc) => {
          keyArrays.push.apply(keyArrays, _.keys(doc));
        });
        cb(undefined, _.without(_.union(keyArrays), 'key', '_id'));
      });
    });
  }

  /**
   * @description Adds values to a given key inside a bucket.
   * @param transaction
   * @param bucket
   * @param key
   * @param values
   */
  add(transaction, bucket, key, values) {
    if (key === 'key') throw new Error(`Key name 'key' is not allowed.`);
    const keyTmp = encodeText(key);
    var self = this;
    var updateParams = (self.useSingle ? {_bucketname: bucket, key: keyTmp} : {key: keyTmp});
    var collName = (self.useSingle ? aclCollectionName : bucket);
    transaction.push(function (cb) {
      values = makeArray(values);
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

    transaction.push((cb) => {
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
   * @param transaction
   * @param bucket
   * @param keys
   */
  del(transaction, bucket, keys) {
    const keysTmp = makeArray(keys);
    const self = this;
    const updateParams = (self.useSingle ? {_bucketname: bucket, key: {$in: keysTmp}} : {key: {$in: keysTmp}});
    const collName = (self.useSingle ? aclCollectionName : bucket);

    transaction.push((cb) => {
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
   * @param transaction
   * @param bucket
   * @param key
   * @param values
   */
  remove(transaction, bucket, key, values) {
    const keyTmp = encodeText(key);
    const self = this;
    const updateParams = (self.useSingle ? {_bucketname: bucket, key: keyTmp} : {key: keyTmp});
    const collName = (self.useSingle ? aclCollectionName : bucket);

    const valuesTmp = makeArray(values);
    transaction.push((cb) => {
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


}
