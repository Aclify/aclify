// @flow
import Redis from 'redis';
import MongoDB from 'mongodb';
import MongoDBMock from 'mongo-mock';
import Tests from './tests';
import MemoryStore from '../src/stores/memory';
import RedisStore from '../src/stores/redis';
import MongoDBStore from '../src/stores/mongodb';

// describe('Memory', () => Tests(new MemoryStore()));
// describe('Redis', () => Tests(new RedisStore(Redis.createClient())));


// describe('MongoDB', () => {
// MongoDB.connect('mongodb://localhost:27017/acl', (error, db) => {
//   Tests(new MongoDBStore(db, 'acl_'))
// })
// Tests(new MongoDBStore(MongoDB.connect('mongodb://localhost:27017/acl'), 'acl_'))
// });
//
const mongoose = require('mongoose');

describe('MyTest', () => {

  new Promise((resolve, reject) => {
    MongoDB.connect('mongodb://localhost:27017/acl', (error, db) => {
      console.log(error)
      return resolve(db)
    })
      .then((db) => Tests(new MongoDBStore(db, 'acl_')))
  })


  // it('has some property', () => {
  //   expect(1).toBe(1);
  // });
});

// afterAll(() => setTimeout(() => process.exit(), 1000))
