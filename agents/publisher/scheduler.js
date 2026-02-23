/**
 * AGENT PUBLISHER — scheduler.js
 * Gère le scheduling optimal des pins Pinterest.
 *
 * Stratégie : 5 pins/jour aux heures de pic Pinterest (Europe/Paris)
 * Lundi→Vendredi : 09h, 12h, 18h, 20h, 21h
 * Samedi→Dimanche : 10h, 14h, 16h, 20h, 22h
 *
 * Évite de publier trop vite (rate limiting Pinterest)
 * Respecte la fenêtre 7-day scheduling de l'API
 */

/**
 * Heures optimales par jour de la semaine (Paris)
 * Basé sur les données d'engagement Pinterest B2C / Home Office
 */
const OPTIMAL_HOURS = {
  1: ['09:00', '12:00', '18:00', '20:00', '21:00'], // Lundi
  2: ['09:00', '12:30', '18:00', '19:30', '21:00'], // Mardi
  3: ['08:30', '12:00', '18:00', '20:00', '22:00'], // Mercredi
  4: ['09:00', '12:00', '17:30', '20:00', '21:30'], // Jeudi
  5: ['09:00', '12:00', '17:00', '19:00', '21:00'], // Vendredi
  6: ['10:00', '14:00', '16:00', '20:00', '22:00'], // Samedi
  0: ['10:00', '13:00', '16:00', '19:00', '22:00'], // Dimanche
};

/**
 * Calcule les timestamps de publication pour la semaine courante
 * @param {Date} weekStart - Lundi de la semaine
 * @param {Array} pins - Pins à scheduler (35 max)
 * @returns {Array} Pins avec scheduled_at en ISO string
 */
function scheduleWeeklyPins(weekStart, pins) {
  const scheduled = [];
  let pinIndex = 0;

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + dayOffset);
    const dayOfWeek = date.getDay(); // 0=Dim, 1=Lun, etc.

    const hours = OPTIMAL_HOURS[dayOfWeek] || OPTIMAL_HOURS[1];

    for (const hour of hours) {
      if (pinIndex >= pins.length) break;

      const [h, m] = hour.split(':').map(Number);
      const scheduledAt = new Date(date);
      scheduledAt.setHours(h, m, 0, 0);

      // Skip si dans le passé (sécurité)
      if (scheduledAt <= new Date()) {
        scheduledAt.setDate(scheduledAt.getDate() + 1);
      }

      scheduled.push({
        ...pins[pinIndex],
        scheduled_at: scheduledAt.toISOString(),
        scheduled_day: dayOffset + 1,
        scheduled_hour: hour,
      });

      pinIndex++;
    }
  }

  return scheduled;
}

/**
 * Retourne le prochain slot de publication disponible
 * (pour publication immédiate avec délai minimum)
 * @param {Array} publishedToday - Pins déjà publiés aujourd'hui
 * @returns {Date}
 */
function getNextPublishSlot(publishedToday = []) {
  const now = new Date();
  const todayDayOfWeek = now.getDay();
  const hours = OPTIMAL_HOURS[todayDayOfWeek] || OPTIMAL_HOURS[1];

  // Trouve le prochain slot futur du jour
  for (const hour of hours) {
    const [h, m] = hour.split(':').map(Number);
    const slot = new Date();
    slot.setHours(h, m, 0, 0);

    if (slot > now) {
      // Vérifie que ce slot n'est pas déjà pris
      const alreadyTaken = publishedToday.some(p => p.scheduled_hour === hour);
      if (!alreadyTaken) return slot;
    }
  }

  // Sinon : demain au premier slot
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDay = tomorrow.getDay();
  const tomorrowHours = OPTIMAL_HOURS[tomorrowDay];
  const [h, m] = tomorrowHours[0].split(':').map(Number);
  tomorrow.setHours(h, m, 0, 0);
  return tomorrow;
}

/**
 * Délai minimum entre 2 publications consécutives (ms)
 * Pinterest recommande 10-15 min minimum entre pins
 */
const MIN_PUBLISH_DELAY_MS = 12 * 60 * 1000; // 12 minutes

/**
 * Calcule le délai à attendre avant la prochaine publication
 * @param {string} lastPublishedAt - ISO string de la dernière publication
 * @returns {number} Milliseconds to wait (0 if no wait needed)
 */
function getPublishDelay(lastPublishedAt) {
  if (!lastPublishedAt) return 0;
  const elapsed = Date.now() - new Date(lastPublishedAt).getTime();
  const remaining = MIN_PUBLISH_DELAY_MS - elapsed;
  return Math.max(0, remaining);
}

/**
 * Groupe les pins par jour pour le rapport
 */
function groupByDay(pins) {
  return pins.reduce((acc, pin) => {
    const day = pin.scheduled_day || pin.day || 1;
    if (!acc[day]) acc[day] = [];
    acc[day].push(pin);
    return acc;
  }, {});
}

/**
 * Formate une date pour l'affichage
 */
function formatSchedule(isoString) {
  const date = new Date(isoString);
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  return `${days[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1} à ${date.getHours()}h${String(date.getMinutes()).padStart(2, '0')}`;
}

module.exports = {
  scheduleWeeklyPins,
  getNextPublishSlot,
  getPublishDelay,
  groupByDay,
  formatSchedule,
  OPTIMAL_HOURS,
  MIN_PUBLISH_DELAY_MS,
};
