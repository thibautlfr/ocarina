// localStorage can be unavailable (private mode, blocked site data): reads
// then return an empty object, and writes only last for the session

export const loadJson = (key: string): Record<string, unknown> => {
	try {
		const value = JSON.parse(localStorage.getItem(key) ?? "{}");
		return typeof value === "object" && value !== null ? value : {};
	} catch {
		return {};
	}
};

export const saveJson = (key: string, value: unknown) => {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Not persisted, still applied for this session
	}
};
