function updateMarket(state) {
  state.price += (Math.random() - 0.5); // small random move
  state.tick++;
}

window.updateMarket = updateMarket;
