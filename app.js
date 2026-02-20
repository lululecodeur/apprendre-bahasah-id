// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyCS_ubDe0cYx7a8Qu-xa9S2C4ac7vSAGMs',
  authDomain: 'indo-gaul-app.firebaseapp.com',
  databaseURL: 'https://indo-gaul-app-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'indo-gaul-app',
  storageBucket: 'indo-gaul-app.firebasestorage.app',
  messagingSenderId: '774768594106',
  appId: '1:774768594106:web:be944bc0f4af85c6918683',
  measurementId: 'G-FF1B0QYT5W',
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const userId = 'utilisateur_unique'; // Ton identifiant de synchro

let monVocabulaire = [];
let motActuel = null;
let faceFrancaise = true;
let nouveauxMotsAujourdhui = 0;
let totalSessionFixe = 0; // <--- TRÈS IMPORTANT

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  chargerDonnees();
  mettreAJourStats();
});

async function chargerDonnees() {
  try {
    // On récupère tout le profil utilisateur sur Firebase
    const snapshot = await db.ref('users/' + userId).once('value');
    const cloudData = snapshot.val() || {};

    const scoresSauvegardes = cloudData.scores || {};
    const localCustomVocab = cloudData.customVocab || [];

    // On fusionne avec data.js (vocabulaireBase)
    monVocabulaire = [...vocabulaireBase, ...localCustomVocab].map(mot => ({
      ...mot,
      level: scoresSauvegardes[mot.id]?.level || 0,
      prochaineRevision: scoresSauvegardes[mot.id]?.prochaineRevision || 0,
    }));

    // Gestion du reset à 4h du matin
    const maintenant = new Date();
    const dateRef = new Date(maintenant.getTime() - 4 * 60 * 60 * 1000).toDateString();

    if (cloudData.derniereJourneeId === dateRef) {
      nouveauxMotsAujourdhui = cloudData.compteurNouveaux || 0;
    } else {
      nouveauxMotsAujourdhui = 0;
    }

    mettreAJourStats();
    console.log('Données chargées depuis le Cloud ! ✅');
  } catch (error) {
    console.error('Erreur de chargement Firebase:', error);
  }
}

function sauvegarderDonnees() {
  const scores = {};
  // On filtre les mots que tu as créés toi-même
  const customVocab = monVocabulaire.filter(m => m.id && m.id.toString().startsWith('custom_'));

  monVocabulaire.forEach(mot => {
    scores[mot.id] = {
      level: mot.level,
      prochaineRevision: mot.prochaineRevision,
    };
  });

  const dateRef = new Date(Date.now() - 4 * 60 * 60 * 1000).toDateString();

  // Envoi à Firebase
  db.ref('users/' + userId).set({
    scores: scores,
    customVocab: customVocab,
    compteurNouveaux: nouveauxMotsAujourdhui,
    derniereJourneeId: dateRef,
  });

  mettreAJourStats();
}

function mettreAJourStats() {
  const maintenant = Date.now();
  const aReviser = monVocabulaire.filter(m => m.level > 0 && m.prochaineRevision <= maintenant);
  const nouveauxRestants = Math.max(0, 20 - nouveauxMotsAujourdhui);
  const resteAFaire = aReviser.length + nouveauxRestants;

  let pourcentage = 0;
  if (totalSessionFixe > 0) {
    pourcentage = ((totalSessionFixe - resteAFaire) / totalSessionFixe) * 100;
  }

  document.getElementById('progress-fill').style.width =
    `${Math.max(0, Math.min(100, pourcentage))}%`;
  document.getElementById('mots-acquis').innerText = Math.max(0, totalSessionFixe - resteAFaire);
  document.getElementById('total-mots').innerText = totalSessionFixe;
}

// Logique des Flashcards
function piocherMot() {
  const maintenant = Date.now();
  let aReviser = monVocabulaire.filter(m => m.level > 0 && m.prochaineRevision <= maintenant);
  let nouveauxDispos = monVocabulaire.filter(m => m.level === 0);
  let quotaNouveaux = Math.max(0, 20 - nouveauxMotsAujourdhui);
  let nouveauxPourSession = nouveauxDispos.slice(0, quotaNouveaux);

  let sessionPool = [...aReviser, ...nouveauxPourSession];

  if (sessionPool.length === 0) {
    totalSessionFixe = 0;
    afficherFinSession();
    return;
  }

  // Mélange aléatoire
  sessionPool.sort(() => Math.random() - 0.5);

  if (totalSessionFixe === 0) {
    totalSessionFixe = sessionPool.length;
  }

  motActuel = sessionPool[0];

  if (motActuel.level === 0 && !motActuel.dejaVuCetteSession) {
    nouveauxMotsAujourdhui++;
    motActuel.dejaVuCetteSession = true;
    // On sauvegarde le compteur immédiatement
    db.ref('users/' + userId + '/compteurNouveaux').set(nouveauxMotsAujourdhui);
  }

  afficherCarte();
  mettreAJourStats();

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
  const maintenant = new Date();
  const prochainReset4h = new Date();
  prochainReset4h.setHours(4, 0, 0, 0);

  if (estCorrect) {
    motActuel.level += 1;
    const intervalles = [0, 1, 3, 7, 14, 30];
    const joursAajouter = intervalles[Math.min(motActuel.level, 5)];

    let baseTemps = prochainReset4h.getTime();
    if (maintenant.getHours() < 4) {
      baseTemps -= 24 * 60 * 60 * 1000;
    }
    motActuel.prochaineRevision = baseTemps + joursAajouter * 24 * 60 * 60 * 1000;
    motActuel.dejaVuCetteSession = false;
  } else {
    motActuel.level = 0;
    motActuel.prochaineRevision = Date.now() - 60000;
  }

  sauvegarderDonnees();

  const carte = document.getElementById('carte');
  carte.classList.remove('flipped');
  setTimeout(() => {
    piocherMot();
  }, 300);
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

function ouvrirModalAjout() {
  document.getElementById('modal-ajout').classList.remove('hidden');
}

function fermerModalAjout() {
  document.getElementById('modal-ajout').classList.add('hidden');
}

function ajouterNouveauMot() {
  const fr = document.getElementById('new-fr').value;
  const gaul = document.getElementById('new-gaul').value;
  const baku = document.getElementById('new-baku').value;

  if (!fr || !gaul) {
    alert('Remplis au moins le français et le gaul !');
    return;
  }

  const nouveauMot = {
    id: 'custom_' + Date.now(),
    fr: fr,
    gaul: gaul,
    baku: baku || gaul,
    level: 0,
    prochaineRevision: Date.now(),
  };

  monVocabulaire.push(nouveauMot);

  // On utilise la fonction qui envoie vers Firebase
  sauvegarderDonnees();

  document.getElementById('new-fr').value = '';
  document.getElementById('new-gaul').value = '';
  document.getElementById('new-baku').value = '';
  fermerModalAjout();

  alert('Mot ajouté et synchronisé dans le Cloud ! ✅');
}

function afficherFinSession() {
  const front = document.getElementById('content-front');
  front.innerText = 'Session terminée ! 🎉 Reviens plus tard pour de nouvelles révisions.';
  document.getElementById('controls-start').classList.add('hidden');
  document.getElementById('controls-answer').classList.add('hidden');
  document.getElementById('controls-eval').classList.add('hidden');
}

function resetComplet() {
  if (confirm('Es-tu sûr de vouloir effacer TOUTE ta progression et tes mots personnalisés ?')) {
    localStorage.removeItem('indo_scores');
    localStorage.removeItem('indo_vocab_custom');
    localStorage.removeItem('compteur_nouveaux');
    localStorage.removeItem('derniere_journee_id');
    location.reload(); // Recharge la page
  }
}
