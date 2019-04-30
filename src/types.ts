import { RedisClient } from 'redis';

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

export interface IDynamicObject {
  [key: string]: any // tslint:disable-line no-any
}

export interface IRedisClientAsync extends RedisClient {
  endAsync: any; // tslint:disable-line no-any
  getAsync: any; // tslint:disable-line no-any
  sunionAsync: any; // tslint:disable-line no-any
  keysAsync: any; // tslint:disable-line no-any
  delAsync: any; // tslint:disable-line no-any
  smembersAsync: any; // tslint:disable-line no-any
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

export type IRolesObjectAllows = { resources: IResource | IResources; permissions: IPermission | IPermissions; };
export type IRolesObject = { roles: IRole | IRoles; allows: IRolesObjectAllows[] };
export type IRolesObjects = IRolesObject[];

export type IBucket = string

export type IDemuxed = { roles: IRole | IRoles, resources: IResource | IResources, permissions: IPermission | IPermissions };
