import * as express from 'express';
import { extend, intersection, isFunction, isNil, isNumber, isObject, isString, isUndefined, union } from 'lodash';
import { IStore } from '..';
import { IBucket, IDemuxed, IDynamicObject, IOptions, IPermission, IPermissions, IResource, IResources, IRole, IRoles, IRolesObject, IRolesObjectAllows, IRolesObjects, IRolesParent, IRolesParents, IUserId, IUserIds, IUserRoles } from '../types';
import { Common } from './common';
import { HttpError } from './httpError';

/**
 * {@inheritDoc}
 * @description Acl class.
 */
export class Acl extends Common {
  public options: IOptions;
  public store: IStore;

  constructor(store: IStore, options?: IOptions) {
    super();
    this.store = store;
    this.options = extend({
      buckets: {
        meta: 'meta',
        parents: 'parents',
        permissions: 'permissions',
        resources: 'resources',
        roles: 'roles',
        users: 'users',
      },
    }, options);
  }

  /**
   * @description Adds the given permissions to the given roles over the given resources.
   * @param roles
   * @param resources
   * @param permissions
   * @return Promise<void>
   */
  public async allow(roles: IRole | IRoles | IRolesObjects, resources?: IResource | IResources, permissions?: IPermission | IPermissions): Promise<void> {
    if (arguments.length === 1) {
      return this.allowEx(roles as IRolesObjects);
    }

    const rolesParam = Common.MAKE_ARRAY(roles as IRole | IRoles);
    const resourcesParam = Common.MAKE_ARRAY(resources);

    this.store.begin();
    this.store.add(this.options.buckets.meta, 'roles', rolesParam);

    resourcesParam.forEach((resource: IResource) => {
      rolesParam.forEach((role: IRole) => this.store.add(this.allowsBucket(resource), role, permissions), this);
    });

    rolesParam.forEach((role: IRole) => this.store.add(this.options.buckets.resources, role, resourcesParam));

    return this.store.end();
  }

  /**
   * @description Adds roles to a given user id.
   * @param userId
   * @param roles
   * @return Promise<void>
   */
  public async addUserRoles(userId: IUserId, roles: IRole | IRoles): Promise<void> {
    this.store.begin();

    const rolesParams = Common.MAKE_ARRAY(roles);

    this.store.add(this.options.buckets.meta, 'users', userId);
    this.store.add(this.options.buckets.users, userId, roles);

    rolesParams.forEach((role: IRole) => this.store.add(this.options.buckets.roles, role, userId));

    return this.store.end();
  }

  /**
   * @description Returns all the roles from a given user.
   * @param userId
   * @return Promise<IUserRoles>
   */
  public async userRoles(userId: IUserId): Promise<IUserRoles> {
    return this.store.get(this.options.buckets.users, userId);
  }

  /**
   * @description Return boolean whether user is in the role.
   * @param userId
   * @param role
   * @return Promise<boolean>
   */
  public async hasRole(userId: IUserId, role: IRole): Promise<boolean> {
    const roles = await this.userRoles(userId);

    return roles.indexOf(role) !== -1;
  }

  /**
   * @description Returns all users who has a given role.
   * @param role
   * @return Promise<IUserIds>
   */
  public async roleUsers(role: IRole): Promise<IUserIds> {
    return this.store.get(this.options.buckets.roles, role);
  }

  /**
   * @description Adds a parent or parent list to role.
   * @param role
   * @param parents
   * @return Promise<void>
   */
  public async addRoleParents(role: IRole, parents: IRolesParent | IRolesParents): Promise<void> {
    this.store.begin();
    this.store.add(this.options.buckets.meta, 'roles', role);
    this.store.add(this.options.buckets.parents, role, parents);

    return this.store.end();
  }

  /**
   * @description Checks if the given user is allowed to access the resource for the given permissions (note: it must fulfill all the permissions).
   * @param userId
   * @param resource
   * @param permissions
   * @return Promise<boolean>
   */
  public async isAllowed(userId: IUserId, resource: IResource, permissions: IPermission | IPermissions): Promise<boolean> {
    const roles = await this.store.get(this.options.buckets.users, userId);

    if (roles.length > 0) {
      return this.areAnyRolesAllowed(roles, resource, permissions);
    }

    return false;
  }

  /**
   * @description Returns true if any of the given roles have the right permissions.
   * @param roles
   * @param resource
   * @param permissions
   * @return Promise<boolean>
   */
  public async areAnyRolesAllowed(roles: IRole | IRoles, resource: IResource, permissions: IPermission | IPermissions): Promise<boolean> {
    const rolesParam = Common.MAKE_ARRAY(roles);
    const permissionsParam = Common.MAKE_ARRAY(permissions);

    if (rolesParam.length === 0) {
      return false;
    }

    return this.checkPermissions(rolesParam, resource, permissionsParam);
  }

  /**
   * @description Checks role permissions.
   * @param roles
   * @param resource
   * @param permissions
   * @return Promise<boolean>
   */
  public async checkPermissions(roles: IRoles, resource: IResource, permissions: IPermissions): Promise<boolean> {
    const resourcePermissions = await this.store.union(this.allowsBucket(resource), roles);

    if (resourcePermissions.indexOf('*') !== -1) {
      return true;
    }

    const permissionsFiltered = permissions.filter((p: IPermission) => resourcePermissions.indexOf(p) === -1);

    if (permissionsFiltered.length === 0) {
      return true;
    }

    const parents = await this.store.union(this.options.buckets.parents, roles);

    return (parents.length > 0) ? this.checkPermissions(parents, resource, permissionsFiltered) : false;
  }

  /**
   * @description Returns all the allowable permissions a given user have to access the given resources.
   * It returns an array of objects where every object maps a resource name to a list of permissions for that resource.
   * @param userId
   * @param resources
   * @return Promise<IDynamicObject>
   */
  public async allowedPermissions(userId: IUserId, resources: IResource | IResources): Promise<IDynamicObject> {
    if (isFunction(this.store.unions)) {
      return this.optimizedAllowedPermissions(userId, resources);
    }

    const resourcesParams = Common.MAKE_ARRAY(resources);

    const roles: IRoles  = await this.userRoles(userId);
    const result = {};

    await Promise.all(resourcesParams.map(async (resource: IResource) => {
      result[resource] = await this.resourcePermissions(roles, resource);
    }));

    return result;
  }

  /**
   * @description Returns all the allowable permissions a given user have to access the given resources.
   * It returns a map of resource name to a list of permissions for that resource.
   * This is the same as allowedPermissions, it just takes advantage of the unions function if available to reduce the number of backend queries.
   * @param userId
   * @param resources
   * @return Promise<IDynamicObject>
   */
  public async optimizedAllowedPermissions(userId: IUserId, resources: IResource | IResources): Promise<IDynamicObject> {
    const resourcesParam = Common.MAKE_ARRAY(resources);
    const roles: IRoles = await this.allUserRoles(userId);
    const buckets = resourcesParam.map(this.allowsBucket, this);
    let response = {};

    if (roles.length === 0) {
      const emptyResult = {};
      buckets.forEach((bucket: IBucket) => emptyResult[bucket] = []);
      response = emptyResult;
    }

    response = await this.store.unions(buckets, roles);

    const result = {};
    Object.keys(response).forEach((bucket: IBucket) => {
      result[this.keyFromAllowsBucket(bucket)] = response[bucket]
    }, this);

    return result;
  }

  /**
   * @description Returns resources from role.
   * @param roles
   * @param permissions
   * @return Promise<IDynamicObject>
   */
  public async whatResources(roles: IRole | IRoles, permissions?: IPermission | IPermissions): Promise<IDynamicObject> {
    const rolesParam = Common.MAKE_ARRAY(roles);

    if (permissions === undefined) {
      return this.permittedResources(rolesParam);
    }

    return this.permittedResources(rolesParam, Common.MAKE_ARRAY(permissions));
  }

  /**
   * @description Returns permitted resources.
   * @param roles
   * @param permissions
   * @return Promise<IResources>
   */
  public async permittedResources(roles: IRoles, permissions?: IPermission | IPermissions): Promise<IResources> {
    const result = permissions === undefined ? {} : [];

    const rolesParam = Common.MAKE_ARRAY(roles);

    const resources: IResources = await this.rolesResources(rolesParam);

    await Promise.all(resources.map(async (resource: IResource) => {
      const resourcePermissions: IPermissions = await this.resourcePermissions(rolesParam, resource);

      if (Array.isArray(result)) {
        const commonPermissions = intersection(permissions, resourcePermissions);
        if (commonPermissions.length > 0) {
          result.push(resource);
        }
      } else {
        result[resource] = resourcePermissions;
      }
    }));

    if (isObject(result)) {
      const resultArray = [];
      Object.entries(result).forEach((item: [string, string]) => resultArray[item[0]] = item[1]);

      return resultArray;
    }

    return result;
  }

  /**
   * @description Removes allow.
   * @param role
   * @param resources
   * @param permissions
   * @return Promise<void>
   */
  public async removeAllow(role: IRole, resources: IResource | IResources, permissions?: IPermission | IPermissions): Promise<void> {
    const resourcesParam = Common.MAKE_ARRAY(resources);

    if (permissions !== undefined && !isFunction(permissions)) {
      return this.removePermissions(role, resourcesParam, Common.MAKE_ARRAY(permissions));
    }

    return this.removePermissions(role, resourcesParam);
  }

  /**
   * @description Remove permissions.
   * @param role
   * @param resources
   * @param permissions
   * @return Promise<void>
   */
  public async removePermissions(role: IRole, resources: IResource | IResources, permissions?: IPermission | IPermissions): Promise<void> {
    const resourcesParams = Common.MAKE_ARRAY(resources);

    this.store.begin();

    resourcesParams.forEach(async (resource: IResource) => {
      const bucket = this.allowsBucket(resource);
      if (permissions !== undefined) {
        await this.store.remove(bucket, role, Common.MAKE_ARRAY(permissions));
      } else {
        await this.store.del(bucket, role);
        await this.store.remove(this.options.buckets.resources, role, resource);
      }
    }, this);

    await this.store.end();
    this.store.begin();

    await Promise.all(resourcesParams.map(async (resource: IResource) => {
      const bucket: IBucket = this.allowsBucket(resource);
      const permissionsRetrieved: IPermissions = await this.store.get(bucket, role);

      if (permissionsRetrieved.length === 0) {
        await this.store.remove(this.options.buckets.resources, role, resource);
      }
    }, this));

    return this.store.end();
  }

  /**
   * @description Removes a role from the system.
   * @param role
   * @return Promise<void>
   */
  public async removeRole(role: IRole): Promise<void> {
    const resources: IResources = await this.store.get(this.options.buckets.resources, role);

    this.store.begin();

    resources.forEach(async (resource: IResource) => {
      const bucket = this.allowsBucket(resource);
      await this.store.del(bucket, role);
    }, this);

    await this.store.del(this.options.buckets.resources, role);
    await this.store.del(this.options.buckets.parents, role);
    await this.store.del(this.options.buckets.roles, role);
    await this.store.remove(this.options.buckets.meta, 'roles', role);

    return this.store.end();
  }

  /**
   * @description Removes a parent or parent list from role. If `parents` is not specified, removes all parents.
   * @param role
   * @param parents
   * @return Promise<void>
   */
  public async removeRoleParents(role: IRole, parents?: IRolesParent | IRolesParents): Promise<void> {
    this.store.begin();

    if (parents !== undefined) {
      await this.store.remove(this.options.buckets.parents, role, parents);
    } else  {
      await this.store.del(this.options.buckets.parents, role);
    }

    return this.store.end();
  }

  /**
   * @description Removes a resource from the system.
   * @param resource
   * @return Promise<void>
   */
  public async removeResource(resource: IResource): Promise<void> {
    const roles: IRoles = await this.store.get(this.options.buckets.meta, 'roles');

    this.store.begin();
    await this.store.del(this.allowsBucket(resource), roles);

    await Promise.all(roles.map(async (role: IRole) => this.store.remove(this.options.buckets.resources, role, resource), this));

    return this.store.end();
  }

  /**
   * @description Removes user with his associated roles.
   * @param userId
   * @return Promise<void>
   */
  public async removeUser(userId: string | number): Promise<void> {
    const userRoles = await this.userRoles(userId);
    await this.removeUserRoles(userId, userRoles);

    this.store.begin();
    await this.store.del(this.options.buckets.users, userId);

    return this.store.end();
  }

  /**
   * @description Remove roles from a given user.
   * @param userId
   * @param roles
   * @return Promise<void>
   */
  public async removeUserRoles(userId: IUserId, roles: IRole | IRoles): Promise<void> {
    this.store.begin();
    await this.store.remove(this.options.buckets.users, userId, roles);

    if (Array.isArray(roles)) {
      await Promise.all(roles.map(async (role: IRole) => this.store.remove(this.options.buckets.roles, role, userId)));
    } else {
      await this.store.remove(this.options.buckets.roles, roles, userId);
    }

    return this.store.end();
  }

  /**
   * @description Express middleware.
   * @param numPathComponents
   * @param userId
   * @param method
   * @return void
   */
  public middleware(numPathComponents: number, userId: string | number | Function | null, method: string): (req: express.Request, res: express.Response, next: express.NextFunction) => void {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      let userIdTmp = userId;
      let actionsTmp = method;

      // Call function to fetch userId
      if (isFunction(userId)) {
        userIdTmp = userId(req, res); // tslint:disable-line  no-unsafe-any
      }

      if (isNil(userId)) {
        // @ts-ignore
        if (isObject(req.session) && (isString(req.session.userId) || isNumber(req.session.userId))) { // tslint:disable-line  no-unsafe-any
          // @ts-ignore
          userIdTmp = req.session.userId; // tslint:disable-line  no-unsafe-any
          // @ts-ignore
        } else if (isObject(req.user) && (isString(req.user.id) || isNumber(req.user.id))) { // tslint:disable-line  no-unsafe-any
          // @ts-ignore
          userIdTmp = req.user.id; // tslint:disable-line  no-unsafe-any
        } else {
          return next(new HttpError(401, 'User not authenticated'));
        }
      }

      if (isUndefined(userIdTmp)) {
        return next(new HttpError(401, 'User not authenticated'));
      }

      const url = req.originalUrl.split('?')[0];
      const resource = numPathComponents === 0 ? url : url.split('/').slice(0, numPathComponents + 1).join('/');

      if (!isUndefined(actionsTmp)) {
        actionsTmp = req.method.toLowerCase();
      }

      // @ts-ignore
      this.isAllowed(userIdTmp, resource, actionsTmp)
        .then((allowed: boolean) => {//}, (err, allowed) => {
          if (!allowed) {
            return next(new HttpError(403, 'Insufficient permissions to access resource'));
          }

          return next();
        })
        .catch(() => next(new Error('Error checking permissions to access resource')));
    };
  }

  /**
   * @description Returns all roles in the hierarchy of the given user.
   * @param userId
   * @return Promise<IRoles>
   */
  private async allUserRoles(userId: IUserId): Promise<IRoles> {
    const roles = await this.userRoles(userId);

    if (roles.length > 0) {
      return this.allRoles(roles);
    }

    return [];
  }

  /**
   * @description Returns all roles in the hierarchy including the given roles.
   * @param roles
   * @return Promise<IRoles>
   */
  private async allRoles(roles: IRoles): Promise<IRoles> {
    const parents = await this.rolesParents(roles);

    if (parents.length > 0) {
      const parentRoles = await this.allRoles(parents);

      return union(roles, parentRoles);
    }

    return roles;
  }

  /**
   * @description Returns the parents of the given roles.
   * @param roles
   * @return Promise<IRolesParents>
   */
  private async rolesParents(roles: IRoles): Promise<IRolesParents> {
    return this.store.union(this.options.buckets.parents, roles);
  }

  /**
   * @description Same as allow but accepts a more compact input.
   * @param rolesArray
   * @return Promise<void>
   */
  private async allowEx(rolesArray: IRolesObjects): Promise<void> {
    const rolesArrayParam = rolesArray;
    const demuxed = [];

    rolesArrayParam.forEach((obj: IRolesObject) => {
      const roles = obj.roles;
      obj.allows.forEach((allow: IRolesObjectAllows) => {
        demuxed.push({
          roles:roles,
          resources:allow.resources,
          permissions:allow.permissions,
        });
      });
    });

    demuxed.reduce(async (_: undefined, obj: IDemuxed) => {
      await this.allow(obj.roles, obj.resources, obj.permissions)
    }, undefined);
  }

  /**
   * @description Returns the permissions for the given resource and set of roles.
   * @param roles
   * @param resource
   * @return Promise<IPermissions>
   */
  private async resourcePermissions(roles: IRoles, resource: IResource): Promise<IPermissions> {
    const rolesTmp = Common.MAKE_ARRAY(roles);

    if (rolesTmp.length ===0 ) {
      return [];
    }

    const resourcePermissions = await this.store.union(this.allowsBucket(resource), rolesTmp);
    const parents = await this.rolesParents(rolesTmp);

    if (parents.length > 0) {
      const morePermissions = await this.resourcePermissions(parents, resource);

      return union(resourcePermissions, morePermissions);
    }

    return resourcePermissions;
  }

  /**
   * @description Returns an array with resources for the given roles.
   * @param roles
   * @return Promise<IResources>
   */
  private async rolesResources(roles: IRole | IRoles): Promise<IResources> {
    const rolesTmp = Common.MAKE_ARRAY(roles);

    const allRoles = await this.allRoles(rolesTmp);
    let result = [];

    await Promise.all(allRoles.map(async (role: IRole) => {
      const resources: IResources = await this.store.get(this.options.buckets.resources, role);
      result = result.concat(resources);
    }));

    return result;
  }
}
