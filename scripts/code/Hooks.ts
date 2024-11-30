import type { IResourceHooks, MaybePromise, ResourceHookSharedData } from "./types/Hooks";

type HookHandlerData<T extends keyof IResourceHooks> = ResourceHookSharedData & {
    data: Parameters<IResourceHooks[T]>[0];
};

export type HookHandler<T extends keyof IResourceHooks> = (
    data: HookHandlerData<T>,
) => MaybePromise<ReturnType<IResourceHooks[T]>>;

export type HookResult<T extends keyof IResourceHooks> = {
    ctx: ResourceHookSharedData;
    returned: ReturnType<IResourceHooks[T]>;
};

export function createHook<E extends keyof IResourceHooks>(
    hookName: E,
    handler: HookHandler<E>,
): (data: HookHandlerData<E>) => Promise<HookResult<E>> {
    return async (data: HookHandlerData<E>) => {
        const ctx = { ...data };
        const result = await handler(ctx);

        return {
            ctx: {
                manifest: ctx.manifest,
                resourceName: ctx.resourceName,
                resourcePath: ctx.resourcePath,
                outputTarget: ctx.outputTarget,
                data: ctx.data,
            },
            returned: result,
        };
    };
}
