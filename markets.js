export function isMarketOpen(market) {
  const now = new Date();
  const day = now.getUTCDay();   // 0=Dom, 6=Sab
  const hour = now.getUTCHours();

  switch (market) {
    case "CRYPTO":
      return true; // sempre aperto

    case "FOREX":
      // Lun–Ven
      return day >= 1 && day <= 5;

    case "INDEX":
      // Lun–Ven 14:30–21:00 UTC (USA)
      return day >= 1 && day <= 5 && hour >= 14 && hour <= 21;

    case "COMMODITY":
      // semplificato (poi si raffina)
      return day >= 1 && day <= 5;

    default:
      return false;
  }
}
