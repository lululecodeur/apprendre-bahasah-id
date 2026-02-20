// app.js
let monVocabulaire = [];
let motActuel = null;
let faceFrancaise = true;

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  chargerDonnees();
  mettreAJourStats();
});

// Charge la progression depuis la mémoire du navigateur, sinon utilise data.js
function chargerDonnees() {
  // 1. On charge les scores sauvegardés (juste ID et Level)
  const scoresSauvegardes = JSON.parse(localStorage.getItem('indo_scores')) || {};

  // 2. On prend ta liste data.js et on applique les scores
  monVocabulaire = vocabulaireBase.map(mot => ({
    ...mot,
    level: scoresSauvegardes[mot.id] || 0, // Si pas de score, niveau 0
  }));
}

function sauvegarderDonnees() {
  // On ne sauvegarde que les ID et les niveaux pour ne pas bloquer les nouveaux mots
  const scores = {};
  monVocabulaire.forEach(mot => {
    if (mot.level > 0) scores[mot.id] = mot.level;
  });
  localStorage.setItem('indo_scores', JSON.stringify(scores));
  mettreAJourStats();
}

function mettreAJourStats() {
  const total = monVocabulaire.length;
  // On considère un mot "acquis" s'il est au niveau 3 ou plus
  const acquis = monVocabulaire.filter(mot => mot.level >= 3).length;

  const pourcentage = total > 0 ? (acquis / total) * 100 : 0;

  // Mise à jour visuelle
  document.getElementById('progress-fill').style.width = `${pourcentage}%`;
  document.getElementById('mots-acquis').innerText = acquis;
  document.getElementById('total-mots').innerText = total;
}

// Logique des Flashcards
function piocherMot() {
  // 1. Filtrer les mots à apprendre (niveau < 3)
  const motsAApprendre = monVocabulaire.filter(m => m.level < 3);

  let pool;

  if (motsAApprendre.length > 0) {
    // 80% de chance de prendre un mot non maîtrisé
    const aleatoire = Math.random();
    if (aleatoire > 0.2) {
      pool = motsAApprendre;
    } else {
      // 20% de chance de réviser un mot acquis (pour ne pas oublier)
      pool = monVocabulaire.filter(m => m.level >= 3);
      if (pool.length === 0) pool = monVocabulaire; // Fallback
    }
  } else {
    // Si tout est appris, on révise tout
    pool = monVocabulaire;
  }

  const index = Math.floor(Math.random() * pool.length);
  motActuel = pool[index];

  afficherCarte();

  // Reset UI controls
  document.getElementById('controls-start').classList.add('hidden');
  document.getElementById('controls-answer').classList.remove('hidden');
  document.getElementById('controls-eval').classList.add('hidden');
}

function afficherCarte() {
  const carte = document.getElementById('carte');
  const front = document.getElementById('content-front');
  const back = document.getElementById('content-back');

  // On remet la carte du bon côté (face question)
  carte.classList.remove('flipped');
  faceFrancaise = true;

  // On remplit le contenu
  front.innerText = motActuel.fr;

  // On prépare déjà la réponse derrière
  back.innerHTML = `
      <div class="answer-gaul">${motActuel.gaul}</div>
      <div class="answer-baku">Formel : ${motActuel.baku}</div>
      <div style="margin-top:15px; font-size: 0.9em; color: gray;">
          Niveau : ${motActuel.level}
      </div>
  `;
}

function retournerCarte() {
  const carte = document.getElementById('carte');
  carte.classList.add('flipped'); // Déclenche l'animation CSS
  faceFrancaise = false;

  document.getElementById('controls-answer').classList.add('hidden');
  document.getElementById('controls-eval').classList.remove('hidden');
}

function evaluer(estCorrect) {
  // Système de progression basique
  if (estCorrect) {
    motActuel.level += 1;
  } else {
    motActuel.level = 0; // On réinitialise si on s'est trompé
  }

  sauvegarderDonnees();
  piocherMot(); // Passe automatiquement au mot suivant
}

// Permet de cliquer sur la carte pour la retourner
document.getElementById('carte').addEventListener('click', () => {
  if (motActuel && faceFrancaise) {
    retournerCarte();
  }
});

function showModule(moduleId) {
  // Masque toutes les sections principales
  const modules = ['home-module', 'flashcard-section', 'generator-section', 'chat-section'];
  modules.forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });

  // Affiche celle sélectionnée
  document.getElementById(moduleId).classList.remove('hidden');
}
