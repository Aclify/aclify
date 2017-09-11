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
          let bucket = allowsBucket(resource);
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
        this.backend.del(transaction, allowsBucket(resource), roles);
        roles.forEach(role => this.backend.remove(transaction, this.options.buckets.resources, role, resource));
        return this.backend.endAsync(transaction);
      }).nodeify(callback)
  };

  allow(roles: mixed, resources: mixed, permissions: mixed, callback: () => void) {
    if ((arguments.length === 1) || ((arguments.length === 2) && _.isObject(roles) && _.isFunction(resources))) {
      return this._allowEx(roles).nodeify(resources);
    } else {
      var _this = this;

      roles = makeArray(roles);
      resources = makeArray(resources);

      var transaction = _this.backend.begin();

      _this.backend.add(transaction, _this.options.buckets.meta, 'roles', roles);

      resources.forEach(function (resource) {
        roles.forEach(function (role) {
          _this.backend.add(transaction, allowsBucket(resource), role, permissions);
        });
      });

      roles.forEach(function (role) {
        _this.backend.add(transaction, _this.options.buckets.resources, role, resources);
      });

      return _this.backend.endAsync(transaction).nodeify(cb);
    }
  };

}
