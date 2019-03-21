import { Acl, MemoryStore } from '../src';


const memoryStore = new MemoryStore();
const acl = new Acl(memoryStore);

describe('Constructor', () => {
  it('Should use default `buckets` names', () => {
    expect(acl.options.buckets.meta).toEqual('meta');
    expect(acl.options.buckets.parents).toEqual('parents');
    expect(acl.options.buckets.permissions).toEqual('permissions');
    expect(acl.options.buckets.resources).toEqual('resources');
    expect(acl.options.buckets.roles).toEqual('roles');
    expect(acl.options.buckets.users).toEqual('users');
  });

  it('Should use given `buckets` names', () => {
    const aclCustomized = new Acl(acl.store, {
      buckets: {
        meta: 'Meta',
        parents: 'Parents',
        permissions: 'Permissions',
        resources: 'Resources',
        roles: 'Roles',
        users: 'Users',
      },
    });
    expect(aclCustomized.options.buckets.meta).toEqual('Meta');
    expect(aclCustomized.options.buckets.parents).toEqual('Parents');
    expect(aclCustomized.options.buckets.permissions).toEqual('Permissions');
    expect(aclCustomized.options.buckets.resources).toEqual('Resources');
    expect(aclCustomized.options.buckets.roles).toEqual('Roles');
    expect(aclCustomized.options.buckets.users).toEqual('Users');
  });
});

describe('allow', function () {
  it('guest to view blogs', async (done) => {
    const guest = await acl.allow('guest', 'blogs', 'view');
    console.log(memoryStore.buckets);
    expect(guest).toBeUndefined();
    done();
  });

  it('guest to view forums', async () => {
    const guest = await acl.allow('guest', 'forums', 'view');
    expect(guest).toBeUndefined();
  });

  it('member to view/edit/delete blogs', async () => {
    const member = await acl.allow('member', 'blogs', ['edit','view', 'delete']);
    expect(member).toBeUndefined();
  });
});

describe('Add user roles', function () {
  it('joed => guest, jsmith => member, harry => admin, test@test.com => member', async () => {
    const joed = await acl.addUserRoles('joed', 'guest');
    expect(joed).toBeUndefined();

    const jsmith = await acl.addUserRoles('jsmith', 'member');
    expect(jsmith).toBeUndefined();


    const harry = await acl.addUserRoles('harry', 'admin');
    expect(harry).toBeUndefined();


    const test = await acl.addUserRoles('test@test.com', 'member');
    expect(test).toBeUndefined();

  });

  it('0 => guest, 1 => member, 2 => admin', async () => {
    const zero = await acl.addUserRoles(0, 'guest');
    expect(zero).toBeUndefined();

    const one = await acl.addUserRoles(1, 'member');
    expect(one).toBeUndefined();

    const two = await acl.addUserRoles(2, 'admin');
    expect(two).toBeUndefined();
  });
});

describe('read User Roles', function() {
  it('run userRoles function', async () => {
    const addUserRole = await acl.addUserRoles('harry', 'admin');
    expect(addUserRole).toBeUndefined();

    const userRoles = await acl.userRoles('harry');
    expect(userRoles).toEqual(['admin']);

    const harryHasAdminRole = await acl.hasRole('harry', 'admin');
    expect(harryHasAdminRole).toBeTruthy();

    const harryHasNoRole = await acl.hasRole('harry', 'no role');
    expect(harryHasNoRole).toBeFalsy();
  });
});

describe('read Role Users', function() {
  it('run roleUsers function', async () => {
    const addUserRoles = await acl.addUserRoles('harry', 'admin');
    expect(addUserRoles).toBeUndefined();

    const roleUsers = await acl.roleUsers('admin');
    expect(roleUsers).toContain('harry');
  });
});

describe('allow', function () {
  it('admin view/add/edit/delete users', async () => {
    const admin = await acl.allow('admin', 'users', ['add','edit','view','delete']);
    expect(admin).toBeUndefined();
  });

  it('foo view/edit blogs', async () => {
    const foo = await acl.allow('foo', 'blogs', ['edit','view']);
    expect(foo).toBeUndefined();
  });

  it('bar to view/delete blogs', async () => {
    const bar = await acl.allow('bar', 'blogs', ['view','delete']);
    expect(bar).toBeUndefined();
  });
});

describe('add role parents', function () {
  it('add them', async () => {
    const addRoleParents = await acl.addRoleParents('baz', ['foo','bar']);
    expect(addRoleParents).toBeUndefined();
  });
});

describe('add user roles', function () {
  it('add them', async () => {
    const addUserRoles = await acl.addUserRoles('james', 'baz');
    expect(addUserRoles).toBeUndefined();
  });

  it('add them (numeric userId)', async () => {
    const addUserRoles = await acl.addUserRoles(3, 'baz');
    expect(addUserRoles).toBeUndefined();
  });
});

describe('allow admin to do anything', function () {
  it('add them', async () => {
    const allow = await acl.allow('admin', ['blogs', 'forums'], '*');
    expect(allow).toBeUndefined();
  });
});

describe('Arguments in one array', function () {
  it('give role fumanchu an array of resources and permissions', async () => {
    const allow = await acl.allow(
      [
        {
          roles:'fumanchu',
          allows:[
            {resources:'blogs', permissions:'get'},
            {resources:['forums','news'], permissions:['get','put','delete']},
            {resources:['/path/file/file1.txt','/path/file/file2.txt'], permissions:['get','put','delete']}
          ]
        }
      ]);
    expect(allow).toBeUndefined();
  });
});

describe('Add fumanchu role to suzanne', function () {
  it('do it', async () => {
    const addUserRoles = await acl.addUserRoles('suzanne', 'fumanchu');
    expect(addUserRoles).toBeUndefined();
  });

  it('do it (numeric userId)', async () => {
    const addUserRoles = await acl.addUserRoles(4, 'fumanchu');
    expect(addUserRoles).toBeUndefined();
  });
});

describe('Allowance queries', function () {
  describe('isAllowed', function () {

    it('Can joed view blogs?', async () => {
      const isAllowed = await acl.isAllowed('joed', 'blogs', 'view');
      expect(isAllowed).toBeTruthy();
    });

    it('Can userId=0 view blogs?', async () => {
      const isAllowed = await acl.isAllowed(0, 'blogs', 'view');
      expect(isAllowed).toBeTruthy();
    });

    it('Can joed view forums?', async () => {
      const isAllowed = await acl.isAllowed('joed', 'forums', 'view');
      expect(isAllowed).toBeTruthy();
    });

    it('Can userId=0 view forums?', async () => {
      const isAllowed = await acl.isAllowed(0, 'forums', 'view');
      expect(isAllowed).toBeTruthy();
    });

    it('Can joed edit forums?', async () => {
      const isAllowed = await acl.isAllowed('joed', 'forums', 'edit');
      expect(isAllowed).toBeFalsy();
    });

    it('Can userId=0 edit forums?', async () => {
      const isAllowed = await acl.isAllowed(0, 'forums', 'edit');
      expect(isAllowed).toBeFalsy();
    });

    it('Can jsmith edit forums?', async () => {
      const isAllowed = await acl.isAllowed('jsmith', 'forums', 'edit');
      expect(isAllowed).toBeFalsy();
    });

    it('Can jsmith edit forums?', async () => {
      const isAllowed = await acl.isAllowed('jsmith', 'forums', 'edit');
      expect(isAllowed).toBeFalsy();
    });


    it('Can jsmith edit blogs?', async () => {
      const isAllowed = await acl.isAllowed('jsmith', 'blogs', 'edit');
      expect(isAllowed).toBeTruthy();
    });

    it('Can test@test.com edit forums?', async () => {
      const isAllowed = await acl.isAllowed('test@test.com', 'forums', 'edit');
      expect(isAllowed).toBeFalsy();
    });

    it('Can test@test.com edit forums?', async () => {
      const isAllowed = await acl.isAllowed('test@test.com', 'forums', 'edit');
      expect(isAllowed).toBeFalsy();
    });

    it('Can test@test.com edit blogs?', async () => {
      const isAllowed = await acl.isAllowed('test@test.com', 'blogs', 'edit');
      expect(isAllowed).toBeTruthy();
    });

    it('Can userId=1 edit blogs?', async () => {
      const isAllowed = await acl.isAllowed(1, 'blogs', 'edit');
      expect(isAllowed).toBeTruthy();
    });

    it('Can jsmith edit, delete and clone blogs?', async () => {
      const isAllowed = await acl.isAllowed('jsmith', 'blogs', ['edit','view','clone']);
      expect(isAllowed).toBeFalsy();
    });

    it('Can test@test.com edit, delete and clone blogs?', async () => {
      const isAllowed = await acl.isAllowed('test@test.com', 'blogs', ['edit','view','clone']);
      expect(isAllowed).toBeFalsy();
    });

    it('Can userId=1 edit, delete and clone blogs?', async () => {
      const isAllowed = await acl.isAllowed(1, 'blogs', ['edit','view','clone']);
      expect(isAllowed).toBeFalsy();
    });

    it('Can jsmith edit, clone blogs?', async () => {
      const isAllowed = await acl.isAllowed('jsmith', 'blogs', ['edit', 'clone']);
      expect(isAllowed).toBeFalsy();
    });

    it('Can test@test.com edit, clone blogs?', async () => {
      const isAllowed = await acl.isAllowed('test@test.com', 'blogs', ['edit', 'clone']);
      expect(isAllowed).toBeFalsy();
    });

    it('Can userId=1 edit, delete blogs?', async () => {
      const isAllowed = await acl.isAllowed(1, 'blogs', ['edit', 'clone']);
      expect(isAllowed).toBeFalsy();
    });

    it('Can james add blogs?', async () => {
      const isAllowed = await acl.isAllowed('james', 'blogs', 'add');
      expect(isAllowed).toBeFalsy();
    });

    it('Can userId=3 add blogs?', async () => {
      const isAllowed = await acl.isAllowed(3, 'blogs', 'add');
      expect(isAllowed).toBeFalsy();
    });

    it('Can suzanne add blogs?', async () => {
      const isAllowed = await acl.isAllowed('suzanne', 'blogs', 'add');
      expect(isAllowed).toBeFalsy();
    });

    it('Can userId=4 add blogs?', async () => {
      const isAllowed = await acl.isAllowed(4, 'blogs', 'add');
      expect(isAllowed).toBeFalsy();
    });

    it('Can suzanne get blogs?', async () => {
      const isAllowed = await acl.isAllowed('suzanne', 'blogs', 'get');
      expect(isAllowed).toBeTruthy();
    });

    it('Can userId=4 get blogs?', async () => {
      const isAllowed = await acl.isAllowed(4, 'blogs', 'get');
      expect(isAllowed).toBeTruthy();
    });

    it('Can suzanne delete and put news?', async () => {
      const isAllowed = await acl.isAllowed('suzanne', 'news', ['put','delete']);
      expect(isAllowed).toBeTruthy();
    });

    it('Can userId=4 delete and put news?', async () => {
      const isAllowed = await acl.isAllowed(4, 'news', ['put','delete']);
      expect(isAllowed).toBeTruthy();
    });

    it('Can suzanne delete and put forums?', async () => {
      const isAllowed = await acl.isAllowed('suzanne', 'forums', ['put','delete']);
      expect(isAllowed).toBeTruthy();
    });

    it('Can userId=4 delete and put forums?', async () => {
      const isAllowed = await acl.isAllowed(4, 'forums', ['put','delete']);
      expect(isAllowed).toBeTruthy();
    });

    it('Can nobody view news?', async () => {
      const isAllowed = await acl.isAllowed('nobody', 'blogs', 'view');
      expect(isAllowed).toBeFalsy();
    });

    it('Can nobody view nothing?', async () => {
      const isAllowed = await acl.isAllowed('nobody', 'nothing', 'view');
      expect(isAllowed).toBeFalsy();
    });

    describe('allowedPermissions', function () {
      it('What permissions has james over blogs and forums?', async () => {
        const allowedPermissions = await acl.allowedPermissions('james', ['blogs','forums']);
        expect(allowedPermissions).toHaveProperty('blogs', ['edit', 'view', 'delete']);
        expect(allowedPermissions).toHaveProperty('forums', []);
      });
    });
    it('What permissions has userId=3 over blogs and forums?', async () => {
      const allowedPermissions = await acl.allowedPermissions(3, ['blogs','forums']);
      expect(allowedPermissions).toHaveProperty('blogs', ['edit', 'view', 'delete']);
      expect(allowedPermissions).toHaveProperty('forums', [ ]);
    });
    it('What permissions has nonsenseUser over blogs and forums?', async () => {
      const allowedPermissions = await acl.allowedPermissions('nonsense', ['blogs','forums']);
      expect(allowedPermissions).toHaveProperty('blogs', []);
      expect(allowedPermissions).toHaveProperty('forums', []);
    });
  });
});

describe('whatResources queries', function () {
  it('What resources have "bar" some rights on?', async () => {
    const resources = await acl.whatResources('bar');
    expect(resources).toHaveProperty('blogs', ['view', 'delete'])
  });

  it('What resources have "bar" view rights on?', async () => {
    const resources = await acl.whatResources('bar', 'view');
    expect(resources).toEqual(['blogs']);
  });

  it('What resources have "fumanchu" some rights on?', async () => {
    const resources = await acl.whatResources('fumanchu');
    expect(resources).toHaveProperty('blogs', ['get']);
    expect(resources).toHaveProperty('forums', ['get', 'put', 'delete']);
    expect(resources).toHaveProperty('news', ['get', 'put', 'delete']);
    expect(resources['/path/file/file1.txt']).toEqual(['get', 'put', 'delete']);
    expect(resources['/path/file/file2.txt']).toEqual(['get', 'put', 'delete']);
  });

  it('What resources have "baz" some rights on?', async () => {
    const resources = await acl.whatResources('baz');
    expect(resources).toHaveProperty('blogs', ['edit', 'view', 'delete']);
  });
});

describe('removeAllow', function () {
  it('Remove get permissions from resources blogs and forums from role fumanchu', async () => {
    const removeAllow = await acl.removeAllow('fumanchu', ['blogs','forums'], 'get');
    expect(removeAllow).toBeUndefined();
  });

  it('Remove delete and put permissions from resource news from role fumanchu', async () => {
    const removeAllow = await acl.removeAllow('fumanchu', 'news', 'delete');
    expect(removeAllow).toBeUndefined();
  });

  it('Remove view permissions from resource blogs from role bar', async () => {
    const removeAllow = await acl.removeAllow('bar', 'blogs', 'view');
    expect(removeAllow).toBeUndefined();
  });
});

describe('See if permissions were removed', function () {
  it('What resources have "fumanchu" some rights on after removed some of them?', async () => {
    const resources = await acl.whatResources('fumanchu');
    expect(resources).not.toHaveProperty('blogs');
    expect(resources).toHaveProperty('news', ['get', 'put']);
    expect(resources).not.toHaveProperty('news', ['delete']);
    expect(resources).toHaveProperty('forums', ['put', 'delete']);
  });
});

describe('removeRole', function () {
  it('Remove role fumanchu', async () => {
    const remove = await acl.removeRole('fumanchu');
    expect(remove).toBeUndefined();
  });

  it('Remove role member', async () => {
    const remove = await acl.removeRole('member');
    expect(remove).toBeUndefined();
  });

  it('Remove role foo', async () => {
    const remove = await acl.removeRole('foo');
    expect(remove).toBeUndefined();
  });
});

//   describe('Was role removed?', function () {
//     it('What resources have "fumanchu" some rights on after removed?', async () => {
//
//       acl.whatResources('fumanchu', function (err, resources) {
//         assert(!err)
//         assert(Object.keys(resources).length === 0)
//         done()
//       });
//     });
//
//     it('What resources have "member" some rights on after removed?', async () => {
//
//       acl.whatResources('member', function (err, resources) {
//         assert(!err)
//         assert(Object.keys(resources).length === 0)
//         done()
//       });
//     });
//
//     describe('allowed permissions', function () {
//       it('What permissions has jsmith over blogs and forums?', async () => {
//
//         acl.allowedPermissions('jsmith', ['blogs','forums'], function (err, permissions) {
//           assert(!err)
//           assert(permissions.blogs.length === 0)
//           assert(permissions.forums.length === 0)
//           done()
//         });
//       });
//
//       it('What permissions has test@test.com over blogs and forums?', async () => {
//
//         acl.allowedPermissions('test@test.com', ['blogs','forums'], function (err, permissions) {
//           assert(!err)
//           assert(permissions.blogs.length === 0)
//           assert(permissions.forums.length === 0)
//           done()
//         });
//       });
//
//       it('What permissions has james over blogs?', async () => {
//
//         acl.allowedPermissions('james', 'blogs', function (err, permissions) {
//           assert(!err)
//           assert.property(permissions, 'blogs')
//           assert.include(permissions.blogs, 'delete')
//           done()
//         });
//       });
//     });
//   });
// }
//
//
//
//
//
// exports.RoleParentRemoval = function () {
//   describe('RoleParentRemoval', function () {
//     before(async () => {
//       ;
//       acl.allow('parent1', 'x', 'read1')
//         .then(function () { return acl.allow('parent2', 'x', 'read2'); });
//         .then(function () { return acl.allow('parent3', 'x', 'read3'); });
//         .then(function () { return acl.allow('parent4', 'x', 'read4'); });
//         .then(function () { return acl.allow('parent5', 'x', 'read5'); });
//         .then(function () {
//           return acl.addRoleParents('child', ['parent1', 'parent2', 'parent3', 'parent4', 'parent5']);
//         });
//         .done(done, done);
//     });;
//
//     var acl;
//
//     beforeEach(function () {
//       acl = new Acl(this.backend);
//     });;
//
//     it('Environment check', async () => {
//       acl.whatResources('child')
//         .then(function (resources) {
//           assert.lengthOf(resources.x, 5);
//           assert.include(resources.x, 'read1');
//           assert.include(resources.x, 'read2');
//           assert.include(resources.x, 'read3');
//           assert.include(resources.x, 'read4');
//           assert.include(resources.x, 'read5');
//         });
//         .done(done, done);
//     });;
//
//     it('Operation uses a callback when removing a specific parent role', async () => {
//       acl.removeRoleParents('child', 'parentX', function (err) {
//         assert(!err);
//
//       });;
//     });;
//
//     it('Operation uses a callback when removing multiple specific parent roles', async () => {
//       acl.removeRoleParents('child', ['parentX', 'parentY'], function (err) {
//         assert(!err);
//
//       });;
//     });;
//
//     it('Remove parent role "parentX" from role "child"', async () => {
//       acl.removeRoleParents('child', 'parentX')
//         .then(function () { return acl.whatResources('child'); });
//         .then(function (resources) {
//           assert.lengthOf(resources.x, 5);
//           assert.include(resources.x, 'read1');
//           assert.include(resources.x, 'read2');
//           assert.include(resources.x, 'read3');
//           assert.include(resources.x, 'read4');
//           assert.include(resources.x, 'read5');
//         });
//         .done(done, done);
//     });;
//
//     it('Remove parent role "parent1" from role "child"', async () => {
//       acl.removeRoleParents('child', 'parent1')
//         .then(function () { return acl.whatResources('child'); });
//         .then(function (resources) {
//           assert.lengthOf(resources.x, 4);
//           assert.include(resources.x, 'read2');
//           assert.include(resources.x, 'read3');
//           assert.include(resources.x, 'read4');
//           assert.include(resources.x, 'read5');
//         });
//         .done(done, done);
//     });;
//
//     it('Remove parent roles "parent2" & "parent3" from role "child"', async () => {
//       acl.removeRoleParents('child', ['parent2', 'parent3'])
//         .then(function () { return acl.whatResources('child'); });
//         .then(function (resources) {
//           assert.lengthOf(resources.x, 2);
//           assert.include(resources.x, 'read4');
//           assert.include(resources.x, 'read5');
//         });
//         .done(done, done);
//     });;
//
//     it('Remove all parent roles from role "child"', async () => {
//       acl.removeRoleParents('child')
//         .then(function () { return acl.whatResources('child'); });
//         .then(function (resources) {
//           assert.notProperty(resources, 'x');
//         });
//         .done(done, done);
//     });;
//
//     it('Remove all parent roles from role "child" with no parents', async () => {
//       acl.removeRoleParents('child')
//         .then(function () { return acl.whatResources('child'); });
//         .then(function (resources) {
//           assert.notProperty(resources, 'x');
//         });
//         .done(done, done);
//     });;
//
//     it('Remove parent role "parent1" from role "child" with no parents', async () => {
//       acl.removeRoleParents('child', 'parent1')
//         .then(function () { return acl.whatResources('child'); });
//         .then(function (resources) {
//           assert.notProperty(resources, 'x');
//         });
//         .done(done, done);
//     });;
//
//     it('Operation uses a callback when removing all parent roles', async () => {
//       acl.removeRoleParents('child', function (err) {
//         assert(!err);
//
//       });;
//     });;
//   });;
// };
//
//
//
//
//
// exports.ResourceRemoval = function () {
//   describe('removeResource', function () {
//     it('Remove resource blogs', async () => {
//
//       acl.removeResource('blogs', function (err) {
//         assert(!err)
//         done()
//       });
//     });
//
//     it('Remove resource users', async () => {
//
//       acl.removeResource('users', function (err) {
//         assert(!err)
//         done()
//       });
//     });
//   });
//
//   describe('allowedPermissions', function () {
//     it('What permissions has james over blogs?', async () => {
//
//       acl.allowedPermissions('james', 'blogs', function (err, permissions) {
//         assert.isNull(err)
//         assert.property(permissions, 'blogs')
//         assert(permissions.blogs.length === 0)
//         done()
//       });
//     });
//     it('What permissions has userId=4 over blogs?', async () => {
//
//       acl.allowedPermissions(4, 'blogs').then(function (permissions) {
//         assert.property(permissions, 'blogs')
//         assert(permissions.blogs.length === 0)
//         done()
//       }, done);
//     });
//   });
//
//   describe('whatResources', function () {
//     it('What resources have "baz" some rights on after removed blogs?', async () => {
//
//       acl.whatResources('baz', function (err, resources) {
//         assert(!err)
//         assert.isObject(resources)
//         assert(Object.keys(resources).length === 0)
//
//         done()
//       });
//     });
//
//     it('What resources have "admin" some rights on after removed users resource?', async () => {
//
//       acl.whatResources('admin', function (err, resources) {
//         assert(!err)
//         assert.isFalse('users' in resources)
//         assert.isFalse('blogs' in resources)
//
//         done()
//       });
//     });
//   });
// }
//
//
//
//
//
// exports.UserRoleRemoval = function () {
//   describe('Remove user roles', function () {
//     it('Remove role guest from joed', async () => {
//
//       acl.removeUserRoles('joed','guest', function (err) {
//         assert(!err)
//         done()
//       });
//     });
//
//     it('Remove role guest from userId=0', async () => {
//
//       acl.removeUserRoles(0,'guest', function (err) {
//         assert(!err)
//         done()
//       });
//     });
//     it('Remove role admin from harry', async () => {
//
//       acl.removeUserRoles('harry','admin', function (err) {
//         assert(!err)
//         done()
//       });
//     });
//
//     it('Remove role admin from userId=2', async () => {
//
//       acl.removeUserRoles(2,'admin', function (err) {
//         assert(!err)
//         done()
//       });
//     });
//   });
//
//   describe('Were roles removed?', function () {
//     it('What permissions has harry over forums and blogs?', async () => {
//
//       acl.allowedPermissions('harry', ['forums','blogs'], function (err, permissions) {
//         assert(!err)
//         assert.isObject(permissions)
//         assert(permissions.forums.length === 0)
//         done()
//       });
//       it('What permissions has userId=2 over forums and blogs?', async () => {
//
//         acl.allowedPermissions(2, ['forums','blogs'], function (err, permissions) {
//           assert(!err)
//           assert.isObject(permissions)
//           assert(permissions.forums.length === 0)
//           done()
//         });
//       });
//     });
//   });
// }
//
// exports.i55PermissionRemoval = function () {
//   describe('Github issue #55: removeAllow is removing all permissions.', function () {
//     it('Add roles/resources/permissions', function () {
//
//
//       return acl.addUserRoles('jannette', 'member').then(function(){
//         return acl.allow('member', 'blogs', ['view', 'update']);
//       });.then(function(){
//         return acl.isAllowed('jannette', 'blogs', 'view', function(err, allowed){
//           expect(allowed).to.be.eql(true);
//         });
//       });.then(function(){
//         return acl.removeAllow('member', 'blogs', 'update');
//       });.then(function(){
//         return acl.isAllowed('jannette', 'blogs', 'view', function(err, allowed){
//           expect(allowed).to.be.eql(true);
//         });;
//       });.then(function(){
//         return acl.isAllowed('jannette', 'blogs', 'update', function(err, allowed){
//           expect(allowed).to.be.eql(false);
//         });;
//       });.then(function(){
//         return acl.removeAllow('member', 'blogs', 'view');
//       });.then(function(){
//         return acl.isAllowed('jannette', 'blogs', 'view', function(err, allowed){
//           expect(allowed).to.be.eql(false);
//         });;
//       });
//     });
//   });
// }
//
// exports.i32RoleRemoval = function () {
//   describe('Github issue #32: Removing a role removes the entire "allows" document.', function () {
//     it('Add roles/resources/permissions', async () => {
//
//
//       acl.allow(['role1', 'role2', 'role3'], ['res1', 'res2', 'res3'], ['perm1', 'perm2', 'perm3'], function (err) {
//         assert(!err)
//         done()
//       });
//     });
//
//     it('Add user roles and parent roles', async () => {
//
//
//       acl.addUserRoles('user1', 'role1', function (err) {
//         assert(!err)
//
//         acl.addRoleParents('role1', 'parentRole1', function (err) {
//           assert(!err)
//           done()
//         });
//       });
//     });
//
//     it('Add user roles and parent roles', async () => {
//
//
//       acl.addUserRoles(1, 'role1', function (err) {
//         assert(!err)
//
//         acl.addRoleParents('role1', 'parentRole1', function (err) {
//           assert(!err)
//           done()
//         });
//       });
//     });
//     it('Verify that roles have permissions as assigned', function(done){
//
//
//       acl.whatResources('role1', function (err, res) {
//         assert(!err)
//         assert.deepEqual(res.res1.sort(), [ 'perm1', 'perm2', 'perm3' ])
//
//         acl.whatResources('role2', function (err, res) {
//           assert(!err)
//           assert.deepEqual(res.res1.sort(), [ 'perm1', 'perm2', 'perm3' ])
//           done()
//         });
//       });
//     });
//
//     it('Remove role "role1"', function(done){
//
//
//       acl.removeRole('role1', function (err) {
//         assert(!err)
//         done()
//       });
//     });
//
//     it('Verify that "role1" has no permissions and "role2" has permissions intact', function(done){
//
//
//       acl.removeRole('role1', function (err) {
//         assert(!err)
//
//         acl.whatResources('role1', function (err, res) {
//           assert(Object.keys(res).length === 0)
//
//           acl.whatResources('role2', function (err, res) {
//             assert.deepEqual(res.res1.sort(), [ 'perm1', 'perm2', 'perm3' ])
//             done()
//           });
//         });
//       });
//     });
//   });
// }
