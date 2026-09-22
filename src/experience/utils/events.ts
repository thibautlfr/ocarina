import type { Emitter, EventType, Handler } from "mitt";

// Subscribes `handler` to `type` and returns the matching unsubscribe
export const listen = <
	Events extends Record<EventType, unknown>,
	Key extends keyof Events,
>(
	emitter: Emitter<Events>,
	type: Key,
	handler: Handler<Events[Key]>,
) => {
	emitter.on(type, handler);
	return () => emitter.off(type, handler);
};
