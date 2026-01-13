// Cloud function decorators - stub implementations
// These are re-exports from civkit or custom implementations

export function CloudHTTPv2(options: any) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        return descriptor;
    };
}

export function CloudTaskV2(options: any) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        return descriptor;
    };
}

export function CloudScheduleV2(schedule: string, options: any) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        return descriptor;
    };
}

export function Ctx() {
    return function (target: any, propertyKey: string, parameterIndex: number) {
        // Parameter decorator
    };
}

export function Param(nameOrOptions?: string | { default?: any; required?: boolean }) {
    return function (target: any, propertyKey: string, parameterIndex: number) {
        // Parameter decorator
    };
}

export function RPCReflect() {
    return function (target: any, propertyKey: string, parameterIndex: number) {
        // Parameter decorator
    };
}
