import { IOptions } from "../interfaces/IAcl";
import * as _ from "lodash";
import { IStore } from "../interfaces/IStore";

export class Acl {
  readonly options;
  readonly store;

  constructor(store: IStore, options?: IOptions) {
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
}
