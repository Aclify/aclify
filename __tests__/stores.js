// @flow
import RedisMock from 'redis';
import Tests from './tests';
import Memory from '../src/stores/memory';
import RedisStore from '../src/stores/redis';

// describe('Memory', () => {
//   Tests(new Memory());
// });

describe('Redis', () => {
  Tests(new RedisStore(RedisMock.createClient()));
});
