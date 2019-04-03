# @aclify/aclify

[![Aclify](media/header.png)](https://github.com/Aclify) 

[![Dependencies][prod-dependencies-badge]][prod-dependencies]
[![Coverage][coverage-badge]][coverage]
[![Build Status][travis-badge]][travis-ci]
[![MIT License][license-badge]][LICENSE]
[![PRs Welcome][prs-badge]][prs]

## Description

This module provides a Node Access Control Lists implementation inspired by Zend_ACL and node_acl package.

When you develop a web site or application you will soon notice that sessions are not enough to protect all the
available resources. Avoiding that malicious users access other users content proves a much more
complicated task than anticipated. ACL can solve this problem in a flexible and elegant way.

Create roles and assign roles to users. Sometimes it may even be useful to create one role per user,
to get the finest granularity possible, while in other situations you will give the *asterisk* permission
for admin kind of functionality.

## Install
```
$ npm install @aclify/aclify --save
```

## Features

- Users
- Roles
- Hierarchies
- Resources
- Express middleware for protecting resources.
- Robust implementation with good unit test coverage.

## Documentation

* [addUserRoles](#addUserRoles)
* [removeUserRoles](#removeUserRoles)
* [removeUser](#removeUser)
* [userRoles](#userRoles)
* [roleUsers](#roleUsers)
* [hasRole](#hasRole)
* [addRoleParents](#addRoleParents)
* [removeRoleParents](#removeRoleParents)
* [removeRole](#removeRole)
* [removeResource](#removeResource)
* [allow](#allow)
* [removeAllow](#removeAllow)
* [allowedPermissions](#allowedPermissions)
* [isAllowed](#isAllowed)
* [areAnyRolesAllowed](#areAnyRolesAllowed)
* [whatResources](#whatResources)
* [middleware](#middleware)
* [store](#store)

## Stores

Aclify offers several possibilities to store your data:

  - Memory
  - Redis
  - MongoDB
  - Sequelize (mysql, mssql, sqlite or postgresql)


## Examples

Create your acl module by requiring it and instantiating it with a valid store instance:


**From import**
```javascript
import {Acl, RedisStore, MemoryStore, MongoDBStore, SequelizeStore} from '@aclify/aclify'

// Using Redis store
acl = new Acl(new RedisStore(RedisClient, {prefix: 'acl_'}));

// Or Using the Memory store
acl = new Acl(new MemoryStore());

// Or Using the MongoDB store
acl = new Acl(new MongoDBStore(db, {prefix: 'acl_'}));

// Or Using a Sequelize store (mysql, mssql, sqlite or postgresql)
acl = new Acl(new SequelizeStore(db, {prefix: 'acl_'}));
```

**From require**
```javascript
const aclify = require('@aclify/aclify');

// Using Redis store
acl = new aclify.Acl(new aclify.RedisStore(RedisClient, {prefix: 'acl_'}));

// Or Using the Memory store
acl = new aclify.Acl(new aclify.MemoryStore());

// Or Using the MongoDB store
acl = new aclify.Acl(new aclify.MongoDBStore(db, {prefix: 'acl_'}));

// Or Using a Sequelize store (mysql, mssql, sqlite or postgresql)
acl = new aclify.Acl(new aclify.SequelizeStore(db, {prefix: 'acl_'}));
```

All the following functions return a promise or optionally take a callback with
an err parameter as last parameter. We omit them in the examples for simplicity.

Create roles implicitly by giving them permissions:

```javascript
// guest is allowed to view blogs
acl.allow('guest', 'blogs', 'view')

// allow function accepts arrays as any parameter
acl.allow('member', 'blogs', ['edit', 'view', 'delete'])
```

Users are likewise created implicitly by assigning them roles:

```javascript
acl.addUserRoles('joed', 'guest')
```

Hierarchies of roles can be created by assigning parents to roles:

```javascript
acl.addRoleParents('baz', ['foo', 'bar'])
```

Note that the order in which you call all the functions is irrelevant (you can add parents first and assign permissions to roles later)

```javascript
acl.allow('foo', ['blogs', 'forums', 'news'], ['view', 'delete'])
```

Use the wildcard to give all permissions:

```javascript
acl.allow('admin', ['blogs', 'forums'], '*')
```

Sometimes is necessary to set permissions on many different roles and resources. This would
lead to unnecessary nested callbacks for handling errors. Instead use the following:

```javascript
acl.allow([
    {
        roles:['guest', 'member'],
        allows:[
            {resources:'blogs', permissions:'get'},
            {resources:['forums', 'news'], permissions:['get', 'put', 'delete']}
        ]
    },
    {
        roles:['gold', 'silver'],
        allows:[
            {resources:'cash', permissions:['sell', 'exchange']},
            {resources:['account', 'deposit'], permissions:['put', 'delete']}
        ]
    }
])
```

You can check if a user has permissions to access a given resource with *isAllowed*:

```javascript
acl.isAllowed('joed', 'blogs', 'view', function(err, res){
    if(res){
        console.log("User Joed is allowed to view blogs")
    }
})
```


Of course arrays are also accepted in this function:

```javascript
acl.isAllowed('jsmith', 'blogs', ['edit', 'view', 'delete'])
```

Note that all permissions must be fulfilled in order to get *true*.


Sometimes is necessary to know what permissions a given user has over certain resources:

```javascript
acl.allowedPermissions('james', ['blogs', 'forums'], function(err, permissions){
    console.log(permissions)
})
```

It will return an array of resource:[permissions] like this:

```javascript
[{'blogs' : ['get', 'delete']},
 {'forums':['get', 'put']}]
```


Finally, we provide a middleware for Express for easy protection of resources.

```javascript
acl.middleware()
```

We can protect a resource like this:

```javascript
app.put('/blogs/:id', acl.middleware(), function(req, res, next){…}
```

The middleware will protect the resource named by *req.url*, pick the user from *req.session.userId* and check the permission for *req.method*, so the above would be equivalent to something like this:

```javascript
acl.isAllowed(req.session.userId, '/blogs/12345', 'put')
```

The middleware accepts 3 optional arguments, that are useful in some situations. For example, sometimes we
cannot consider the whole url as the resource:

```javascript
app.put('/blogs/:id/comments/:commentId', acl.middleware(3), function(req, res, next){…}
```

In this case the resource will be just the three first components of the url (without the ending slash).

It is also possible to add a custom userId or check for other permissions than the method:

```javascript
app.put('/blogs/:id/comments/:commentId', acl.middleware(3, 'joed', 'post'), function(req, res, next){…}
```

## Methods

<a name="addUserRoles"/>

### addUserRoles( userId, roles, function(err) )

Adds roles to a given user id.

__Arguments__

```javascript
    userId   {String|Number} User id.
    roles    {String|Array} Role(s) to add to the user id.
    callback {Function} Callback called when finished.
```

---------------------------------------

<a name="removeUser"/>

### removeUser( userId, function(err) )

Remove user.

__Arguments__

```javascript
    userId   {String|Number} User id.
    callback {Function} Callback called when finished.
```

---------------------------------------

<a name="removeUserRoles"/>

### removeUserRoles( userId, roles, function(err) )

Remove roles from a given user.

__Arguments__

```javascript
    userId   {String|Number} User id.
    roles    {String|Array} Role(s) to remove to the user id.
    callback {Function} Callback called when finished.
```

---------------------------------------

<a name="userRoles" />

### userRoles( userId, function(err, roles) )

Return all the roles from a given user.

__Arguments__

```javascript
    userId   {String|Number} User id.
    callback {Function} Callback called when finished.
```

---------------------------------------

<a name="roleUsers" />

### roleUsers( rolename, function(err, users) )

Return all users who has a given role.

__Arguments__

```javascript
    rolename   {String|Number} User id.
    callback {Function} Callback called when finished.
```

---------------------------------------

<a name="hasRole" />

### hasRole( userId, rolename, function(err, hasRole) )

Return boolean whether user has the role

__Arguments__

```javascript
    userId   {String|Number} User id.
    rolename {String|Number} role name.
    callback {Function} Callback called when finished.
```

---------------------------------------

<a name="addRoleParents" />

### addRoleParents( role, parents, function(err) )

Adds a parent or parent list to role.

__Arguments__

```javascript
    role     {String} Child role.
    parents  {String|Array} Parent role(s) to be added.
    callback {Function} Callback called when finished.
```

---------------------------------------

<a name="removeRoleParents" />

### removeRoleParents( role, parents, function(err) )

Removes a parent or parent list from role.

If `parents` is not specified, removes all parents.

__Arguments__

```javascript
    role     {String} Child role.
    parents  {String|Array} Parent role(s) to be removed [optional].
    callback {Function} Callback called when finished [optional].
```

---------------------------------------

<a name="removeRole" />

### removeRole( role, function(err) )

Removes a role from the system.

__Arguments__

```javascript
    role     {String} Role to be removed
    callback {Function} Callback called when finished.
```

---------------------------------------

<a name="removeResource" />

### removeResource( resource, function(err) )

Removes a resource from the system

__Arguments__

```javascript
    resource {String} Resource to be removed
    callback {Function} Callback called when finished.
```

---------------------------------------

<a name="allow" />

### allow( roles, resources, permissions, function(err) )

Adds the given permissions to the given roles over the given resources.

__Arguments__

```javascript
    roles       {String|Array} role(s) to add permissions to.
    resources   {String|Array} resource(s) to add permisisons to.
    permissions {String|Array} permission(s) to add to the roles over the resources.
    callback    {Function} Callback called when finished.
```

### allow( permissionsArray, function(err) )

__Arguments__

```javascript
    permissionsArray {Array} Array with objects expressing what permissions to give.
       [{roles:{String|Array}, allows:[{resources:{String|Array}, permissions:{String|Array}]]

    callback         {Function} Callback called when finished.
```

---------------------------------------

<a name="removeAllow" />

###  removeAllow( role, resources, permissions, function(err) )

Remove permissions from the given roles owned by the given role.

Note: we loose atomicity when removing empty role_resources.

__Arguments__

```javascript
    role        {String}
    resources   {String|Array}
    permissions {String|Array}
    callback    {Function}
```

---------------------------------------

<a name="allowedPermissions" />

### allowedPermissions( userId, resources, function(err, obj) )

Returns all the allowable permissions a given user have to
access the given resources.

It returns an array of objects where every object maps a
resource name to a list of permissions for that resource.

__Arguments__

```javascript
    userId    {String|Number} User id.
    resources {String|Array} resource(s) to ask permissions for.
    callback  {Function} Callback called when finished.
```

---------------------------------------

<a name="isAllowed" />

### isAllowed( userId, resource, permissions, function(err, allowed) )

Checks if the given user is allowed to access the resource for the given
permissions (note: it must fulfill all the permissions).

__Arguments__

```javascript
    userId      {String|Number} User id.
    resource    {String} resource to ask permissions for.
    permissions {String|Array} asked permissions.
    callback    {Function} Callback called with the result.
```

---------------------------------------
<a name="areAnyRolesAllowed" />

### areAnyRolesAllowed( roles, resource, permissions, function(err, allowed) )

Returns true if any of the given roles have the right permissions.

__Arguments__

```javascript
    roles       {String|Array} Role(s) to check the permissions for.
    resource    {String} resource to ask permissions for.
    permissions {String|Array} asked permissions.
    callback    {Function} Callback called with the result.
```

---------------------------------------
<a name="whatResources" />

### whatResources(role, function(err, {resourceName: [permissions]})

Returns what resources a given role has permissions over.

__Arguments__

```javascript
    role        {String|Array} Roles
    callback    {Function} Callback called with the result.
```

whatResources(role, permissions, function(err, resources) )

Returns what resources a role has the given permissions over.

__Arguments__

```javascript
    role        {String|Array} Roles
    permissions {String|Array} Permissions
    callback    {Function} Callback called with the result.
```

---------------------------------------

<a name="middleware" />

### middleware( [numPathComponents, userId, permissions] )

Middleware for express.

To create a custom getter for userId, pass a function(req, res) which returns the userId when called (must not be async).

__Arguments__

```javascript
    numPathComponents {Number} number of components in the url to be considered part of the resource name.
    userId            {String|Number|Function} the user id for the acl system (defaults to req.session.userId)
    permissions       {String|Array} the permission(s) to check for (defaults to req.method.toLowerCase())
```

---------------------------------------

Creates a new Redis store using Redis client `client`.

## Tests

    $ npm run docker:run:test

## Scripts

Run using npm run <script> command.

    clean - remove coverage data, Jest cache and transpiled files.
    lint - lint source files and tests.
    typecheck - check type annotations.
    test -  run tests into docker-compose.
    test:coverage - run tests without coverage.
    build - compile source files.

## License

MIT © [Dimitri DO BAIRRO](https://github.com/Aclify/aclify/blob/master/LICENSE)

[prod-dependencies-badge]: https://david-dm.org/Aclify/aclify/status.svg
[prod-dependencies]: https://david-dm.org/Aclify/aclify
[coverage-badge]: https://codecov.io/gh/Aclify/aclify/branch/master/graph/badge.svg
[coverage]: https://codecov.io/gh/Aclify/aclify
[node_acl]: https://github.com/OptimalBits/node_acl
[travis-badge]: https://travis-ci.org/Aclify/aclify.svg?branch=master
[travis-ci]: https://travis-ci.org/Aclify/aclify
[license-badge]: https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square
[license]: https://github.com/Aclify/aclify/blob/master/LICENSE
[prs-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square
[prs]: http://makeapullrequest.com