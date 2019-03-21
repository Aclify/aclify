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



export type IParents = string | string[];

export type IUserId = string | number;

export type IUserRoles = string[];

export type IResource = string;
export type IResources = IResource[];

export type IRole = string;
export type IRoles = IRole[];

export type IPermissions = string | string[];


export interface IAcl {
  store: IStore;
  options: IOptions;

}
