// market.js — placeholder updater (expand later)
window.updateMarket = function updateMarket(state) {
  state.price += (Math.random() - 0.5) * 0.2;
  state.tick++;
};
