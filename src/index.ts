import { hooks as authHooks } from '@feathersjs/authentication';
import { AuthenticateHookSettings } from '@feathersjs/authentication/lib/hooks/authenticate';
import { Forbidden } from '@feathersjs/errors';
import { Hook, HookContext } from '@feathersjs/feathers';

const { authenticate } = authHooks;

interface AuthOptions {
    rolesGetter: <T = any>(context: HookContext<T>, userId: number) => string[] | Promise<string[]>;
}

export const auth = (
    options: AuthOptions,
    originalSettings: string | AuthenticateHookSettings,
    ...originalStrategies: string[]
): Hook => async (context) => {
    // authenticate using feathers
    await authenticate(originalSettings, ...originalStrategies).call(context.service, context);

    if (context.params.user) {
        context.params.roles = await Promise.resolve(
            options.rolesGetter(context, context.params.user.id)
        );
    }

    return context;
};

type ReqRolesOptions =
    | string
    | string[]
    | {
          every?: ReqRolesOptions;
          some?: ReqRolesOptions;
      };

const everyFn = <T = any>(context: HookContext<T>, reqRoles: ReqRolesOptions) =>
    hasRoleRec(reqRoles, true).call(context.service, context);

const someFn = <T = any>(context: HookContext<T>, reqRoles: ReqRolesOptions) =>
    hasRoleRec(reqRoles, false).call(context.service, context);

const hasRoleRec = (reqRoles: ReqRolesOptions, every: boolean) => <T = any>(
    context: HookContext<T>
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

export const hasRole = (reqRoles: ReqRolesOptions = {}) => <T = any>(
    context: HookContext<T>
): boolean => {
    if (context.params.authenticated) {
        if (!context.params.provider) {
            return true;
        }
    }

    return hasRoleRec(reqRoles, true).call(context.service, context);
};

export const reqRole = (reqRoles: ReqRolesOptions = {}) => <T = any>(context: HookContext<T>) => {
    if (!hasRole(reqRoles).call(context.service, context)) {
        throw new Forbidden(new Error('Access forbidden'));
    }
};
