/**
 * AGENT TRACKER — report-generator.js
 * Génère le rapport hebdomadaire au format Markdown + Discord.
 *
 * Contenu du rapport :
 * - Résumé exécutif (pins publiés, impressions, revenus estimés)
 * - Top 5 pins de la semaine
 * - Analyse par type de pin
 * - Analyse par board
 * - Recommandations automatiques pour la semaine suivante
 * - Tendances & alertes
 */

const fs = require('fs');
const path = require('path');

// ─── Rapport Markdown (pour le repo Git) ────────────────────────────────────

/**
 * Génère le rapport hebdomadaire complet en Markdown
 */
function generateMarkdownReport(weekData) {
  const { week, metrics, publishedCount, totalRevenue, topPins, byType, byBoard, recommendations } = weekData;

  const totalImpressions = metrics.reduce((s, m) => s + (m.impressions || 0), 0);
  const totalSaves = metrics.reduce((s, m) => s + (m.saves || 0), 0);
  const totalClicks = metrics.reduce((s, m) => s + (m.outbound_clicks || 0), 0);
  const avgScore = metrics.length
    ? Math.round(metrics.reduce((s, m) => s + (m.performance_score || 0), 0) / metrics.length)
    : 0;

  const weekLabel = week || new Date().toISOString().split('T')[0];

  return `# 📊 Rapport Hebdomadaire APEX — Semaine du ${weekLabel}

> Généré automatiquement par l'Agent TRACKER · ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

---

## 🎯 Résumé Exécutif

| Métrique | Valeur | Objectif | Statut |
|----------|--------|----------|--------|
| Pins publiés | ${publishedCount} | 35 | ${getStatus(publishedCount, 35, 25)} |
| Impressions | ${formatNumber(totalImpressions)} | 17 500 | ${getStatus(totalImpressions, 17500, 10000)} |
| Saves (repins) | ${formatNumber(totalSaves)} | 175 | ${getStatus(totalSaves, 175, 100)} |
| Clics outbound | ${formatNumber(totalClicks)} | 280 | ${getStatus(totalClicks, 280, 150)} |
| Revenus estimés | ${totalRevenue.toFixed(2)}€ | - | 💰 |
| Score moyen | ${avgScore}/100 | 60 | ${getStatus(avgScore, 60, 40)} |

---

## 🏆 Top 5 Pins de la Semaine

${topPins.slice(0, 5).map((pin, i) => `### ${i + 1}. ${pin.keyword} \`[${pin.type}]\`
- **Score** : ${pin.performance_score}/100
- **Impressions** : ${formatNumber(pin.impressions)} | **Saves** : ${pin.saves} | **Clics** : ${pin.outbound_clicks}
- **Revenu estimé** : ${pin.estimated_revenue_eur}€
- **Board** : \`${pin.board}\`
`).join('\n')}

---

## 📈 Performance par Type de Pin

| Type | Pins | Impressions moy. | Saves moy. | Clics moy. | Score moy. |
|------|------|-----------------|-----------|-----------|-----------|
${Object.entries(byType).map(([type, data]) =>
  `| ${type} | ${data.count} | ${formatNumber(data.avg_impressions)} | ${data.avg_saves.toFixed(1)} | ${data.avg_clicks.toFixed(1)} | ${data.avg_score}/100 |`
).join('\n')}

---

## 🗂️ Performance par Board

| Board | Pins | Impressions | Revenus estimés |
|-------|------|-------------|----------------|
${Object.entries(byBoard).map(([board, data]) =>
  `| ${board} | ${data.count} | ${formatNumber(data.total_impressions)} | ${data.total_revenue.toFixed(2)}€ |`
).join('\n')}

---

## 🔮 Recommandations Semaine Suivante

${recommendations.map((r, i) => `${i + 1}. **${r.title}** — ${r.detail}`).join('\n')}

---

## 📦 Données Brutes

\`\`\`json
${JSON.stringify({ week: weekLabel, published: publishedCount, total_impressions: totalImpressions, total_revenue: totalRevenue.toFixed(2), avg_score: avgScore }, null, 2)}
\`\`\`

---
*APEX Bot · homeofficesetup.net · [GitHub](https://github.com/ton-user/homeoffice-affiliate)*
`;
}

// ─── Rapport Discord (message court) ────────────────────────────────────────

/**
 * Génère le message Discord hebdomadaire (max 2000 chars)
 */
function generateDiscordReport(weekData) {
  const { week, metrics, publishedCount, totalRevenue, topPins } = weekData;

  const totalImpressions = metrics.reduce((s, m) => s + (m.impressions || 0), 0);
  const totalSaves = metrics.reduce((s, m) => s + (m.saves || 0), 0);
  const totalClicks = metrics.reduce((s, m) => s + (m.outbound_clicks || 0), 0);
  const avgScore = metrics.length
    ? Math.round(metrics.reduce((s, m) => s + (m.performance_score || 0), 0) / metrics.length)
    : 0;

  const top1 = topPins[0];

  return `## 📊 Rapport Hebdo APEX — ${week}

**🎯 KPIs Semaine**
• 📌 Pins publiés : **${publishedCount}/35**
• 👁️ Impressions : **${formatNumber(totalImpressions)}**
• 💾 Saves : **${formatNumber(totalSaves)}**
• 🖱️ Clics : **${formatNumber(totalClicks)}**
• 💰 Revenus estimés : **${totalRevenue.toFixed(2)}€**
• ⭐ Score moyen : **${avgScore}/100**

**🏆 Meilleur Pin**
${top1 ? `\`${top1.keyword}\` (${top1.type}) — Score ${top1.performance_score}/100 — ${top1.outbound_clicks} clics` : 'N/A'}

→ Rapport complet : [voir sur GitHub](https://github.com/ton-user/homeoffice-affiliate/tree/main/data/reports)`;
}

// ─── Analyse & Recommandations ───────────────────────────────────────────────

/**
 * Agrège les métriques par type de pin
 */
function aggregateByType(metrics) {
  const types = {};

  for (const m of metrics) {
    if (!types[m.type]) types[m.type] = { count: 0, impressions: 0, saves: 0, clicks: 0, score: 0 };
    types[m.type].count++;
    types[m.type].impressions += m.impressions || 0;
    types[m.type].saves += m.saves || 0;
    types[m.type].clicks += m.outbound_clicks || 0;
    types[m.type].score += m.performance_score || 0;
  }

  return Object.fromEntries(
    Object.entries(types).map(([type, data]) => [type, {
      count: data.count,
      avg_impressions: Math.round(data.impressions / data.count),
      avg_saves: parseFloat((data.saves / data.count).toFixed(1)),
      avg_clicks: parseFloat((data.clicks / data.count).toFixed(1)),
      avg_score: Math.round(data.score / data.count),
    }])
  );
}

/**
 * Agrège les métriques par board
 */
function aggregateByBoard(metrics) {
  const boards = {};

  for (const m of metrics) {
    if (!boards[m.board]) boards[m.board] = { count: 0, total_impressions: 0, total_revenue: 0 };
    boards[m.board].count++;
    boards[m.board].total_impressions += m.impressions || 0;
    boards[m.board].total_revenue += m.estimated_revenue_eur || 0;
  }

  // Arrondit les revenus
  return Object.fromEntries(
    Object.entries(boards).map(([board, data]) => [board, {
      ...data,
      total_revenue: parseFloat(data.total_revenue.toFixed(2)),
    }])
  );
}

/**
 * Génère les recommandations automatiques pour la semaine suivante
 */
function generateRecommendations(metrics, byType, byBoard) {
  const recs = [];

  // 1. Type de pin le plus performant → en faire plus
  const bestType = Object.entries(byType)
    .sort((a, b) => b[1].avg_score - a[1].avg_score)[0];
  if (bestType) {
    recs.push({
      title: `Augmenter les pins "${bestType[0]}"`,
      detail: `Score moyen ${bestType[1].avg_score}/100 — le meilleur type cette semaine. Allouer 40% du budget contenu.`
    });
  }

  // 2. Board le plus rentable → focus
  const bestBoard = Object.entries(byBoard)
    .sort((a, b) => b[1].total_revenue - a[1].total_revenue)[0];
  if (bestBoard) {
    recs.push({
      title: `Focus board "${bestBoard[0]}"`,
      detail: `${bestBoard[1].total_revenue.toFixed(2)}€ générés — board le plus rentable. Créer 2 pins supplémentaires.`
    });
  }

  // 3. Pins sous-performants → identifier les keywords faibles
  const lowPerformers = metrics.filter(m => m.performance_score < 30);
  if (lowPerformers.length > 0) {
    recs.push({
      title: `Réviser ${lowPerformers.length} keyword(s) sous-performants`,
      detail: `${lowPerformers.map(m => m.keyword).slice(0, 3).join(', ')} — score < 30. Tester de nouveaux angles ou visuels.`
    });
  }

  // 4. Ratio saves/impressions faible → améliorer les visuels
  const avgEngagement = metrics.reduce((s, m) => s + (m.engagement_rate_pct || 0), 0) / (metrics.length || 1);
  if (avgEngagement < 3) {
    recs.push({
      title: 'Améliorer les visuels (engagement < 3%)',
      detail: `Taux d'engagement moyen: ${avgEngagement.toFixed(1)}%. Tester des overlays de texte plus larges et des palettes plus contrastées.`
    });
  }

  // 5. Recommandation générale de croissance
  recs.push({
    title: 'Étendre vers 45 pins/semaine',
    detail: 'Ajouter 2 boards thématiques (lighting, plants) pour diversifier le reach et atteindre de nouvelles audiences.'
  });

  return recs;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNumber(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n || 0);
}

function getStatus(value, target, minimum) {
  if (value >= target) return '✅';
  if (value >= minimum) return '⚠️';
  return '❌';
}

module.exports = {
  generateMarkdownReport,
  generateDiscordReport,
  aggregateByType,
  aggregateByBoard,
  generateRecommendations,
};
