// @flow
import _ from 'lodash';
import bluebird from 'bluebird';
import Common from './common';
import Memory from '../stores/memory';

export default class Acl extends Common {
  logger: {};
  store: {};
  options: {};

  /**
   * @description Create ACL class and promisify store methods
   * @param store
   * @param logger
   * @param options
   */
  constructor(store: {} = new Memory(), logger: {} | null = null, options: {} = {}) {
    super();
    this.options = _.extend({
      buckets: {
        meta: 'meta',
        parents: 'parents',
        permissions: 'permissions',
        resources: 'resources',
        roles: 'roles',
        users: 'users',
      },
    }, options);

    this.logger = logger;
    this.store = store;
    this.store.endAsync = bluebird.promisify(store.end);
    this.store.getAsync = bluebird.promisify(store.get);
    this.store.cleanAsync = bluebird.promisify(store.clean);
    this.store.unionAsync = bluebird.promisify(store.union);
    if (store.unions) this.store.unionsAsync = bluebird.promisify(store.unions);
  }

  /**
   * @description Adds roles to a given user id
   * @param userId
   * @param roles
   * @param callback
   */
  addUserRoles(userId: string | number, roles: mixed, callback: ?() => void) {
    this.store.begin();
    this.store.add(this.options.buckets.meta, 'users', userId);
    this.store.add(this.options.buckets.users, userId, roles);

    if (Array.isArray(roles)) {
      roles.map((role) => this.store.add(this.options.buckets.roles, role, userId), this);
    } else {
      this.store.add(this.options.buckets.roles, roles, userId);
    }
    return this.store.endAsync().nodeify(callback);
  }

  /**
   * @description Remove roles from a given user
   * @param userId
   * @param roles
   * @param callback
   */
  removeUserRoles(userId: string | number, roles: mixed, callback: ?() => void) {
    this.store.begin();
    this.store.remove(this.options.buckets.users, userId, roles);

    if (Array.isArray(roles)) {
      roles.map((role) => this.store.remove(this.options.buckets.roles, role, userId), this);
    } else {
      this.store.remove(this.options.buckets.roles, roles, userId);
    }
    return this.store.endAsync().nodeify(callback);
  }

  /**
   * @description Return all the roles from a given user
   * @param userId
   * @param callback
   */
  userRoles(userId: string | number, callback: ?() => void) {
    return this.store.getAsync(this.options.buckets.users, userId).nodeify(callback);
  }

  /**
   * @description Return all users who has a given role
   * @param roleName
   * @param callback
   */
  roleUsers(roleName: string | number, callback: ?() => void) {
    return this.store.getAsync(this.options.buckets.roles, roleName).nodeify(callback);
  }

  /**
   * @description Return boolean whether user is in the role
   * @param userId
   * @param rolename
   * @param callback
   */
  hasRole(userId: string | number, rolename: string | number, callback: ?() => void) {
    return this.userRoles(userId).then((roles) => roles.indexOf(rolename) !== -1).nodeify(callback);
  }

  /**
   * @description Adds a parent or parent list to role
   * @param role
   * @param parents
   * @param callback
   */
  addRoleParents(role: string | number, parents: mixed, callback: ?() => void) {
    this.store.begin();
    this.store.add(this.options.buckets.meta, 'roles', role);
    this.store.add(this.options.buckets.parents, role, parents);
    return this.store.endAsync().nodeify(callback);
  }

  /**
   * @description Removes a parent or parent list from role. If `parents` is not specified, removes all parents
   * @param role
   * @param parents
   * @param callback
   */
  removeRoleParents(role: string, parents: ?mixed, callback: ?() => void) {
    if (!callback && _.isFunction(parents)) {
      callback = parents;
      parents = null;
    }

    this.store.begin();
    if (parents) this.store.remove(this.options.buckets.parents, role, parents);
    else this.store.del(this.options.buckets.parents, role);
    return this.store.endAsync().nodeify(callback);
  }

  /**
   * @description Removes a role from the system
   * @param role
   * @param callback
   */
  removeRole(role: string, callback: ?() => void) {
    return this.store.getAsync(this.options.buckets.resources, role)
      .then((resources) => {
        this.store.begin();
        resources.map((resource) => {
          const bucket = this.allowsBucket(resource);
          this.store.del(bucket, role);
        }, this);

        this.store.del(this.options.buckets.resources, role);
        this.store.del(this.options.buckets.parents, role);
        this.store.del(this.options.buckets.roles, role);
        this.store.remove(this.options.buckets.meta, 'roles', role);
        return this.store.endAsync();
      }).nodeify(callback);
  }

  /**
   * @description Removes a resource from the system
   * @param resource
   * @param callback
   */
  removeResource(resource: string, callback: ?() => void) {
    return this.store.getAsync(this.options.buckets.meta, 'roles')
      .then((roles) => {
        this.store.begin();
        this.store.del(this.allowsBucket(resource), roles);
        roles.map((role) => this.store.remove(this.options.buckets.resources, role, resource), this);
        return this.store.endAsync();
      }).nodeify(callback);
  }

  /**
   * @description Remove all permissions
   * @param role
   * @param resources
   * @param permissions
   * @param callback
   * @return {*}
   */
  removeAllow(role: string, resources: mixed, permissions: ?mixed, callback: ?() => void) {
    resources = Common.makeArray(resources);
    if (callback || (permissions && !_.isFunction(permissions))) {
      permissions = Common.makeArray(permissions);
    } else {
      callback = permissions;
      permissions = null;
    }
    return this.removePermissions(role, resources, permissions, callback);
  }

  /**
   * @description Remove permissions from the given roles owned by the given role.
   * @param role
   * @param resources
   * @param permissions
   * @param callback
   */
  removePermissions(role: string, resources: string | Array, permissions: string | Array, callback: ?() => void) {
    this.store.begin();
    resources.map((resource) => {
      const bucket = this.allowsBucket(resource);
      if (permissions) {
        this.store.remove(bucket, role, permissions);
      } else {
        this.store.del(bucket, role);
        this.store.remove(this.options.buckets.resources, role, resource);
      }
    }, this);

    return this.store.endAsync()
      .then(() => {
        this.store.begin();
        return bluebird.all(resources.map((resource) => {
          const bucket = this.allowsBucket(resource);
          return this.store.getAsync(bucket, role)
            .then((permissions) => {
              if (!permissions.length) this.store.remove(this.options.buckets.resources, role, resource);
            });
        }, this))
          .then(this.store.endAsync());
      }).nodeify(callback);
  }

  /**
   * @description Adds the given permissions to the given roles over the given resources
   * @param roles
   * @param resources
   * @param permissions
   * @param callback
   */
  allow(roles: mixed, resources: ?mixed, permissions: ?mixed, callback: ?() => void) {
    if ((arguments.length === 1) || ((arguments.length === 2) && _.isObject(roles) && _.isFunction(resources))) {
      return this.allowEx(roles).nodeify(resources);
    }
    roles = Common.makeArray(roles);
    resources = Common.makeArray(resources);

    this.store.begin();
    this.store.add(this.options.buckets.meta, 'roles', roles);

    resources.map((resource) => {
      roles.map((role) => {
        this.store.add(this.allowsBucket(resource), role, permissions);
      }, this);
    }, this);

    roles.map((role) => {
      this.store.add(this.options.buckets.resources, role, resources);
    }, this);

    return this.store.endAsync().nodeify(callback);
  }

  /**
   * @description Returns all the allowable permissions a given user have to access the given resources.
   * It returns an array of objects where every object maps a resource name to a list of permissions for that resource.
   * @param userId
   * @param ressources
   * @param callback
   * @return {*}
   */
  allowedPermissions(userId: string | number, ressources: mixed, callback: ?() => void) {
    if (!userId) return callback(null, {});
    if (this.store.unionsAsync) {
      return this.optimizedAllowedPermissions(userId, ressources, callback);
    }

    const resourcesArray = Common.makeArray(ressources);
    return this.userRoles(userId)
      .then((roles) => {
        const result = {};
        return bluebird.all(resourcesArray.map((resource) => this.resourcePermissions(roles, resource)
          .then((permissions) => result[resource] = permissions), this))
          .then(() => result);
      }).nodeify(callback);
  }

  /**
   * @description Returns all the allowable permissions a given user have to access the given resources.
   * It returns a map of resource name to a list of permissions for that resource.
   * This is the same as allowedPermissions, it just takes advantage of the unions function if available to reduce
   * the number of store queries.
   * @param userId
   * @param resources
   * @param callback
   * @return {*}
   */
  optimizedAllowedPermissions(userId: string | number, resources: mixed, callback: ?() => void) {
    if (!userId) return callback(null, {});

    const resourcesArray = Common.makeArray(resources);
    return this.allUserRoles(userId)
      .then((roles) => {
        const buckets = resourcesArray.map(this.allowsBucket, this);
        if (roles.length === 0) {
          const emptyResult = {};
          buckets.map((bucket) => {
            emptyResult[bucket] = [];
          }, this);
          return bluebird.resolve(emptyResult);
        }
        return this.store.unionsAsync(buckets, roles);
      })
      .then((response) => {
        const result = {};
        Object.keys(response).map((bucket) => {
          result[this.keyFromAllowsBucket(bucket)] = response[bucket];
        }, this);

        return result;
      }).nodeify(callback);
  }

  /**
   * @description Checks if the given user is allowed to access the resource for the given permissions
   * (note: it must fulfill all the permissions).
   * @param userId
   * @param resource
   * @param permissions
   * @param callback
   */
  isAllowed(userId: string | number, resource: string, permissions: mixed, callback: ?() => void) {
    return this.store.getAsync(this.options.buckets.users, userId)
      .then((roles) => {
        if (roles.length) return this.areAnyRolesAllowed(roles, resource, permissions);
        return false;
      }).nodeify(callback);
  }

  /**
   * @description Returns true if any of the given roles have the right permissions.
   * @param roles
   * @param resource
   * @param permissions
   * @param callback
   */
  areAnyRolesAllowed(roles: mixed, resource: string, permissions: mixed, callback: ?() => void) {
    roles = Common.makeArray(roles);
    permissions = Common.makeArray(permissions);
    if (!roles.length) return bluebird.resolve(false).nodeify(callback);
    return this.checkPermissions(roles, resource, permissions).nodeify(callback);
  }

  /**
   * @description Returns what resources a given role or roles have permissions over.
   * @param roles
   * @param permissions
   * @param callback
   * @return {*}
   */
  whatResources(roles: mixed, permissions: ?mixed, callback: ?() => void) {
    roles = Common.makeArray(roles);
    if (_.isFunction(permissions)) {
      callback = permissions;
      permissions = undefined;
    } else if (permissions) {
      permissions = Common.makeArray(permissions);
    }
    return this.permittedResources(roles, permissions, callback);
  }

  /**
   * @description Returns permitted resources.
   * @param roles
   * @param permissions
   * @param callback
   */
  permittedResources(roles: mixed, permissions: mixed, callback: ?() => void) {
    const result = _.isUndefined(permissions) ? {} : [];
    return this.rolesResources(roles)
      .then((resources) => bluebird.all(resources.map((resource) => this.resourcePermissions(roles, resource)
        .then((p) => {
          if (permissions) {
            const commonPermissions = _.intersection(permissions, p);
            if (commonPermissions.length > 0) {
              result.push(resource);
            }
          } else {
            result[resource] = p;
          }
        }), this))
        .then(() => result)).nodeify(callback);
  }

  /**
   * @description Same as allow but accepts a more compact input.
   * @param objs
   * @return {*}
   * @private
   */
  allowEx(objs) {
    objs = Common.makeArray(objs);

    const demuxed = [];
    objs.map((obj) => {
      const roles = obj.roles;
      obj.allows.map((allow) => {
        demuxed.push({
          roles,
          resources: allow.resources,
          permissions: allow.permissions,
        });
      }, this);
    }, this);

    return bluebird.reduce(demuxed, (values, obj) => this.allow(obj.roles, obj.resources, obj.permissions), null);
  }

  /**
   * @description Returns the parents of the given roles.
   * @param roles
   * @return {*}
   * @private
   */
  rolesParents(roles) {
    return this.store.unionAsync(this.options.buckets.parents, roles);
  }

  /**
   * @description Return all roles in the hierarchy including the given roles.
   * @param roleNames
   * @return {Promise.<TResult>}
   * @private
   */
  allRoles(roleNames) {
    return this.rolesParents(roleNames)
      .then((parents) => {
        if (parents.length) {
          return this.allRoles(parents)
            .then((parentRoles) => _.union(roleNames, parentRoles));
        }
        return roleNames;
      });
  }

  /**
   * @description Return all roles in the hierarchy of the given user.
   * @param userId
   * @return {Promise.<TResult>}
   * @private
   */
  allUserRoles(userId) {
    return this.userRoles(userId)
      .then((roles) => {
        if (roles && roles.length) {
          return this.allRoles(roles);
        }
        return [];
      });
  }

  /**
   * @description Returns an array with resources for the given roles.
   * @param roles
   * @return {Promise.<TResult>}
   * @private
   */
  rolesResources(roles) {
    roles = Common.makeArray(roles);
    return this.allRoles(roles)
      .then((allRoles) => {
        let result = [];
        return bluebird.all(allRoles.map((role) => this.store.getAsync(this.options.buckets.resources, role)
          .then((resources) => result = result.concat(resources)), this)).then(() => result);
      });
  }

  /**
   * @description Returns the permissions for the given resource and set of roles.
   * @param roles
   * @param resource
   * @return {*}
   * @private
   */
  resourcePermissions(roles, resource) {
    if (!roles.length) return bluebird.resolve([]);
    return this.store.unionAsync(this.allowsBucket(resource), roles)
      .then((resourcePermissions) => this.rolesParents(roles)
        .then((parents) => {
          if (parents && parents.length) {
            return this.resourcePermissions(parents, resource)
              .then((morePermissions) => _.union(resourcePermissions, morePermissions));
          }
          return resourcePermissions;
        }));
  }

  /**
   * @description This function will not handle circular dependencies and result in a crash.
   * @param roles
   * @param resource
   * @param permissions
   * @return {Promise.<TResult>}
   * @private
   */
  checkPermissions(roles, resource, permissions) {
    return this.store.unionAsync(this.allowsBucket(resource), roles)
      .then((resourcePermissions) => {
        if (resourcePermissions.indexOf('*') !== -1) return true;
        permissions = permissions.filter((p) => resourcePermissions.indexOf(p) === -1);

        if (!permissions.length) return true;
        return this.store.unionAsync(this.options.buckets.parents, roles)
          .then((parents) => ((parents && parents.length) ? this.checkPermissions(parents, resource, permissions) : false));
      });
  }
}
