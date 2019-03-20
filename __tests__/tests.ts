import { Acl, MemoryStore } from '../src';

let acl = null;
beforeAll(async (done) => {
  acl = new Acl(new MemoryStore());
  done();
});

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

describe('Allows', () => {
  it('Guest to view blogs', async () => {
    const result = await acl.allow('guest', 'blogs', 'view');
    expect(result).toBeUndefined();
  });

  it('Guest to view forums', async () => {
    const result = await acl.allow('guest', 'forums', 'view');
    expect(result).toBeUndefined();
  });

  it('Member to view/edit/delete blogs', async () => {
    const result = await acl.allow('member', 'blogs', ['edit', 'view', 'delete']);
    expect(result).toBeUndefined();
  });
});

describe('Add user roles', () => {
  it('Joed = guest, jsmith = member, harry = admin, test@test.com = member', async () => {
    const [joed, jsmith, harry, test] = await Promise.all([
      acl.addUserRoles('joed', 'guest'),
      acl.addUserRoles('jsmith', 'member'),
      acl.addUserRoles('harry', 'admin'),
      acl.addUserRoles('test@test.com', 'member'),
    ]);

    expect(joed).toBeUndefined();
    expect(jsmith).toBeUndefined();
    expect(harry).toBeUndefined();
    expect(test).toBeUndefined();
  });

  it('0 = guest, 1 = member, 2 = admin', async () => {
    const [zero, one, two] = await Promise.all([
      acl.addUserRoles(0, 'guest'),
      acl.addUserRoles(1, 'member'),
      acl.addUserRoles(2, 'admin'),
    ]);

    expect(zero).toBeUndefined();
    expect(one).toBeUndefined();
    expect(two).toBeUndefined();
  });
});





// describe('Middleware', () => {
//   it('Should return 403', async () => {
//     const request = httpMocks.createRequest({method: 'GET', url: '/blogs'});
//     const response = httpMocks.createResponse();
//     acl.middleware(0, 'joed', 'GET')(request, response, (err) => {
//       expect(err.name).toEqual('HttpError');
//       expect(err.errorCode).toEqual(403);
//       expect(err.message).toEqual('Insufficient permissions to access resource');
//       done();
//     });
//   });
//
//   it('Should return 401', async () => {
//     const request = httpMocks.createRequest({method: 'GET', url: '/blogs'});
//     const response = httpMocks.createResponse();
//     acl.middleware(0, null, 'GET')(request, response, (err) => {
//       expect(err.name).toEqual('HttpError');
//       expect(err.errorCode).toEqual(401);
//       expect(err.message).toEqual('User not authenticated');
//       done();
//     });
//   });
//
//   it('Should return 200', async () => {
//     const request = httpMocks.createRequest({method: 'POST', url: '/blogs'});
//     const response = httpMocks.createResponse();
//     acl.addUserRoles('joed', 'member')
//       .then(() => acl.allow('member', '/blogs', ['POST']))
//       .then(() => acl.isAllowed('joed', '/blogs', 'POST'))
//       .then(() => acl.middleware(0, 'joed', 'POST')(request, response, (err2) => {
//         setTimeout(() => {
//           expect(!err2);
//           expect(response.statusCode).toEqual(200);
//           expect(response.statusMessage).toEqual('OK');
//           done();
//         }, 2000);
//       }));
//   });
// });
// });

describe('Read user\'s roles', () => {
  it('Run userRoles function', async () => {
    const harry = await acl.addUserRoles('harry', 'admin');
    const harryRoles = await acl.userRoles('harry');
    const harryHasRoleAdmin = await acl.hasRole('harry', 'admin');
    const harryHasRoleNoRole = await acl.hasRole('harry', 'no role');

    expect(harry).toBeUndefined();
    expect(harryRoles).toContain('admin');
    expect(harryHasRoleAdmin).toBeTruthy();
    expect(harryHasRoleNoRole).toBeFalsy();
  });
});

describe('Read role\'s users', () => {
  it('Run roleUsers function', async () => {

    const harry = await acl.addUserRoles('harry', 'admin');
    expect(harry).toBeUndefined();

    const roleUsers = await acl.roleUsers('admin');
    expect(roleUsers).toContain('harry');
  });
});

describe('Allow', () => {
  it('Admin view/add/edit/delete users', async () => {
    const admin = await acl.allow('admin', 'users', ['add', 'edit', 'view', 'delete']);
    expect(admin).toBeUndefined();
  });

  it('Foo view/edit blogs', async () => {
    const foo = await acl.allow('foo', 'blogs', ['edit', 'view']);
    expect(foo).toBeUndefined();
  });

  it('Bar to view/delete blogs', async () => {
    const bar = await acl.allow('bar', 'blogs', ['view', 'delete']);
    expect(bar).toBeUndefined();
  });
});

describe('Add role parents', () => {
  it('Add foot and bar roles into baz parent role', async () => {
    const baz = await acl.addRoleParents('baz', ['foo', 'bar']);
    expect(baz).toBeUndefined();
  });
});

describe('Add user roles', () => {
  it('Add them', async () => {
    const dimitri = await acl.addUserRoles('dimitri', 'baz');
    expect(dimitri).toBeUndefined();
  });

  it('Add them with numeric userId', async () => {
    const three = await acl.addUserRoles(3, 'baz');
    expect(three).toBeUndefined();
  });
});

describe('allow admin to do anything', () => {
  it('Add them', async () => {
    const admin = await acl.allow('admin', ['blogs', 'forums'], '*');
    expect(admin).toBeUndefined();
  });
});

describe('Arguments in one array', () => {
  it('Give role fumanchu an array of resources and permissions', async () => {
    const allow = await acl.allow(
      [{
        roles: 'fumanchu',
        allows: [
          {resources: 'blogs', permissions: 'get'},
          {resources: ['forums', 'news'], permissions: ['get', 'put', 'delete']},
          {resources: ['/path/file/file1.txt', '/path/file/file2.txt'], permissions: ['get', 'put', 'delete']},
        ],
      }],
    );
    expect(allow).toBeUndefined();
  });
});

describe('Add fumanchu role to suzanne', () => {
  it('Do it', async () => {
    const suzanne = await acl.addUserRoles('suzanne', 'fumanchu');
    expect(suzanne).toBeUndefined();
  });

  it('Do it (numeric userId)', async () => {
    const suzanne = await acl.addUserRoles(4, 'fumanchu');
    expect(suzanne).toBeUndefined();
  });
});


describe('Allowance queries', () => {
  describe('IsAllowed', () => {
    it('Can joed view blogs?', async () => {
      const isAllowed = await acl.isAllowed('joed', 'blogs', 'view');
      expect(isAllowed).toBeTruthy();
    });

    // it('Can userId=0 view blogs?', async () => {
    //   const isAllowed = await acl.isAllowed(0, 'blogs', 'view');
    //   expect(isAllowed).toBeTruthy();
    // });
    //
    // it('Can joed view forums?', async () => {
    //   const isAllowed = await acl.isAllowed('joed', 'forums', 'view');
    //   expect(isAllowed).toBeTruthy();
    // });
    //
    // it('Can userId=0 view forums?', async () => {
    //   const isAllowed = acl.isAllowed(0, 'forums', 'view');
    //   expect(isAllowed).toBeTruthy();
    // });
    //
    // it('Can joed edit forums?', async () => {
    //   const isAllowed = await acl.isAllowed('joed', 'forums', 'edit');
    //   expect(isAllowed).toBeFalsy();
    // });
    //
    // it('Can userId=0 edit forums?', async () => {
    //   const isAllowed = await acl.isAllowed(0, 'forums', 'edit');
    //   expect(isAllowed).toBeFalsy();
    // });
    //
    // it('Can jsmith edit forums?', async () => {
    //   const isAllowed = await acl.isAllowed('jsmith', 'forums', 'edit');
    //   expect(isAllowed).toBeFalsy();
    // });
    //
    // it('Can jsmith edit blogs?', async () => {
    //   const isAllowed = await acl.isAllowed('jsmith', 'blogs', 'edit');
    //   expect(isAllowed).toBeTruthy();
    // });
    //
    // it('Can test@test.com edit forums?', async () => {
    //   const isAllowed = await acl.isAllowed('test@test.com', 'forums', 'edit');
    //   expect(isAllowed).toBeFalsy();
    // });
    //
    // it('Can test@test.com edit blogs?', async () => {
    //   const isAllowed = await acl.isAllowed('test@test.com', 'blogs', 'edit');
    //   expect(isAllowed).toBeTruthy();
    // });
    //
    // it('Can userId=1 edit blogs?', async () => {
    //   const isAllowed = await acl.isAllowed(1, 'blogs', 'edit');
    //   expect(isAllowed).toBeTruthy();
    // });
    //
    // it('Can jsmith edit, delete and clone blogs?', async () => {
    //   const isAllowed = await acl.isAllowed('jsmith', 'blogs', ['edit', 'view', 'clone']);
    //   expect(isAllowed).toBeFalsy();
    // });
    //
    // it('Can test@test.com edit, delete and clone blogs?', async () => {
    //   const isAllowed = await acl.isAllowed('test@test.com', 'blogs', ['edit', 'view', 'clone']);
    //   expect(isAllowed).toBeFalsy();
    // });
    //
    // it('Can userId=1 edit, delete and clone blogs?', async () => {
    //   const isAllowed = await acl.isAllowed(1, 'blogs', ['edit', 'view', 'clone']);
    //   expect(isAllowed).toBeFalsy();
    // });
    //
    // it('Can jsmith edit, clone blogs?', async () => {
    //   const isAllowed = await acl.isAllowed('jsmith', 'blogs', ['edit', 'clone']);
    //   expect(isAllowed).toBeFalsy();
    // });
    //
    // it('Can test@test.com edit, clone blogs?', async () => {
    //   const isAllowed = await acl.isAllowed('test@test.com', 'blogs', ['edit', 'clone']);
    //   expect(isAllowed).toBeFalsy();
    // });
    //
    // it('Can userId=1 edit, delete blogs?', async () => {
    //   const isAllowed = await acl.isAllowed(1, 'blogs', ['edit', 'clone']);
    //   expect(isAllowed).toBeFalsy();
    // });
    //
    // it('Can james add blogs?', async () => {
    //   const isAllowed = await acl.isAllowed('dimitri', 'blogs', 'add');
    //   expect(isAllowed).toBeFalsy();
    // });
    //
    // it('Can userId=3 add blogs?', async () => {
    //   const isAllowed = await acl.isAllowed(3, 'blogs', 'add');
    //   expect(isAllowed).toBeFalsy();
    // });
    //
    // it('Can suzanne add blogs?', async () => {
    //   const isAllowed = await acl.isAllowed('suzanne', 'blogs', 'add');
    //   expect(isAllowed).toBeFalsy();
    // });
    //
    // it('Can userId=4 add blogs?', async () => {
    //   const isAllowed = await acl.isAllowed(4, 'blogs', 'add');
    //   expect(isAllowed).toBeFalsy();
    // });
    //
    // it('Can suzanne get blogs?', async () => {
    //   const isAllowed = await acl.isAllowed('suzanne', 'blogs', 'get');
    //   expect(isAllowed).toBeTruthy();
    // });
    //
    // it('Can userId=4 get blogs?', async () => {
    //   const isAllowed = await acl.isAllowed(4, 'blogs', 'get');
    //   expect(isAllowed).toBeTruthy();
    // });
    //
    // it('Can suzanne delete and put news?', async () => {
    //   const isAllowed = await acl.isAllowed('suzanne', 'news', ['put', 'delete']);
    //   expect(isAllowed).toBeTruthy();
    // });
    //
    // it('Can userId=4 delete and put news?', async () => {
    //   const isAllowed = await acl.isAllowed(4, 'news', ['put', 'delete']);
    //   expect(isAllowed).toBeTruthy();
    // });
    //
    // it('Can suzanne delete and put forums?', async () => {
    //   const isAllowed = await acl.isAllowed('suzanne', 'forums', ['put', 'delete']);
    //   expect(isAllowed).toBeTruthy();
    // });
    //
    // it('Can userId=4 delete and put forums?', async () => {
    //   const isAllowed = await acl.isAllowed(4, 'forums', ['put', 'delete']);
    //   expect(isAllowed).toBeTruthy();
    // });
    //
    // it('Can nobody view news?', async () => {
    //   const isAllowed = await acl.isAllowed('nobody', 'blogs', 'view');
    //   expect(isAllowed).toBeFalsy();
    // });
    //
    // it('Can nobody view nothing?', async () => {
    //   const isAllowed = await acl.isAllowed('nobody', 'nothing', 'view');
    //   expect(isAllowed).toBeFalsy();
    // });
  });
});

// describe('allowedPermissions', () => {
//   it('What permissions has james over blogs and forums?', async () => {
//     acl.allowedPermissions('dimitri', ['blogs', 'forums'], (err, permissions) => {
//       expect(!err);
//       expect(permissions).toHaveProperty('blogs');
//       expect(permissions).toHaveProperty('forums');
//       expect(permissions.blogs).toContain('edit');
//       expect(permissions.blogs).toContain('view');
//       expect(permissions.blogs).toContain('delete');
//       expect(!permissions.forums.length);
//       done();
//     });
//   });
//
//   it('What permissions has userId=3 over blogs and forums?', async () => {
//     acl.allowedPermissions(3, ['blogs', 'forums'], (err, permissions) => {
//       expect(!err);
//       expect(permissions).toHaveProperty('blogs');
//       expect(permissions).toHaveProperty('forums');
//       expect(permissions.blogs).toContain('edit');
//       expect(permissions.blogs).toContain('view');
//       expect(permissions.blogs).toContain('delete');
//       expect(!permissions.forums.length);
//       done();
//     });
//   });
//
//   it('What permissions has nonsenseUser over blogs and forums?', async () => {
//     acl.allowedPermissions('nonsense', ['blogs', 'forums'], (err, permissions) => {
//       expect(!err);
//       expect(!permissions.forums.length);
//       expect(!permissions.blogs.length);
//       done();
//     });
//   });
// });
//
// describe('WhatResources queries', () => {
//   it('What resources have "bar" some rights on?', async () => {
//     acl.whatResources('bar', (err, resources) => {
//       expect(err).toBeNull();
//       expect(resources.blogs).toContain('view');
//       expect(resources.blogs).toContain('delete');
//       done();
//     });
//   });
//
//   it('What resources have "bar" view rights on?', async () => {
//     acl.whatResources('bar', 'view', (err, resources) => {
//       expect(err).toBeNull();
//       expect(resources).toContain('blogs');
//       done();
//     });
//   });
//
//   it('What resources have "fumanchu" some rights on?', async () => {
//     acl.whatResources('fumanchu', (err, resources) => {
//       expect(err).toBeNull();
//       expect(resources).toHaveProperty('blogs', ['get']);
//       expect(resources.forums).toContain('get');
//       expect(resources.forums).toContain('put');
//       expect(resources.forums).toContain('delete');
//       expect(resources.news).toContain('get');
//       expect(resources.news).toContain('put');
//       expect(resources.news).toContain('delete');
//       expect(resources['/path/file/file1.txt']).toContain('get');
//       expect(resources['/path/file/file1.txt']).toContain('put');
//       expect(resources['/path/file/file1.txt']).toContain('delete');
//       expect(resources['/path/file/file2.txt']).toContain('get');
//       expect(resources['/path/file/file2.txt']).toContain('put');
//       expect(resources['/path/file/file2.txt']).toContain('delete');
//       done();
//     });
//   });
//
//   it('What resources have "baz" some rights on?', async () => {
//     acl.whatResources('baz', (err, resources) => {
//       expect(err).toBeNull();
//       expect(resources.blogs).toContain('edit');
//       expect(resources.blogs).toContain('view');
//       expect(resources.blogs).toContain('delete');
//       done();
//     });
//   });
// });
//
// describe('removeAllow', () => {
//   it('Remove get permissions from resources blogs and forums from role fumanchu', async () => {
//     acl.removeAllow('fumanchu', ['blogs', 'forums'], 'get', (err) => {
//       expect(!err);
//       done();
//     });
//   });
//
//   it('Remove delete and put permissions from resource news from role fumanchu', async () => {
//     acl.removeAllow('fumanchu', 'news', 'delete', (err) => {
//       expect(!err);
//       done();
//     });
//   });
//
//   it('Remove view permissions from resource blogs from role bar', async () => {
//     acl.removeAllow('bar', 'blogs', 'view', (err) => {
//       expect(!err);
//       done();
//     });
//   });
// });
//
// describe('See if permissions were removed', () => {
//   it('What resources have "fumanchu" some rights on after removed some of them?', async () => {
//     acl.whatResources('fumanchu', (err, resources) => {
//       expect(err).toBeNull();
//       expect(resources).not.toContain('blogs');
//       expect(resources).toHaveProperty('news');
//       expect(resources.news).toContain('get');
//       expect(resources.news).toContain('put');
//       expect(resources).not.toContain('delete');
//       expect(resources.forums).toContain('put');
//       expect(resources.forums).toContain('delete');
//       done();
//     });
//   });
// });
//
// describe('RemoveRole', () => {
//   it('Remove role fumanchu', async () => {
//     acl.removeRole('fumanchu', (err) => {
//       expect(!err);
//       done();
//     });
//   });
//
//   it('Remove role member', async () => {
//     acl.removeRole('member', (err) => {
//       expect(!err);
//       done();
//     });
//   });
//
//   it('Remove role foo', async () => {
//     acl.removeRole('foo', (err) => {
//       expect(!err);
//       done();
//     });
//   });
// });
//
// describe('Was role removed?', () => {
//   it('What resources have "fumanchu" some rights on after removed?', async () => {
//     acl.whatResources('fumanchu', (err, resources) => {
//       expect(!err);
//       expect(!Object.keys(resources).length);
//       done();
//     });
//   });
//
//   it('What resources have "member" some rights on after removed?', async () => {
//     acl.whatResources('member', (err, resources) => {
//       expect(!err);
//       expect(!Object.keys(resources).length);
//       done();
//     });
//   });
//
//   describe('Allowed permissions', () => {
//     it('What permissions has jsmith over blogs and forums?', async () => {
//       acl.allowedPermissions('jsmith', ['blogs', 'forums'], (err, permissions) => {
//         expect(!err);
//         expect(!permissions.blogs);
//         expect(!permissions.forums);
//         done();
//       });
//     });
//
//     it('What permissions has test@test.com over blogs and forums?', async () => {
//       acl.allowedPermissions('test@test.com', ['blogs', 'forums'], (err, permissions) => {
//         expect(!err);
//         expect(!permissions.blogs);
//         expect(!permissions.forums);
//         done();
//       });
//     });
//
//     it('What permissions has james over blogs?', async () => {
//       acl.allowedPermissions('dimitri', 'blogs', (err, permissions) => {
//         expect(!err);
//         expect(permissions.blogs).toContain('delete');
//         done();
//       });
//     });
//   });
// });
//
// describe('RoleParentRemoval', () => {
//   beforeAll(async () => {
//     acl.allow('parent1', 'x', 'read1')
//       .then(() => acl.allow('parent2', 'x', 'read2'))
//       .then(() => acl.allow('parent3', 'x', 'read3'))
//       .then(() => acl.allow('parent4', 'x', 'read4'))
//       .then(() => acl.allow('parent5', 'x', 'read5'))
//       .then(() => acl.addRoleParents('child', ['parent1', 'parent2', 'parent3', 'parent4', 'parent5']))
//       .then(() => done());
//   });
//
//   it('Environment check', async () => {
//     acl.whatResources('child')
//       .then((resources) => {
//         expect(resources.x.length === 5);
//         expect(resources.x).toContain('read1');
//         expect(resources.x).toContain('read2');
//         expect(resources.x).toContain('read3');
//         expect(resources.x).toContain('read4');
//         expect(resources.x).toContain('read5');
//         done();
//       });
//   });
//
//   it('Operation uses a callback when removing a specific parent role', async () => {
//     acl.removeRoleParents('child', 'parentX', (err) => {
//       expect(!err);
//       done();
//     });
//   });
//
//   it('Operation uses a callback when removing multiple specific parent roles', async () => {
//     acl.removeRoleParents('child', ['parentX', 'parentY'], (err) => {
//       expect(!err);
//       done();
//     });
//   });
//
//   it('Remove parent role "parentX" from role "child"', async () => {
//     acl.removeRoleParents('child', 'parentX')
//       .then(() => acl.whatResources('child'))
//       .then((resources) => {
//         expect(resources.x.length === 5);
//         expect(resources.x).toContain('read1');
//         expect(resources.x).toContain('read2');
//         expect(resources.x).toContain('read3');
//         expect(resources.x).toContain('read4');
//         expect(resources.x).toContain('read5');
//         done();
//       });
//   });
//
//   it('Remove parent role "parent1" from role "child"', async () => {
//     acl.removeRoleParents('child', 'parent1')
//       .then(() => acl.whatResources('child'))
//       .then((resources) => {
//         expect(resources.x.length === 4);
//         expect(resources.x).toContain('read2');
//         expect(resources.x).toContain('read3');
//         expect(resources.x).toContain('read4');
//         expect(resources.x).toContain('read5');
//         done();
//       });
//   });
//
//   it('Remove parent roles "parent2" & "parent3" from role "child"', async () => {
//     acl.removeRoleParents('child', ['parent2', 'parent3'])
//       .then(() => acl.whatResources('child'))
//       .then((resources) => {
//         expect(resources.x.length === 2);
//         expect(resources.x).toContain('read4');
//         expect(resources.x).toContain('read5');
//         done();
//       });
//   });
//
//   it('Remove all parent roles from role "child"', async () => {
//     acl.removeRoleParents('child')
//       .then(() => acl.whatResources('child'))
//       .then((resources) => {
//         expect(resources).not.toHaveProperty('x');
//         done();
//       });
//   });
//
//   it('Remove all parent roles from role "child" with no parents', async () => {
//     acl.removeRoleParents('child')
//       .then(() => acl.whatResources('child'))
//       .then((resources) => {
//         expect(resources).not.toHaveProperty('x');
//         done();
//       });
//   });
//
//   it('Remove parent role "parent1" from role "child" with no parents', async () => {
//     acl.removeRoleParents('child', 'parent1')
//       .then(() => acl.whatResources('child'))
//       .then((resources) => {
//         expect(resources).not.toHaveProperty('x');
//         done();
//       });
//   });
//
//   it('Operation uses a callback when removing all parent roles', async () => {
//     acl.removeRoleParents('child', (err) => {
//       expect(!err);
//       done();
//     });
//   });
// });
//
// describe('RemoveResource', () => {
//   it('Remove resource blogs', async () => {
//     acl.removeResource('blogs', (err) => {
//       expect(!err);
//       done();
//     });
//   });
//
//   it('Remove resource users', async () => {
//     acl.removeResource('users', (err) => {
//       expect(!err);
//       done();
//     });
//   });
// });
//
// describe('AllowedPermissions', () => {
//   it('What permissions has james over blogs?', async () => {
//     acl.allowedPermissions('dimitri', 'blogs', (err, permissions) => {
//       expect(err).toBeNull();
//       expect(permissions).toHaveProperty('blogs');
//       expect(!permissions.blogs.length);
//       done();
//     });
//   });
//
//   it('What permissions has userId=4 over blogs?', async () => {
//     acl.allowedPermissions(4, 'blogs')
//       .then((permissions) => {
//         expect(permissions).toHaveProperty('blogs');
//         expect(!permissions.blogs.length);
//         done();
//       });
//   });
// });
//
// describe('WhatResources', () => {
//   it('What resources have "baz" some rights on after removed blogs?', async () => {
//     acl.whatResources('baz', (err, resources) => {
//       expect(!err);
//       expect(typeof resources === 'object');
//       expect(!Object.keys(resources).length);
//       done();
//     });
//   });
//
//   it('What resources have "admin" some rights on after removed users resource?', async () => {
//     acl.whatResources('admin', (err, resources) => {
//       expect(!err);
//       expect(resources).not.toContain('users');
//       expect(resources).not.toContain('blogs');
//       done();
//     });
//   });
// });
//
// describe('Remove user roles', () => {
//   it('Remove role guest from joed', async () => {
//     acl.removeUserRoles('joed', 'guest', (err) => {
//       expect(!err);
//       done();
//     });
//   });
//
//   it('Remove role guest from userId=0', async () => {
//     acl.removeUserRoles(0, 'guest', (err) => {
//       expect(!err);
//       done();
//     });
//   });
//   it('Remove role admin from harry', async () => {
//     acl.removeUserRoles('harry', 'admin', (err) => {
//       expect(!err);
//       done();
//     });
//   });
//
//   it('Remove role admin from userId=2', async () => {
//     acl.removeUserRoles(2, 'admin', (err) => {
//       expect(!err);
//       done();
//     });
//   });
// });
//
// describe('Were roles removed?', () => {
//   it('What permissions has harry over forums and blogs?', async () => {
//     acl.allowedPermissions('harry', ['forums', 'blogs'], (err, permissions) => {
//       expect(!err);
//       expect(typeof permissions === 'object');
//       expect(!permissions.forums.length);
//       done();
//     });
//   });
//
//   it('What permissions has userId=2 over forums and blogs?', async () => {
//     acl.allowedPermissions(2, ['forums', 'blogs'], (err, permissions) => {
//       expect(!err);
//       expect(typeof permissions === 'object');
//       expect(!permissions.forums.length);
//       done();
//     });
//   });
// });
//
// describe('RemoveAllow is removing all permissions', () => {
//   it('Add roles/resources/permissions', () => {
//     acl.addUserRoles('jannette', 'member')
//       .then(() => acl.allow('member', 'blogs', ['view', 'update']))
//       .then(() => acl.isAllowed('jannette', 'blogs', 'view'))
//       .then((isAllowed) => expect(isAllowed).toBeTruthy())
//       .then(() => acl.removeAllow('member', 'blogs', 'update'))
//       .then(() => acl.isAllowed('jannette', 'blogs', 'view'))
//       .then((isAllowed) => expect(isAllowed).toBeTruthy())
//       .then(() => acl.isAllowed('jannette', 'blogs', 'update'))
//       .then((isAllowed) => expect(isAllowed).toBeFalsy())
//       .then(() => acl.removeAllow('member', 'blogs', 'view'))
//       .then(() => acl.isAllowed('jannette', 'blogs', 'view'))
//       .then((isAllowed) => expect(isAllowed).toBeFalsy());
//   });
// });
//
// describe('Removing a role removes the entire "allows" document.', () => {
//   it('Add roles/resources/permissions', async () => {
//     acl.allow(['role1', 'role2', 'role3'], ['res1', 'res2', 'res3'], ['perm1', 'perm2', 'perm3'], (err) => {
//       expect(!err);
//       done();
//     });
//   });
//
//   it('Add user roles and parent roles', async () => {
//     acl.addUserRoles('user1', 'role1', (err1) => {
//       expect(!err1);
//
//       acl.addRoleParents('role1', 'parentRole1', (err2) => {
//         expect(!err2);
//         done();
//       });
//     });
//   });
//
//   it('Add user roles and parent roles', async () => {
//     acl.addUserRoles(1, 'role1', (err1) => {
//       expect(!err1);
//
//       acl.addRoleParents('role1', 'parentRole1', (err2) => {
//         expect(!err2);
//         done();
//       });
//     });
//   });
//
//   it('Verify that roles have permissions as assigned', async () => {
//     acl.whatResources('role1', (err1, res1) => {
//       expect(!err1);
//       expect(res1.res1.sort()).toEqual(['perm1', 'perm2', 'perm3']);
//
//       acl.whatResources('role2', (err2, res2) => {
//         expect(!err2);
//         expect(res2.res1.sort()).toEqual(['perm1', 'perm2', 'perm3']);
//         done();
//       });
//     });
//   });
//
//   it('Remove role "role1"', async () => {
//     acl.removeRole('role1', (err) => {
//       expect(!err);
//       done();
//     });
//   });
//
//   it('Verify that "role1" has no permissions and "role2" has permissions intact', async () => {
//     acl.removeRole('role1', (err) => {
//       expect(!err);
//
//       acl.whatResources('role1', (err1, res1) => {
//         expect(!Object.keys(res1).length);
//
//         acl.whatResources('role2', (err2, res2) => {
//           expect(res2.res1.sort()).toEqual(['perm1', 'perm2', 'perm3']);
//           done();
//         });
//       });
//     });
//   });
//
//   it('Remove an user', async () => {
//     acl.removeUser('dimitri', (err1) => {
//       expect(!err1);
//       done();
//     });
//   });
// });
