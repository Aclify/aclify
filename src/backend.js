/**
 Backend Interface.
 Implement this API for providing a backend for the acl module.
 */

import contract from './contract';

const Backend = {
  /**
   Begins a transaction.
   */
  begin() {
    // returns a transaction object
  },

  /**
   Ends a transaction (and executes it)
   */
  end(transaction, cb) {
    contract(arguments).params('object', 'function').end();
    // Execute transaction
  },

  /**
   Cleans the whole storage.
   */
  clean(cb) {
    contract(arguments).params('function').end();
  },

  /**
   Gets the contents at the bucket's key.
   */
  get(bucket, key, cb) {
    contract(arguments)
      .params('string', 'string|number', 'function')
      .end();
  },

  /**
   Gets the union of contents of the specified keys in each of the specified buckets and returns
   a mapping of bucket to union.
   */
  unions(bucket, keys, cb) {
    contract(arguments)
      .params('array', 'array', 'function')
      .end();
  },

  /**
   Returns the union of the values in the given keys.
   */
  union(bucket, keys, cb) {
    contract(arguments)
      .params('string', 'array', 'function')
      .end();
  },

  /**
   Adds values to a given key inside a bucket.
   */
  add(transaction, bucket, key, values) {
    contract(arguments)
      .params('object', 'string', 'string|number','string|array|number')
      .end();
  },

  /**
   Delete the given key(s) at the bucket
   */
  del(transaction, bucket, keys) {
    contract(arguments)
      .params('object', 'string', 'string|array')
      .end();
  },

  /**
   Removes values from a given key inside a bucket.
   */
  remove(transaction, bucket, key, values) {
    contract(arguments)
      .params('object', 'string', 'string|number','string|array|number')
      .end();
  },
};

exports = module.exports = Backend;
