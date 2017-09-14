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

describe('Add user roles', () => {
  it('joed = guest, jsmith = member, harry = admin, test@test.com = member', (done) => {
    const acl = new Acl(store);

    acl.addUserRoles('joed', 'guest', (err) => {
      expect(!err);

      acl.addUserRoles('jsmith', 'member', (err) => {
        expect(!err);

        acl.addUserRoles('harry', 'admin', (err) => {
          expect(!err);

          acl.addUserRoles('test@test.com', 'member', (err) => {
            expect(!err);
            done();
          });
        });
      });
    });
  });
});

