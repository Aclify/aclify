// @flow
import bluebird from 'bluebird';
import Common from './common';
import _ from 'lodash';

export default class Acl extends Common {

  logger: {};
  backend: {};
  options: {};

  /**
   * @description Create ACL class and promisify backend methods
   * @param backend
   * @param logger
   * @param options
   */
  constructor(backend: {}, logger: {} = {} , options: {} = {}) {
    super()
    this.options = _.extend({
      buckets: {
        meta: 'meta',
        parents: 'parents',
        permissions: 'permissions',
        resources: 'resources',
        roles: 'roles',
        users: 'users'
      }
    }, options);

    this.logger = logger;
    this.backend = backend;

    backend.endAsync = bluebird.promisify(backend.end);
    backend.getAsync = bluebird.promisify(backend.get);
    backend.cleanAsync = bluebird.promisify(backend.clean);
    backend.unionAsync = bluebird.promisify(backend.union);
    if (backend.unions) backend.unionsAsync = bluebird.promisify(backend.unions);
  }

  /**
   * @description Adds roles to a given user id
   * @param userId
   * @param roles
   * @param callback
   */
  addUserRoles(userId: string | number, roles: mixed, callback: ?() => void) {
    const transaction = this.backend.begin();
    this.backend.add(transaction, this.options.buckets.meta, 'users', userId);
    this.backend.add(transaction, this.options.buckets.users, userId, roles);

    if (Array.isArray(roles)) {
      roles.forEach(role => this.backend.add(transaction, this.options.buckets.roles, role, userId));
    } else {
      this.backend.add(transaction, this.options.buckets.roles, roles, userId);
    }
    return this.backend.endAsync(transaction).nodeify(callback);
  }

  /**
   * @description Remove roles from a given user
   * @param userId
   * @param roles
   * @param callback
   */
  removeUserRoles(userId: string | number, roles: mixed, callback: ?() => void) {
    const transaction = this.backend.begin();
    this.backend.remove(transaction, this.options.buckets.users, userId, roles);

    if (Array.isArray(roles)) {
      roles.forEach(role => this.backend.remove(transaction, this.options.buckets.roles, role, userId));
    } else {
      this.backend.remove(transaction, this.options.buckets.roles, roles, userId);
    }
    return this.backend.endAsync(transaction).nodeify(callback);
  };

  /**
   * @description Return all the roles from a given user
   * @param userId
   * @param callback
   */
  userRoles(userId: string | number, callback: ?() => void) {
    return this.backend.getAsync(this.options.buckets.users, userId).nodeify(callback);
  };

  /**
   * @description Return all users who has a given role
   * @param roleName
   * @param callback
   */
  roleUsers(roleName: string | number, callback: ?() => void) {
    return this.backend.getAsync(this.options.buckets.roles, roleName).nodeify(callback);
  };

  /**
   * @description Return boolean whether user is in the role
   * @param userId
   * @param rolename
   * @param callback
   */
  hasRole(userId: string | number, rolename: string | number, callback: ?() => void) {
    return this.userRoles(userId).then(roles => roles.indexOf(rolename) !== -1).nodeify(callback);
  };

  /**
   * @description Adds a parent or parent list to role
   * @param role
   * @param parents
   * @param callback
   */
  addRoleParents(role: string | number, parents: mixed, callback: ?() => void) {
    const transaction = this.backend.begin();
    this.backend.add(transaction, this.options.buckets.meta, 'roles', role);
    this.backend.add(transaction, this.options.buckets.parents, role, parents);
    return this.backend.endAsync(transaction).nodeify(callback);
  };

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

    const transaction = this.backend.begin();
    if (parents) this.backend.remove(transaction, this.options.buckets.parents, role, parents);
    else this.backend.del(transaction, this.options.buckets.parents, role);
    return this.backend.endAsync(transaction).nodeify(callback);
  };

  /**
   * @description Removes a role from the system
   * @param role
   * @param callback
   */
  removeRole(role: string, callback: ?() => void) {
    return this.backend.getAsync(this.options.buckets.resources, role)
      .then(resources => {
        const transaction = this.backend.begin();
        resources.forEach(resource => {
          let bucket = this.allowsBucket(resource);
          this.backend.del(transaction, bucket, role);
        });

        this.backend.del(transaction, this.options.buckets.resources, role);
        this.backend.del(transaction, this.options.buckets.parents, role);
        this.backend.del(transaction, this.options.buckets.roles, role);
        this.backend.remove(transaction, this.options.buckets.meta, 'roles', role);
        return this.backend.endAsync(transaction);
      }).nodeify(callback);
  };

  /**
   * @description Removes a resource from the system
   * @param resource
   * @param callback
   */
  removeResource(resource: string, callback: ?() => void) {
    return this.backend.getAsync(this.options.buckets.meta, 'roles')
      .then(roles => {
        const transaction = this.backend.begin();
        this.backend.del(transaction, this.allowsBucket(resource), roles);
        roles.forEach(role => this.backend.remove(transaction, this.options.buckets.resources, role, resource));
        return this.backend.endAsync(transaction);
      }).nodeify(callback)
  };

  /**
   * @description Remove all permissions
   * @param role
   * @param resources
   * @param permissions
   * @param callback
   * @return {*}
   */
  removeAllow(role: string, resources: mixed, permissions: ?mixed, callback: ?() => void) {
    resources = this.makeArray(resources);
    if (callback || (permissions && !_.isFunction(permissions))) {
      permissions = this.makeArray(permissions);
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
  removePermissions(role: string, resources: mixed, permissions: mixed, callback: ?() => void) {
    const transaction = this.backend.begin();
    resources.forEach(resource => {
      let bucket = this.allowsBucket(resource);
      if (permissions) {
        this.backend.remove(transaction, bucket, role, permissions);
      } else {
        this.backend.del(transaction, bucket, role);
        this.backend.remove(transaction, this.options.buckets.resources, role, resource);
      }
    });

    return this.backend.endAsync(transaction)
      .then(() => {
        const transaction = this.backend.begin();
        return bluebird.all(resources.map(resource => {
          let bucket = this.allowsBucket(resource);
          return this.backend.getAsync(bucket, role)
            .then(permissions => {
              if (!permissions.length) this.backend.remove(transaction, this.options.buckets.resources, role, resource);
            });
        }))
          .then(this.backend.endAsync(transaction));
      }).nodeify(callback);
  };

  /**
   * @description Adds the given permissions to the given roles over the given resources
   * @param roles
   * @param resources
   * @param permissions
   * @param callback
   */
  allow(roles: mixed, resources: ?mixed, permissions: ?mixed, callback: ?() => void) {
    if ((arguments.length === 1) || ((arguments.length === 2) && _.isObject(roles) && _.isFunction(resources))) {
      return this._allowEx(roles).nodeify(resources);
    } else {
      roles = this.makeArray(roles);
      resources = this.makeArray(resources);

      const transaction = this.backend.begin();
      this.backend.add(transaction, this.options.buckets.meta, 'roles', roles);

      resources.forEach(resource => {
        roles.forEach(role => {
          this.backend.add(transaction, this.allowsBucket(resource), role, permissions);
        });
      });

      roles.forEach(function (role) {
        this.backend.add(transaction, this.options.buckets.resources, role, resources);
      });

      return this.backend.endAsync(transaction).nodeify(callback);
    }
  };

  /**
   * @description Returns all the allowable permissions a given user have to access the given resources.
   * It returns an array of objects where every object maps a resource name to a list of permissions for that resource.
   * @param userId
   * @param resources
   * @param callback
   * @return {*}
   */
  allowedPermissions(userId: string | number, resources: mixed, callback: ?() => void) {
    if (!userId) return callback(null, {});
    if (this.backend.unionsAsync) return this.optimizedAllowedPermissions(userId, resources, callback);

    resources = this.makeArray(resources);
    return this.userRoles(userId)
      .then(roles => {
        let result = {};
        return bluebird.all(resources.map(resource => {
          return this._resourcePermissions(roles, resource)
            .then(permissions => result[resource] = permissions);
        }))
          .then(() => {
            return result
          });
      }).nodeify(callback);
  };

  /**
   * @description Returns all the allowable permissions a given user have to access the given resources.
   * It returns a map of resource name to a list of permissions for that resource.
   * This is the same as allowedPermissions, it just takes advantage of the unions function if available to reduce
   * the number of backend queries.
   * @param userId
   * @param resources
   * @param callback
   * @return {*}
   */
  optimizedAllowedPermissions(userId: string | number, resources: mixed, callback: ?() => void) {
    if (!userId) return callback(null, {});

    resources = this.makeArray(resources);
    return this._allUserRoles(userId)
      .then(roles => {
        const buckets = resources.map(this.allowsBucket);
        if (roles.length === 0) {
          let emptyResult = {};
          buckets.forEach(bucket => {
            emptyResult[bucket] = [];
          });
          return bluebird.resolve(emptyResult);
        }
        return this.backend.unionsAsync(buckets, roles);
      })
      .then(response => {
        let result = {};
        Object.keys(response).forEach(bucket => {
          result[this.keyFromAllowsBucket(bucket)] = response[bucket];
        });

        return result;
      }).nodeify(callback);
  };

  /**
   * @description Checks if the given user is allowed to access the resource for the given permissions
   * (note: it must fulfill all the permissions).
   * @param userId
   * @param resource
   * @param permissions
   * @param callback
   */
  isAllowed(userId: string | number, resource: string, permissions: mixed, callback: ?() => void) {
    return this.backend.getAsync(this.options.buckets.users, userId)
      .then(roles => {
        if (roles.length) return this.areAnyRolesAllowed(roles, resource, permissions);
        return false;
      }).nodeify(callback);
  };

  /**
   * @description Returns true if any of the given roles have the right permissions.
   * @param roles
   * @param resource
   * @param permissions
   * @param callback
   */
  areAnyRolesAllowed(roles: mixed, resource: string, permissions: mixed, callback: ?() => void) {
    roles = this.makeArray(roles);
    permissions = this.makeArray(permissions);
    if (!roles.length) return bluebird.resolve(false).nodeify(callback);
    return this._checkPermissions(roles, resource, permissions).nodeify(callback);
  };

  /**
   * @description Returns what resources a given role or roles have permissions over.
   * @param roles
   * @param permissions
   * @param callback
   * @return {*}
   */
  whatResources(roles: mixed, permissions: ?mixed, callback: ?() => void) {
    roles = this.makeArray(roles);
    if (_.isFunction(permissions)) {
      callback = permissions;
      permissions = undefined;
    } else if (permissions) {
      permissions = this.makeArray(permissions);
    }
    return this.permittedResources(roles, permissions, callback);
  };

  /**
   * @description Returns permitted resources.
   * @param roles
   * @param permissions
   * @param callback
   */
  permittedResources(roles: mixed, permissions: mixed, callback: ?() => void) {
    let result = _.isUndefined(permissions) ? {} : [];
    return this._rolesResources(roles)
      .then(resources => {
        return bluebird.all(resources.map(resource => {
          return this._resourcePermissions(roles, resource)
            .then(p => {
              if (permissions) {
                let commonPermissions = _.intersection(permissions, p);
                if (commonPermissions.length > 0) {
                  result.push(resource);
                }
              } else {
                result[resource] = p;
              }
            });
        }))
          .then(() => {
            return result;
          });
      }).nodeify(callback);
  }

  /**
   * @description Same as allow but accepts a more compact input.
   * @param objs
   * @return {*}
   * @private
   */
  _allowEx(objs) {
    objs = this.makeArray(objs);

    let demuxed = [];
    objs.forEach(obj => {
      let roles = obj.roles;
      obj.allows.forEach(allow => {
        demuxed.push({
          roles: roles,
          resources: allow.resources,
          permissions: allow.permissions
        });
      });
    });

    return bluebird.reduce(demuxed, (values, obj) => {
      return this.allow(obj.roles, obj.resources, obj.permissions);
    }, null);
  };

  /**
   * @description Returns the parents of the given roles.
   * @param roles
   * @return {*}
   * @private
   */
  _rolesParents(roles) {
    return this.backend.unionAsync(this.options.buckets.parents, roles);
  };

  /**
   * @description Return all roles in the hierarchy including the given roles.
   * @param roleNames
   * @return {Promise.<TResult>}
   * @private
   */
  _allRoles(roleNames) {
    return this._rolesParents(roleNames)
      .then(parents => {
        if (parents.length) {
          return this._allRoles(parents)
            .then(parentRoles => {
              return _.union(roleNames, parentRoles);
            });
        }
        return roleNames;
      });
  };

  /**
   * @description Return all roles in the hierarchy of the given user.
   * @param userId
   * @return {Promise.<TResult>}
   * @private
   */
  _allUserRoles(userId) {
    return this.userRoles(userId)
      .then(roles => {
        if (roles && roles.length) return this._allRoles(roles);
        return [];
      });
  };

  /**
   * @description Returns an array with resources for the given roles.
   * @param roles
   * @return {Promise.<TResult>}
   * @private
   */
  _rolesResources(roles) {
    roles = this.makeArray(roles);
    return this._allRoles(roles)
      .then(allRoles => {
        let result = [];
        return bluebird.all(allRoles.map(role => {
          return this.backend.getAsync(this.options.buckets.resources, role)
            .then(resources => result = result.concat(resources));
        })).then(() => {
          return result;
        });
      });
  };

  /**
   * @description Returns the permissions for the given resource and set of roles.
   * @param roles
   * @param resource
   * @return {*}
   * @private
   */
  _resourcePermissions(roles, resource) {
    if (!roles.length) return bluebird.resolve([]);
    return this.backend.unionAsync(this.allowsBucket(resource), roles)
      .then(resourcePermissions => {
        return this._rolesParents(roles)
          .then(parents => {
            if (parents && parents.length) {
              return this._resourcePermissions(parents, resource)
                .then(morePermissions => {
                  return _.union(resourcePermissions, morePermissions);
                });
            }
            return resourcePermissions;
          });
      });
  };

  /**
   * @description This function will not handle circular dependencies and result in a crash.
   * @param roles
   * @param resource
   * @param permissions
   * @return {Promise.<TResult>}
   * @private
   */
  _checkPermissions(roles, resource, permissions) {
    return this.backend.unionAsync(this.allowsBucket(resource), roles)
      .then(resourcePermissions => {
        if (resourcePermissions.indexOf('*') !== -1) return true;
        permissions = permissions.filter(p => {
          return resourcePermissions.indexOf(p) === -1;
        });

        if (!permissions.length) return true;
        return this.backend.unionAsync(this.options.buckets.parents, roles)
          .then(parents => {
            return (parents && parents.length) ? this._checkPermissions(parents, resource, permissions) : false;
          });
      });
  };

}
