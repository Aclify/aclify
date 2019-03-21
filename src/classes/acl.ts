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

  async roleUsers(roleName: IRole): Promise<IUserId[]> {
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




  async allowedPermissions(userId: IUserId, resources: IResources) {

    // contract(arguments)
    //   .params('string|number', 'string|array', 'function')
    //   .params('string|number', 'string|array')
    //   .end();

    if (this.store.unions) {
      return this.optimizedAllowedPermissions(userId, resources);
    }

    var _this = this;
    const resourcesTmp = Common.makeArray(resources);

    return _this.userRoles(userId).then(function(roles){
      var result = {};
      return bluebird.all(resourcesTmp.map(function(resource){
        return _this._resourcePermissions(roles, resource).then(function(permissions){
          result[resource] = permissions;
        });
      })).then(function(){
        return result;
      });
    })
  };




  async optimizedAllowedPermissions(userId: IUserId, resources: IResources){
    // contract(arguments)
    //   .params('string|number', 'string|array', 'function|undefined')
    //   .params('string|number', 'string|array')
    //   .end();

    const resourcesTmp = Common.makeArray(resources);
    var self = this;

    return this._allUserRoles(userId)
      .then((roles) => {
      var buckets = resourcesTmp.map(this.allowsBucket, this);

      if (roles.length === 0) {
        var emptyResult = {};
        buckets.forEach(function(bucket) {
          // @ts-ignore
          emptyResult[bucket] = [];
        });
        return bluebird.resolve(emptyResult);
      }

      return self.store.unions(buckets, roles);
    }).then((response) => {
      var result = {};
      Object.keys(response).forEach(function(bucket) {
        result[this.keyFromAllowsBucket(bucket)] = response[bucket];
      }, this);

      return result;
    })
  };



  async _allUserRoles(userId: IUserId) {
    var _this = this;

    const roles = await this.userRoles(userId);

      if (roles && roles.length > 0) {
        return _this._allRoles(roles);
      } else {
        return [];
      }
  };


  async _allRoles (roleNames) {
    var _this = this;

    return this._rolesParents(roleNames).then(function(parents){
      if(parents.length > 0){
        return _this._allRoles(parents).then(function(parentRoles){
          return _.union(roleNames, parentRoles);
        });
      }else{
        return roleNames;
      }
    });
  };

  async _rolesParents(roles: IRoles) {

    // @ts-ignore
    return this.store.union(this.options.buckets.parents, roles);
  };

  async _resourcePermissions(roles: IRoles, resource: IResource){
    var _this = this;

    if(roles.length===0){
      return bluebird.resolve([]);
    } else{
      // @ts-ignore
      return this.store.union(this.allowsBucket(resource), roles).then(function(resourcePermissions){
        return _this._rolesParents(roles).then(function(parents){
          if(parents && parents.length){
            return _this._resourcePermissions(parents, resource).then(function(morePermissions){
              return _.union(resourcePermissions, morePermissions);
            });
          }else{
            return resourcePermissions;
          }
        });
      });
    }
  };
}
