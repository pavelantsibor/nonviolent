import intro from "./modules/intro.js";
import work from "./modules/work.js";
import home from "./modules/home.js";
import family from "./modules/family.js";
import friends from "./modules/friends.js";
import transit from "./modules/transit.js";
import restaurant from "./modules/restaurant.js";

export const MODULE_ORDER = [
  "intro",
  "work",
  "home",
  "family",
  "friends",
  "transit",
  "restaurant",
];

const MODULES = {
  intro,
  work,
  home,
  family,
  friends,
  transit,
  restaurant,
};

export function getModule(id) {
  return MODULES[id] || null;
}

export function getAllModules() {
  return MODULE_ORDER.map((id) => MODULES[id]);
}
