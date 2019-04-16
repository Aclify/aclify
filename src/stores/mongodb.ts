import async from 'async';
import _ from 'lodash';

// Name of the collection where meta and allowsXXX are stored.
// If prefix is specified, it will be prepended to this name, like acl_resources
const aclCollectionName = 'resources';

export class MongoDB {
  private transaction;
  private db;
  private prefix;
  private useSingle;
  private useRawCollectionNames;

  constructor(db, prefix, useSingle, useRawCollectionNames) {
    this.db = db;
    this.prefix = typeof prefix !== 'undefined' ? prefix : '';
    this.useSingle = (typeof useSingle !== 'undefined') ? useSingle : false;
    this.useRawCollectionNames = useRawCollectionNames === false; // requires explicit boolean false value
  }

  /**
   Begins a transaction.
   */
  begin() {
    this.transaction = [];
  }

  /**
   Ends a transaction (and executes it)
   */
  end() {
    async.series(this.transaction);
  }

  /**
   Cleans the whole storage.
   */
  clean() {
    this.db.collections((_err, collections) => {
      async.forEach(collections,(coll, innercb) => {
        coll.drop(() => {innercb()}); // ignores errors
      });
    });
  }

  /**
   Gets the contents at the bucket's key.
   */
  get(bucket: string, key: string | number): Promise<string[]> {
    key = encodeText(key);
    const searchParams = (this.useSingle? {_bucketname: bucket, key} : {key});
    const collName = (this.useSingle? aclCollectionName : bucket);

    let output;
    this.db.collection(this.prefix + this.removeUnsupportedChar(collName),(_err, collection) => {
      // if(err instanceof Error) return cb(err);
      // Excluding bucket field from search result
      collection.findOne(searchParams, {_bucketname: 0}, (_err, doc) => {
        // if(err) return cb(err);
        if(! _.isObject(doc) ) {
          // return cb(undefined,[]);
          return output = [];
        }
        doc = fixKeys(doc);
        return output = _.without(_.keys(doc),"key","_id");
      });
    });
    return output;
  }

  /**
   Returns the union of the values in the given keys.
   */
  union(bucket: string, keys: string[]): Promise<string[]> {
    keys = encodeAll(keys);
    const searchParams = (this.useSingle? {_bucketname: bucket, key: { $in: keys }} : {key: { $in: keys }});
    const collName = (this.useSingle? aclCollectionName : bucket);

    let output;
    this.db.collection(this.prefix + this.removeUnsupportedChar(collName),(_err, collection) => {
      // if(err instanceof Error) return cb(err);
      // Excluding bucket field from search result
      collection.find(searchParams, {_bucketname: 0}).toArray((_err, docs) => {
        // if(err instanceof Error) return cb(err);
        if( ! docs.length ) {
          // return cb(undefined, []);
          return output = [];
        }

        const keyArrays = [];
        docs = fixAllKeys(docs);
        docs.forEach(doc => {
          keyArrays.push.apply(keyArrays, _.keys(doc));
        });
        return output = _.without(_.union(keyArrays),"key","_id");
        // cb(undefined, _.without(_.union(keyArrays),"key","_id"));
      });
    });
    return output;
  }

  /**
   Adds values to a given key inside a bucket.
   */
  add(bucket: string, key: string | number, values: number | number[] | string | string[]): void {
    if(key === "key") {
      throw new Error("Key name 'key' is not allowed.");
    }
    key = encodeText(key);
    const self=this;
    const updateParams = (self.useSingle? {_bucketname: bucket, key} : {key});
    const collName = (self.useSingle? aclCollectionName : bucket);
    this.transaction.push(cb => {
      values = makeArray(values);
      self.db.collection(self.prefix + self.removeUnsupportedChar(collName), (err, collection) => {
        if(err instanceof Error) return cb(err);

        // build doc from array values
        const doc = {};
        // @ts-ignore
        values.forEach(value => {doc[value]=true;});

        // update document
        collection.update(updateParams,{$set:doc},{safe:true,upsert:true}, err => {
          if(err instanceof Error) return cb(err);
          cb(undefined);
        });
      });
    });

    this.transaction.push(cb => {
      self.db.collection(self.prefix + self.removeUnsupportedChar(collName), (_err, collection) => {
        // Create index
        collection.ensureIndex({_bucketname: 1, key: 1}, err => {
          if (err instanceof Error) {
            return cb(err);
          } else{
            cb(undefined);
          }
        });
      });
    })
  }

  /**
   Delete the given key(s) at the bucket
   */
  async del(bucket: string, keys: string | string[]): Promise<void> {
    keys = makeArray(keys);
    const self= this;
    const updateParams = (self.useSingle? {_bucketname: bucket, key:{$in:keys}} : {key:{$in:keys}});
    const collName = (self.useSingle? aclCollectionName : bucket);

    this.transaction.push(cb => {
      self.db.collection(self.prefix + self.removeUnsupportedChar(collName),(err, collection) => {
        if(err instanceof Error) return cb(err);
        collection.remove(updateParams,{safe:true},err => {
          if(err instanceof Error) return cb(err);
          cb(undefined);
        });
      });
    });
  }

  /**
   Removes values from a given key inside a bucket.
   */
  async remove(bucket: string, key: string | number, values: number | number[] | string | string[]): Promise<void> {
    key = encodeText(key);
    const self=this;
    const updateParams = (self.useSingle? {_bucketname: bucket, key} : {key});
    const collName = (self.useSingle? aclCollectionName : bucket);

    values = makeArray(values);
    this.transaction.push(cb => {
      self.db.collection(self.prefix + self.removeUnsupportedChar(collName),(err, collection) => {
        if(err instanceof Error) return cb(err);

        // build doc from array values
        const doc = {};
        // @ts-ignore
        values.forEach(value => {doc[value]=true;});

        // update document
        collection.update(updateParams,{$unset:doc},{safe:true,upsert:true},err => {
          if(err instanceof Error) return cb(err);
          cb(undefined);
        });
      });
    });
  }

  removeUnsupportedChar(text: string) {
    if (!this.useRawCollectionNames) {
      text = decodeURIComponent(text);
      text = text.replace(/[/\s]/g, '_'); // replaces slashes and spaces
    }
    return text;
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

// function decodeAll(arr) {
//   if (Array.isArray(arr)) {
//     const ret = [];
//     arr.forEach(aval => {
//       ret.push(decodeText(aval));
//     });
//     return ret;
//   } else {
//     return arr;
//   }
// }

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

exports = module.exports = MongoDB;
