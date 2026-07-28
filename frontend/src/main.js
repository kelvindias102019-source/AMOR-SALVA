import './styles.css';

const API = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
const VALUES = [10, 20, 30, 50, 70, 100, 150, 200, 300, 500, 700, 1000, 1500, 2000];
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const slides = [
  { src: '/assets/1.png', title: 'O suplemento faz parte da rotina', text: 'A alimentação clínica é importante para Ana Júlia manter as forças e receber o suporte nutricional necessário no dia a dia.' },
  { src: '/assets/2.png', title: 'Mãe e filha enfrentam essa luta juntas', text: 'Maria Sônia dedica sua rotina aos cuidados da filha, acompanhando cada necessidade com atenção e carinho.' },
  { src: '/assets/3.png', title: 'Cada contribuição ajuda de verdade', text: 'Mesmo uma doação de menor valor pode colaborar com fraldas, higiene, alimentação e outras despesas contínuas.' },
  { src: '/assets/4.png', title: 'A preocupação com a moradia', text: 'A família precisa preservar um lugar seguro para viver e continuar os cuidados de Ana Júlia com mais estabilidade.' },
  { src: '/assets/5.png', title: 'Moradia e tratamento não podem esperar', text: 'Sem apoio, as despesas da casa e dos cuidados essenciais ficam cada vez mais difíceis de manter.' },
  { src: '/assets/6.png', title: 'Uma rotina marcada pela urgência', text: 'Os gastos são contínuos e a família precisa de apoio para não interromper itens indispensáveis.' },
  { src: '/assets/7.png', title: 'Ana Júlia precisa de cuidados constantes', text: 'A condição dela exige atenção integral, alimentação adequada, higiene e acompanhamento diário.' },
  { src: '/assets/8.png', title: 'O risco de perder o lar', text: 'A insegurança da moradia aumenta o peso vivido pela família e torna a campanha ainda mais urgente.' },
  { src: '/assets/9.png', title: 'A cadeira atual já não atende bem', text: 'Uma estrutura adequada ajuda a oferecer mais segurança, conforto e dignidade durante os cuidados.' },
  { src: '/assets/10.png', title: 'Até o banho exige estrutura e apoio', text: 'Atividades básicas da rotina se tornam difíceis sem equipamentos e um ambiente adaptado às necessidades de Ana Júlia.' }
];
const supporters = [
  ['AN', 'Ana M.', 'Há 2 min', 50],
  ['CR', 'Carlos R.', 'Há 12 min', 100],
  ['MP', 'Muralha P.', 'Há 20 min', 50],
  ['MS', 'Maria S.', 'Há 34 min', 200],
];

const app = document.querySelector('#app');
app.innerHTML = `
  <header class="site-header">
    <div class="page-shell header-inner">
      <a class="brand" href="#inicio" aria-label="Amor Salva">
        <img src="/assets/logo-amor-salva.png" alt="Amor Salva">
      </a>
      <button class="icon-button" id="shareBtn" aria-label="Compartilhar campanha">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="M8.7 10.7l6.6-3.8M8.7 13.3l6.6 3.8"></path></svg>
      </button>
    </div>
  </header>

  <main id="inicio">
    <section class="vsl-first page-shell" aria-labelledby="vslTitle">
      <section class="vsl-card">
        <div class="vsl-heading">
          <span class="vsl-kicker">ASSISTA À HISTÓRIA</span>
          <h1 id="vslTitle">Conheça a realidade de Maria Sônia e Ana Júlia</h1>
          <p>Veja por que esta família precisa de apoio para manter a moradia e os cuidados essenciais.</p>
        </div>
        <div class="video-stage" id="videoStage">
          <video id="campaignVideo" playsinline preload="metadata" controlslist="nodownload noplaybackrate nofullscreen noremoteplayback" disablepictureinpicture poster="/assets/banner-principal.jpg" aria-label="Vídeo da campanha. Toque para reproduzir ou pausar.">
            <source src="/assets/historia-amor-salva.mp4" type="video/mp4">
            Seu navegador não suporta vídeo HTML5.
          </video>
          <button class="video-play-overlay" id="videoPlayOverlay" type="button" aria-label="Reproduzir vídeo">
            <span class="video-play-icon" aria-hidden="true"></span>
            <strong>Toque para assistir</strong>
          </button>
        </div>
        <div class="video-progress" aria-label="Progresso visual do vídeo"><span id="fakeVideoProgress"></span></div>
        <div class="video-control-row">
          <button class="sound-toggle" id="soundToggle" type="button" aria-pressed="false">
            <span id="soundIcon" aria-hidden="true">🔊</span>
            <span id="soundLabel">Áudio ligado</span>
          </button>
          <span class="video-status" id="videoStatus">Toque no vídeo para começar</span>
        </div>
        <p class="video-note"><span></span> Assista até o fim para conhecer toda a história.</p>
      </section>
    </section>

    <section class="hero page-shell">
      <div class="hero-copy">
        <span class="eyebrow">CAMPANHA SOLIDÁRIA • AMOR SALVA</span>
        <h2>Ajude Maria Sônia e Ana Júlia a manterem um lar seguro</h2>
        <img class="hero-banner" src="/assets/banner-principal.jpg" alt="Precisamos da sua ajuda para ter onde morar">
        <p>Maria Sônia dedica todos os dias aos cuidados da filha Ana Júlia, que vive com paralisia cerebral severa e precisa de atenção integral. Hoje, elas enfrentam despesas essenciais e o risco de perder a moradia.</p>
        <div class="hero-actions hero-actions-single">
          <a class="button button-ghost" href="#historia">Conhecer a história</a>
        </div>
      </div>
    </section>

    <section class="progress-wrap page-shell" aria-label="Progresso da campanha">
      <div class="progress-card">
        <div class="progress-top">
          <div>
            <span>Já arrecadamos</span>
            <strong id="raised">R$ 27.847,00</strong>
          </div>
          <b id="percent">21,4%</b>
        </div>
        <div class="progress-track"><span id="bar" style="width:21.4%"></span></div>
        <div class="progress-bottom"><span>Meta: <strong id="goal">R$ 130.000,00</strong></span><span>Campanha ativa</span></div>
      </div>
    </section>

    <section class="donation-section page-shell" id="doar">
      <div class="donation-callout">
        <div>
          <span class="eyebrow">SUA AJUDA FAZ DIFERENÇA</span>
          <h2>Ajude a manter um lar seguro e os cuidados essenciais</h2>
          <p>Ao tocar no botão, você escolhe o valor dentro de uma janela segura. O nome é opcional e a contribuição pode ser anônima.</p>
        </div>
        <button class="button button-primary donation-main-button" data-donate>
          <span class="donation-heart">♥</span> Fazer minha parte
        </button>
      </div>
      <div class="trust-row">
        <span>✓ Pagamento via PIX</span>
        <span>✓ Nome opcional</span>
        <span>✓ Confirmação automática</span>
      </div>
    </section>

    <section class="story-section" id="historia">
      <div class="page-shell story-grid">
        <div class="story-content">
          <span class="eyebrow">A HISTÓRIA DELAS</span>
          <h2>Uma vida inteira dedicada ao cuidado</h2>
          <p>Durante a gravidez, Maria Sônia enfrentou dengue hemorrágica. Ana Júlia nasceu com hidrocefalia e paralisia cerebral severa e, desde então, necessita de cuidados constantes.</p>
          <p>As despesas incluem fraldas especiais, medicamentos neurológicos, alimentação clínica e uma moradia segura e adaptada. A renda atual não é suficiente para cobrir tudo.</p>
          <blockquote>“Choro escondida para não desanimar meus filhos. Se eu fraquejar, quem cuidará da Júlia? Ela é toda a minha vida.”</blockquote>
        </div>
        <div class="story-highlight">
          <strong>Elas precisam de apoio para:</strong>
          <ul>
            <li>Manter uma moradia segura e adaptada</li>
            <li>Comprar fraldas e itens de higiene</li>
            <li>Garantir medicamentos de uso contínuo</li>
            <li>Custear alimentação clínica e cuidados diários</li>
          </ul>
          <button class="button button-primary" data-donate>Fazer minha parte</button>
        </div>
      </div>
    </section>

    <section class="gallery-section page-shell">
      <div class="section-heading">
        <span class="eyebrow">REGISTROS DA CAMPANHA</span>
        <h2>Conheça um pouco da rotina da família</h2>
      </div>
      <div class="gallery-track">
        ${slides.map((slide, i) => `
          <article class="gallery-card">
            <img src="${slide.src}" alt="${slide.title}" loading="lazy">
            <div class="gallery-caption">
              <span>REGISTRO ${String(i + 1).padStart(2, '0')}</span>
              <h3>${slide.title}</h3>
              <p>${slide.text}</p>
            </div>
          </article>`).join('')}
      </div>
    </section>

    <section class="impact-section">
      <div class="page-shell">
        <div class="section-heading light centered">
          <span class="eyebrow">SEU APOIO TEM IMPACTO</span>
          <h2>Veja como cada contribuição pode ajudar</h2>
        </div>
        <div class="impact-grid">
          <article><strong>R$ 30</strong><p>Ajuda com fraldas e itens básicos de higiene.</p></article>
          <article><strong>R$ 100</strong><p>Contribui para medicamentos e insumos contínuos.</p></article>
          <article><strong>R$ 300</strong><p>Apoia alimentação clínica e despesas essenciais.</p></article>
          <article><strong>R$ 500</strong><p>Ajuda na manutenção de uma moradia segura.</p></article>
        </div>
      </div>
    </section>

    <section class="needs-section page-shell">
      <div class="section-heading">
        <span class="eyebrow">NECESSIDADES CONTÍNUAS</span>
        <h2>Cuidados que não podem esperar</h2>
      </div>
      <div class="needs-grid">
        <article class="need-card"><img src="/assets/hidantal.jpg" alt="Medicamento"><div><h3>Medicamentos neurológicos</h3><p>Uso contínuo conforme acompanhamento médico.</p></div></article>
        <article class="need-card"><img src="/assets/7.png" alt="Cuidados diários"><div><h3>Cuidados diários</h3><p>Fraldas, alimentação, higiene e suporte integral.</p></div></article>
        <article class="need-card"><img src="/assets/8.png" alt="Moradia"><div><h3>Moradia segura</h3><p>Apoio para preservar um lar adequado às necessidades da família.</p></div></article>
      </div>
    </section>

    <section class="supporters-section page-shell">
      <div class="section-heading">
        <span class="eyebrow">CORRENTE DO BEM</span>
        <h2>Últimas contribuições</h2>
      </div>
      <div class="support-list">
        ${supporters.map(s => `<article><span class="avatar">${s[0]}</span><div><b>${s[1]}</b><small>${s[2]}</small></div><strong>${money.format(s[3])}</strong></article>`).join('')}
      </div>
    </section>

    <section class="faq-section page-shell">
      <div class="section-heading">
        <span class="eyebrow">TRANSPARÊNCIA</span>
        <h2>Dúvidas frequentes</h2>
      </div>
      <details open><summary>Como os recursos serão usados?</summary><p>Em moradia, alimentação, fraldas, medicamentos, insumos e necessidades diretamente relacionadas aos cuidados de Ana Júlia.</p></details>
      <details><summary>Posso doar de forma anônima?</summary><p>Sim. O nome é opcional e o pagamento pode ser gerado sem identificação pública.</p></details>
      <details><summary>Como o pagamento é confirmado?</summary><p>O sistema acompanha a cobrança e confirma a doação quando o gateway informa o pagamento.</p></details>
    </section>

    <section class="final-cta">
      <div class="page-shell final-card">
        <img src="/assets/logo-amor-salva.png" alt="Amor Salva">
        <div><span class="eyebrow">AMOR SALVA</span><h2>Juntos podemos aliviar esse peso</h2><p>Escolha um valor e ajude Maria Sônia e Ana Júlia a seguirem com mais segurança e dignidade.</p></div>
        <button class="button button-primary" data-donate>Fazer minha parte</button>
      </div>
    </section>
  </main>

  <button class="sticky-donate" data-donate>Fazer minha parte</button>

  <div class="modal" id="modal" aria-hidden="true">
    <div class="backdrop" data-close></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-label="Fazer doação">
      <button class="close" data-close aria-label="Fechar">×</button>
      <div id="valueStep" class="step active">
        <span class="eyebrow">AJUDE COM O VALOR QUE PUDER</span>
        <h2>Escolha sua contribuição</h2>
        <div class="value-grid">${VALUES.map(v => `<button data-value="${v}">${money.format(v).replace(',00','')}</button>`).join('')}</div>
        <p class="secure">Pagamento por PIX gerado com segurança.</p>
      </div>
      <form id="donorForm" class="step">
        <button class="back" type="button" id="backValues">← Alterar valor</button>
        <p class="selected">Doação de <b id="selectedValue"></b></p>
        <label>Seu nome <span>(opcional)</span><input name="name" maxlength="100" placeholder="Deixe vazio para doar anonimamente"></label>
        <label class="check"><input type="checkbox" name="showPublic"> Mostrar meu nome entre os apoiadores</label>
        <button class="button button-primary full" id="generate" type="submit">Gerar QR Code PIX</button>
        <p class="error" id="error"></p>
      </form>
      <div id="pixStep" class="step pix">
        <h2>Escaneie para doar</h2>
        <p>Valor: <b id="pixAmount"></b></p>
        <div class="qr"><img id="qrImage" alt="QR Code PIX"></div>
        <p class="waiting"><span></span>Aguardando confirmação do pagamento…</p>
        <button class="button button-ghost full" data-close>Fechar</button>
      </div>
      <div id="successStep" class="step success"><div>✓</div><h2>Doação confirmada</h2><p>Obrigado por fazer parte desta corrente de amor.</p><button class="button button-primary full" data-close>Concluir</button></div>
    </section>
  </div>`;

let selectedAmount = null;
let poll = null;
const modal = document.querySelector('#modal');
const steps = [...document.querySelectorAll('.step')];
const showStep = id => steps.forEach(s => s.classList.toggle('active', s.id === id));

function openDonation(amount) {
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lock');
  if (amount) {
    selectedAmount = Number(amount);
    document.querySelector('#selectedValue').textContent = money.format(selectedAmount);
    showStep('donorForm');
  } else {
    showStep('valueStep');
  }
}

function closeDonation() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('lock');
  clearInterval(poll);
}

document.querySelectorAll('[data-donate]').forEach(b => b.addEventListener('click', () => openDonation()));
document.querySelectorAll('[data-quick-donate]').forEach(b => b.addEventListener('click', () => openDonation(b.dataset.quickDonate)));
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeDonation));
document.querySelectorAll('[data-value]').forEach(b => b.addEventListener('click', () => {
  selectedAmount = Number(b.dataset.value);
  document.querySelector('#selectedValue').textContent = money.format(selectedAmount);
  showStep('donorForm');
}));
document.querySelector('#backValues').addEventListener('click', () => showStep('valueStep'));
document.querySelector('#shareBtn').addEventListener('click', async () => {
  const data = { title: document.title, text: 'Conheça esta campanha do Amor Salva', url: location.href };
  try { navigator.share ? await navigator.share(data) : await navigator.clipboard.writeText(location.href); } catch {}
});

document.querySelector('#donorForm').addEventListener('submit', async e => {
  e.preventDefault();
  const error = document.querySelector('#error');
  error.textContent = '';
  const btn = document.querySelector('#generate');
  btn.disabled = true;
  btn.textContent = 'Gerando…';
  const fd = new FormData(e.currentTarget);
  const name = String(fd.get('name') || '').trim();
  const payload = { amount: selectedAmount, name, showPublic: Boolean(name) && fd.get('showPublic') === 'on', ...tracking() };
  try {
    if (!API) throw new Error('O pagamento ainda não foi configurado.');
    const response = await fetch(`${API}/api/donations/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível gerar o PIX.');
    document.querySelector('#qrImage').src = data.qrImage;
    document.querySelector('#pixAmount').textContent = money.format(data.amount);
    showStep('pixStep');
    startPolling(data.externalId);
  } catch (err) {
    error.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Gerar QR Code PIX';
  }
});

function tracking() {
  const params = new URLSearchParams(location.search);
  const output = {};
  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid','ttclid'].forEach(key => {
    const value = params.get(key);
    if (value) output[key] = value;
  });
  return output;
}

function startPolling(id) {
  clearInterval(poll);
  const check = async () => {
    try {
      const response = await fetch(`${API}/api/donations/${encodeURIComponent(id)}/status`, { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      if (data.status === 'COMPLETED') {
        clearInterval(poll);
        showStep('successStep');
        loadCampaign();
      }
    } catch {}
  };
  check();
  poll = setInterval(check, 5000);
}

const campaignVideo = document.querySelector('#campaignVideo');
const fakeVideoProgress = document.querySelector('#fakeVideoProgress');
const videoStage = document.querySelector('#videoStage');
const videoPlayOverlay = document.querySelector('#videoPlayOverlay');
const soundToggle = document.querySelector('#soundToggle');
const soundIcon = document.querySelector('#soundIcon');
const soundLabel = document.querySelector('#soundLabel');
const videoStatus = document.querySelector('#videoStatus');

function updateVisualVideoProgress() {
  if (!campaignVideo || !fakeVideoProgress) return;
  const duration = Number(campaignVideo.duration);
  const current = Number(campaignVideo.currentTime);
  if (!Number.isFinite(duration) || duration <= 0) {
    fakeVideoProgress.style.width = '0%';
    return;
  }

  if (campaignVideo.ended || current >= duration - 0.05) {
    fakeVideoProgress.style.width = '100%';
    return;
  }

  const realRatio = Math.max(0, Math.min(0.999, current / duration));
  let visualRatio;
  if (realRatio <= 0.72) {
    // Chega rapidamente a 93% durante os primeiros 72% do vídeo.
    visualRatio = (realRatio / 0.72) * 0.93;
  } else {
    // Nos minutos finais, avança lentamente e fica abaixo de 100% até o término real.
    const finalPhase = (realRatio - 0.72) / 0.28;
    visualRatio = 0.93 + 0.069 * (1 - Math.pow(1 - finalPhase, 2.6));
  }
  fakeVideoProgress.style.width = `${Math.min(99.9, visualRatio * 100).toFixed(2)}%`;
}

function updateVideoInterface() {
  if (!campaignVideo) return;
  const playing = !campaignVideo.paused && !campaignVideo.ended;
  videoPlayOverlay?.classList.toggle('is-hidden', playing);
  if (videoPlayOverlay) {
    videoPlayOverlay.setAttribute('aria-label', playing ? 'Pausar vídeo' : 'Reproduzir vídeo');
    const label = videoPlayOverlay.querySelector('strong');
    if (label) label.textContent = campaignVideo.ended ? 'Assistir novamente' : (campaignVideo.paused && campaignVideo.currentTime > 0 ? 'Continuar assistindo' : 'Toque para assistir');
  }
  if (videoStatus) videoStatus.textContent = campaignVideo.ended ? 'Vídeo concluído' : (playing ? 'Reproduzindo' : 'Vídeo pausado');
}

async function toggleVideoPlayback() {
  if (!campaignVideo) return;
  try {
    if (campaignVideo.ended) campaignVideo.currentTime = 0;
    if (campaignVideo.paused) await campaignVideo.play();
    else campaignVideo.pause();
  } catch {}
  updateVideoInterface();
}

function updateSoundInterface() {
  if (!campaignVideo) return;
  const muted = campaignVideo.muted || campaignVideo.volume === 0;
  soundToggle?.setAttribute('aria-pressed', String(muted));
  if (soundIcon) soundIcon.textContent = muted ? '🔇' : '🔊';
  if (soundLabel) soundLabel.textContent = muted ? 'Ativar áudio' : 'Áudio ligado';
}

if (campaignVideo) {
  campaignVideo.controls = false;
  campaignVideo.removeAttribute('controls');
  campaignVideo.addEventListener('click', toggleVideoPlayback);
  videoPlayOverlay?.addEventListener('click', toggleVideoPlayback);
  soundToggle?.addEventListener('click', () => {
    campaignVideo.muted = !campaignVideo.muted;
    updateSoundInterface();
  });
  ['loadedmetadata', 'timeupdate', 'seeking', 'seeked'].forEach(eventName => {
    campaignVideo.addEventListener(eventName, updateVisualVideoProgress);
  });
  ['play', 'pause', 'ended'].forEach(eventName => {
    campaignVideo.addEventListener(eventName, updateVideoInterface);
  });
  campaignVideo.addEventListener('volumechange', updateSoundInterface);
  campaignVideo.addEventListener('ended', () => {
    fakeVideoProgress.style.width = '100%';
  });
  updateVideoInterface();
  updateSoundInterface();
}

async function loadCampaign() {
  if (!API) return;
  try {
    const response = await fetch(`${API}/api/campaign`, { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    document.querySelector('#raised').textContent = money.format(data.raised);
    document.querySelector('#goal').textContent = money.format(data.goal);
    document.querySelector('#percent').textContent = `${data.percentage}%`;
    document.querySelector('#bar').style.width = `${Math.min(100, data.percentage)}%`;
  } catch {}
}

loadCampaign();
