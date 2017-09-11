// @flow

interface Acl {

  constructor(backend: {}, logger: ?{}, options: ?{})

  // addUserRoles(userId, roles, cb)
  //
  // removeUserRoles(userId, roles, cb)
  //
  // userRoles(userId, cb)
  //
  // roleUsers(roleName, cb)
  //
  // hasRole(userId, rolename, cb)
  //
  // addRoleParents(role, parents, cb)
  //
  // removeRoleParents(role, parents, cb)
  //
  // removeRole(role, cb)
  //
  // removeResource(resource, cb)
  //
  // allow(roles, resources, permissions, cb)
  //
  // removeAllow(role, resources, permissions, cb)
  //
  // removePermissions(role, resources, permissions, cb)
  //
  // allowedPermissions(userId, resources, cb)
  //
  // optimizedAllowedPermissions(userId, resources, cb)
  //
  // isAllowed(userId, resource, permissions, cb)
  //
  // areAnyRolesAllowed(roles, resource, permissions, cb)
  //
  // whatResources(roles, permissions, cb)
  //
  // permittedResources(roles, permissions, cb)
  //
  // middleware(numPathComponents, userId, actions)
  //
  // _allowEx(objs)
  //
  // _rolesParents(roles)
  //
  // _allRoles(roleNames)
  //
  // _allUserRoles(userId)
  //
  // _rolesResources(roles)
  //
  // _resourcePermissions(roles, resource)
  //
  // _checkPermissions(roles, resource, permissions)

}
