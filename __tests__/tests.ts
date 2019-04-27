import * as bluebird from 'bluebird';
import { MongoClient } from 'mongodb';
import * as Redis from 'redis';
import { Acl, MemoryStore, MongoDBStore, RedisStore } from '../src';

['Memory', 'Redis', 'MongoDB'].forEach((store: string) => {
  let acl: Acl;
  let redis: Redis.RedisClient;
  let mongodb: MongoClient;

  describe(`${store} store`, () => {
    beforeAll(async (done: Function) => {
      if (store === 'Memory') {
        acl = new Acl(new MemoryStore());
      } else if (store === 'Redis') {
        bluebird.promisifyAll(Redis.RedisClient.prototype);
        bluebird.promisifyAll(Redis.Multi.prototype);
        redis = Redis.createClient({host: 'aclify-redis'});
        acl = new Acl(new RedisStore(redis));
      } else if (store === 'MongoDB') {
        mongodb = await MongoClient.connect('mongodb://aclify-mongodb'); // tslint:disable-line no-unsafe-any
        acl = new Acl(new MongoDBStore(mongodb.db('aclify'), 'acl_')); // tslint:disable-line no-unsafe-any
      }
      done();
    });

    afterAll((done: Function) => {
      setTimeout(() => {
        if (store === 'Redis') {
          redis.quit();
        } else if (store === 'MongoDB') {
          mongodb.close(); // tslint:disable-line no-unsafe-any
        }
        done();
      }, 14000);
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

    describe('allow', () => {
      it('guest to view blogs', async () => {
        const guest = await acl.allow('guest', 'blogs', 'view');
        expect(guest).toBeUndefined();
      });

      it('guest to view forums', async () => {
        const guest = await acl.allow('guest', 'forums', 'view');
        expect(guest).toBeUndefined();
      });

      it('member to view/edit/delete blogs', async () => {
        const member = await acl.allow('member', 'blogs', ['edit', 'view', 'delete']);
        expect(member).toBeUndefined();
      });
    });

    describe('Add user roles', () => {
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

    describe('read User Roles', () => {
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

    describe('read Role Users', () => {
      it('run roleUsers function', async () => {
        const addUserRoles = await acl.addUserRoles('harry', 'admin');
        expect(addUserRoles).toBeUndefined();

        const roleUsers = await acl.roleUsers('admin');
        expect(roleUsers).toContain('harry');
      });
    });

    describe('allow', () => {
      it('admin view/add/edit/delete users', async () => {
        const admin = await acl.allow('admin', 'users', ['add', 'edit', 'view', 'delete']);
        expect(admin).toBeUndefined();
      });

      it('foo view/edit blogs', async () => {
        const foo = await acl.allow('foo', 'blogs', ['edit', 'view']);
        expect(foo).toBeUndefined();
      });

      it('bar to view/delete blogs', async () => {
        const bar = await acl.allow('bar', 'blogs', ['view', 'delete']);
        expect(bar).toBeUndefined();
      });
    });

    describe('add role parents', () => {
      it('add them', async () => {
        const addRoleParents = await acl.addRoleParents('baz', ['foo', 'bar']);
        expect(addRoleParents).toBeUndefined();
      });
    });

    describe('add user roles', () => {
      it('add them', async () => {
        const addUserRoles = await acl.addUserRoles('james', 'baz');
        expect(addUserRoles).toBeUndefined();
      });

      it('add them (numeric userId)', async () => {
        const addUserRoles = await acl.addUserRoles(3, 'baz');
        expect(addUserRoles).toBeUndefined();
      });
    });

    describe('allow admin to do anything', () => {
      it('add them', async () => {
        const allow = await acl.allow('admin', ['blogs', 'forums'], '*');
        expect(allow).toBeUndefined();
      });
    });

    describe('Arguments in one array', () => {
      it('give role fumanchu an array of resources and permissions', async () => {
        const allow = await acl.allow(
          [
            {
              roles: 'fumanchu',
              allows: [
                {resources: 'blogs', permissions: 'get'},
                {resources: ['forums', 'news'], permissions: ['get', 'put', 'delete']},
                {resources: ['/path/file/file1.txt', '/path/file/file2.txt'], permissions: ['get', 'put', 'delete']}
              ]
            }
          ]);
        expect(allow).toBeUndefined();
      });
    });

    describe('Add fumanchu role to suzanne', () => {
      it('do it', async () => {
        const addUserRoles = await acl.addUserRoles('suzanne', 'fumanchu');
        expect(addUserRoles).toBeUndefined();
      });

      it('do it (numeric userId)', async () => {
        const addUserRoles = await acl.addUserRoles(4, 'fumanchu');
        expect(addUserRoles).toBeUndefined();
      });
    });

    describe('Allowance queries', () => {
      describe('isAllowed', () => {
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
          const isAllowed = await acl.isAllowed('jsmith', 'blogs', ['edit', 'view', 'clone']);
          expect(isAllowed).toBeFalsy();
        });

        it('Can test@test.com edit, delete and clone blogs?', async () => {
          const isAllowed = await acl.isAllowed('test@test.com', 'blogs', ['edit', 'view', 'clone']);
          expect(isAllowed).toBeFalsy();
        });

        it('Can userId=1 edit, delete and clone blogs?', async () => {
          const isAllowed = await acl.isAllowed(1, 'blogs', ['edit', 'view', 'clone']);
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
          const isAllowed = await acl.isAllowed('suzanne', 'news', ['put', 'delete']);
          expect(isAllowed).toBeTruthy();
        });

        it('Can userId=4 delete and put news?', async () => {
          const isAllowed = await acl.isAllowed(4, 'news', ['put', 'delete']);
          expect(isAllowed).toBeTruthy();
        });

        it('Can suzanne delete and put forums?', async () => {
          const isAllowed = await acl.isAllowed('suzanne', 'forums', ['put', 'delete']);
          expect(isAllowed).toBeTruthy();
        });

        it('Can userId=4 delete and put forums?', async () => {
          const isAllowed = await acl.isAllowed(4, 'forums', ['put', 'delete']);
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

        describe('allowedPermissions', () => {
          it('What permissions has james over blogs and forums?', async () => {
            interface IResult {
              blogs: string[],
              forums: string[],
            }

            // @ts-ignore
            const allowedPermissions: IResult = await acl.allowedPermissions('james', ['blogs', 'forums']);
            expect(allowedPermissions).toHaveProperty('blogs');
            expect(allowedPermissions).toHaveProperty('forums', []);
            expect(allowedPermissions.blogs.sort()).toEqual(['edit', 'view', 'delete'].sort())
          });
        });

        it('What permissions has userId=3 over blogs and forums?', async () => {
          interface IResult {
            blogs: string[],
            forums: string[],
          }

          // @ts-ignore
          const allowedPermissions: IResult = await acl.allowedPermissions(3, ['blogs', 'forums']);
          expect(allowedPermissions).toHaveProperty('blogs');
          expect(allowedPermissions).toHaveProperty('forums', []);
          expect(allowedPermissions.blogs.sort()).toEqual(['edit', 'view', 'delete'].sort())
        });

        it('What permissions has nonsenseUser over blogs and forums?', async () => {
          const allowedPermissions = await acl.allowedPermissions('nonsense', ['blogs', 'forums']);
          expect(allowedPermissions).toHaveProperty('blogs', []);
          expect(allowedPermissions).toHaveProperty('forums', []);
        });
      });
    });

    describe('whatResources queries', () => {
      it('What resources have "bar" some rights on?', async () => {
        interface IResult {
          blogs: string[],
        }

        // @ts-ignore
        const resources: IResult = await acl.whatResources('bar');
        expect(resources).toHaveProperty('blogs');
        expect(resources.blogs.sort()).toEqual(['view', 'delete'].sort());
      });

      it('What resources have "bar" view rights on?', async () => {
        const resources = await acl.whatResources('bar', 'view');
        expect(resources).toEqual(['blogs']);
      });

      it('What resources have "fumanchu" some rights on?', async () => {
        interface IResult {
          blogs: string[],
          forums: string[],
          news: string[],
          '/path/file/file1.txt': string[],
          '/path/file/file2.txt': string[],
        }

        // @ts-ignore
        const resources: IResult = await acl.whatResources('fumanchu');
        expect(resources).toHaveProperty('blogs');
        expect(resources).toHaveProperty('forums');
        expect(resources).toHaveProperty('news');
        expect(resources['/path/file/file1.txt'].sort()).toEqual(['get', 'put', 'delete'].sort());
        expect(resources['/path/file/file2.txt'].sort()).toEqual(['get', 'put', 'delete'].sort());
        expect(resources.blogs.sort()).toEqual(['get']);
        expect(resources.forums.sort()).toEqual(['get', 'put', 'delete'].sort());
        expect(resources.news.sort()).toEqual(['get', 'put', 'delete'].sort());
      });

      it('What resources have "baz" some rights on?', async () => {
        interface IResult {
          blogs: string[],
        }

        // @ts-ignore
        const resources: IResult = await acl.whatResources('baz');
        expect(resources).toHaveProperty('blogs', );
        expect(resources.blogs.sort()).toEqual(['edit', 'view', 'delete'].sort());
      });
    });

    // describe('removeAllow', () => {
    //   it('Remove get permissions from resources blogs and forums from role fumanchu', async () => {
    //     const removeAllow = await acl.removeAllow('fumanchu', ['blogs', 'forums'], 'get');
    //     expect(removeAllow).toBeUndefined();
    //   });
    //
    //   it('Remove delete and put permissions from resource news from role fumanchu', async () => {
    //     const removeAllow = await acl.removeAllow('fumanchu', 'news', 'delete');
    //     expect(removeAllow).toBeUndefined();
    //   });
    //
    //   it('Remove view permissions from resource blogs from role bar', async () => {
    //     const removeAllow = await acl.removeAllow('bar', 'blogs', 'view');
    //     expect(removeAllow).toBeUndefined();
    //   });
    // });
    //
    // describe('See if permissions were removed', () => {
    //   it('What resources have "fumanchu" some rights on after removed some of them?', async () => {
    //     interface IResult {
    //       blogs: string[],
    //       news: string[],
    //       forums: string[],
    //     }
    //
    //     // @ts-ignore
    //     const resources: IResult = await acl.whatResources('fumanchu');
    //     expect(resources).not.toHaveProperty('blogs');
    //     expect(resources).toHaveProperty('news');
    //     expect(resources).not.toHaveProperty('news', ['delete']);
    //     expect(resources).toHaveProperty('forums');
    //     expect(resources.news.sort()).toEqual(['get', 'put'].sort());
    //     expect(resources.forums.sort()).toEqual(['put', 'delete'].sort());
    //   });
    // });
    //
    // describe('removeRole', () => {
    //   it('Remove role fumanchu', async () => {
    //     const remove = await acl.removeRole('fumanchu');
    //     expect(remove).toBeUndefined();
    //   });
    //
    //   it('Remove role member', async () => {
    //     const remove = await acl.removeRole('member');
    //     expect(remove).toBeUndefined();
    //   });
    //
    //   it('Remove role foo', async () => {
    //     const remove = await acl.removeRole('foo');
    //     expect(remove).toBeUndefined();
    //   });
    // });
    //
    // describe('Was role removed?', () => {
    //   it('What resources have "fumanchu" some rights on after removed?', async () => {
    //     const resources = await acl.whatResources('fumanchu');
    //     expect(Object.keys(resources)).toHaveLength(0);
    //   });
    //
    //   it('What resources have "member" some rights on after removed?', async () => {
    //     const resources = await acl.whatResources('member');
    //     expect(Object.keys(resources)).toHaveLength(0);
    //   });
    // });
    //
    // describe('allowed permissions', () => {
    //   it('What permissions has jsmith over blogs and forums?', async () => {
    //     const permissions = await acl.allowedPermissions('jsmith', ['blogs', 'forums']);
    //     expect(permissions).toHaveProperty('blogs');
    //     expect(permissions.blogs).toHaveLength(0);
    //     expect(permissions).toHaveProperty('forums');
    //     expect(permissions.forums).toHaveLength(0);
    //   });
    //
    //   it('What permissions has test@test.com over blogs and forums?', async () => {
    //     const permissions = await acl.allowedPermissions('test@test.com', ['blogs', 'forums']);
    //     expect(permissions).toHaveProperty('blogs');
    //     expect(permissions.blogs).toHaveLength(0);
    //     expect(permissions).toHaveProperty('forums');
    //     expect(permissions.forums).toHaveLength(0);
    //   });
    //
    //   it('What permissions has james over blogs?', async () => {
    //     const permissions = await acl.allowedPermissions('james', 'blogs');
    //     expect(permissions).toHaveProperty('blogs', ['delete']);
    //   });
    // });
    //
    // describe('RoleParentRemoval', () => {
    //   const memoryStore2 = new MemoryStore();
    //   const acl2 = new Acl(memoryStore2);
    //
    //   beforeAll(async () => {
    //     await acl2.allow('parent1', 'x', 'read1');
    //     await acl2.allow('parent2', 'x', 'read2');
    //     await acl2.allow('parent3', 'x', 'read3');
    //     await acl2.allow('parent4', 'x', 'read4');
    //     await acl2.allow('parent5', 'x', 'read5');
    //     await acl2.addRoleParents('child', ['parent1', 'parent2', 'parent3', 'parent4', 'parent5']);
    //   });
    //
    //   it('Environment check', async () => {
    //     interface IResult {
    //       x: string[],
    //     }
    //
    //     // @ts-ignore
    //     const resources: IResult = await acl2.whatResources('child');
    //     expect(resources).toHaveProperty('x');
    //     expect(resources.x.sort()).toEqual(['read1', 'read2', 'read3', 'read4', 'read5'].sort());
    //   });
    //
    //   it('Operation uses a callback when removing a specific parent role', async () => {
    //     const removeRoleParents = await acl2.removeRoleParents('child', 'parentX');
    //     expect(removeRoleParents).toBeUndefined();
    //   });
    //
    //   it('Operation uses a callback when removing multiple specific parent roles', async () => {
    //     const removeRoleParents = await acl2.removeRoleParents('child', ['parentX', 'parentY']);
    //     expect(removeRoleParents).toBeUndefined();
    //   });
    //
    //   it('Remove parent role "parentX" from role "child"', async () => {
    //     interface IResult {
    //       x: string[],
    //     }
    //
    //     await acl2.removeRoleParents('child', 'parentX');
    //
    //     // @ts-ignore
    //     const resources: IResult = await acl2.whatResources('child');
    //     expect(resources).toHaveProperty('x');
    //     expect(resources.x).toHaveLength(5);
    //     expect(resources.x.sort()).toEqual(['read1', 'read2', 'read3', 'read4', 'read5'].sort());
    //   });
    //
    //   it('Remove parent role "parent1" from role "child"', async () => {
    //     interface IResult {
    //       x: string[],
    //     }
    //
    //     await acl2.removeRoleParents('child', 'parent1');
    //
    //     // @ts-ignore
    //     const resources: IResult = await acl2.whatResources('child');
    //     expect(resources).toHaveProperty('x');
    //     expect(resources.x).toHaveLength(4);
    //     expect(resources.x.sort()).toEqual(['read2', 'read3', 'read4', 'read5'].sort());
    //   });
    //
    //   it('Remove parent roles "parent2" & "parent3" from role "child"', async () => {
    //     interface IResult {
    //       x: string[],
    //     }
    //
    //     await acl2.removeRoleParents('child', ['parent2', 'parent3']);
    //
    //     // @ts-ignore
    //     const resources: IResult = await acl2.whatResources('child');
    //     expect(resources).toHaveProperty('x', ['read4', 'read5']);
    //     expect(resources.x).toHaveLength(2);
    //     expect(resources.x.sort()).toEqual(['read4', 'read5'].sort());
    //   });
    //
    //   it('Remove all parent roles from role "child"', async () => {
    //     await acl2.removeRoleParents('child');
    //     const resources = await acl2.whatResources('child');
    //     expect(resources).not.toHaveProperty('x');
    //   });
    //
    //   it('Remove all parent roles from role "child" with no parents', async () => {
    //     await acl2.removeRoleParents('child');
    //     const resources = await acl2.whatResources('child');
    //     expect(resources).not.toHaveProperty('x');
    //   });
    //
    //   it('Remove parent role "parent1" from role "child" with no parents', async () => {
    //     await acl2.removeRoleParents('child', 'parent1');
    //     const resources = await acl2.whatResources('child');
    //     expect(resources).not.toHaveProperty('x');
    //   });
    //
    //   it('Operation uses a callback when removing all parent roles', async () => {
    //     const removeRoleParents = await acl2.removeRoleParents('child');
    //     expect(removeRoleParents).toBeUndefined()
    //   });
    // });
    //
    // describe('removeResource', () => {
    //   it('Remove resource blogs', async () => {
    //     const removeResource = await acl.removeResource('blogs');
    //     expect(removeResource).toBeUndefined();
    //   });
    //
    //   it('Remove resource users', async () => {
    //     const removeResource = await acl.removeResource('users');
    //     expect(removeResource).toBeUndefined();
    //   });
    // });
    //
    // describe('allowedPermissions', () => {
    //   it('What permissions has james over blogs?', async () => {
    //     const permissions = await acl.allowedPermissions('james', 'blogs');
    //     expect(permissions).toHaveProperty('blogs', []);
    //   });
    //   it('What permissions has userId=4 over blogs?', async () => {
    //     const permissions = await acl.allowedPermissions(4, 'blogs');
    //     expect(permissions).toHaveProperty('blogs', []);
    //   });
    // });
    //
    // describe('whatResources', () => {
    //   it('What resources have "baz" some rights on after removed blogs?', async () => {
    //     const resources = await acl.whatResources('baz');
    //     expect(Object.keys(resources)).toHaveLength(0);
    //   });
    //
    //   it('What resources have "admin" some rights on after removed users resource?', async () => {
    //     const resources = await acl.whatResources('admin');
    //     expect(resources).not.toHaveProperty('users');
    //     expect(resources).not.toHaveProperty('blogs');
    //   });
    // });
    //
    // describe('Remove user roles', () => {
    //   it('Remove role guest from joed', async () => {
    //     const removeUserRoles = await acl.removeUserRoles('joed', 'guest');
    //     expect(removeUserRoles).toBeUndefined();
    //   });
    //
    //   it('Remove role guest from userId=0', async () => {
    //     const removeUserRoles = await acl.removeUserRoles(0, 'guest');
    //     expect(removeUserRoles).toBeUndefined();
    //   });
    //
    //   it('Remove role admin from harry', async () => {
    //     const removeUserRoles = await acl.removeUserRoles('harry', 'admin');
    //     expect(removeUserRoles).toBeUndefined();
    //   });
    //
    //   it('Remove role admin from userId=2', async () => {
    //     const removeUserRoles = await acl.removeUserRoles(2, 'admin');
    //     expect(removeUserRoles).toBeUndefined();
    //   });
    // });
    //
    // describe('Were roles removed?', () => {
    //   it('What permissions has harry over forums and blogs?', async () => {
    //     const permissions = await acl.allowedPermissions('harry', ['forums', 'blogs']);
    //     expect(permissions).toHaveProperty('forums', []);
    //   });
    //   it('What permissions has userId=2 over forums and blogs?', async () => {
    //     const permissions = await acl.allowedPermissions(2, ['forums', 'blogs']);
    //     expect(permissions).toHaveProperty('forums', []);
    //   });
    // });
    //
    // describe('removeAllow is removing all permissions.', () => {
    //   it('Add roles/resources/permissions', async () => {
    //     await acl.addUserRoles('jannette', 'member')
    //     await acl.allow('member', 'blogs', ['view', 'update']);
    //     const isAllowed1 = await acl.isAllowed('jannette', 'blogs', 'view');
    //     expect(isAllowed1).toBeTruthy();
    //
    //     await acl.removeAllow('member', 'blogs', 'update');
    //     const isAllowed2 = await acl.isAllowed('jannette', 'blogs', 'view');
    //     expect(isAllowed2).toBeTruthy();
    //
    //     const isAllowed3 = await acl.isAllowed('jannette', 'blogs', 'update');
    //     expect(isAllowed3).toBeFalsy();
    //
    //     await acl.removeAllow('member', 'blogs', 'view');
    //     const allowed4 = await acl.isAllowed('jannette', 'blogs', 'view');
    //     expect(allowed4).toBeFalsy();
    //   });
    // });
    //
    // describe('Removing a role removes the entire "allows" document.', () => {
    //   it('Add roles/resources/permissions', async () => {
    //     const allow = await acl.allow(['role1', 'role2', 'role3'], ['res1', 'res2', 'res3'], ['perm1', 'perm2', 'perm3']);
    //     expect(allow).toBeUndefined();
    //   });
    //
    //   it('Add user roles and parent roles', async () => {
    //     const addUserRoles = await acl.addUserRoles('user1', 'role1');
    //     expect(addUserRoles).toBeUndefined();
    //
    //     const addRoleParents = await acl.addRoleParents('role1', 'parentRole1');
    //     expect(addRoleParents).toBeUndefined();
    //   });
    //
    //   it('Add user roles and parent roles', async () => {
    //     const addUserRoles = await acl.addUserRoles(1, 'role1');
    //     expect(addUserRoles).toBeUndefined();
    //
    //     const addRoleParents = await acl.addRoleParents('role1', 'parentRole1');
    //     expect(addRoleParents).toBeUndefined();
    //   });
    //
    //   it('Verify that roles have permissions as assigned', async () => {
    //     const res1 = await acl.whatResources('role1');
    //     expect(res1.res1.sort()).toEqual(['perm1', 'perm2', 'perm3'].sort()); // tslint:disable-line no-unsafe-any
    //
    //     const res2 = await acl.whatResources('role2');
    //     expect(res2.res1.sort()).toEqual(['perm1', 'perm2', 'perm3'].sort()); // tslint:disable-line no-unsafe-any
    //   });
    //
    //   it('Remove role "role1"', async () => {
    //     const removeRole = await acl.removeRole('role1');
    //     expect(removeRole).toBeUndefined();
    //   });
    //
    //   it('Verify that "role1" has no permissions and "role2" has permissions intact', async () => {
    //     const removeRole = await acl.removeRole('role1');
    //     expect(removeRole).toBeUndefined();
    //
    //     const res1 = await acl.whatResources('role1');
    //     expect(Object.keys(res1)).toHaveLength(0);
    //
    //     const res2 = await acl.whatResources('role2');
    //     expect(res2.res1.sort()).toEqual(['perm1', 'perm2', 'perm3'].sort()); // tslint:disable-line no-unsafe-any
    //   });
    // });
  });
});
