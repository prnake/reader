import { Request, Response } from 'express';

export interface Ctx {
    req: Request;
    res: Response;
}

// Ctx decorator factory
export function Ctx(): ParameterDecorator {
    return (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
        // Parameter decorator for injecting context
    };
}