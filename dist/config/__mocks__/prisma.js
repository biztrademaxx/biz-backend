"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
/**
 * Jest manual mock for Prisma — no real DB or PrismaClient construction in tests.
 * Any `prisma.<model>.<method>()` resolves to a jest.fn() unless overridden in a test.
 */
function modelDelegate() {
    return new Proxy({}, {
        get: () => jest.fn().mockResolvedValue(null),
    });
}
const mockPrisma = new Proxy({
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $on: jest.fn(),
    $transaction: jest.fn(async (arg) => {
        if (typeof arg === "function") {
            return arg({});
        }
        return [];
    }),
}, {
    get(target, prop) {
        if (typeof prop !== "string")
            return undefined;
        if (prop in target) {
            return target[prop];
        }
        return modelDelegate();
    },
});
exports.prisma = mockPrisma;
exports.default = mockPrisma;
