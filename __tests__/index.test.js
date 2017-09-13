// @flow
import Acl from '../src/classes/acl';
import Memory from '../src/stores/memory';

const store = new Memory();

describe('Allows', () => {
  it('guest to view blogs', () => {
    const acl = new Acl();
    acl.allow('guest', 'blogs', 'view', (err) => {
      expect(!err);
    });
  });

  it('guest to view forums', () => {
    const acl = new Acl(store);
    acl.allow('guest', 'forums', 'view', (err) => {
      expect(!err);
    });
  });

  it('member to view/edit/delete blogs', () => {
    const acl = new Acl(store);
    acl.allow('member', 'blogs', ['edit', 'view', 'delete'], (err) => {
      expect(!err);
    });
  });
});
