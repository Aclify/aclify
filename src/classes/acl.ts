import { IOptions, IPermissions, IResources, IRoles, IUserId, IUserRoles, IRole, IParents, IResource } from "../interfaces/IAcl";
import * as _ from "lodash";
import { IStore } from "../interfaces/IStore";
import { Common } from "./common";

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

  /**
   * @description
   * @param roles
   * @param resources
   * @param permissions
   * @return Promise<void>
   */
  async allow(roles: IRoles, resources: IResources, permissions: IPermissions): Promise<void> {
    const [rolesParam, resourcesParam] = await Promise.all([
      Common.makeArray(roles),
      Common.makeArray(resources),
    ]);

    this.store.begin();
    await this.store.add(this.options.buckets.meta, 'roles', rolesParam);

    resourcesParam.forEach((resource) => {
      rolesParam.forEach(async (role) => {
        await this.store.add(this.allowsBucket(resource), role, permissions);
      });
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
    const [rolesParam, permissionsParam] = await Promise.all([
      Common.makeArray(roles),
      Common.makeArray(permissions),
    ]);

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
}
