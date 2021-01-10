import * as local from '@feathersjs/authentication-local';
import configuration from '@feathersjs/configuration';
import feathers, {
    HooksObject,
    ServiceAddons,
    ServiceMethods,
    Application as FApplication,
} from '@feathersjs/feathers';
import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication';
import { expressOauth } from '@feathersjs/authentication-oauth';
import { auth, reqRole } from '../index';

const { hashPassword } = local.hooks;

// A mapping of service names to types. Will be extended in service files.
interface ServiceTypes {
    authentication: AuthenticationService & ServiceAddons<any>;
    users: ServiceMethods<any> & ServiceAddons<any>;
    test1: ServiceMethods<any> & ServiceAddons<any>;
    test2: ServiceMethods<any> & ServiceAddons<any>;
}
// The application instance type that will be used everywhere else
interface Application extends FApplication<ServiceTypes> {}

describe('hooks.authentication', () => {
    const internalReq = {
        authenticated: true,
    };
    const userReq = {
        authenticated: true,
        provider: 'rest',
        user: { id: 1 },
    };

    let user: any = undefined;
    let roles: string[] = [];

    // Options for feathers authentication module
    const app: Application = feathers();

    app.configure(configuration());

    const authentication = new AuthenticationService(app);

    authentication.register('jwt', new JWTStrategy());
    authentication.register('local', new local.LocalStrategy());

    app.use('/authentication', authentication);
    app.configure(expressOauth());

    app.use('/users', {
        async find() {
            if (user) return [user] as unknown[];
            return [];
        },
        async create(data) {
            user = data;
        },
    });

    app.service('users').hooks(<HooksObject>{
        before: {
            create: hashPassword('password'),
        },
    });

    app.use('/test1', {
        async find() {
            return true;
        },
        async get() {
            return true;
        },
        async create() {
            return true;
        },
        async update() {
            return true;
        },
        async patch() {
            return true;
        },
        async remove() {
            return true;
        },
    });

    app.service('test1').hooks(<HooksObject>{
        before: {
            all: auth(
                {
                    rolesGetter: () => {
                        return roles;
                    },
                },
                'jwt'
            ),
            get: reqRole('first'),
            create: reqRole(['first', 'second']),
            update: reqRole({ every: 'first' }),
            patch: reqRole({ some: ['first', 'second'] }),
            remove: reqRole(),
        },
        after: (context) => {
            if (context.result) {
                context.result = context.params.roles;
            }
        },
    });

    app.use('/test2', {
        async find() {
            return true;
        },
    });

    app.service('test2').hooks(<HooksObject>{
        before: {
            find: reqRole('first'),
        },
    });

    describe('unknown queries', () => {
        beforeAll(async () => {
            user = null;
        });

        it("doesn't work", async () => {
            try {
                await app.service('test2').find({
                    authenticated: false,
                });
                fail();
            } catch (e) {}

            try {
                await app.service('test2').find({
                    authenticated: false,
                    provider: 'rest',
                });
                fail();
            } catch (e) {}
        });
    });

    describe('internal queries', () => {
        beforeAll(async () => {
            user = null;
        });

        it("logs in but doesn't add any roles", async () => {
            const res = await app.service('test1').find(internalReq);

            // roles undefined
            expect(res).toBeFalsy();
        });

        it("doesn't prevent from calling routes protected by roles", async () => {
            const res = await app.service('test1').get(1, internalReq);

            // roles undefined
            expect(res).toBeFalsy();
        });
    });

    describe('external queries', () => {
        beforeAll(async () => {
            user = { name: 'user' };
        });

        it("get user's roles using accessor", async () => {
            roles = [];
            const res1 = await app.service('test1').find(userReq);

            expect(Array.isArray(res1)).toBeTruthy();
            expect(res1.length).toBeFalsy();

            roles = ['first'];
            const res2 = await app.service('test1').find(userReq);

            expect(Array.isArray(res2)).toBeTruthy();
            expect(res2).toStrictEqual(['first']);
        });

        it('test role presence with single string option', async () => {
            roles = [];
            try {
                await app.service('test1').get(1, userReq);
                fail();
            } catch (e) {}

            roles = ['first'];
            await app.service('test1').get(1, userReq);
        });

        it('test role presence with string[] option', async () => {
            roles = [];
            try {
                await app.service('test1').create({}, userReq);
                fail();
            } catch (e) {}

            roles = ['first', 'second'];
            await app.service('test1').create({}, userReq);
        });

        it('test role presence with every(string) option', async () => {
            roles = [];
            try {
                await app.service('test1').update(1, {}, userReq);
                fail();
            } catch (e) {}

            roles = ['first', 'second'];
            await app.service('test1').update(1, {}, userReq);
        });

        it('test role presence with some(string) option', async () => {
            roles = [];
            try {
                await app.service('test1').patch(1, {}, userReq);
                fail();
            } catch (e) {}

            roles = ['first'];
            await app.service('test1').patch(1, {}, userReq);

            roles = ['second'];
            await app.service('test1').patch(1, {}, userReq);

            roles = ['third'];
            try {
                await app.service('test1').patch(1, {}, userReq);
                fail();
            } catch (e) {}
        });

        it('test role presence with no option', async () => {
            roles = [];
            await app.service('test1').remove(1, userReq);

            roles = ['first'];
            await app.service('test1').remove(1, userReq);
        });
    });
});
