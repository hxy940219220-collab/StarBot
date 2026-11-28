// window.starbot belongs in the application adapter.
export const documentation = "window.starbot";
export const viewport = () => window.innerWidth;
export const platformAction = (props: { starbot: () => void }) => props.starbot();
