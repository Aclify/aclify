import contract from '../contract';
import _ from 'lodash';

class MemoryBackend {
  constructor() {
    this._buckets = {};
  }

  /**
   Begins a transaction.
   */
  begin() {
    // returns a transaction object(just an array of functions will do here.)
    return [];
  }

  /**
   Ends a transaction (and executes it)
   */
  end(transaction, cb) {
    contract(arguments).params('array', 'function').end();

    // Execute transaction
    for(let i=0, len=transaction.length;i<len;i++){
      transaction[i]();
    }
    cb();
  }

  /**
   Cleans the whole storage.
   */
  clean(cb) {
    contract(arguments).params('function').end();
    this._buckets = {};
    cb();
  }

  /**
   Gets the contents at the bucket's key.
   */
  get(bucket, key, cb) {
    contract(arguments)
      .params('string', 'string|number', 'function')
      .end();

    if(this._buckets[bucket]){
      cb(null, this._buckets[bucket][key] || []);
    }else{
      cb(null, []);
    }
  }

  /**
   Gets the union of the keys in each of the specified buckets
   */
  unions(buckets, keys, cb) {
    contract(arguments)
      .params('array', 'array', 'function')
      .end();

    const self = this;
    const results = {};

    buckets.forEach(bucket => {
      if(self._buckets[bucket]){
        results[bucket] = _.uniq(_.flatten(_.values(_.pick(self._buckets[bucket], keys))));
      }else{
        results[bucket] = [];
      }
    });

    cb(null, results);
  }

  /**
   Returns the union of the values in the given keys.
   */
  union(bucket, keys, cb) {
    contract(arguments)
      .params('string', 'array', 'function')
      .end();

    let match;
    let re;
    if (!this._buckets[bucket]) {
      Object.keys(this._buckets).some(b => {
        re = new RegExp(`^${b}$`);
        match = re.test(bucket);
        if (match) bucket = b;
        return match;
      });
    }

    if(this._buckets[bucket]){
      const keyArrays = [];
      for(let i=0, len=keys.length;i<len;i++){
        if(this._buckets[bucket][keys[i]]){
          keyArrays.push(...this._buckets[bucket][keys[i]]);
        }
      }
      cb(undefined, _.union(keyArrays));
    }else{
      cb(undefined, []);
    }
  }

  /**
   Adds values to a given key inside a bucket.
   */
  add(transaction, bucket, key, values) {
    contract(arguments)
      .params('array', 'string', 'string|number', 'string|array|number')
      .end();

    const self = this;
    values = makeArray(values);

    transaction.push(() => {
      if(!self._buckets[bucket]){
        self._buckets[bucket] = {};
      }
      if(!self._buckets[bucket][key]){
        self._buckets[bucket][key] = values;
      }else{
        self._buckets[bucket][key] = _.union(values, self._buckets[bucket][key]);
      }
    })
  }

  /**
   Delete the given key(s) at the bucket
   */
  del(transaction, bucket, keys) {
    contract(arguments)
      .params('array', 'string', 'string|array')
      .end();

    const self = this;
    keys = makeArray(keys);

    transaction.push(() => {
      if(self._buckets[bucket]){
        for(let i=0, len=keys.length;i<len;i++){
          delete self._buckets[bucket][keys[i]];
        }
      }
    })
  }

  /**
   Removes values from a given key inside a bucket.
   */
  remove(transaction, bucket, key, values) {
    contract(arguments)
      .params('array', 'string', 'string|number','string|array|number')
      .end();

    const self = this;
    values = makeArray(values);
    transaction.push(() => {
      let old;
      if(self._buckets[bucket] && (old = self._buckets[bucket][key])){
        self._buckets[bucket][key] = _.difference(old, values);
      }
    });
  }
}

function makeArray(arr){
  return Array.isArray(arr) ? arr : [arr];
}

exports = module.exports = MemoryBackend;
