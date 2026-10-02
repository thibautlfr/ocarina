import Experience from "../experience.ts";

// Volume of each menu sound, by resource name
const MENU_SOUND_VOLUME = {
	menuOpen: 0.55,
	menuClose: 0.55,
	menuSelect: 0.4,
} as const;

export type MenuSound = keyof typeof MENU_SOUND_VOLUME;

// Silent until the resources are loaded
export const playMenuSound = (name: MenuSound) => {
	const { sampler, resources } = Experience.getInstance();
	if (!sampler.isReady) return;
	sampler.playOneShot(
		resources.get<AudioBuffer>(name),
		sampler.currentTime,
		MENU_SOUND_VOLUME[name],
	);
};
