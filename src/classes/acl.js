import bluebird from 'bluebird'
import {Common} from './common'

export class Acl extends Common {

  logger: {};
  backend: {};
  options: {};

  /**
   * @description Create ACL class and promisify backend methods
   * @param backend
   * @param logger
   * @param options
   */
  constructor(backend: {}, logger: ?{}, options: ?{}) {
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
  addUserRoles(userId: string | number, roles: mixed, callback: () => void) {
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
  removeUserRoles(userId: string | number, roles: mixed, callback: () => void) {
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
  userRoles(userId: string | number, callback: () => void) {
    return this.backend.getAsync(this.options.buckets.users, userId).nodeify(callback);
  };

  /**
   * @description Return all users who has a given role
   * @param roleName
   * @param callback
   */
  roleUsers(roleName: string | number, callback: () => void) {
    return this.backend.getAsync(this.options.buckets.roles, roleName).nodeify(callback);
  };

  /**
   * @description Return boolean whether user is in the role
   * @param userId
   * @param rolename
   * @param callback
   */
  hasRole(userId: string | number, rolename: string | number, callback: () => void) {
    return this.userRoles(userId).then(roles => roles.indexOf(rolename) !== -1).nodeify(callback);
  };

  /**
   * @description Adds a parent or parent list to role
   * @param role
   * @param parents
   * @param callback
   */
  addRoleParents(role: string | number, parents: mixed, callback: () => void) {
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
  removeRoleParents(role: string | number, parents: mixed, callback: () => void) {
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
  removeRole(role: string | number, callback: () => void) {
    return this.backend.getAsync(this.options.buckets.resources, role)
      .then(resources => {
        const transaction = _this.backend.begin();
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
  removeResource(resource: string, callback: () => void) {
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
  removeAllow(role: string, resources: mixed, permissions: mixed, callback: () => void) {
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
  removePermissions(role, resources, permissions, callback: () => void) {
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
  allow(roles: mixed, resources: mixed, permissions: mixed, callback: () => void) {
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
  allowedPermissions(userId: string | number, resources: mixed, callback: () => void) {
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
   * This is the same as allowedPermissions, it just takes advantage of the unions function if available to reduce the number of backend queries.
   * @param userId
   * @param resources
   * @param callback
   * @return {*}
   */
  optimizedAllowedPermissions(userId: string | number, resources: mixed, callback: () => void) {
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
   * @description Same as allow but accepts a more compact input
   * @param objs
   * @return {*}
   * @private
   */
  _allowEx(objs) {
    objs = this.makeArray(objs);

    let demuxed = [];
    objs.forEach(obj => {
      obj.allows.forEach(allow => {
        demuxed.push({
          roles: obj.roles,
          resources: allow.resources,
          permissions: allow.permissions
        });
      });
    });
    return bluebird.reduce(demuxed, (values, obj) => this.allow(obj.roles, obj.resources, obj.permissions), null);
  };

}
