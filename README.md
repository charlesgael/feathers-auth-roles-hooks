# feathers-auth-roles-hooks

A hook that helps login and manage roles with ease

`$ npm install feathers-auth-roles-hooks --save`

`feathers-auth-roles-hooks` contains 2 [Feathers hooks](https://docs.feathersjs.com/api/hooks.html) that allow: to login and query roles for the first, and to forbid access to user on a role based system for the latter.

It also contains a [Predicate](https://hooks-common.feathersjs.com/overview.html) for those using `feathers-hooks-common` (`iff`, `iffElse`, etc.)

## auth

The `auth` hook allows to login really similarly to the `authenticate` fonction of `@feathersjs/authentication` preceded by its own configuration object.

### Options

-   `rolesGetter` _required_ - The method used to get the roles of a particular user. It takes as parameter the `context: HookContext` and a `userId: number` and must return a `string[]` representing the roles for this user.

### Example

Login all access to a service and get roles for futher uses:

```js
const appAuth = auth(
    {
        // Simple case where roles is a text field in User containing roles separated by commas
        rolesGetter: async (context, userId) => {
            const user = context.app.service("users").get(userId);
            return user.roles.split(",") || [];
        },
    },
    "jwt"
);

app.service("service").hooks({
    before: {
        all: appAuth,
    },
});
```

## reqRole and hasRole

The `reqRole` hook and the `hasRole` predicate must be called **after** the `auth` hook since it will utilise the roles gathered by this one. `reqRole` will restrict access and throw `Forbidden`, whereas `hasRole` will return a boolean (can be used by `iff`, `iffElse`, etc. from [`feathers-hooks-common`](https://hooks-common.feathersjs.com/overview.html)). It is called with either a role (`string`), a list of roles (`string[]`), or a config object. By default, it works in `every` mode meaning that all roles must be there.

### Options

`reqRole` or `hasRole` can be called by multiple ways:

-   `reqRole('first')` meaning user must have role `first`.
-   `reqRole(['first', 'second'])` meaning user must have role `first` and `second`.
-   `reqRole({every: ['first', 'second']})` same as previous line.
-   `reqRole({some: ['first', 'second']})` meaning user must either have `first` or `second` (can have both).

# License

Copyright (c) 2021

Licensed under the [MIT license](https://github.com/charlesgael/feathers-auth-roles-hooks/blob/master/LICENSE).
