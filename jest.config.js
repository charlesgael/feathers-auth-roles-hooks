module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['src'],
    globals: {
        'ts-jest': {
            diagnostics: false,
            tsconfig: 'tsconfig.spec.json',
        },
    },
    collectCoverage: true,
    coveragePathIgnorePatterns: ['/node_modules/', '/src/__test__/'],
};
