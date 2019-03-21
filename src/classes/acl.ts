import { IOptions, IPermissions, IResources, IRoles, IUserId, IUserRoles, IRole, IParents, IResource, IRolesArray } from "../interfaces/IAcl";
import * as _ from "lodash";
import { IStore } from "../interfaces/IStore";
import { Common } from "./common";
import * as bluebird from "bluebird";

export class Acl extends Common {
  public options: IOptions;
  public store: IStore;

  constructor(store: IStore, options?: IOptions) {
    super();
    this.store = store;
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
  }

  async allow(roles: IRoles | any, resources?: IResources, permissions?: IPermissions): Promise<void> {
    if(arguments.length === 1 && _.isArray(roles) && _.isObject(roles[0])) {
      return this.allowEx(roles);
    }

    const rolesParam = Common.makeArray(roles);
    const resourcesParam = Common.makeArray(resources);

    this.store.begin();
    await this.store.add(this.options.buckets.meta, 'roles', rolesParam);

    resourcesParam.forEach((resource) => {
      rolesParam.forEach(async (role) => {
        await this.store.add(this.allowsBucket(resource), role, permissions);
      }, this);
    });

    rolesParam.forEach(async (role) => {
      await this.store.add(this.options.buckets.resources, role, resourcesParam);
    });

    return this.store.end();
  }

  async addUserRoles(userId: IUserId, roles: IRoles): Promise<void> {
    this.store.begin();

    const rolesParams = await Common.makeArray(roles);
    await this.store.add(this.options.buckets.meta, 'users', userId);
    await this.store.add(this.options.buckets.users, userId, roles);

    const promises = rolesParams.map((role) => this.store.add(this.options.buckets.roles, role, userId), this);
    await Promise.all(promises);

    return this.store.end();
  }

  async userRoles(userId: IUserId): Promise<IUserRoles> {
    return this.store.get(this.options.buckets.users, userId);
  }

  async hasRole(userId: IUserId, rolename: IRole): Promise<boolean> {
    const roles = await this.userRoles(userId);

    return roles.indexOf(rolename as string) !== -1;
  }

  async roleUsers(roleName: IRole): Promise<[IUserId]> {
    return this.store.get(this.options.buckets.roles, roleName);
  }

  async addRoleParents(role: IRole, parents: IParents): Promise<void> {
    this.store.begin();
    await this.store.add(this.options.buckets.meta, 'roles', role);
    await this.store.add(this.options.buckets.parents, role, parents);

    return this.store.end();
  }

  async isAllowed(userId: IUserId, resource: IResource, permissions: IPermissions): Promise<boolean> {
    const roles = await this.store.get(this.options.buckets.users, userId);

    if (roles.length) {
      return await this.areAnyRolesAllowed(roles, resource, permissions);
    }

    return false;
  }

  async areAnyRolesAllowed(roles: IRoles, resource: IResource, permissions: IPermissions): Promise<boolean> {
    const rolesParam = Common.makeArray(roles);
    const permissionsParam = Common.makeArray(permissions);

    if (!rolesParam.length) {
      return false;
    }
    return this.checkPermissions(rolesParam, resource, permissionsParam);
  }

  async checkPermissions(roles, resource, permissions): Promise<boolean> {
    const resourcePermissions = await this.store.union(this.allowsBucket(resource), roles);

    if (resourcePermissions.indexOf('*') !== -1) {
      return true;
    }

    const perms = permissions.filter((p) => resourcePermissions.indexOf(p) === -1);

    if (!perms.length) {
      return true;
    }

    const parents = await this.store.union(this.options.buckets.parents, roles);
    return (parents && parents.length) ? await this.checkPermissions(parents, resource, perms) : false;
  }

  private async allowEx(objs: IRolesArray) {
    // const objsTmp = await Common.makeArray(objs);
    const objsTmp = objs;

    const demuxed = [];
    objsTmp.forEach((obj) => {
      const roles = obj.roles;
      obj.allows.forEach((allow) => {
        demuxed.push({
          roles:roles,
          resources:allow.resources,
          permissions:allow.permissions,
        });
      });
    });

    return bluebird.reduce(demuxed,(_values, obj) => {
      return this.allow(obj.roles, obj.resources, obj.permissions);
    }, null);
  };
}
