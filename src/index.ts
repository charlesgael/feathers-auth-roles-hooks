import { hooks as authHooks } from '@feathersjs/authentication';
import { AuthenticateHookSettings } from '@feathersjs/authentication/lib/hooks/authenticate';
import { Forbidden, NotAuthenticated } from '@feathersjs/errors';
import { Hook, HookContext, Params } from '@feathersjs/feathers';

const { authenticate } = authHooks;

interface MyContext extends HookContext {
    params: Params & {
        user: { [key: string]: any };
    };
}

interface AuthOptions {
    rolesGetter: (context: MyContext) => string[] | Promise<string[]>;
}

type SyncContextFunction<T> = (context: HookContext) => T;

export function auth(
    options: AuthOptions,
    originalSettings: string | AuthenticateHookSettings,
    ...originalStrategies: string[]
): Hook {
    return async (context) => {
        // authenticate using feathers
        await authenticate(originalSettings, ...originalStrategies).call(context.service, context);

        if (context.params.user) {
            context.params.roles = await Promise.resolve(options.rolesGetter(context as MyContext));
        } else if (context.params.provider !== undefined) {
            throw new NotAuthenticated(new Error('Not authenticated'));
        }

        return context;
    };
}

type ReqRolesOptions =
    | string
    | string[]
    | {
          every?: ReqRolesOptions;
          some?: ReqRolesOptions;
      };

const everyFn = (context: HookContext, reqRoles: ReqRolesOptions) =>
    hasRoleRec(reqRoles, true).call(context.service, context);

const someFn = (context: HookContext, reqRoles: ReqRolesOptions) =>
    hasRoleRec(reqRoles, false).call(context.service, context);

const hasRoleRec = (reqRoles: ReqRolesOptions, every: boolean) => (
    context: HookContext
): boolean => {
    const roles: string[] = context.params.roles || [];

    if (typeof reqRoles === 'string') {
        return roles.includes(reqRoles);
    }
    if (Array.isArray(reqRoles)) {
        if (every) return reqRoles.every((it) => roles.includes(it));
        return reqRoles.some((it) => roles.includes(it));
    }
    if (reqRoles.every) return everyFn(context, reqRoles.every);
    if (reqRoles.some) return someFn(context, reqRoles.some);

    // No conditions
    return true;
};

export const hasRole = (reqRoles: ReqRolesOptions = {}): SyncContextFunction<boolean> => {
    return (context) => {
        if (context.params.authenticated) {
            if (!context.params.provider) {
                return true;
            }
        }

        return hasRoleRec(reqRoles, true).call(context.service, context);
    };
};

export const reqRole = (reqRoles: ReqRolesOptions = {}): Hook => {
    return (context: HookContext) => {
        if (!hasRole(reqRoles).call(context.service, context)) {
            throw new Forbidden(new Error('Access forbidden'));
        }
    };
};
