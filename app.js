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

// ... Tes clés Firebase et variables globales restent les mêmes en haut ...

function mettreAJourStats() {
  const maintenant = Date.now();

  // 1. On compte les révisions réelles qui attendent
  const aReviser = monVocabulaire.filter(m => m.level > 0 && m.prochaineRevision <= maintenant);

  // 2. On compte les nouveaux mots qu'il reste à voir pour atteindre le quota de 20
  // On s'assure de ne pas compter plus de mots que ce qu'il y a dans le dictionnaire
  const nouveauxDispo = monVocabulaire.filter(m => m.level === 0).length;
  const quotaRestant = Math.max(0, 20 - nouveauxMotsAujourdhui);
  const nouveauxAFaire = Math.min(nouveauxDispo, quotaRestant);

  // 3. Le total qu'il reste à traiter
  const resteAFaire = aReviser.length + nouveauxAFaire;

  // 4. Calcul du pourcentage basé sur le total fixé au début de la session
  let pourcentage = 0;
  if (totalSessionFixe > 0) {
    // Si totalSessionFixe est 2, et resteAFaire est 1, on a fait 50%
    pourcentage = ((totalSessionFixe - resteAFaire) / totalSessionFixe) * 100;
  }

  // 5. Mise à jour visuelle
  const fill = document.getElementById('progress-fill');
  if (fill) {
    fill.style.width = `${Math.max(0, Math.min(100, pourcentage))}%`;
  }

  document.getElementById('mots-acquis').innerText = Math.max(0, totalSessionFixe - resteAFaire);
  document.getElementById('total-mots').innerText = totalSessionFixe;

  // Mise à jour du petit badge sur le bouton du menu
  const dictCounter = document.getElementById('nb-mots-dict');
  if (dictCounter) dictCounter.innerText = monVocabulaire.length;
}

// MODIFICATION de piocherMot pour bien initialiser la barre
function piocherMot() {
  const maintenant = Date.now();
  let aReviser = monVocabulaire.filter(m => m.level > 0 && m.prochaineRevision <= maintenant);
  let nouveauxDispos = monVocabulaire.filter(m => m.level === 0);
  let quotaNouveaux = Math.max(0, 20 - nouveauxMotsAujourdhui);
  let nouveauxPourSession = nouveauxDispos.slice(0, quotaNouveaux);

  let sessionPool = [...aReviser, ...nouveauxPourSession];

  // FIXER LE TOTAL : Si c'est le début de la session, on enregistre le nombre total
  if (totalSessionFixe === 0 && sessionPool.length > 0) {
    totalSessionFixe = sessionPool.length;
  }

  if (sessionPool.length === 0) {
    totalSessionFixe = 0; // On reset pour la prochaine fois
    afficherFinSession();
    return;
  }

  // Mélange et sélection
  sessionPool.sort(() => Math.random() - 0.5);
  motActuel = sessionPool[0];

  if (motActuel.level === 0 && !motActuel.dejaVuCetteSession) {
    nouveauxMotsAujourdhui++;
    motActuel.dejaVuCetteSession = true;
    db.ref('users/' + userId + '/compteurNouveaux').set(nouveauxMotsAujourdhui);
  }

  afficherCarte();
  mettreAJourStats(); // On force la mise à jour de la barre ici

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
    // On ne reset pas dejaVuCetteSession ici pour ne pas fausser le quota journalier
  }

  sauvegarderDonnees();
  mettreAJourStats(); // <-- C'est cet appel qui fait bouger la barre immédiatement !

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
  // 1. Liste TOUS tes identifiants de sections principales
  const modules = [
    'home-module',
    'flashcard-section',
    'generator-section',
    'chat-section',
    'dictionary-section', // <--- Vérifie bien que celui-ci est là !
  ];

  // 2. Cache tout le monde
  modules.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  // 3. Affiche uniquement celui demandé
  const target = document.getElementById(moduleId);
  if (target) {
    target.classList.remove('hidden');
    window.scrollTo(0, 0); // Remonte en haut de page pour éviter les décalages
  }
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

function ouvrirDictionnaire() {
  showModule('dictionary-section');
  afficherDictionnaire(monVocabulaire);
}

function afficherDictionnaire(liste) {
  const conteneur = document.getElementById('dictionary-list');
  conteneur.innerHTML = '';

  // Tri alphabétique par défaut
  const triee = [...liste].sort((a, b) => a.fr.localeCompare(b.fr));

  triee.forEach(mot => {
    const estCustom = mot.id && mot.id.toString().startsWith('custom_');
    const niveau = mot.level || 0;

    // Déterminer une couleur selon le niveau pour voir la maîtrise d'un coup d'œil
    let color = '#ef4444'; // Rouge (Niveau 0)
    if (niveau >= 1) color = '#f59e0b'; // Orange
    if (niveau >= 3) color = '#10b981'; // Vert
    if (niveau >= 5) color = '#3b82f6'; // Bleu (Maîtrisé)

    const div = document.createElement('div');
    div.className = 'dict-item';
    div.innerHTML = `
        <div class="dict-info">
            <div style="display: flex; align-items: center; gap: 8px;">
                <h4 style="margin:0;">${mot.fr}</h4>
                <span style="font-size: 0.7em; padding: 2px 6px; border-radius: 10px; background: ${color}22; color: ${color}; border: 1px solid ${color};">
                    Niv. ${niveau}
                </span>
            </div>
            <p style="margin: 5px 0 0 0; color: #555;">${mot.gaul} ${mot.baku ? `<small style="color:gray;">(${mot.baku})</small>` : ''}</p>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
            ${estCustom ? `<button onclick="supprimerMot('${mot.id}')" style="background:none; border:none; cursor:pointer; font-size:1.2em; opacity: 0.5;">🗑️</button>` : ''}
        </div>
    `;
    conteneur.appendChild(div);
  });
}
async function supprimerMot(id) {
  if (confirm('Supprimer ce mot définitivement du Cloud ?')) {
    // 1. Retirer du tableau local
    monVocabulaire = monVocabulaire.filter(m => m.id !== id);

    // 2. Sauvegarder sur Firebase (la fonction sauvegarderDonnees() s'occupe de filtrer les custom)
    sauvegarderDonnees();

    // 3. Rafraîchir l'affichage
    afficherDictionnaire(monVocabulaire);
    alert('Mot supprimé !');
  }
}

function filtrerDictionnaire() {
  const recherche = document.getElementById('dict-search').value.toLowerCase();
  const resultats = monVocabulaire.filter(
    m => m.fr.toLowerCase().includes(recherche) || m.gaul.toLowerCase().includes(recherche)
  );
  afficherDictionnaire(resultats);
}

function resetComplet() {
  if (confirm('Es-tu sûr de vouloir effacer TOUTE ta progression (Cloud + Local) ?')) {
    // 1. Nettoyage Local
    localStorage.clear();

    // 2. Nettoyage Firebase
    db.ref('users/' + userId)
      .remove()
      .then(() => {
        alert('Progression réinitialisée !');
        location.reload();
      })
      .catch(err => {
        console.error('Erreur Firebase reset:', err);
        location.reload();
      });
  }
}
