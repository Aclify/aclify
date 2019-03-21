import * as bluebird from "bluebird";
import * as _ from "lodash";
import { IOptions, IParents, IPermissions, IResource, IResources, IRole, IRoles, IRolesArray, IUserId, IUserRoles } from "../interfaces/IAcl";
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

  public async allow(roles: IRoles | any, resources?: IResource | IResources, permissions?: IPermissions): Promise<void> {
    if(arguments.length === 1 && _.isArray(roles) && _.isObject(roles[0])) {
      return this.allowEx(roles);
    }

    const rolesTmp = Common.makeArray(roles);
    const resourcesTmp = Common.makeArray(resources);

    this.store.begin();
    this.store.add(this.options.buckets.meta, 'roles', rolesTmp);

    resourcesTmp.forEach((resource) => {
      rolesTmp.forEach((role) => this.store.add(this.allowsBucket(resource), role, permissions), this);
    });

    rolesTmp.forEach((role) => this.store.add(this.options.buckets.resources, role, resourcesTmp));

    return this.store.end();
  }

  public async addUserRoles(userId: IUserId, roles: IRole | IRoles): Promise<void> {
    this.store.begin();
    const rolesParams = await Common.makeArray(roles);

    this.store.add(this.options.buckets.meta, 'users', userId);
    this.store.add(this.options.buckets.users, userId, roles);

    const promises = rolesParams.map((role) => this.store.add(this.options.buckets.roles, role, userId), this);
    await Promise.all(promises);

    return this.store.end();
  }

  public async userRoles(userId: IUserId): Promise<IUserRoles> {
    return this.store.get(this.options.buckets.users, userId);
  }

  public async hasRole(userId: IUserId, rolename: IRole): Promise<boolean> {
    const roles = await this.userRoles(userId);

    return roles.indexOf(rolename) !== -1;
  }

  public async roleUsers(roleName: IRole): Promise<IUserId[]> {
    return this.store.get(this.options.buckets.roles, roleName);
  }

  public async addRoleParents(role: IRole, parents: IParents): Promise<void> {
    this.store.begin();
    this.store.add(this.options.buckets.meta, 'roles', role);
    this.store.add(this.options.buckets.parents, role, parents);

    return this.store.end();
  }

  public async isAllowed(userId: IUserId, resource: IResource, permissions: IPermissions): Promise<boolean> {
    const roles = await this.store.get(this.options.buckets.users, userId);

    if (roles.length) {
      return this.areAnyRolesAllowed(roles, resource, permissions);
    }

    return false;
  }

  public async areAnyRolesAllowed(roles: IRoles, resource: IResource, permissions: IPermissions): Promise<boolean> {
    const rolesParam = Common.makeArray(roles);
    const permissionsParam = Common.makeArray(permissions);

    if (!rolesParam.length) {
      return false;
    }

    return this.checkPermissions(rolesParam, resource, permissionsParam);
  }

  public async checkPermissions(roles, resource, permissions): Promise<boolean> {
    const resourcePermissions = await this.store.union(this.allowsBucket(resource), roles);

    if (resourcePermissions.indexOf('*') !== -1) {
      return true;
    }

    const perms = permissions.filter((p) => resourcePermissions.indexOf(p) === -1);

    if (!perms.length) {
      return true;
    }

    const parents = await this.store.union(this.options.buckets.parents, roles);

    return (parents && parents.length) ? this.checkPermissions(parents, resource, perms) : false;
  }

  public async allowedPermissions(userId: IUserId, resources: IResource | IResources) {
    if (this.store.unions) {
      return this.optimizedAllowedPermissions(userId, resources);
    }

    let _this = this;
    const resourcesTmp = Common.makeArray(resources);

    return _this.userRoles(userId).then(function(roles){
      let result = {};

      return bluebird.all(resourcesTmp.map(function(resource){
        return _this.resourcePermissions(roles, resource).then(function(permissions){
          result[resource] = permissions;
        });
      })).then(function(){
        return result;
      });
    })
  };

  public async optimizedAllowedPermissions(userId: IUserId, resources: IResources){
    const resourcesTmp = Common.makeArray(resources);
    let self = this;

    return this.allUserRoles(userId)
      .then((roles) => {
        let buckets = resourcesTmp.map(this.allowsBucket, this);

        if (roles.length === 0) {
          let emptyResult = {};
          buckets.forEach(function(bucket) {
            emptyResult[bucket] = [];
          });

          return bluebird.resolve(emptyResult);
        }

        return self.store.unions(buckets, roles);
      }).then((response) => {
        let result = {};
        Object.keys(response).forEach(function(bucket) {
          result[this.keyFromAllowsBucket(bucket)] = response[bucket];
        }, this);

        return result;
      })
  };

  public async whatResources(roles: IRole | IRoles, permissions?: IPermissions){
    let permissionsTmp = permissions;
    roles = Common.makeArray(roles);

    if(permissions !== undefined){
      permissionsTmp = Common.makeArray(permissionsTmp);
    }

    return this.permittedResources(roles, permissionsTmp);
  };

  public async permittedResources(roles, permissions){
    let _this = this;
    let result = permissions === undefined ? {} : [];

    return this.rolesResources(roles).then(function(resources){
      return bluebird.all(resources.map(function(resource){
        return _this.resourcePermissions(roles, resource).then(function(p){

          if(Array.isArray(result)){
            let commonPermissions = _.intersection(permissions, p);
            if(commonPermissions.length>0){
              result.push(resource);
            }
          }else{
            result[resource] = p;
          }
        });
      })).then(function(){
        return result;
      });
    });
  }

  public async removeAllow(role: IRole, resources: IResource | IResources, permissions: IPermissions){
    resources = Common.makeArray(resources);
    if(permissions && !_.isFunction(permissions)){
      permissions = Common.makeArray(permissions);
    }else {
      permissions = null;
    }

    return this.removePermissions(role, resources, permissions);
  }

  public async removePermissions(role: IRole, resources: IResources, permissions: IPermissions) {
    let _this = this;

    _this.store.begin();
    resources.forEach(async function(resource){
      let bucket = this.allowsBucket(resource);
      if(permissions){
        await _this.store.remove(bucket, role, permissions);
      }else{
        await _this.store.del(bucket, role);
        await _this.store.remove(_this.options.buckets.resources, role, resource);
      }
    }, this);

    // Remove resource from role if no rights for that role exists.
    // Not fully atomic...
    return _this.store.end().then(function(){
      _this.store.begin();

      return bluebird.all(resources.map(function(resource){
        let bucket = _this.allowsBucket(resource);

        return _this.store.get(bucket, role).then(function(permissions){

          // @ts-ignore
          if(permissions.length === 0){
            _this.store.remove(_this.options.buckets.resources, role, resource);
          }
        });
      })).then(function(){
        return _this.store.end();
      });
    });
  };

  public async removeRole(role: IRole) {
    // contract(arguments)
    //   .params('string','function')
    //   .params('string').end();
    //
    let _this = this;

    // Note that this is not fully transactional.
    return this.store.get(this.options.buckets.resources, role).then(async(resources) => {
      _this.store.begin();

      resources.forEach(function(resource){
        let bucket = this.allowsBucket(resource);
        _this.store.del(bucket, role);
      }, this);

      await _this.store.del(this.options.buckets.resources, role);
      await _this.store.del(this.options.buckets.parents, role);
      await _this.store.del(this.options.buckets.roles, role);
      await _this.store.remove(this.options.buckets.meta, 'roles', role);

      return _this.store.end();
    });
  }

  public removeRoleParents(role: IRole, parents?: IParents){
    if (_.isFunction(parents)) {
      parents = null;
    }

    this.store.begin();
    if (parents) {
      this.store.remove(this.options.buckets.parents, role, parents);
    } else  {
      this.store.del(this.options.buckets.parents, role);
    }

    return this.store.end();
  };

  public async removeResource(resource: IResource) {
    let _this = this;

    return this.store.get(this.options.buckets.meta, 'roles').then(function(roles){
      _this.store.begin();
      _this.store.del(_this.allowsBucket(resource), roles);
      roles.forEach(function(role){
        _this.store.remove(_this.options.buckets.resources, role, resource);
      });

      return _this.store.end();
    });
  }

  public async removeUserRoles(userId: IUserId, roles: IRole | IRoles){
    this.store.begin();
    this.store.remove(this.options.buckets.users, userId, roles);

    if (Array.isArray(roles)) {
      let _this = this;

      roles.forEach(function(role) {
        _this.store.remove(_this.options.buckets.roles, role, userId);
      });
    }
    else {
      this.store.remove(this.options.buckets.roles, roles, userId);
    }

    return this.store.end();
  }

  private async allUserRoles(userId: IUserId) {
    let _this = this;

    const roles = await this.userRoles(userId);

    if (roles && roles.length > 0) {
      return _this.allRoles(roles);
    } else {
      return [];
    }
  };

  private async allRoles (roleNames) {
    let _this = this;

    return this.rolesParents(roleNames).then(function(parents){
      if(parents.length > 0){
        return _this.allRoles(parents).then(function(parentRoles){
          return _.union(roleNames, parentRoles);
        });
      }else{
        return roleNames;
      }
    });
  };

  private async rolesParents(roles: IRoles) {
    return this.store.union(this.options.buckets.parents, roles);
  };

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

  private async resourcePermissions(roles: IRoles, resource: IResource){
    let _this = this;

    if(roles.length===0){
      return bluebird.resolve([]);
    } else{
      return this.store.union(this.allowsBucket(resource), roles).then(function(resourcePermissions){
        return _this.rolesParents(roles).then(function(parents){
          if(parents && parents.length){
            return _this.resourcePermissions(parents, resource).then(function(morePermissions){
              return _.union(resourcePermissions, morePermissions);
            });
          }else{
            return resourcePermissions;
          }
        });
      });
    }
  };

  private async rolesResources(roles: IRoles){
    let _this = this;
    const rolesTmp = Common.makeArray(roles);

    return this.allRoles(rolesTmp).then(function(allRoles){
      let result = [];

      return bluebird.all(allRoles.map(function(role){
        return _this.store.get(_this.options.buckets.resources, role).then(function(resources){
          result = result.concat(resources);
        });
      })).then(function(){
        return result;
      });
    });
  };
}
