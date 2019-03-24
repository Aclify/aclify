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

export type IRolesObjectAllow = { resources: string; permissions: string; };
export type IRolesObjectAllows = { resources: string[]; permissions: string[]; };

export type IDemuxed = { roles: IRole | IRoles, resources: IResource | IResources, permissions: IPermission | IPermissions };

export type IRolesObject = { roles: string; allows: IRolesObjectAllow[] | IRolesObjectAllows[]; };
export type IRolesObjects = IRolesObject[];

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

export type IBucket = string


export interface IDynamicObject {
  [key: string]: any // tslint:disable-line no-any
}

export interface IAcl {
  store: IStore;
  options: IOptions;

}
