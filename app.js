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
  const sauvegarde = localStorage.getItem('indo_vocab');
  if (sauvegarde) {
    monVocabulaire = JSON.parse(sauvegarde);
  } else {
    monVocabulaire = [...vocabulaireBase]; // Récupéré de data.js
  }
}

// Sauvegarde dans le navigateur
function sauvegarderDonnees() {
  localStorage.setItem('indo_vocab', JSON.stringify(monVocabulaire));
  mettreAJourStats();
}

function mettreAJourStats() {
  // Compte les mots avec un niveau bas (ex: level < 3)
  const motsAReviser = monVocabulaire.filter(mot => mot.level < 3).length;
  document.getElementById('mots-restants').innerText = motsAReviser;
}

// Logique des Flashcards
function piocherMot() {
  // Pour l'instant on prend un mot au hasard (on améliorera l'algorithme plus tard)
  const index = Math.floor(Math.random() * monVocabulaire.length);
  motActuel = monVocabulaire[index];
  faceFrancaise = true;

  afficherCarte();

  // Gérer les boutons
  document.getElementById('controls-start').classList.add('hidden');
  document.getElementById('controls-answer').classList.remove('hidden');
  document.getElementById('controls-eval').classList.add('hidden');
}

function afficherCarte() {
  const content = document.getElementById('card-content');
  if (faceFrancaise) {
    content.innerHTML = `<div class="question">${motActuel.fr}</div>`;
  } else {
    content.innerHTML = `
            <div class="answer-gaul">${motActuel.gaul}</div>
            <div class="answer-baku">Formel : ${motActuel.baku}</div>
            <div style="margin-top:15px; font-size: 0.9em; color: gray;">
                Niveau de maîtrise : ${motActuel.level}
            </div>
        `;
  }
}

function retournerCarte() {
  faceFrancaise = false;
  afficherCarte();

  // Changer les boutons
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
