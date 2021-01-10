import { hooks as authHooks } from '@feathersjs/authentication';
import { AuthenticateHookSettings } from '@feathersjs/authentication/lib/hooks/authenticate';
import { Forbidden } from '@feathersjs/errors';
import { Hook, HookContext as FHookContext, Service } from '@feathersjs/feathers';

const { authenticate } = authHooks;

interface HookContext extends FHookContext<any, Service<any>> {}

interface AuthOptions {
    rolesGetter: (context: HookContext, userId: number) => string[] | Promise<string[]>;
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

export const hasRole = (reqRoles: ReqRolesOptions = {}) => (context: HookContext): boolean => {
    if (context.params.authenticated) {
        if (!context.params.provider) {
            return true;
        }
    }

    return hasRoleRec(reqRoles, true).call(context.service, context);
};

export const reqRole = (reqRoles: ReqRolesOptions = {}) => (context: HookContext) => {
    if (!hasRole(reqRoles).call(context.service, context)) {
        throw new Forbidden(new Error('Access forbidden'));
    }
};
