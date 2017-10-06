// @flow
import Redis from 'redis';
import MongoDB from 'mongodb';
import Sequelize from 'sequelize';
import Acl from '../src/classes/acl';
import MemoryStore from '../src/stores/memory';
import RedisStore from '../src/stores/redis';
import MongoDBStore from '../src/stores/mongodb';
import SequelizeStore from '../src/stores/sequelize';

const {Op} = Sequelize;

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;
jest.setTimeout(10000);

['Memory', 'MySQL', 'Redis', 'MongoDB'].forEach((store) => {
  let acl = null;

  describe(store, () => {
    beforeAll((done) => {
      jest.setTimeout(10000);
      if (store === 'Memory') {
        acl = new Acl(new MemoryStore());
        done();
      } else if (store === 'Redis') {
        acl = new Acl(new RedisStore(Redis.createClient({host: 'redis'})));
        done();
      } else if (store === 'MongoDB') {
        MongoDB.connect('mongodb://mongo/aclify', (error, db) => {
          acl = new Acl(new MongoDBStore(db, 'acl_'));
          done();
        });
      } else if (store === 'MySQL') {
        const sequelize = new Sequelize('aclify', 'root', 'aclify', {
          host: 'mysql',
          operatorsAliases: {$in: Op.in},
          dialect: 'mysql',
          logging: null,
        });
        sequelize.authenticate()
          .then(() => {
            acl = new Acl(new SequelizeStore(sequelize), {prefix: 'acl_'});
            done();
          });
      }
    });

    afterAll((done) => {
      jest.setTimeout(10000);
      setTimeout(() => {
        if (store === 'Redis') acl.store.redis.quit();
        else if (store === 'MongoDB') acl.store.db.close();
        else if (store === 'Sequelize') acl.store.db.close();
        done();
      }, 5000);
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
        const aclCustomized = new Acl(acl.store, {}, {
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
      it('Guest to view blogs', () => {
        acl.allow('guest', 'blogs', 'view', (err) => {
          expect(!err);
        });
      });

      it('Guest to view forums', () => {
        acl.allow('guest', 'forums', 'view', (err) => {
          expect(!err);
        });
      });

      it('Member to view/edit/delete blogs', () => {
        acl.allow('member', 'blogs', ['edit', 'view', 'delete'], (err) => {
          expect(!err);
        });
      });
    });

    describe('Add user roles', () => {
      it('Joed = guest, jsmith = member, harry = admin, test@test.com = member', (done) => {
        acl.addUserRoles('joed', 'guest', (err1) => {
          expect(!err1);

          acl.addUserRoles('jsmith', 'member', (err2) => {
            expect(!err2);

            acl.addUserRoles('harry', 'admin', (err3) => {
              expect(!err3);

              acl.addUserRoles('test@test.com', 'member', (err4) => {
                expect(!err4);
                done();
              });
            });
          });
        });
      });

      it('0 = guest, 1 = member, 2 = admin', (done) => {
        acl.addUserRoles(0, 'guest', (err1) => {
          expect(!err1);

          acl.addUserRoles(1, 'member', (err2) => {
            expect(!err2);

            acl.addUserRoles(2, 'admin', (err3) => {
              expect(!err3);
              done();
            });
          });
        });
      });
    });

    describe('Read user\'s roles', () => {
      it('Run userRoles function', (done) => {
        acl.addUserRoles('harry', 'admin', (err1) => {
          if (err1) done(err1);

          acl.userRoles('harry', (err2, roles) => {
            if (err2) done(err2);
            expect(roles).toEqual(['admin']);

            acl.hasRole('harry', 'admin', (err3, isInRole1) => {
              if (err3) done(err3);
              expect(isInRole1).toBeTruthy();

              acl.hasRole('harry', 'no role', (err4, isInRole2) => {
                if (err4) done(err4);
                expect(isInRole2).toBeFalsy();
                done();
              });
            });
          });
        });
      });
    });

    describe('Read role\'s users', () => {
      it('Run roleUsers function', (done) => {
        acl.addUserRoles('harry', 'admin', (err1) => {
          if (err1) done(err1);

          acl.roleUsers('admin', (err2, users) => {
            if (err2) done(err2);
            expect(users).toContain('harry');
            done();
          });
        });
      });
    });

    describe('Allow', () => {
      it('Admin view/add/edit/delete users', (done) => {
        acl.allow('admin', 'users', ['add', 'edit', 'view', 'delete'], (err) => {
          expect(!err);
          done();
        });
      });

      it('Foo view/edit blogs', (done) => {
        acl.allow('foo', 'blogs', ['edit', 'view'], (err) => {
          expect(!err);
          done();
        });
      });

      it('Bar to view/delete blogs', (done) => {
        acl.allow('bar', 'blogs', ['view', 'delete'], (err) => {
          expect(!err);
          done();
        });
      });
    });

    describe('Add role parents', () => {
      it('Add foot and bar roles into baz parent role', (done) => {
        acl.addRoleParents('baz', ['foo', 'bar'], (err) => {
          expect(!err);
          done();
        });
      });
    });

    describe('Add user roles', () => {
      it('Add them', (done) => {
        acl.addUserRoles('james', 'baz', (err) => {
          expect(!err);
          done();
        });
      });

      it('Add them with numeric userId', (done) => {
        acl.addUserRoles(3, 'baz', (err) => {
          expect(!err);
          done();
        });
      });
    });

    describe('allow admin to do anything', () => {
      it('Add them', (done) => {
        acl.allow('admin', ['blogs', 'forums'], '*', (err) => {
          expect(!err);
          done();
        });
      });
    });

    describe('Arguments in one array', () => {
      it('Give role fumanchu an array of resources and permissions', (done) => {
        acl.allow(
          [{
            roles: 'fumanchu',
            allows: [
              {resources: 'blogs', permissions: 'get'},
              {resources: ['forums', 'news'], permissions: ['get', 'put', 'delete']},
              {resources: ['/path/file/file1.txt', '/path/file/file2.txt'], permissions: ['get', 'put', 'delete']},
            ],
          }],
          (err) => {
            expect(!err);
            done();
          },
        );
      });
    });

    describe('Add fumanchu role to suzanne', () => {
      it('Do it', (done) => {
        acl.addUserRoles('suzanne', 'fumanchu', (err) => {
          expect(!err);
          done();
        });
      });

      it('Do it (numeric userId)', (done) => {
        acl.addUserRoles(4, 'fumanchu', (err) => {
          expect(!err);
          done();
        });
      });
    });


    describe('Allowance queries', () => {
      describe('IsAllowed', () => {
        it('Can joed view blogs?', (done) => {
          acl.isAllowed('joed', 'blogs', 'view', (err, allow) => {
            expect(!err);
            expect(allow);
            done();
          });
        });

        it('Can userId=0 view blogs?', (done) => {
          acl.isAllowed(0, 'blogs', 'view', (err, allow) => {
            expect(!err);
            expect(allow);
            done();
          });
        });

        it('Can joed view forums?', (done) => {
          acl.isAllowed('joed', 'forums', 'view', (err, allow) => {
            expect(!err);
            expect(allow);
            done();
          });
        });

        it('Can userId=0 view forums?', (done) => {
          acl.isAllowed(0, 'forums', 'view', (err, allow) => {
            expect(!err);
            expect(allow);
            done();
          });
        });

        it('Can joed edit forums?', (done) => {
          acl.isAllowed('joed', 'forums', 'edit', (err, allow) => {
            expect(!err);
            expect(!allow);
            done();
          });
        });

        it('Can userId=0 edit forums?', (done) => {
          acl.isAllowed(0, 'forums', 'edit', (err, allow) => {
            expect(!err);
            expect(!allow);
            done();
          });
        });

        it('Can jsmith edit forums?', (done) => {
          acl.isAllowed('jsmith', 'forums', 'edit', (err, allow) => {
            expect(!err);
            expect(!allow);
            done();
          });
        });

        it('Can jsmith edit forums?', (done) => {
          acl.isAllowed('jsmith', 'forums', 'edit', (err, allow) => {
            expect(!err);
            expect(!allow);
            done();
          });
        });


        it('Can jsmith edit blogs?', (done) => {
          acl.isAllowed('jsmith', 'blogs', 'edit', (err, allow) => {
            expect(!err);
            expect(allow);
            done();
          });
        });

        it('Can test@test.com edit forums?', (done) => {
          acl.isAllowed('test@test.com', 'forums', 'edit', (err, allow) => {
            expect(!err);
            expect(!allow);
            done();
          });
        });

        it('Can test@test.com edit forums?', (done) => {
          acl.isAllowed('test@test.com', 'forums', 'edit', (err, allow) => {
            expect(!err);
            expect(!allow);
            done();
          });
        });

        it('Can test@test.com edit blogs?', (done) => {
          acl.isAllowed('test@test.com', 'blogs', 'edit', (err, allow) => {
            expect(!err);
            expect(allow);
            done();
          });
        });

        it('Can userId=1 edit blogs?', (done) => {
          acl.isAllowed(1, 'blogs', 'edit', (err, allow) => {
            expect(!err);
            expect(allow);
            done();
          });
        });

        it('Can jsmith edit, delete and clone blogs?', (done) => {
          acl.isAllowed('jsmith', 'blogs', ['edit', 'view', 'clone'], (err, allow) => {
            expect(!err);
            expect(!allow);
            done();
          });
        });

        it('Can test@test.com edit, delete and clone blogs?', (done) => {
          acl.isAllowed('test@test.com', 'blogs', ['edit', 'view', 'clone'], (err, allow) => {
            expect(!err);
            expect(!allow);
            done();
          });
        });

        it('Can userId=1 edit, delete and clone blogs?', (done) => {
          acl.isAllowed(1, 'blogs', ['edit', 'view', 'clone'], (err, allow) => {
            expect(!err);
            expect(!allow);
            done();
          });
        });

        it('Can jsmith edit, clone blogs?', (done) => {
          acl.isAllowed('jsmith', 'blogs', ['edit', 'clone'], (err, allow) => {
            expect(!err);
            expect(!allow);
            done();
          });
        });

        it('Can test@test.com edit, clone blogs?', (done) => {
          acl.isAllowed('test@test.com', 'blogs', ['edit', 'clone'], (err, allow) => {
            expect(!err);
            expect(!allow);
            done();
          });
        });

        it('Can userId=1 edit, delete blogs?', (done) => {
          acl.isAllowed(1, 'blogs', ['edit', 'clone'], (err, allow) => {
            expect(!err);
            expect(!allow);
            done();
          });
        });

        it('Can james add blogs?', (done) => {
          acl.isAllowed('james', 'blogs', 'add', (err, allow) => {
            expect(!err);
            expect(!allow);
            done();
          });
        });


        it('Can userId=3 add blogs?', (done) => {
          acl.isAllowed(3, 'blogs', 'add', (err, allow) => {
            expect(!err);
            expect(!allow);
            done();
          });
        });

        it('Can suzanne add blogs?', (done) => {
          acl.isAllowed('suzanne', 'blogs', 'add', (err, allow) => {
            expect(!err);
            expect(!allow);
            done();
          });
        });

        it('Can userId=4 add blogs?', (done) => {
          acl.isAllowed(4, 'blogs', 'add', (err, allow) => {
            expect(!err);
            expect(!allow);
            done();
          });
        });

        it('Can suzanne get blogs?', (done) => {
          acl.isAllowed('suzanne', 'blogs', 'get', (err, allow) => {
            expect(!err);
            expect(allow);
            done();
          });
        });

        it('Can userId=4 get blogs?', (done) => {
          acl.isAllowed(4, 'blogs', 'get', (err, allow) => {
            expect(!err);
            expect(allow);
            done();
          });
        });

        it('Can suzanne delete and put news?', (done) => {
          acl.isAllowed('suzanne', 'news', ['put', 'delete'], (err, allow) => {
            expect(!err);
            expect(allow);
            done();
          });
        });

        it('Can userId=4 delete and put news?', (done) => {
          acl.isAllowed(4, 'news', ['put', 'delete'], (err, allow) => {
            expect(!err);
            expect(allow);
            done();
          });
        });

        it('Can suzanne delete and put forums?', (done) => {
          acl.isAllowed('suzanne', 'forums', ['put', 'delete'], (err, allow) => {
            expect(!err);
            expect(allow);
            done();
          });
        });

        it('Can userId=4 delete and put forums?', (done) => {
          acl.isAllowed(4, 'forums', ['put', 'delete'], (err, allow) => {
            expect(!err);
            expect(allow);
            done();
          });
        });

        it('Can nobody view news?', (done) => {
          acl.isAllowed('nobody', 'blogs', 'view', (err, allow) => {
            expect(!err);
            expect(!allow);
            done();
          });
        });

        it('Can nobody view nothing?', (done) => {
          acl.isAllowed('nobody', 'nothing', 'view', (err, allow) => {
            expect(!err);
            expect(!allow);
            done();
          });
        });
      });
    });

    describe('allowedPermissions', () => {
      it('What permissions has james over blogs and forums?', (done) => {
        acl.allowedPermissions('james', ['blogs', 'forums'], (err, permissions) => {
          expect(!err);
          expect(permissions).toHaveProperty('blogs');
          expect(permissions).toHaveProperty('forums');
          expect(permissions.blogs).toContain('edit');
          expect(permissions.blogs).toContain('view');
          expect(permissions.blogs).toContain('delete');
          expect(!permissions.forums.length);
          done();
        });
      });

      it('What permissions has userId=3 over blogs and forums?', (done) => {
        acl.allowedPermissions(3, ['blogs', 'forums'], (err, permissions) => {
          expect(!err);
          expect(permissions).toHaveProperty('blogs');
          expect(permissions).toHaveProperty('forums');
          expect(permissions.blogs).toContain('edit');
          expect(permissions.blogs).toContain('view');
          expect(permissions.blogs).toContain('delete');
          expect(!permissions.forums.length);
          done();
        });
      });

      it('What permissions has nonsenseUser over blogs and forums?', (done) => {
        acl.allowedPermissions('nonsense', ['blogs', 'forums'], (err, permissions) => {
          expect(!err);
          expect(!permissions.forums.length);
          expect(!permissions.blogs.length);
          done();
        });
      });
    });

    describe('WhatResources queries', () => {
      it('What resources have "bar" some rights on?', (done) => {
        acl.whatResources('bar', (err, resources) => {
          expect(err).toBeNull();
          expect(resources.blogs).toContain('view');
          expect(resources.blogs).toContain('delete');
          done();
        });
      });

      it('What resources have "bar" view rights on?', (done) => {
        acl.whatResources('bar', 'view', (err, resources) => {
          expect(err).toBeNull();
          expect(resources).toContain('blogs');
          done();
        });
      });

      it('What resources have "fumanchu" some rights on?', (done) => {
        acl.whatResources('fumanchu', (err, resources) => {
          expect(err).toBeNull();
          expect(resources).toHaveProperty('blogs', ['get']);
          expect(resources.forums).toContain('get');
          expect(resources.forums).toContain('put');
          expect(resources.forums).toContain('delete');
          expect(resources.news).toContain('get');
          expect(resources.news).toContain('put');
          expect(resources.news).toContain('delete');
          expect(resources['/path/file/file1.txt']).toContain('get');
          expect(resources['/path/file/file1.txt']).toContain('put');
          expect(resources['/path/file/file1.txt']).toContain('delete');
          expect(resources['/path/file/file2.txt']).toContain('get');
          expect(resources['/path/file/file2.txt']).toContain('put');
          expect(resources['/path/file/file2.txt']).toContain('delete');
          done();
        });
      });

      it('What resources have "baz" some rights on?', (done) => {
        acl.whatResources('baz', (err, resources) => {
          expect(err).toBeNull();
          expect(resources.blogs).toContain('edit');
          expect(resources.blogs).toContain('view');
          expect(resources.blogs).toContain('delete');
          done();
        });
      });
    });

    describe('removeAllow', () => {
      it('Remove get permissions from resources blogs and forums from role fumanchu', (done) => {
        acl.removeAllow('fumanchu', ['blogs', 'forums'], 'get', (err) => {
          expect(!err);
          done();
        });
      });

      it('Remove delete and put permissions from resource news from role fumanchu', (done) => {
        acl.removeAllow('fumanchu', 'news', 'delete', (err) => {
          expect(!err);
          done();
        });
      });

      it('Remove view permissions from resource blogs from role bar', (done) => {
        acl.removeAllow('bar', 'blogs', 'view', (err) => {
          expect(!err);
          done();
        });
      });
    });

    describe('See if permissions were removed', () => {
      it('What resources have "fumanchu" some rights on after removed some of them?', (done) => {
        acl.whatResources('fumanchu', (err, resources) => {
          expect(err).toBeNull();
          expect(resources).not.toContain('blogs');
          expect(resources).toHaveProperty('news');
          expect(resources.news).toContain('get');
          expect(resources.news).toContain('put');
          expect(resources).not.toContain('delete');
          expect(resources.forums).toContain('put');
          expect(resources.forums).toContain('delete');
          done();
        });
      });
    });

    describe('RemoveRole', () => {
      it('Remove role fumanchu', (done) => {
        acl.removeRole('fumanchu', (err) => {
          expect(!err);
          done();
        });
      });

      it('Remove role member', (done) => {
        acl.removeRole('member', (err) => {
          expect(!err);
          done();
        });
      });

      it('Remove role foo', (done) => {
        acl.removeRole('foo', (err) => {
          expect(!err);
          done();
        });
      });
    });

    describe('Was role removed?', () => {
      it('What resources have "fumanchu" some rights on after removed?', (done) => {
        acl.whatResources('fumanchu', (err, resources) => {
          expect(!err);
          expect(!Object.keys(resources).length);
          done();
        });
      });

      it('What resources have "member" some rights on after removed?', (done) => {
        acl.whatResources('member', (err, resources) => {
          expect(!err);
          expect(!Object.keys(resources).length);
          done();
        });
      });

      describe('Allowed permissions', () => {
        it('What permissions has jsmith over blogs and forums?', (done) => {
          acl.allowedPermissions('jsmith', ['blogs', 'forums'], (err, permissions) => {
            expect(!err);
            expect(!permissions.blogs);
            expect(!permissions.forums);
            done();
          });
        });

        it('What permissions has test@test.com over blogs and forums?', (done) => {
          acl.allowedPermissions('test@test.com', ['blogs', 'forums'], (err, permissions) => {
            expect(!err);
            expect(!permissions.blogs);
            expect(!permissions.forums);
            done();
          });
        });

        it('What permissions has james over blogs?', (done) => {
          acl.allowedPermissions('james', 'blogs', (err, permissions) => {
            expect(!err);
            expect(permissions.blogs).toContain('delete');
            done();
          });
        });
      });
    });

    describe('RoleParentRemoval', () => {
      beforeAll((done) => {
        acl.allow('parent1', 'x', 'read1')
          .then(() => acl.allow('parent2', 'x', 'read2'))
          .then(() => acl.allow('parent3', 'x', 'read3'))
          .then(() => acl.allow('parent4', 'x', 'read4'))
          .then(() => acl.allow('parent5', 'x', 'read5'))
          .then(() => acl.addRoleParents('child', ['parent1', 'parent2', 'parent3', 'parent4', 'parent5']))
          .then(() => done());
      });

      it('Environment check', (done) => {
        acl.whatResources('child')
          .then((resources) => {
            expect(resources.x.length === 5);
            expect(resources.x).toContain('read1');
            expect(resources.x).toContain('read2');
            expect(resources.x).toContain('read3');
            expect(resources.x).toContain('read4');
            expect(resources.x).toContain('read5');
            done();
          });
      });

      it('Operation uses a callback when removing a specific parent role', (done) => {
        acl.removeRoleParents('child', 'parentX', (err) => {
          expect(!err);
          done();
        });
      });

      it('Operation uses a callback when removing multiple specific parent roles', (done) => {
        acl.removeRoleParents('child', ['parentX', 'parentY'], (err) => {
          expect(!err);
          done();
        });
      });

      it('Remove parent role "parentX" from role "child"', (done) => {
        acl.removeRoleParents('child', 'parentX')
          .then(() => acl.whatResources('child'))
          .then((resources) => {
            expect(resources.x.length === 5);
            expect(resources.x).toContain('read1');
            expect(resources.x).toContain('read2');
            expect(resources.x).toContain('read3');
            expect(resources.x).toContain('read4');
            expect(resources.x).toContain('read5');
            done();
          });
      });

      it('Remove parent role "parent1" from role "child"', (done) => {
        acl.removeRoleParents('child', 'parent1')
          .then(() => acl.whatResources('child'))
          .then((resources) => {
            expect(resources.x.length === 4);
            expect(resources.x).toContain('read2');
            expect(resources.x).toContain('read3');
            expect(resources.x).toContain('read4');
            expect(resources.x).toContain('read5');
            done();
          });
      });

      it('Remove parent roles "parent2" & "parent3" from role "child"', (done) => {
        acl.removeRoleParents('child', ['parent2', 'parent3'])
          .then(() => acl.whatResources('child'))
          .then((resources) => {
            expect(resources.x.length === 2);
            expect(resources.x).toContain('read4');
            expect(resources.x).toContain('read5');
            done();
          });
      });

      it('Remove all parent roles from role "child"', (done) => {
        acl.removeRoleParents('child')
          .then(() => acl.whatResources('child'))
          .then((resources) => {
            expect(resources).not.toHaveProperty('x');
            done();
          });
      });

      it('Remove all parent roles from role "child" with no parents', (done) => {
        acl.removeRoleParents('child')
          .then(() => acl.whatResources('child'))
          .then((resources) => {
            expect(resources).not.toHaveProperty('x');
            done();
          });
      });

      it('Remove parent role "parent1" from role "child" with no parents', (done) => {
        acl.removeRoleParents('child', 'parent1')
          .then(() => acl.whatResources('child'))
          .then((resources) => {
            expect(resources).not.toHaveProperty('x');
            done();
          });
      });

      it('Operation uses a callback when removing all parent roles', (done) => {
        acl.removeRoleParents('child', (err) => {
          expect(!err);
          done();
        });
      });
    });

    describe('RemoveResource', () => {
      it('Remove resource blogs', (done) => {
        acl.removeResource('blogs', (err) => {
          expect(!err);
          done();
        });
      });

      it('Remove resource users', (done) => {
        acl.removeResource('users', (err) => {
          expect(!err);
          done();
        });
      });
    });

    describe('AllowedPermissions', () => {
      it('What permissions has james over blogs?', (done) => {
        acl.allowedPermissions('james', 'blogs', (err, permissions) => {
          expect(err).toBeNull();
          expect(permissions).toHaveProperty('blogs');
          expect(!permissions.blogs.length);
          done();
        });
      });

      it('What permissions has userId=4 over blogs?', (done) => {
        acl.allowedPermissions(4, 'blogs')
          .then((permissions) => {
            expect(permissions).toHaveProperty('blogs');
            expect(!permissions.blogs.length);
            done();
          });
      });
    });

    describe('WhatResources', () => {
      it('What resources have "baz" some rights on after removed blogs?', (done) => {
        acl.whatResources('baz', (err, resources) => {
          expect(!err);
          expect(typeof resources === 'object');
          expect(!Object.keys(resources).length);
          done();
        });
      });

      it('What resources have "admin" some rights on after removed users resource?', (done) => {
        acl.whatResources('admin', (err, resources) => {
          expect(!err);
          expect(resources).not.toContain('users');
          expect(resources).not.toContain('blogs');
          done();
        });
      });
    });

    describe('Remove user roles', () => {
      it('Remove role guest from joed', (done) => {
        acl.removeUserRoles('joed', 'guest', (err) => {
          expect(!err);
          done();
        });
      });

      it('Remove role guest from userId=0', (done) => {
        acl.removeUserRoles(0, 'guest', (err) => {
          expect(!err);
          done();
        });
      });
      it('Remove role admin from harry', (done) => {
        acl.removeUserRoles('harry', 'admin', (err) => {
          expect(!err);
          done();
        });
      });

      it('Remove role admin from userId=2', (done) => {
        acl.removeUserRoles(2, 'admin', (err) => {
          expect(!err);
          done();
        });
      });
    });

    describe('Were roles removed?', () => {
      it('What permissions has harry over forums and blogs?', (done) => {
        acl.allowedPermissions('harry', ['forums', 'blogs'], (err, permissions) => {
          expect(!err);
          expect(typeof permissions === 'object');
          expect(!permissions.forums.length);
          done();
        });
      });

      it('What permissions has userId=2 over forums and blogs?', (done) => {
        acl.allowedPermissions(2, ['forums', 'blogs'], (err, permissions) => {
          expect(!err);
          expect(typeof permissions === 'object');
          expect(!permissions.forums.length);
          done();
        });
      });
    });

    describe('RemoveAllow is removing all permissions', () => {
      it('Add roles/resources/permissions', () => {
        acl.addUserRoles('jannette', 'member')
          .then(() => acl.allow('member', 'blogs', ['view', 'update']))
          .then(() => acl.isAllowed('jannette', 'blogs', 'view'))
          .then((isAllowed) => expect(isAllowed).toBeTruthy())
          .then(() => acl.removeAllow('member', 'blogs', 'update'))
          .then(() => acl.isAllowed('jannette', 'blogs', 'view'))
          .then((isAllowed) => expect(isAllowed).toBeTruthy())
          .then(() => acl.isAllowed('jannette', 'blogs', 'update'))
          .then((isAllowed) => expect(isAllowed).toBeFalsy())
          .then(() => acl.removeAllow('member', 'blogs', 'view'))
          .then(() => acl.isAllowed('jannette', 'blogs', 'view'))
          .then((isAllowed) => expect(isAllowed).toBeFalsy());
      });
    });

    describe('Removing a role removes the entire "allows" document.', () => {
      it('Add roles/resources/permissions', (done) => {
        acl.allow(['role1', 'role2', 'role3'], ['res1', 'res2', 'res3'], ['perm1', 'perm2', 'perm3'], (err) => {
          expect(!err);
          done();
        });
      });

      it('Add user roles and parent roles', (done) => {
        acl.addUserRoles('user1', 'role1', (err1) => {
          expect(!err1);

          acl.addRoleParents('role1', 'parentRole1', (err2) => {
            expect(!err2);
            done();
          });
        });
      });

      it('Add user roles and parent roles', (done) => {
        acl.addUserRoles(1, 'role1', (err1) => {
          expect(!err1);

          acl.addRoleParents('role1', 'parentRole1', (err2) => {
            expect(!err2);
            done();
          });
        });
      });

      it('Verify that roles have permissions as assigned', (done) => {
        acl.whatResources('role1', (err1, res1) => {
          expect(!err1);
          expect(res1.res1.sort()).toEqual(['perm1', 'perm2', 'perm3']);

          acl.whatResources('role2', (err2, res2) => {
            expect(!err2);
            expect(res2.res1.sort()).toEqual(['perm1', 'perm2', 'perm3']);
            done();
          });
        });
      });

      it('Remove role "role1"', (done) => {
        acl.removeRole('role1', (err) => {
          expect(!err);
          done();
        });
      });

      it('Verify that "role1" has no permissions and "role2" has permissions intact', (done) => {
        acl.removeRole('role1', (err) => {
          expect(!err);

          acl.whatResources('role1', (err1, res1) => {
            expect(!Object.keys(res1).length);

            acl.whatResources('role2', (err2, res2) => {
              expect(res2.res1.sort()).toEqual(['perm1', 'perm2', 'perm3']);
              done();
            });
          });
        });
      });
    });
  });
}, this);
