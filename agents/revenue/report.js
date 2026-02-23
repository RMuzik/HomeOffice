/**
 * report.js — Génère le rapport Markdown de l'agent REVENUE
 */

function tierEmoji(tier) {
  return { S: '🏆', A: '🥇', B: '🥈', C: '🥉', D: '💀' }[tier] || '❓';
}

function formatEur(n) {
  return `${(n || 0).toFixed(2)}€`;
}

function generateMarkdown(data) {
  const { summary, keywords, scout_recommendations: reco } = data;
  const date = new Date(data.generated_at).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const topKeywords = keywords.slice(0, 10);
  const winnerRows = topKeywords.map(k =>
    `| ${tierEmoji(k.tier)} **${k.tier}** | ${k.keyword} | ${k.impressions.toLocaleString('fr-FR')} | ${k.outbound_clicks} | ${formatEur(k.revenue_eur)} | ${formatEur(k.rpm)} |`
  ).join('\n');

  const doubleDownList = reco.double_down.length
    ? reco.double_down.map(r => `- **${r.keyword}** — ${r.reason}`).join('\n')
    : '- Aucun keyword en tier S/A pour l\'instant — continuer à publier';

  const abandonList = reco.abandon.length
    ? reco.abandon.map(r => `- ~~${r.keyword}~~ — ${r.reason}`).join('\n')
    : '- Aucun keyword à abandonner pour l\'instant';

  const newKwList = reco.new_opportunities.slice(0, 8)
    .map(r => `- \`${r.keyword}\` — ${r.reason}`).join('\n');

  return `# 💶 Rapport REVENUE — ${date}

> Généré par l'agent REVENUE | Données: ${data.period_weeks} semaines d'historique${summary.is_mock_data ? ' | ⚠️ Mode mock' : ''}

## 📊 Vue d'ensemble

| Métrique | Valeur |
|----------|--------|
| Keywords analysés | ${summary.total_keywords} |
| Impressions totales | ${summary.total_impressions.toLocaleString('fr-FR')} |
| Clics sortants | ${summary.total_clicks.toLocaleString('fr-FR')} |
| Revenue estimé | **${formatEur(summary.total_revenue_eur)}** |
| RPM moyen | ${formatEur(summary.avg_rpm)} |

### Distribution par tier

| Tier | Nb | Description |
|------|-----|-------------|
| 🏆 S | ${summary.by_tier.S} | RPM ≥ 5€ — Jackpot |
| 🥇 A | ${summary.by_tier.A} | RPM ≥ 2€ — Excellent |
| 🥈 B | ${summary.by_tier.B} | RPM ≥ 0.5€ — Bon |
| 🥉 C | ${summary.by_tier.C} | RPM ≥ 0.1€ — Moyen |
| 💀 D | ${summary.by_tier.D} | RPM < 0.1€ — À revoir |

## 🏆 Top 10 Keywords par RPM

| Tier | Keyword | Impressions | Clics | Revenue | RPM |
|------|---------|-------------|-------|---------|-----|
${winnerRows}

## 🎯 Recommandations pour le SCOUT

### ✅ Double down — créer plus de contenu

${doubleDownList}

### 🧪 À tester — changer de format

${reco.test.slice(0, 5).map(r => `- **${r.keyword}** — ${r.reason}`).join('\n') || '- Continuer les tests actuels'}

### 🗑️ À abandonner

${abandonList}

### 💡 Nouveaux keywords à explorer

${newKwList || '- Aucune suggestion pour l\'instant'}

## 📈 Projections

${generateProjection(summary)}

---
*Rapport généré automatiquement par l'agent REVENUE*
*Pour données Associates réelles : exporter CSV depuis affiliate-program.amazon.fr → data/associates-export.csv*
`;
}

function generateProjection(summary) {
  const weeklyRevenue = summary.total_revenue_eur / Math.max(summary.total_keywords, 1);
  const monthlyEst = weeklyRevenue * 4;
  const target = 1000;
  const gap = target - monthlyEst;
  const impressionsNeeded = gap > 0 ? Math.round((gap / (summary.avg_rpm / 1000)) - summary.total_impressions) : 0;

  if (monthlyEst >= target) {
    return `🎉 **Objectif 1000€/mois atteint !** Revenue mensuel estimé : **${monthlyEst.toFixed(0)}€**`;
  }

  return `**Revenue mensuel estimé :** ${monthlyEst.toFixed(0)}€ / 1000€ objectif

Pour atteindre 1000€/mois avec le RPM actuel (${summary.avg_rpm.toFixed(3)}€), il faut **${(impressionsNeeded + summary.total_impressions).toLocaleString('fr-FR')} impressions/mois** — soit ${Math.round(impressionsNeeded / 4).toLocaleString('fr-FR')} impressions supplémentaires par semaine.

**Levier principal :** publier plus sur les keywords tier S/A (RPM élevé) plutôt qu'augmenter le volume global.`;
}

module.exports = { generateMarkdown, buildRevenueReport: (d) => d };
