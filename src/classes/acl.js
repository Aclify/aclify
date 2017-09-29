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
  addUserRoles(userId: string | number, roles: mixed, callback: ?() => void): void {
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
  removeUserRoles(userId: string | number, roles: mixed, callback: ?() => void): void {
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
  userRoles(userId: string | number, callback: ?() => void): Array {
    return this.store.getAsync(this.options.buckets.users, userId).nodeify(callback);
  }

  /**
   * @description Return all users who has a given role
   * @param roleName
   * @param callback
   */
  roleUsers(roleName: string | number, callback: ?() => void): Array {
    return this.store.getAsync(this.options.buckets.roles, roleName).nodeify(callback);
  }

  /**
   * @description Return boolean whether user is in the role
   * @param userId
   * @param rolename
   * @param callback
   */
  hasRole(userId: string | number, rolename: string | number, callback: ?() => void): boolean {
    return this.userRoles(userId).then((roles) => roles.indexOf(rolename) !== -1).nodeify(callback);
  }

  /**
   * @description Adds a parent or parent list to role
   * @param role
   * @param parents
   * @param callback
   */
  addRoleParents(role: string | number, parents: mixed, callback: ?() => void): void {
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
  removeRoleParents(role: string, parents: ?mixed, callback: ?() => void): void {
    let callbackParam = callback;
    let parentsParam = parents;
    if (!callbackParam && _.isFunction(parentsParam)) {
      callbackParam = parentsParam;
      parentsParam = null;
    }

    this.store.begin();
    if (parentsParam) this.store.remove(this.options.buckets.parents, role, parentsParam);
    else this.store.del(this.options.buckets.parents, role);
    return this.store.endAsync().nodeify(callbackParam);
  }

  /**
   * @description Removes a role from the system
   * @param role
   * @param callback
   */
  removeRole(role: string, callback: ?() => void): void {
    return this.store.getAsync(this.options.buckets.resources, role)
      .then((resources) => {
        this.store.begin();

        for (let i = 0; i < resources.length; i += 1) {
          const bucket = this.allowsBucket(resources[i]);
          this.store.del(bucket, role);
        }

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
  removeResource(resource: string, callback: ?() => void): void {
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
  removeAllow(role: string, resources: mixed, permissions: ?mixed, callback: ?() => void): void {
    let permissionsParam = permissions;
    let callbackParam = callback;
    const resourcesParam = Common.makeArray(resources);
    if (callbackParam || (permissionsParam && !_.isFunction(permissionsParam))) {
      permissionsParam = Common.makeArray(permissionsParam);
    } else {
      callbackParam = permissionsParam;
      permissionsParam = null;
    }
    return this.removePermissions(role, resourcesParam, permissionsParam, callbackParam);
  }

  /**
   * @description Remove permissions from the given roles owned by the given role.
   * @param role
   * @param resources
   * @param permissions
   * @param callback
   */
  removePermissions(role: string, resources: string | Array, permissions: string | Array, callback: ?() => void): void {
    this.store.begin();

    for (let i = 0; i < resources.length; i += 1) {
      const bucket = this.allowsBucket(resources[i]);
      if (permissions) {
        this.store.remove(bucket, role, permissions);
      } else {
        this.store.del(bucket, role);
        this.store.remove(this.options.buckets.resources, role, resources[i]);
      }
    }

    return this.store.endAsync()
      .then(() => {
        this.store.begin();
        return bluebird.all(resources.map((resource) => {
          const bucket = this.allowsBucket(resource);
          return this.store.getAsync(bucket, role)
            .then((permissionsUpdated) => {
              if (!permissionsUpdated.length) this.store.remove(this.options.buckets.resources, role, resource);
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
  allow(roles: mixed, resources: ?mixed, permissions: ?mixed, callback: ?() => void): void {
    if ((arguments.length === 1) || ((arguments.length === 2) && _.isObject(roles) && _.isFunction(resources))) {
      return this.allowEx(roles).nodeify(resources);
    }
    const rolesParam = Common.makeArray(roles);
    const resourcesParam = Common.makeArray(resources);

    this.store.begin();
    this.store.add(this.options.buckets.meta, 'roles', rolesParam);

    for (let i = 0; i < resourcesParam.length; i += 1) {
      for (let j = 0; j < rolesParam.length; j += 1) {
        this.store.add(this.allowsBucket(resourcesParam[i]), rolesParam[j], permissions);
      }
    }

    for (let i = 0; i < rolesParam.length; i += 1) {
      this.store.add(this.options.buckets.resources, rolesParam[i], resourcesParam);
    }

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
  allowedPermissions(userId: string | number, ressources: mixed, callback: ?() => void): Array {
    if (!userId) return callback(null, {});
    if (this.store.unionsAsync) {
      return this.optimizedAllowedPermissions(userId, ressources, callback);
    }

    const resourcesArray = Common.makeArray(ressources);
    return this.userRoles(userId)
      .then((roles) => {
        const result = {};
        return bluebird.all(resourcesArray.map((resource) => this.resourcePermissions(roles, resource)
          .then((permissions) => {
            result[resource] = permissions;
          }), this))
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
  optimizedAllowedPermissions(userId: string | number, resources: mixed, callback: ?() => void): Array {
    if (!userId) return callback(null, {});

    const resourcesArray = Common.makeArray(resources);
    return this.allUserRoles(userId)
      .then((roles) => {
        const buckets = resourcesArray.map(this.allowsBucket, this);
        if (roles.length === 0) {
          const emptyResult = {};

          for (let i = 0; i < buckets.length; i += 1) {
            emptyResult[buckets[i]] = [];
          }
          return bluebird.resolve(emptyResult);
        }
        return this.store.unionsAsync(buckets, roles);
      })
      .then((response) => {
        const result = {};
        const keys = Object.keys(response);

        for (let i = 0; i < keys.length; i += 1) {
          result[this.keyFromAllowsBucket(keys[i])] = response[keys[i]];
        }
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
  isAllowed(userId: string | number, resource: string, permissions: mixed, callback: ?() => void): boolean {
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
  areAnyRolesAllowed(roles: mixed, resource: string, permissions: mixed, callback: ?() => void): boolean {
    const rolesParam = Common.makeArray(roles);
    const permissionsParam = Common.makeArray(permissions);
    if (!rolesParam.length) return bluebird.resolve(false).nodeify(callback);
    return this.checkPermissions(rolesParam, resource, permissionsParam).nodeify(callback);
  }

  /**
   * @description Returns what resources a given role or roles have permissions over.
   * @param roles
   * @param permissions
   * @param callback
   * @return {*}
   */
  whatResources(roles: mixed, permissions: ?mixed, callback: ?() => void): Array {
    const rolesParam = Common.makeArray(roles);
    let callbackParam = callback;
    let permissionsParam = permissions;
    if (_.isFunction(permissionsParam)) {
      callbackParam = permissionsParam;
      permissionsParam = undefined;
    } else if (permissionsParam) {
      permissionsParam = Common.makeArray(permissionsParam);
    }
    return this.permittedResources(rolesParam, permissionsParam, callbackParam);
  }

  /**
   * @description Returns permitted resources.
   * @param roles
   * @param permissions
   * @param callback
   */
  permittedResources(roles: mixed, permissions: mixed, callback: ?() => void): Array {
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
  allowEx(objs): Array {
    const objsParam = Common.makeArray(objs);
    const demuxed = [];

    for (let i = 0; i < objsParam.length; i += 1) {
      const {roles} = objsParam[i];
      const allow = objsParam[i].allows;
      for (let j = 0; j < allow.length; j += 1) {
        demuxed.push({
          roles,
          resources: allow[j].resources,
          permissions: allow[j].permissions,
        });
      }
    }
    return bluebird.reduce(demuxed, (values, obj) => this.allow(obj.roles, obj.resources, obj.permissions), null);
  }

  /**
   * @description Returns the parents of the given roles.
   * @param roles
   * @return {*}
   * @private
   */
  rolesParents(roles): Array {
    return this.store.unionAsync(this.options.buckets.parents, roles);
  }

  /**
   * @description Return all roles in the hierarchy including the given roles.
   * @param roleNames
   * @return {Promise.<TResult>}
   * @private
   */
  allRoles(roleNames): Array {
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
  allUserRoles(userId): Array {
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
  rolesResources(roles): Array {
    const rolesParam = Common.makeArray(roles);
    return this.allRoles(rolesParam)
      .then((allRoles) => {
        let result = [];
        return bluebird.all(allRoles.map((role) => this.store.getAsync(this.options.buckets.resources, role)
          .then((resources) => {
            result = result.concat(resources);
          }), this))
          .then(() => result);
      });
  }

  /**
   * @description Returns the permissions for the given resource and set of roles.
   * @param roles
   * @param resource
   * @return {*}
   * @private
   */
  resourcePermissions(roles, resource): Array {
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
  checkPermissions(roles, resource, permissions): boolean {
    return this.store.unionAsync(this.allowsBucket(resource), roles)
      .then((resourcePermissions) => {
        if (resourcePermissions.indexOf('*') !== -1) return true;
        const perms = permissions.filter((p) => resourcePermissions.indexOf(p) === -1);
        if (!perms.length) return true;
        return this.store.unionAsync(this.options.buckets.parents, roles)
          .then((parents) => ((parents && parents.length) ? this.checkPermissions(parents, resource, perms) : false));
      });
  }
}
