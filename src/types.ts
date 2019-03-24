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

export type IRolesObjectAllow = { resources: IResource; permissions: IPermission; };
export type IRolesObjectAllows = { resources: IResources; permissions: IPermissions; };
export type IRolesObject = { roles: IRole | IRoles; allows: (IRolesObjectAllow | IRolesObjectAllows)[] };
export type IRolesObjects = IRolesObject[];

export type IBucket = string

export type IDemuxed = { roles: IRole | IRoles, resources: IResource | IResources, permissions: IPermission | IPermissions };

export interface IDynamicObject {
  [key: string]: any // tslint:disable-line no-any
}
