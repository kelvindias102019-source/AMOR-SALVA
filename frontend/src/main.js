import './styles.css';

'use strict';

/* Sempre abre a página no topo, inclusive ao voltar pelo navegador. */
if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

window.addEventListener('pageshow', () => {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
});

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '')
  .trim()
  .replace(/\/$/, '');

function apiUrl(pathname) {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${API_BASE_URL}${path}`;
}

if (!API_BASE_URL) {
  console.warn('Configure VITE_API_BASE_URL na Vercel com a URL pública do backend no Render.');
}

function trackMeta(eventName, params = {}, options = {}) {
  try {
    if (typeof window.fbq !== 'function') return;
    window.fbq('track', eventName, params, options);
  } catch (error) {
    console.warn('Falha ao registrar evento do Meta Pixel:', error);
  }
}

const AMOUNTS = [5,20,30,50,70,100,150,200,300,500,700,1000,1500,2000];
const NOTES = {5:'Qualquer valor faz diferença.',20:'Ajuda nas despesas imediatas.',30:'Contribui com itens de cuidado.',50:'Ajuda na alimentação especial.',70:'Contribui para medicamentos básicos.',100:'Ajuda no acompanhamento do tratamento.',150:'Apoia insumos e cuidados.',200:'Ajuda nas despesas mensais.',300:'Contribui com consultas e exames.',500:'Apoio importante para medicamentos.',700:'Ajuda ampla no tratamento.',1000:'Contribuição de grande impacto.',1500:'Apoio essencial para vários meses.',2000:'Ajuda de enorme impacto.'};
const currency = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const donationModal = document.querySelector('#donation-modal');
const urgencyModal = document.querySelector('#urgency-modal');
const valuesStep = document.querySelector('#donation-step-values');
const donorForm = document.querySelector('#donor-form');
const pixStep = document.querySelector('#pix-step');
const successStep = document.querySelector('#success-step');
const formError = document.querySelector('#form-error');
let selectedAmount = null;
let pollTimer = null;

function setModalOpen(modal, open) {
  modal.classList.toggle('open', open);
  modal.setAttribute('aria-hidden', String(!open));
  if (modal === donationModal) {
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (!open && modal === donationModal) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
function showStep(step){[valuesStep,donorForm,pixStep,successStep].forEach(el=>el.classList.toggle('active',el===step))}
function openDonation(amount){setModalOpen(urgencyModal,false);setModalOpen(donationModal,true);showStep(valuesStep);trackMeta('InitiateCheckout',{content_name:'Doação Sônia',currency:'BRL'});if(amount)chooseAmount(Number(amount))}
function closeDonation(){setModalOpen(donationModal,false);showStep(valuesStep);donorForm.reset();formError.textContent='';selectedAmount=null;document.querySelectorAll('.amount-button').forEach(b=>b.classList.remove('selected'))}
function chooseAmount(amount) {
  selectedAmount = amount;
  document.querySelectorAll('.amount-button').forEach((b) => b.classList.toggle('selected', Number(b.dataset.amount) === amount));
  const amountNote = document.querySelector('#amount-note');
  if (amountNote) amountNote.textContent = NOTES[amount] || 'Cada valor ajuda.';
  document.querySelector('#selected-amount-label').textContent = currency.format(amount);
  setTimeout(() => showStep(donorForm), 120);
}

const amountGrid=document.querySelector('#amount-grid');
AMOUNTS.forEach(amount=>{const b=document.createElement('button');b.type='button';b.dataset.amount=amount;b.className=`amount-button${amount===100?' popular':''}`;b.textContent=currency.format(amount).replace(/\s/g,'').replace(',00','');b.addEventListener('click',()=>chooseAmount(amount));amountGrid.appendChild(b)});

document.querySelectorAll('[data-open-donation]').forEach(b=>b.addEventListener('click',()=>openDonation()));
document.querySelectorAll('[data-close-modal]').forEach(b=>b.addEventListener('click',closeDonation));
document.querySelector('[data-back-values]').addEventListener('click',()=>showStep(valuesStep));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(donationModal.classList.contains('open'))closeDonation();if(urgencyModal.classList.contains('open'))setModalOpen(urgencyModal,false)}});

function collectUtms(){const p=new URLSearchParams(location.search);const keys=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid','ttclid'];const result={};keys.forEach(key=>{const value=p.get(key)||sessionStorage.getItem(key);if(value&&!value.includes('{{')){result[key]=value.slice(0,key==='utm_medium'?64:(['fbclid','gclid','ttclid'].includes(key)?500:255));sessionStorage.setItem(key,result[key])}});return result}
collectUtms();



const publicNameInput = donorForm.elements.name;
const showPublicInput = donorForm.elements.showPublic;

// O nome é totalmente opcional. A pessoa pode gerar o PIX anonimamente.
showPublicInput.addEventListener('change', () => {
  formError.textContent = '';
  if (showPublicInput.checked && publicNameInput.value.trim().length < 2) {
    publicNameInput.focus();
  }
});

publicNameInput.addEventListener('input', () => {
  formError.textContent = '';
});

donorForm.addEventListener('submit',async e=>{e.preventDefault();formError.textContent='';if(!selectedAmount){showStep(valuesStep);return}if(!donorForm.reportValidity())return;const button=document.querySelector('#generate-pix');button.disabled=true;button.classList.add('is-loading');button.textContent='Gerando PIX…';const form=new FormData(donorForm);const donorName=String(form.get('name')||'').trim();const showPublic=donorName.length>=2&&form.get('showPublic')==='on';const payload={amount:selectedAmount,name:donorName,showPublic,...collectUtms()};try{const response=await fetch(apiUrl('/api/donations/create'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Não foi possível gerar o PIX.');document.querySelector('#pix-qr').src=data.qrImage;document.querySelector('#pix-code').value=data.pixCode;document.querySelector('#pix-amount').textContent=currency.format(data.amount);trackMeta('AddPaymentInfo',{content_name:'Doação Sônia',currency:'BRL',value:Number(data.amount)});showStep(pixStep);startPolling(data.externalId)}catch(error){formError.textContent=error.message}finally{button.disabled=false;button.classList.remove('is-loading');button.textContent='Gerar PIX'}});

document.querySelector('#copy-pix').addEventListener('click',async()=>{const code=document.querySelector('#pix-code').value;try{await navigator.clipboard.writeText(code)}catch{document.querySelector('#pix-code').select();document.execCommand('copy')}const b=document.querySelector('#copy-pix');const old=b.textContent;b.textContent='Código copiado!';setTimeout(()=>b.textContent=old,1800)});

function startPolling(externalId){clearInterval(pollTimer);const check=async()=>{try{const response=await fetch(apiUrl(`/api/donations/${encodeURIComponent(externalId)}/status`),{cache:'no-store'});if(!response.ok)return;const data=await response.json();if(data.status==='COMPLETED'){clearInterval(pollTimer);pollTimer=null;const purchaseKey=`meta_purchase_${externalId}`;if(!sessionStorage.getItem(purchaseKey)){trackMeta('Purchase',{content_name:'Doação Sônia',currency:'BRL',value:Number(data.amount||selectedAmount||0)},{eventID:externalId});sessionStorage.setItem(purchaseKey,'1')}showStep(successStep);loadCampaign()}else if(data.status==='FAILED'){clearInterval(pollTimer);pollTimer=null;document.querySelector('#payment-status').innerHTML='<span>Não foi possível confirmar esta cobrança. Gere um novo PIX.</span>'}}catch{}};check();pollTimer=setInterval(check,5000)}

function initials(name){return name.split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase()}
async function loadCampaign() {
  // Mantém os valores definidos no frontend (10% / R$ 3.538,95)
  // sem sobrescrever com dados vindos da API.
  return;
}
loadCampaign();

const tabs=document.querySelectorAll('.tab');tabs.forEach(tab=>tab.addEventListener('click',()=>{tabs.forEach(t=>t.classList.toggle('active',t===tab));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===tab.dataset.tab));document.querySelector(`#${tab.dataset.tab}`).scrollIntoView({behavior:'smooth',block:'start'})}));

document.querySelectorAll('[data-close-urgency]').forEach(b=>b.addEventListener('click',()=>setModalOpen(urgencyModal,false)));
document.querySelectorAll('[data-quick-amount]').forEach(b=>b.addEventListener('click',()=>openDonation(b.dataset.quickAmount)));
document.querySelector('[data-open-from-urgency]').addEventListener('click',()=>openDonation());
setTimeout(()=>{if(!sessionStorage.getItem('urgencyShown')&&!donationModal.classList.contains('open')){sessionStorage.setItem('urgencyShown','1');setModalOpen(urgencyModal,true)}},12000);

/* =========================================================
   FOTO DO ORGANIZADOR E CURTIDAS DOS APOIOS
========================================================= */

function configureOrganizerPhoto() {
  const image = document.querySelector('.organizer-avatar-image');
  if (!image) return;

  const hideBrokenImage = () => {
    image.classList.add('is-missing');
  };

  image.addEventListener('error', hideBrokenImage);

  if (image.complete && image.naturalWidth === 0) {
    hideBrokenImage();
  }
}

const MAX_SUPPORTER_LIKES = 50;

function supporterLikeKey(card, index) {
  const name = card.querySelector('strong')?.textContent?.trim() || `apoio-${index}`;
  const amount = card.querySelector('.supporter-amount')?.textContent?.trim() || 'sem-valor';

  const normalizedName = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);

  const normalizedAmount = amount
    .replace(/[^0-9,.-]/g, '')
    .replace(/[^0-9]/g, '')
    .slice(0, 20);

  return `${normalizedName || `apoio-${index}`}:${normalizedAmount || '0'}`;
}

function readSupporterLikeState(button) {
  return {
    liked: button.dataset.liked === 'true',
    count: Math.max(0, Math.min(MAX_SUPPORTER_LIKES, Number(button.dataset.likeCount || 0))),
    maxLikes: Math.max(1, Number(button.dataset.maxLikes || MAX_SUPPORTER_LIKES)),
  };
}

function updateSupporterLikeButton(button, state = {}) {
  const liked = Boolean(state.liked);
  const maxLikes = Math.max(1, Number(state.maxLikes || MAX_SUPPORTER_LIKES));
  const count = Math.max(0, Math.min(maxLikes, Number(state.count || 0)));
  const loading = Boolean(state.loading);
  const limitReached = count >= maxLikes && !liked;

  button.dataset.liked = String(liked);
  button.dataset.likeCount = String(count);
  button.dataset.maxLikes = String(maxLikes);

  button.classList.toggle('is-liked', liked);
  button.classList.toggle('is-limit-reached', limitReached);
  button.setAttribute('aria-pressed', String(liked));
  button.disabled = loading || limitReached;

  const actionText = limitReached
    ? 'Limite atingido'
    : liked
      ? 'Curtido'
      : 'Curtir';

  button.setAttribute(
    'aria-label',
    limitReached
      ? `Este apoio atingiu o limite de ${maxLikes} curtidas`
      : liked
        ? 'Descurtir este apoio'
        : 'Curtir este apoio'
  );

  button.setAttribute(
    'title',
    limitReached
      ? `Limite de ${maxLikes} curtidas atingido`
      : liked
        ? 'Descurtir'
        : 'Curtir'
  );

  const label = button.querySelector('.supporter-like-label');
  if (label) label.textContent = loading ? 'Salvando…' : actionText;

  const countElement = button.querySelector('.supporter-like-count');
  if (countElement) {
    countElement.textContent = count === 1 ? '1 curtida' : `${count} curtidas`;
    countElement.hidden = count === 0;
  }
}

async function toggleSupporterLike(button) {
  const previous = readSupporterLikeState(button);
  const desiredLiked = !previous.liked;

  updateSupporterLikeButton(button, {
    ...previous,
    loading: true,
  });

  try {
    const response = await fetch(apiUrl('/api/supporters/like'), {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        supporterKey: button.dataset.supporterKey,
        liked: desiredLiked,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Não foi possível atualizar a curtida.');
    }

    updateSupporterLikeButton(button, {
      liked: data.liked,
      count: data.count,
      maxLikes: data.maxLikes || MAX_SUPPORTER_LIKES,
    });
  } catch (error) {
    console.warn('Falha ao atualizar curtida:', error);
    updateSupporterLikeButton(button, previous);
  }
}

function createSupporterLikeButton(card, index) {
  if (card.querySelector('.supporter-like-button')) return;

  const content = card.querySelector(':scope > div:nth-child(2)');
  if (!content) return;

  const actions = document.createElement('div');
  actions.className = 'supporter-actions';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'supporter-like-button';
  button.dataset.supporterKey = supporterLikeKey(card, index);
  button.innerHTML = `
    <svg class="supporter-like-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.8 21H4.5A1.5 1.5 0 0 1 3 19.5v-8A1.5 1.5 0 0 1 4.5 10h3.3v11Zm2 0V10.4l3.4-6.1c.4-.7 1.2-1.1 2-1 .9.2 1.5.9 1.5 1.8v3.4h2.7c1.5 0 2.6 1.4 2.2 2.8l-2 7.3A3.2 3.2 0 0 1 16.5 21H9.8Z"></path>
    </svg>
    <span class="supporter-like-label">Curtir</span>
    <span class="supporter-like-count" hidden></span>
  `;

  updateSupporterLikeButton(button, {
    liked: card.dataset.initialLiked === 'true',
    count: Number(card.dataset.initialLikes || 0),
    maxLikes: MAX_SUPPORTER_LIKES,
  });

  button.addEventListener('click', () => {
    toggleSupporterLike(button);
  });

  actions.appendChild(button);
  content.appendChild(actions);
}

function configureSupporterLikeButtons() {
  document.querySelectorAll('.supporter-card').forEach((card, index) => {
    createSupporterLikeButton(card, index);
  });
}

async function loadSupporterLikeStatuses() {
  const buttons = [...document.querySelectorAll('.supporter-like-button')];
  const supporterKeys = [...new Set(
    buttons
      .map((button) => button.dataset.supporterKey)
      .filter(Boolean)
  )];

  if (supporterKeys.length === 0) return;

  try {
    const response = await fetch(apiUrl('/api/supporters/likes/status'), {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ supporterKeys }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Não foi possível carregar as curtidas.');
    }

    const statusMap = new Map(
      (data.supporters || []).map((item) => [item.supporterKey, item])
    );

    buttons.forEach((button) => {
      const status = statusMap.get(button.dataset.supporterKey) || readSupporterLikeState(button);

      updateSupporterLikeButton(button, {
        liked: status.liked,
        count: status.count,
        maxLikes: data.maxLikes || MAX_SUPPORTER_LIKES,
      });
    });
  } catch (error) {
    console.warn('Falha ao carregar curtidas:', error);
  }
}

configureOrganizerPhoto();
configureSupporterLikeButtons();
loadSupporterLikeStatuses();

/* Também aplica o botão em apoiadores inseridos depois pela API. */
const supporterListElement = document.querySelector('#supporter-list');
let supporterLikeReloadTimer = null;

if (supporterListElement) {
  const supporterObserver = new MutationObserver(() => {
    configureSupporterLikeButtons();
    clearTimeout(supporterLikeReloadTimer);
    supporterLikeReloadTimer = setTimeout(loadSupporterLikeStatuses, 80);
  });

  supporterObserver.observe(supporterListElement, {
    childList: true,
    subtree: true,
  });
}


/* =========================================================
   PLAYER VSL — reprodução por toque e barra verde acelerada
========================================================= */
function configureCampaignVsl() {
  const player = document.querySelector('[data-vsl-player]');
  if (!player) return;

  const video = player.querySelector('#campaign-vsl');
  const toggleButtons = player.querySelectorAll('[data-vsl-toggle]');
  const soundButton = player.querySelector('[data-vsl-sound]');
  const progress = player.querySelector('[data-vsl-progress]');
  const progressFill = player.querySelector('[data-vsl-progress-fill]');
  const progressDot = player.querySelector('[data-vsl-progress-dot]');
  const overlayTitle = player.querySelector('[data-vsl-overlay-title]');

  if (!video || !progress || !progressFill || !progressDot) return;

  let hasStarted = false;

  function visualProgress(actualProgress) {
    const normalized = Math.max(0, Math.min(1, actualProgress || 0));
    if (normalized >= 0.999) return 1;

    /*
     * Curva de retenção da VSL:
     * - 10% do vídeo real  -> barra em aproximadamente 32%;
     * - 25% do vídeo real  -> barra em aproximadamente 66%;
     * - 50% do vídeo real  -> barra em aproximadamente 87%;
     * - 70% do vídeo real  -> barra em aproximadamente 94%;
     * - 90% do vídeo real  -> barra em aproximadamente 98%;
     * - 100% do vídeo real -> barra em 100%.
     *
     * Assim, a barra parece avançar muito rápido no começo e
     * desacelera somente depois da metade, terminando junto com o vídeo.
     */
    if (normalized <= 0.5) {
      const acceleratedStart = normalized / 0.5;
      return 0.87 * (1 - Math.pow(1 - acceleratedStart, 2.05));
    }

    const slowFinish = (normalized - 0.5) / 0.5;
    return 0.87 + 0.13 * Math.pow(slowFinish, 0.72);
  }

  function updateVslProgress() {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const actual = duration > 0 ? video.currentTime / duration : 0;
    const visual = video.ended ? 1 : visualProgress(actual);
    const percentage = Math.max(0, Math.min(100, visual * 100));

    progressFill.style.width = `${percentage}%`;
    progressDot.style.left = `${percentage}%`;
    progress.setAttribute('aria-valuenow', String(Math.round(percentage)));
  }

  function syncVslState() {
    const isPlaying = !video.paused && !video.ended;
    player.classList.toggle('is-playing', isPlaying);
    player.classList.toggle('has-started', hasStarted);
    player.classList.toggle('is-ended', video.ended);
    player.classList.toggle('is-muted', video.muted || video.volume === 0);

    toggleButtons.forEach((button) => {
      button.setAttribute('aria-label', isPlaying ? 'Pausar vídeo' : 'Reproduzir vídeo');
    });

    if (soundButton) {
      soundButton.setAttribute(
        'aria-label',
        video.muted || video.volume === 0 ? 'Ativar som' : 'Desativar som'
      );
    }

    if (overlayTitle) {
      overlayTitle.textContent = video.ended
        ? 'Assistir novamente'
        : hasStarted
          ? 'Continuar vídeo'
          : 'Toque para assistir';
    }
  }

  async function toggleVslPlayback() {
    if (video.ended) {
      video.currentTime = 0;
    }

    if (!video.paused && !video.ended) {
      video.pause();
      return;
    }

    hasStarted = true;
    video.muted = false;
    video.volume = 1;

    try {
      await video.play();
    } catch (error) {
      console.warn('Não foi possível iniciar o vídeo com som:', error);
      syncVslState();
    }
  }

  toggleButtons.forEach((button) => {
    button.addEventListener('click', toggleVslPlayback);
  });

  video.addEventListener('click', toggleVslPlayback);

  soundButton?.addEventListener('click', () => {
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) video.volume = 1;
    syncVslState();
  });

  video.addEventListener('loadedmetadata', updateVslProgress);
  video.addEventListener('durationchange', updateVslProgress);
  video.addEventListener('timeupdate', updateVslProgress);
  video.addEventListener('play', () => {
    hasStarted = true;
    syncVslState();
  });
  video.addEventListener('pause', syncVslState);
  video.addEventListener('ended', () => {
    updateVslProgress();
    syncVslState();
  });
  video.addEventListener('volumechange', syncVslState);

  updateVslProgress();
  syncVslState();
}

configureCampaignVsl();


/* Proteção visual contra cópia casual.
   Campos do checkout continuam editáveis e o botão Copiar PIX continua funcionando. */
const isEditableTarget = (target) => Boolean(
  target?.closest?.('input, textarea, select, [contenteditable="true"]')
);

document.addEventListener('contextmenu', (event) => {
  if (!isEditableTarget(event.target)) event.preventDefault();
});

document.addEventListener('dragstart', (event) => {
  if (event.target instanceof HTMLImageElement || !isEditableTarget(event.target)) {
    event.preventDefault();
  }
});

document.addEventListener('selectstart', (event) => {
  if (!isEditableTarget(event.target)) event.preventDefault();
});

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  const blockedShortcut = (event.ctrlKey || event.metaKey) && ['c', 'a', 's', 'u', 'p'].includes(key);
  if (blockedShortcut && !isEditableTarget(event.target)) {
    event.preventDefault();
  }
});
