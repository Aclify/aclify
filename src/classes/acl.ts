import { extend, intersection, isFunction, isObject, union } from "lodash";
import { IDynamicObject, IOptions, IPermission, IPermissions, IResource, IResources, IRole, IRoles, IRolesArray, IRolesParent, IRolesParents, IUserId, IUserIds, IUserRoles } from "../interfaces/IAcl";
import { IStore } from "../interfaces/IStore";
import { Common } from "./common";

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

  public async allow(roles: IRole | IRoles | IRolesArray, resources?: IResource | IResources, permissions?: IPermission | IPermissions): Promise<void> {
    if(arguments.length === 1) {
      return this.allowEx(roles as IRolesArray);
    }

    const rolesTmp = Common.MAKE_ARRAY(roles as IRole|IRoles);
    const resourcesTmp = Common.MAKE_ARRAY(resources);

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
    const rolesParams = await Common.MAKE_ARRAY(roles);

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

  public async roleUsers(roleName: IRole): Promise<IUserIds> {
    return this.store.get(this.options.buckets.roles, roleName);
  }

  public async addRoleParents(role: IRole, parents: IRolesParent | IRolesParents): Promise<void> {
    this.store.begin();
    this.store.add(this.options.buckets.meta, 'roles', role);
    this.store.add(this.options.buckets.parents, role, parents);

    return this.store.end();
  }

  public async isAllowed(userId: IUserId, resource: IResource, permissions: IPermission | IPermissions): Promise<boolean> {
    const roles = await this.store.get(this.options.buckets.users, userId);

    if (roles.length) {
      return this.areAnyRolesAllowed(roles, resource, permissions);
    }

    return false;
  }

  public async areAnyRolesAllowed(roles: IRole | IRoles, resource: IResource, permissions: IPermission | IPermissions): Promise<boolean> {
    const rolesParam = Common.MAKE_ARRAY(roles);
    const permissionsParam = Common.MAKE_ARRAY(permissions);

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

  public async allowedPermissions(userId: IUserId, resources: IResource | IResources): Promise<IDynamicObject> {
    if (this.store.unions) {
      return this.optimizedAllowedPermissions(userId, resources);
    }

    const _this = this;
    const resourcesTmp = Common.MAKE_ARRAY(resources);

    return _this.userRoles(userId).then(function(roles){
      const result = {};

      return Promise.all(resourcesTmp.map(function(resource){
        return _this.resourcePermissions(roles, resource).then(function(permissions){
          result[resource] = permissions;
        });
      })).then(function(){
        return result;
      });
    })
  };

  public async optimizedAllowedPermissions(userId: IUserId, resources: IResource | IResources): Promise<IDynamicObject> {
    const resourcesTmp = Common.MAKE_ARRAY(resources);
    const self = this;

    return this.allUserRoles(userId)
      .then((roles) => {
        const buckets = resourcesTmp.map(this.allowsBucket, this);

        if (roles.length === 0) {
          const emptyResult = {};
          buckets.forEach(function(bucket) {
            emptyResult[bucket] = [];
          });

          return emptyResult;
        }

        return self.store.unions(buckets, roles);
      }).then((response) => {
        const result = {};
        Object.keys(response).forEach(function(bucket) {
          result[this.keyFromAllowsBucket(bucket)] = response[bucket];
        }, this);

        return result;
      })
  };

  public async whatResources(roles: IRole | IRoles, permissions?: IPermission | IPermissions): Promise<IDynamicObject> {
    let permissionsTmp = permissions;
    roles = Common.MAKE_ARRAY(roles);

    if(permissions !== undefined){
      permissionsTmp = Common.MAKE_ARRAY(permissionsTmp);
      return this.permittedResources(roles, permissionsTmp);
    }

    return this.permittedResources(roles);

    // return this.permittedResources(roles, permissionsTmp);
  };

  public async permittedResources(roles: IRoles, permissions?: IPermission | IPermissions): Promise<IResources> {
    const _this = this;
    // const result = [];
    const result = permissions === undefined ? {} : [];

    const rolesTmp = Common.MAKE_ARRAY(roles);

    return this.rolesResources(rolesTmp)
      .then(function(resources: IResources){
        return Promise.all(resources.map(function(resource: IResource){
          return _this.resourcePermissions(rolesTmp, resource).then(function(p){

            if(Array.isArray(result)){
              const commonPermissions = intersection(permissions, p);
              if(commonPermissions.length>0){
                result.push(resource);
              }
            } else{
              result[resource] = p;
            }
          });
        })).then(function(){
          if(isObject(result)) {
            const resultArray = [];
            Object.entries(result).forEach((item) => resultArray[item[0]] = item[1]);
            return resultArray;
          }

          return result;
        });
      });
  }

  public async removeAllow(role: IRole, resources: IResource | IResources, permissions: IPermission | IPermissions): Promise<void> {

    const resourcesTmp = Common.MAKE_ARRAY(resources);

    if(permissions && !isFunction(permissions)){
      permissions = Common.MAKE_ARRAY(permissions);
    }else {
      permissions = null;
    }

    return this.removePermissions(role, resourcesTmp, permissions);
  }

  public async removePermissions(role: IRole, resources: IResource | IResources, permissions: IPermission | IPermissions): Promise<void> {
    const _this = this;

    const resourcesTmp = Common.MAKE_ARRAY(resources);
    const permissionsTmp = Common.MAKE_ARRAY(permissions);


    _this.store.begin();
    resourcesTmp.forEach(async function(resource){
      const bucket = this.allowsBucket(resource);
      if(permissionsTmp){
        await _this.store.remove(bucket, role, permissionsTmp);
      }else{
        await _this.store.del(bucket, role);
        await _this.store.remove(_this.options.buckets.resources, role, resource);
      }
    }, this);

    // Remove resource from role if no rights for that role exists.
    // Not fully atomic...
    return _this.store.end().then(function(){
      _this.store.begin();

      return Promise.all(resourcesTmp.map(function(resource){
        const bucket = _this.allowsBucket(resource);

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

  public async removeRole(role: IRole): Promise<void> {
    // contract(arguments)
    //   .params('string','function')
    //   .params('string').end();
    //
    const _this = this;

    // Note that this is not fully transactional.
    return this.store.get(this.options.buckets.resources, role).then(async(resources) => {
      _this.store.begin();

      resources.forEach(function(resource){
        const bucket = this.allowsBucket(resource);
        _this.store.del(bucket, role);
      }, this);

      await _this.store.del(this.options.buckets.resources, role);
      await _this.store.del(this.options.buckets.parents, role);
      await _this.store.del(this.options.buckets.roles, role);
      await _this.store.remove(this.options.buckets.meta, 'roles', role);

      return _this.store.end();
    });
  }

  public removeRoleParents(role: IRole, parents?: IRolesParent | IRolesParents): Promise<void> {
    if (isFunction(parents)) {
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

  public async removeResource(resource: IResource): Promise<void> {
    const _this = this;

    return this.store.get(this.options.buckets.meta, 'roles').then(function(roles){
      _this.store.begin();
      _this.store.del(_this.allowsBucket(resource), roles);
      roles.forEach(function(role){
        _this.store.remove(_this.options.buckets.resources, role, resource);
      });

      return _this.store.end();
    });
  }

  public async removeUserRoles(userId: IUserId, roles: IRole | IRoles): Promise<void>{
    this.store.begin();
    this.store.remove(this.options.buckets.users, userId, roles);

    if (Array.isArray(roles)) {
      const _this = this;

      roles.forEach(function(role) {
        _this.store.remove(_this.options.buckets.roles, role, userId);
      });
    }
    else {
      this.store.remove(this.options.buckets.roles, roles, userId);
    }

    return this.store.end();
  }

  private async allUserRoles(userId: IUserId): Promise<IRoles> {
    const _this = this;

    const roles = await this.userRoles(userId);

    if (roles && roles.length > 0) {
      return _this.allRoles(roles);
    } else {
      return [];
    }
  };

  private async allRoles(roleNames): Promise<IRoles> {
    const _this = this;

    return this.rolesParents(roleNames).then(function(parents){
      if(parents.length > 0){
        return _this.allRoles(parents).then(function(parentRoles){
          return union(roleNames, parentRoles);
        });
      }else{
        return roleNames;
      }
    });
  };

  private async rolesParents(roles: IRoles): Promise<IRolesParents> {
    return this.store.union(this.options.buckets.parents, roles);
  };

  private async allowEx(objs: IRolesArray) {
    // const objsTmp = await Common.MAKE_ARRAY(objs);
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

    return demuxed.reduce((_values, obj) => {
      return this.allow(obj.roles, obj.resources, obj.permissions);
    }, null);
  };

  private async resourcePermissions(roles: IRoles, resource: IResource): Promise<IPermissions> {
    const _this = this;
    const rolesTmp = Common.MAKE_ARRAY(roles);

    if(rolesTmp.length===0){
      return [];
    } else{
      return this.store.union(this.allowsBucket(resource), rolesTmp).then(function(resourcePermissions){
        return _this.rolesParents(rolesTmp).then(function(parents){
          if(parents && parents.length){
            return _this.resourcePermissions(parents, resource).then(function(morePermissions){
              return union(resourcePermissions, morePermissions);
            });
          }else{
            return resourcePermissions;
          }
        });
      });
    }
  };

  private async rolesResources(roles: IRole | IRoles): Promise<IResources> {
    const _this = this;
    const rolesTmp = Common.MAKE_ARRAY(roles);

    return this.allRoles(rolesTmp).then(function(allRoles){
      let result = [];

      return Promise.all(allRoles.map(function(role){
        return _this.store.get(_this.options.buckets.resources, role).then(function(resources){
          result = result.concat(resources);
        });
      })).then(function(){
        return result;
      });
    });
  };
}
