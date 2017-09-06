import contract from '../contract'
import async from 'async'
import _ from 'lodash'

// Name of the collection where meta and allowsXXX are stored.
// If prefix is specified, it will be prepended to this name, like acl_resources
const aclCollectionName = 'resources'

class MongoDBBackend {
  constructor(db, prefix, useSingle, useRawCollectionNames) {
    this.db = db
    this.prefix = typeof prefix !== 'undefined' ? prefix : ''
    this.useSingle = (typeof useSingle !== 'undefined') ? useSingle : false
    this.useRawCollectionNames = useRawCollectionNames === false // requires explicit boolean false value
  }

  /**
   Begins a transaction.
   */
  begin() {
    // returns a transaction object(just an array of functions will do here.)
    return []
  }

  /**
   Ends a transaction (and executes it)
   */
  end(transaction, cb) {
    contract(arguments).params('array', 'function').end()
    async.series(transaction,err => {
      cb(err instanceof Error? err : undefined)
    })
  }

  /**
   Cleans the whole storage.
   */
  clean(cb) {
    contract(arguments).params('function').end()
    this.db.collections((err, collections) => {
      if (err instanceof Error) return cb(err)
      async.forEach(collections,(coll, innercb) => {
        coll.drop(() => {innercb()}) // ignores errors
      },cb)
    })
  }

  /**
   Gets the contents at the bucket's key.
   */
  get(bucket, key, cb) {
    contract(arguments)
      .params('string', 'string|number', 'function')
      .end()
    key = encodeText(key)
    const searchParams = (this.useSingle? {_bucketname: bucket, key} : {key})
    const collName = (this.useSingle? aclCollectionName : bucket)

    this.db.collection(this.prefix + this.removeUnsupportedChar(collName),(err, collection) => {
      if(err instanceof Error) return cb(err)
      // Excluding bucket field from search result
      collection.findOne(searchParams, {_bucketname: 0},(err, doc) => {
        if(err) return cb(err)
        if(! _.isObject(doc) ) return cb(undefined,[])
        doc = fixKeys(doc)
        cb(undefined,_.without(_.keys(doc),"key","_id"))
      })
    })
  }

  /**
   Returns the union of the values in the given keys.
   */
  union(bucket, keys, cb) {
    contract(arguments)
      .params('string', 'array', 'function')
      .end()
    keys = encodeAll(keys)
    const searchParams = (this.useSingle? {_bucketname: bucket, key: { $in: keys }} : {key: { $in: keys }})
    const collName = (this.useSingle? aclCollectionName : bucket)

    this.db.collection(this.prefix + this.removeUnsupportedChar(collName),(err, collection) => {
      if(err instanceof Error) return cb(err)
      // Excluding bucket field from search result
      collection.find(searchParams, {_bucketname: 0}).toArray((err, docs) => {
        if(err instanceof Error) return cb(err)
        if( ! docs.length ) return cb(undefined, [])

        const keyArrays = []
        docs = fixAllKeys(docs)
        docs.forEach(doc => {
          keyArrays.push(..._.keys(doc))
        })
        cb(undefined, _.without(_.union(keyArrays),"key","_id"))
      })
    })
  }

  /**
   Adds values to a given key inside a bucket.
   */
  add(transaction, bucket, key, values) {
    contract(arguments)
      .params('array', 'string', 'string|number','string|array|number')
      .end()

    if(key=="key") throw new Error("Key name 'key' is not allowed.")
    key = encodeText(key)
    const self=this
    const updateParams = (self.useSingle? {_bucketname: bucket, key} : {key})
    const collName = (self.useSingle? aclCollectionName : bucket)
    transaction.push(cb => {
      values = makeArray(values)
      self.db.collection(self.prefix + self.removeUnsupportedChar(collName), (err, collection) => {
        if(err instanceof Error) return cb(err)

        // build doc from array values
        const doc = {}
        values.forEach(value => {doc[value]=true})

        // update document
        collection.update(updateParams,{$set:doc},{safe:true,upsert:true},err => {
          if(err instanceof Error) return cb(err)
          cb(undefined)
        })
      })
    })

    transaction.push(cb => {
      self.db.collection(self.prefix + self.removeUnsupportedChar(collName), (err, collection) => {
        // Create index
        collection.ensureIndex({_bucketname: 1, key: 1}, err => {
          if (err instanceof Error) {
            return cb(err)
          } else{
            cb(undefined)
          }
        })
      })
    })
  }

  /**
   Delete the given key(s) at the bucket
   */
  del(transaction, bucket, keys) {
    contract(arguments)
      .params('array', 'string', 'string|array')
      .end()
    keys = makeArray(keys)
    const self= this
    const updateParams = (self.useSingle? {_bucketname: bucket, key:{$in:keys}} : {key:{$in:keys}})
    const collName = (self.useSingle? aclCollectionName : bucket)

    transaction.push(cb => {
      self.db.collection(self.prefix + self.removeUnsupportedChar(collName),(err, collection) => {
        if(err instanceof Error) return cb(err)
        collection.remove(updateParams,{safe:true},err => {
          if(err instanceof Error) return cb(err)
          cb(undefined)
        })
      })
    })
  }

  /**
   Removes values from a given key inside a bucket.
   */
  remove(transaction, bucket, key, values) {
    contract(arguments)
      .params('array', 'string', 'string|number','string|array|number')
      .end()
    key = encodeText(key)
    const self=this
    const updateParams = (self.useSingle? {_bucketname: bucket, key} : {key})
    const collName = (self.useSingle? aclCollectionName : bucket)

    values = makeArray(values)
    transaction.push(cb => {
      self.db.collection(self.prefix + self.removeUnsupportedChar(collName),(err, collection) => {
        if(err instanceof Error) return cb(err)

        // build doc from array values
        const doc = {}
        values.forEach(value => {doc[value]=true})

        // update document
        collection.update(updateParams,{$unset:doc},{safe:true,upsert:true},err => {
          if(err instanceof Error) return cb(err)
          cb(undefined)
        })
      })
    })
  }

  removeUnsupportedChar(text) {
    if (!this.useRawCollectionNames && (typeof text === 'string' || text instanceof String)) {
      text = decodeURIComponent(text)
      text = text.replace(/[/\s]/g, '_') // replaces slashes and spaces
    }
    return text
  }
}

function encodeText(text) {
  if (typeof text == 'string' || text instanceof String) {
    text = encodeURIComponent(text)
    text = text.replace(/\./g, '%2E')
  }
  return text
}

function decodeText(text) {
  if (typeof text == 'string' || text instanceof String) {
    text = decodeURIComponent(text)
  }
  return text
}

function encodeAll(arr) {
  if (Array.isArray(arr)) {
    const ret = []
    arr.forEach(aval => {
      ret.push(encodeText(aval))
    })
    return ret
  } else {
    return arr
  }
}

function decodeAll(arr) {
  if (Array.isArray(arr)) {
    const ret = []
    arr.forEach(aval => {
      ret.push(decodeText(aval))
    })
    return ret
  } else {
    return arr
  }
}

function fixKeys(doc) {
  if (doc) {
    const ret = {}
    for (const key in doc) {
      if (doc.hasOwnProperty(key)) {
        ret[decodeText(key)] = doc[key]
      }
    }
    return ret
  } else {
    return doc
  }
}

function fixAllKeys(docs) {
  if (docs && docs.length) {
    const ret = []
    docs.forEach(adoc => {
      ret.push(fixKeys(adoc))
    })
    return ret
  } else {
    return docs
  }
}

function makeArray(arr){
  return Array.isArray(arr) ? encodeAll(arr) : [encodeText(arr)]
}

exports = module.exports = MongoDBBackend
