import { Acl, MemoryStore } from '../src';

const acl = new Acl(new MemoryStore());

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
  it('guest to view blogs', async () => {
    const guest = await acl.allow('guest', 'blogs', 'view');
    expect(guest).toBeUndefined();
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
