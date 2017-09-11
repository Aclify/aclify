import bluebird from 'bluebird'

export class Acl {

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


}
