// @flow
import Acl from '../src/classes/acl';
import Memory from '../src/stores/memory';

const store = new Memory();

describe('Constructor', () => {
  it('Should use default `buckets` names', () => {
    const acl = new Acl(store);

    expect(acl.options.buckets.meta).toEqual('meta');
    expect(acl.options.buckets.parents).toEqual('parents');
    expect(acl.options.buckets.permissions).toEqual('permissions');
    expect(acl.options.buckets.resources).toEqual('resources');
    expect(acl.options.buckets.roles).toEqual('roles');
    expect(acl.options.buckets.users).toEqual('users');
  });

  it('Should use given `buckets` names', () => {
    const acl = new Acl(store, null, {
      buckets: {
        meta: 'Meta',
        parents: 'Parents',
        permissions: 'Permissions',
        resources: 'Resources',
        roles: 'Roles',
        users: 'Users',
      }
    });

    expect(acl.options.buckets.meta).toEqual('Meta');
    expect(acl.options.buckets.parents).toEqual('Parents');
    expect(acl.options.buckets.permissions).toEqual('Permissions');
    expect(acl.options.buckets.resources).toEqual('Resources');
    expect(acl.options.buckets.roles).toEqual('Roles');
    expect(acl.options.buckets.users).toEqual('Users');
  });
});

describe(`Allows`, () => {
  it('guest to view blogs', () => {
    const acl = new Acl();
    acl.allow('guest', 'blogs', 'view', (err) => {
      expect(!err);
    });
  });

  it(`guest to view forums`, () => {
    const acl = new Acl(store);
    acl.allow('guest', 'forums', 'view', (err) => {
      expect(!err);
    });
  });

  it(`member to view/edit/delete blogs`, () => {
    const acl = new Acl(store);
    acl.allow('member', 'blogs', ['edit', 'view', 'delete'], (err) => {
      expect(!err);
    });
  });
});

describe(`Add user roles`, () => {
  it(`joed = guest, jsmith = member, harry = admin, test@test.com = member`, (done) => {
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

  it(`0 = guest, 1 = member, 2 = admin`, (done) => {
    const acl = new Acl(store);

    acl.addUserRoles(0, 'guest', (err) => {
      expect(!err);

      acl.addUserRoles(1, 'member', (err) => {
        expect(!err);

        acl.addUserRoles(2, 'admin', (err) => {
          expect(!err);
          done();
        });
      });
    });
  });
});

// describe(`Read user's roles`, () => {
//   it(`run userRoles function`, (done) => {
//     const acl = new Acl(store);
//     acl.addUserRoles('harry', 'admin', (err) => {
//       if (err) return done(err);
//
//       acl.userRoles('harry', (err, roles) => {
//         if (err) return done(err);
//
//         expect.deepEqual(roles, ['admin']);
//         acl.hasRole('harry', 'admin', (err, is_in_role) => {
//           if (err) return done(err);
//
//           expect.ok(is_in_role);
//           acl.hasRole('harry', 'no role', (err, is_in_role) => {
//             if (err) return done(err);
//             expect.notOk(is_in_role);
//             done();
//           });
//         });
//       });
//     });
//   });
// });
