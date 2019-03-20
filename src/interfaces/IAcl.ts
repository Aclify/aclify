import { IStore } from "./IStore";

export interface IOptions {
  buckets: {
    meta: string;
    parents: string;
    permissions: string;
    resources: string;
    roles: string;
    users: string;
  };
}

export type IRolesArray = [{ roles: string; allows: ({ resources: string; permissions: string; } | { resources: string[]; permissions: string[]; })[]; }]
export type IRoles = string | string[];
export type IParents = string | string[];
export type IResources = string | string[];
export type IPermissions = string | string[];
export type IUserId = string | number;

export type IUserRoles = string[];
export type IRole = string | number;
export type IResource = string;

export interface IAcl {
  store: IStore;
  options: IOptions;

  // /**
  //  * @description Create ACL class and promisify store methods.
  //  * @param store
  //  * @param options
  //  */
  constructor(store: IStore, options?: IOptions);
  //
  // /**
  //  * @description Adds roles to a given user id.
  //  * @param userId
  //  * @param roles
  //  */

  // contract(arguments)
  // .params('string|number','string|array','function')
  // .params('string|number','string|array')
  // .end();

  addUserRoles(userId: IUserId, roles: IRoles): Promise<void>;
  //
  // /**
  //  * @description Remove user with his associated roles.
  //  * @param userId
  //  */
  // removeUser(userId: string | number): Promise<void>;
  // /**
  //  * @description Remove roles from a given user.
  //  * @param userId
  //  * @param roles
  //  */
  // removeUserRoles(userId: string | number, roles: any): Promise<void>;
  //
  // /**
  //  * @description Return all the roles from a given user.
  //  * @param userId
  //  */
  userRoles(userId: IUserId): Promise<IUserRoles>;
  //
  // /**
  //  * @description Return all users who has a given role.
  //  * @param roleName
  //  */
  // roleUsers(roleName: string | number): any;
  //
  // /**
  //  * @description Return boolean whether user is in the role.
  //  * @param userId
  //  * @param rolename
  //  */
  // hasRole(userId: string | number, rolename: string | number): Promise<boolean>;
  //
  // /**
  //  * @description Adds a parent or parent list to role.
  //  * @param role
  //  * @param parents
  //  */
  // addRoleParents(role: string | number, parents: any): Promise<void>;
  //
  // /**
  //  * @description Removes a parent or parent list from role. If `parents` is not specified, removes all parents.
  //  * @param role
  //  * @param parents
  //  */
  // removeRoleParents(role: string, parents: any): Promise<void>;
  //
  // /**
  //  * @description Removes a role from the system.
  //  * @param role
  //  */
  // removeRole(role: string): Promise<void>
  //
  // /**
  //  * @description Removes a resource from the system.
  //  * @param resource
  //  */
  // removeResource(resource: string): Promise<void>
  //
  // /**
  //  * @description Remove all permissions.
  //  * @param role
  //  * @param resources
  //  * @param permissions
  //  */
  // removeAllow(role: string, resources: any, permissions: any): Promise<void>
  //
  // /**
  //  * @description Remove permissions from the given roles owned by the given role.
  //  * @param role
  //  * @param resources
  //  * @param permissions
  //  */
  // removePermissions(role: string, resources: string | Array, permissions: string | Array): Promise<void>;
  //
  // /**
  //  * @description Adds the given permissions to the given roles over the given resources.
  //  * @param roles
  //  * @param resources
  //  * @param permissions
  //  */

  // allow(roles: IRoles, resources: IResources, permissions: IPermissions): Promise<void>;

  //
  // /**
  //  * @description Returns all the allowable permissions a given user have to access the given resources.
  //  * It returns an array of objects where every object maps a resource name to a list of permissions for that resource.
  //  * @param userId
  //  * @param ressources
  //  * @returns {*}
  //  */
  // allowedPermissions(userId: string | number, ressources: any): any
  //
  // /**
  //  * @description Returns all the allowable permissions a given user have to access the given resources.
  //  * It returns a map of resource name to a list of permissions for that resource.
  //  * This is the same as allowedPermissions, it just takes advantage of the unions function if available to reduce
  //  * the number of store queries.
  //  * @param userId
  //  * @param resources
  //  * @returns {*}
  //  */
  // optimizedAllowedPermissions(userId: string | number, resources: any): any;
  //
  // /**
  //  * @description Checks if the given user is allowed to access the resource for the given permissions
  //  * (note: it must fulfill all the permissions).
  //  * @param userId
  //  * @param resource
  //  * @param permissions
  //  */
  // isAllowed(userId: string | number, resource: string, permissions: any): Promise<boolean>
  // /**
  //  * @description Returns true if any of the given roles have the right permissions.
  //  * @param roles
  //  * @param resource
  //  * @param permissions
  //  */
  // areAnyRolesAllowed(roles: any, resource: string, permissions: any): Promise<boolean>
  //
  // /**
  //  * @description Returns what resources a given role or roles have permissions over.
  //  * @param roles
  //  * @param permissions
  //  * @returns {Array}
  //  */
  // whatResources(roles: any, permissions: any): any;
  //
  // /**
  //  * @description Returns permitted resources.
  //  * @param roles
  //  * @param permissions
  //  */
  // permittedResources(roles: any, permissions: any): any;
  //
  // /**
  //  * @description Same as allow but accepts a more compact input.
  //  * @param objs
  //  */
  // allowEx(objs): any;
  //
  // /**
  //  * @description Returns the parents of the given roles.
  //  * @param roles
  //  * @returns {*}
  //  */
  // rolesParents(roles): any;
  //
  // /**
  //  * @description Return all roles in the hierarchy including the given roles.
  //  * @param roleNames
  //  * @returns {Promise}
  //  */
  // allRoles(roleNames): any;
  //
  // /**
  //  * @description Return all roles in the hierarchy of the given user.
  //  * @param userId
  //  * @returns {Promise}
  //  */
  // allUserRoles(userId): Promise<[any]>;
  //
  // /**
  //  * @description Returns an array with resources for the given roles.
  //  * @param roles
  //  * @returns {Promise}
  //  */
  // rolesResources(roles): Promise<[any]>;
  //
  // /**
  //  * @description Returns the permissions for the given resource and set of roles.
  //  * @param roles
  //  * @param resource
  //  * @returns {*}
  //  */
  // resourcePermissions(roles, resource): Promise<[any]>;
  //
  // /**
  //  * @description This function will not handle circular dependencies and result in a crash.
  //  * @param roles
  //  * @param resource
  //  * @param permissions
  //  * @returns {Promise}
  //  */
  // checkPermissions(roles, resource, permissions): Promise<boolean>;
}
