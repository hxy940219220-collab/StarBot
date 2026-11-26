import { switchPreference } from "./secure-preference";

const preference = switchPreference("starbot.mobile.fullVisualPreviews.v1", false);

export const useFullVisualPreference = preference.store;
export const loadFullVisualPreference = preference.load;
export const saveFullVisualPreference = preference.save;
