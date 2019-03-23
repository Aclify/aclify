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

export type IRolesArray = { roles: string; allows: ({ resources: string; permissions: string; } | { resources: string[]; permissions: string[]; })[]; }[]

export type IRolesParent = string;
export type IRolesParents = IRolesParent[];

export type IUserId = string | number;
export type IUserIds = IUserId[];


export type IUserRoles = string[];

export type IResource = string;
export type IResources = IResource[];

export type IRole = string;
export type IRoles = IRole[];

export type IPermission = string;
export type IPermissions = IPermission[];


export interface IDynamicObject {
  [key: string]: any // tslint:disable-line no-any
}

export interface IAcl {
  store: IStore;
  options: IOptions;

}
