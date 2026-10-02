// The 5 N64 ocarina buttons, low to high: A D4, C▼ F4, C▶ A4, C◀ B4, C▲ D5
export const OCARINA_BUTTONS = [
	"A",
	"CDown",
	"CRight",
	"CLeft",
	"CUp",
] as const;

export type OcarinaButton = (typeof OCARINA_BUTTONS)[number];

// The order the controls are listed in: A, then the C buttons as the arrow
// keys sit, up above left, down, right
export const CONTROL_ORDER: readonly OcarinaButton[] = [
	"A",
	"CUp",
	"CLeft",
	"CDown",
	"CRight",
];

export const BUTTON_LABELS: Record<OcarinaButton, string> = {
	A: "A",
	CDown: "C down",
	CRight: "C right",
	CLeft: "C left",
	CUp: "C up",
};
