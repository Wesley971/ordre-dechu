function gainXp(xp) {
  GameState.player.xp += xp;
  const newLevel = Math.floor(GameState.player.xp / 10) + 1;

  if (newLevel > GameState.player.level) {
    GameState.player.level = newLevel;
    return true;
  }

  return false;
}
