import { IOptions, IPermissions, IResources, IRoles } from "../interfaces/IAcl";
import * as _ from "lodash";
import { IStore } from "../interfaces/IStore";
import { Common } from "./common";

export class Acl extends Common {
  readonly options: IOptions;
  readonly store: IStore;

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
}
