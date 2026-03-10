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
const userId = 'utilisateur_unique';

let monVocabulaire = [];
let motActuel = null;
let faceFrancaise = true;
let nouveauxMotsAujourdhui = 0;
let totalSessionFixe = 0;
let motsValidesSession = 0;

// ─── TOAST ────────────────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ─── CONFIRM MODAL ────────────────────────────────────────────────────────────
function showConfirm(message, onConfirm) {
  const existing = document.getElementById('confirm-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'confirm-modal';
  modal.className = 'confirm-overlay';
  modal.innerHTML = `
    <div class="confirm-box">
      <p class="confirm-message">${message}</p>
      <div class="confirm-actions">
        <button class="confirm-btn-cancel" id="confirm-cancel">Annuler</button>
        <button class="confirm-btn-ok" id="confirm-ok">Confirmer</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  requestAnimationFrame(() => modal.classList.add('confirm-visible'));

  const close = () => {
    modal.classList.remove('confirm-visible');
    setTimeout(() => modal.remove(), 300);
  };

  document.getElementById('confirm-ok').addEventListener('click', () => {
    close();
    onConfirm();
  });
  document.getElementById('confirm-cancel').addEventListener('click', close);
  modal.addEventListener('click', e => {
    if (e.target === modal) close();
  });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  chargerDonnees();
  mettreAJourStats();
});

async function chargerDonnees() {
  try {
    const snapshot = await db.ref('users/' + userId).once('value');
    const cloudData = snapshot.val() || {};

    const scoresSauvegardes = cloudData.scores || {};
    const localCustomVocab = cloudData.customVocab || [];

    monVocabulaire = [...vocabulaireBase, ...localCustomVocab].map(mot => ({
      ...mot,
      level: scoresSauvegardes[mot.id]?.level || 0,
      prochaineRevision: scoresSauvegardes[mot.id]?.prochaineRevision || 0,
    }));

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
  const customVocab = monVocabulaire.filter(m => m.id && m.id.toString().startsWith('custom_'));

  monVocabulaire.forEach(mot => {
    scores[mot.id] = {
      level: mot.level,
      prochaineRevision: mot.prochaineRevision,
    };
  });

  const dateRef = new Date(Date.now() - 4 * 60 * 60 * 1000).toDateString();

  db.ref('users/' + userId).set({
    scores,
    customVocab,
    compteurNouveaux: nouveauxMotsAujourdhui,
    derniereJourneeId: dateRef,
  });

  mettreAJourStats();
}

// ─── STATS ────────────────────────────────────────────────────────────────────
function mettreAJourStats() {
  let pourcentage = 0;
  if (totalSessionFixe > 0) {
    pourcentage = (motsValidesSession / totalSessionFixe) * 100;
  }

  const fill = document.getElementById('progress-fill');
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, pourcentage))}%`;

  document.getElementById('mots-acquis').innerText = motsValidesSession;
  document.getElementById('total-mots').innerText = totalSessionFixe;

  const dictCounter = document.getElementById('nb-mots-dict');
  if (dictCounter) dictCounter.innerText = monVocabulaire.length;
}
// ─── FLASHCARDS ───────────────────────────────────────────────────────────────
let sessionPool = []; // pool fixé au début, global

function piocherMot() {
  if (
    document.getElementById('controls-start') &&
    !document.getElementById('controls-start').classList.contains('hidden')
  ) {
    // Initialisation du pool au clic sur "Commencer"
    const maintenant = Date.now();
    const aReviser = monVocabulaire.filter(m => m.level > 0 && m.prochaineRevision <= maintenant);
    const niveau0Rates = monVocabulaire.filter(
      m => m.level === 0 && m.prochaineRevision > 0 && m.prochaineRevision <= maintenant
    );
    const nouveauxDispos = monVocabulaire.filter(m => m.level === 0 && m.prochaineRevision === 0);
    const quotaNouveaux = Math.max(0, 20 - nouveauxMotsAujourdhui);
    nouveauxDispos.sort(() => Math.random() - 0.5);
    const nouveauxPourSession = nouveauxDispos.slice(0, quotaNouveaux);

    sessionPool = [...aReviser, ...niveau0Rates, ...nouveauxPourSession];
    sessionPool.sort(() => Math.random() - 0.5);
    totalSessionFixe = sessionPool.length;
    motsValidesSession = 0;
  }

  // Ajouter les mots ratés qui reviennent
  const maintenant = Date.now();
  const revenant = monVocabulaire.filter(
    m =>
      m.prochaineRevision <= maintenant &&
      m.prochaineRevision > 0 &&
      m.level > 0 && // ← ajoute ça : exclut tous les niveau 0
      !sessionPool.find(p => p.id === m.id) &&
      m.id !== motActuel?.id // ← compare les ids pas les références
  );
  sessionPool.push(...revenant);

  if (sessionPool.length === 0) {
    totalSessionFixe = 0;
    motsValidesSession = 0;
    afficherFinSession();
    return;
  }

  motActuel = sessionPool[0];
  sessionPool = sessionPool.slice(1); // on retire le mot tiré

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

  carte.classList.remove('flipped');
  faceFrancaise = true;

  front.innerText = motActuel.fr;

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
  carte.classList.add('flipped');
  faceFrancaise = false;

  document.getElementById('controls-answer').classList.add('hidden');
  document.getElementById('controls-eval').classList.remove('hidden');
}

function evaluer(estCorrect) {
  const prochainReset4h = new Date();
  prochainReset4h.setHours(4, 0, 0, 0);

  if (estCorrect) {
    if (motActuel.level === 0) {
      nouveauxMotsAujourdhui++;
      db.ref('users/' + userId + '/compteurNouveaux').set(nouveauxMotsAujourdhui);
      motActuel.level = 1;
      motActuel.rateEnSession = false;
      motsValidesSession++; // ✅ mot niveau 0 validé
    } else if (motActuel.rateEnSession) {
      motActuel.rateEnSession = false;
      let baseTemps = prochainReset4h.getTime();
      if (new Date().getHours() < 4) baseTemps -= 24 * 60 * 60 * 1000;
      const intervalles = [0, 1, 3, 7, 14, 30];
      motActuel.prochaineRevision =
        baseTemps + intervalles[Math.min(motActuel.level, 5)] * 24 * 60 * 60 * 1000;
      motsValidesSession++; // ✅ mot raté puis réussi
    } else {
      motActuel.level += 1;
      let baseTemps = prochainReset4h.getTime();
      if (new Date().getHours() < 4) baseTemps -= 24 * 60 * 60 * 1000;
      const intervalles = [0, 1, 3, 7, 14, 30];
      motActuel.prochaineRevision =
        baseTemps + intervalles[Math.min(motActuel.level, 5)] * 24 * 60 * 60 * 1000;
      motsValidesSession++; // ✅ révision normale réussie
    }
  } else {
    if (motActuel.level === 0) {
      motActuel.prochaineRevision = Date.now() - 60000;
      // ❌ pas de motsValidesSession++
    } else {
      motActuel.level = Math.max(1, motActuel.level - 1);
      motActuel.rateEnSession = true;
      motActuel.prochaineRevision = Date.now() - 60000;
      // ❌ pas de motsValidesSession++
    }
  }

  sauvegarderDonnees();
  mettreAJourStats();
  const carte = document.getElementById('carte');
  carte.classList.remove('flipped');
  setTimeout(() => {
    piocherMot();
  }, 300);
}

document.getElementById('carte').addEventListener('click', () => {
  if (motActuel && faceFrancaise) {
    retournerCarte();
  }
});

function afficherFinSession() {
  totalSessionFixe = 0;
  motsValidesSession = 0; // ← ajoute ça
  const front = document.getElementById('content-front');
  front.innerText = '🎉 Session terminée ! Reviens plus tard.';
  document.getElementById('controls-start').classList.remove('hidden');
  document.getElementById('controls-answer').classList.add('hidden');
  document.getElementById('controls-eval').classList.add('hidden');
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function showModule(moduleId) {
  const modules = [
    'home-module',
    'flashcard-section',
    'generator-section',
    'chat-section',
    'dictionary-section',
  ];

  modules.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const target = document.getElementById(moduleId);
  if (target) {
    target.classList.remove('hidden');
    window.scrollTo(0, 0);
  }
}

// ─── AJOUT DE MOT ─────────────────────────────────────────────────────────────
function ouvrirModalAjout() {
  document.getElementById('modal-ajout').classList.remove('hidden');
}

function fermerModalAjout() {
  document.getElementById('modal-ajout').classList.add('hidden');
}

function ajouterNouveauMot() {
  const fr = document.getElementById('new-fr').value.trim();
  const gaul = document.getElementById('new-gaul').value.trim();
  const baku = document.getElementById('new-baku').value.trim();

  if (!fr || !gaul) {
    showToast('Remplis au moins le français et le gaul !', 'error');
    return;
  }

  const nouveauMot = {
    id: 'custom_' + Date.now(),
    fr,
    gaul,
    baku: baku || gaul,
    level: 0,
    prochaineRevision: Date.now(),
  };

  monVocabulaire.push(nouveauMot);
  sauvegarderDonnees();

  document.getElementById('new-fr').value = '';
  document.getElementById('new-gaul').value = '';
  document.getElementById('new-baku').value = '';
  fermerModalAjout();

  showToast('Mot ajouté et synchronisé ✓', 'success');
}

// ─── DICTIONNAIRE ─────────────────────────────────────────────────────────────
function ouvrirDictionnaire() {
  showModule('dictionary-section');
  afficherDictionnaire(monVocabulaire);
}

function afficherDictionnaire(liste) {
  const conteneur = document.getElementById('dictionary-list');
  conteneur.innerHTML = '';

  const triee = [...liste].sort((a, b) => a.fr.localeCompare(b.fr));

  triee.forEach(mot => {
    const estCustom = mot.id && mot.id.toString().startsWith('custom_');
    const niveau = mot.level || 0;

    let color = '#ef4444';
    if (niveau >= 1) color = '#f59e0b';
    if (niveau >= 3) color = '#10b981';
    if (niveau >= 5) color = '#3b82f6';

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

function supprimerMot(id) {
  showConfirm('Supprimer ce mot définitivement ?', () => {
    monVocabulaire = monVocabulaire.filter(m => m.id !== id);
    sauvegarderDonnees();
    afficherDictionnaire(monVocabulaire);
    showToast('Mot supprimé', 'success');
  });
}

function filtrerDictionnaire() {
  const recherche = document.getElementById('dict-search').value.toLowerCase();
  const resultats = monVocabulaire.filter(
    m => m.fr.toLowerCase().includes(recherche) || m.gaul.toLowerCase().includes(recherche)
  );
  afficherDictionnaire(resultats);
}

// ─── RESET ────────────────────────────────────────────────────────────────────
function resetComplet() {
  showConfirm('Effacer TOUTE ta progression ? Cette action est irréversible.', () => {
    localStorage.clear();
    db.ref('users/' + userId)
      .remove()
      .then(() => {
        showToast('Progression réinitialisée', 'success');
        setTimeout(() => location.reload(), 1500);
      })
      .catch(err => {
        console.error('Erreur Firebase reset:', err);
        location.reload();
      });
  });
}
