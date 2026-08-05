import './styles.css';

const API = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
const TURNSTILE_SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();
let turnstileWidgetId = null;
const VALUES = [10, 20, 30, 50, 70, 100, 150, 200, 300, 500, 700, 1000, 1500, 2000];
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const slides = [
  { record: '01', src: '/assets/1.png', title: 'O suplemento faz parte da rotina', text: 'A alimentação clínica é importante para Ana Júlia manter as forças e receber o suporte nutricional necessário no dia a dia.' },
  { record: '02', src: '/assets/2.png', title: 'Mãe e filha enfrentam essa luta juntas', text: 'Maria Sônia dedica sua rotina aos cuidados da filha, acompanhando cada necessidade com atenção e carinho.' },
  { record: '03', src: '/assets/3.png', title: 'Cada contribuição ajuda de verdade', text: 'Mesmo uma doação de menor valor pode colaborar com fraldas, higiene, alimentação e outras despesas contínuas.' },
  { record: '04', src: '/assets/4.png', title: 'A preocupação com a moradia', text: 'A família precisa preservar um lugar seguro para viver e continuar os cuidados de Ana Júlia com mais estabilidade.' },
  { record: '05', src: '/assets/6.png', title: 'Uma rotina marcada pela urgência', text: 'Os gastos são contínuos e a família precisa de apoio para não interromper itens indispensáveis.' },
  { record: '06', src: '/assets/7.png', title: 'Ana Júlia precisa de cuidados constantes', text: 'A condição dela exige atenção integral, alimentação adequada, higiene e acompanhamento diário.' },
  { record: '07', src: '/assets/8.png', title: 'O risco de perder o lar', text: 'A insegurança da moradia aumenta o peso vivido pela família e torna a campanha ainda mais urgente.' },
  { record: '08', src: '/assets/9.png', title: 'A cadeira atual já não atende bem', text: 'Uma estrutura adequada ajuda a oferecer mais segurança, conforto e dignidade durante os cuidados.' },
  { record: '09', src: '/assets/10.png', title: 'Até o banho exige estrutura e apoio', text: 'Atividades básicas da rotina se tornam difíceis sem equipamentos e um ambiente adaptado às necessidades de Ana Júlia.' }
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
      <button class="menu-toggle" id="menuToggle" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="siteMenu">
        <span></span><span></span><span></span>
      </button>
      <a class="brand" href="#inicio" aria-label="Amor Salva — início">
        <img src="/assets/logo-amor-salva-icon.png" alt="Símbolo do Instituto Amor Salva">
        <span class="brand-copy"><strong>Amor Salva</strong><small>Instituto de apoio solidário</small></span>
      </a>
      <span class="header-spacer" aria-hidden="true"></span>
    </div>
    <nav class="mobile-menu" id="siteMenu" aria-label="Navegação principal">
      <div class="page-shell mobile-menu-inner">
        <a href="#quem-somos">Quem somos</a>
        <a href="#campanha">Campanha</a>
        <a href="#transparencia">Transparência</a>
      </div>
    </nav>
  </header>

  <main id="inicio">
    <section class="vsl-first page-shell" aria-labelledby="vslTitle">
      <section class="vsl-card">
        <div class="vsl-heading">
          <h1 id="vslTitle">Conheça a realidade de Maria Sônia e Ana Júlia</h1>
          <p>Veja por que esta família precisa de apoio para manter a moradia e os cuidados essenciais.</p>
        </div>
        <div class="video-stage" id="videoStage">
          <video id="campaignVideo" playsinline preload="auto" controlslist="nodownload noplaybackrate nofullscreen noremoteplayback" disablepictureinpicture poster="/assets/banner-principal.jpg" aria-label="Vídeo da campanha. O vídeo inicia automaticamente sem som; toque para pausar ou continuar.">
            <source src="/assets/historia-amor-salva.mp4" type="video/mp4">
            Seu navegador não suporta vídeo HTML5.
          </video>
          <button class="video-play-overlay" id="videoPlayOverlay" type="button" aria-label="Reproduzir vídeo">
            <span class="video-play-icon" aria-hidden="true"></span>
            <strong id="videoCountdown">Começando em 2...</strong>
          </button>
          <button class="video-audio-prompt" id="videoAudioPrompt" type="button" aria-label="Ativar áudio do vídeo">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"></path><path d="m17 9 4 4m0-4-4 4"></path></svg>
            <strong>Clique para ativar o áudio</strong>
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

    <section class="hero page-shell" id="campanha">
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
          <span class="donation-heart">♥</span> Doar agora
        </button>
      </div>
    </section>

    <section class="institute-profile page-shell" aria-labelledby="instituteProfileTitle">
      <div class="institute-profile-card">
        <div class="institute-profile-logo institute-profile-logo-full">
          <img src="/assets/logo-amor-salva-completa.png" alt="Instituto Amor Salva">
        </div>
        <div class="institute-profile-copy">
          <span class="eyebrow">RESPONSÁVEL PELA CAMPANHA</span>
          <h2 id="instituteProfileTitle">Instituto Amor Salva</h2>
          <ul class="institute-data">
            <li><span class="institute-data-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg></span><strong>@instituto_amor_salva</strong></li>
            <li><span class="institute-data-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/></svg></span><strong>Belo Horizonte, Minas Gerais</strong></li>
            <li><span class="institute-data-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg></span><strong>CNPJ: 77.260.528/0001-24</strong></li>
          </ul>
        </div>
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
          <div class="support-needs-heading">
            <span>ONDE SUA AJUDA CHEGA</span>
            <h3>Elas precisam de apoio todos os dias</h3>
            <p>Cada contribuição ajuda a sustentar uma parte essencial da rotina da família.</p>
          </div>
          <div class="support-needs-grid">
            <article class="support-need-item">
              <span class="support-need-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5z"/><path d="M9 21v-6h6v6"/></svg>
              </span>
              <div><h4>Moradia segura</h4><p>Um lar estável e adaptado para os cuidados de Ana Júlia.</p></div>
            </article>
            <article class="support-need-item">
              <span class="support-need-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M8 3h8v4H8z"/><path d="M7 7h10l1 3v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-9z"/><path d="M9 13h6M12 10v6"/></svg>
              </span>
              <div><h4>Fraldas e higiene</h4><p>Itens usados diariamente para garantir conforto e dignidade.</p></div>
            </article>
            <article class="support-need-item">
              <span class="support-need-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M9 3h6v4H9z"/><path d="M8 7h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><path d="M9 14h6M12 11v6"/></svg>
              </span>
              <div><h4>Medicamentos contínuos</h4><p>Tratamentos que não podem ser interrompidos.</p></div>
            </article>
            <article class="support-need-item">
              <span class="support-need-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M5 4v7a3 3 0 0 0 6 0V4M8 4v17M16 4v17M16 4c3 2 3 7 0 9"/></svg>
              </span>
              <div><h4>Alimentação e cuidados</h4><p>Suplementos, alimentação clínica e despesas da rotina.</p></div>
            </article>
          </div>
          <button class="button button-primary support-needs-button" data-donate>Fazer minha parte</button>
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
              <span>REGISTRO ${slide.record}</span>
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

    <section class="updates-section page-shell">
      <div class="info-card">
        <div class="info-heading">
          <span class="info-icon" aria-hidden="true">◷</span>
          <h2>Acompanhe as Atualizações</h2>
        </div>
        <div class="updates-list">
          <article class="update-item">
            <span class="update-date">14 de Julho</span>
            <h3>Benefício cortado</h3>
            <p>O auxílio governamental essencial foi suspenso temporariamente, gerando pânico imediato na família.</p>
          </article>
          <article class="update-item">
            <span class="update-date">01 de Julho</span>
            <h3>Risco de despejo</h3>
            <p>Sem recursos para o aluguel adaptado para acessibilidade, a família recebeu uma notificação de desocupação.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="trust-faq-section page-shell" id="transparencia">
      <div class="info-card">
        <div class="info-heading">
          <span class="info-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.8 2.8 8.1 7 10 4.2-1.9 7-5.2 7-10V6z"/><path d="m9 12 2 2 4-4"/></svg></span>
          <h2>Transparência e Respostas</h2>
        </div>
        <div class="trust-badges">
          <article class="trust-badge">
            <span class="trust-badge-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.8 2.8 8.1 7 10 4.2-1.9 7-5.2 7-10V6z"/><path d="m9 12 2 2 4-4"/></svg>
            </span>
            <div><strong>Campanha 100% real</strong><small>História e necessidades apresentadas com clareza</small></div>
          </article>
          <article class="trust-badge">
            <span class="trust-badge-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
            </span>
            <div><strong>Doação protegida</strong><small>Pagamento gerado em ambiente seguro</small></div>
          </article>
          <article class="trust-badge">
            <span class="trust-badge-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5M10 13h5M10 17h5"/></svg>
            </span>
            <div><strong>Contas auditadas</strong><small>Uso dos recursos acompanhado e organizado</small></div>
          </article>
        </div>
        <div class="faq-list">
          <details open>
            <summary>A doação é segura?</summary>
            <p>Sim. O pagamento é gerado em ambiente protegido e a confirmação acontece somente após o sistema receber o retorno oficial da cobrança.</p>
          </details>
          <details>
            <summary>Como os fundos serão usados?</summary>
            <p>Os recursos serão direcionados para moradia, alimentação clínica, fraldas, medicamentos, higiene e demais necessidades ligadas à rotina de Ana Júlia e Maria Sônia.</p>
          </details>
          <details>
            <summary>Posso doar outros valores?</summary>
            <p>Sim. Os valores sugeridos foram pensados para facilitar a contribuição, mas a campanha pode receber outros apoios conforme a configuração do pagamento.</p>
          </details>
        </div>
      </div>
    </section>

    <section class="about-institute" id="quem-somos">
      <div class="page-shell about-institute-grid">
        <div class="about-institute-mark about-institute-mark-full">
          <img src="/assets/logo-amor-salva-completa.png" alt="Instituto Amor Salva">
        </div>
        <div class="about-institute-copy">
          <span class="eyebrow">QUEM SOMOS</span>
          <h2>Um instituto criado para transformar solidariedade em apoio real</h2>
          <p>O Instituto Amor Salva atua mobilizando pessoas em torno de famílias que enfrentam situações urgentes, conectando quem precisa de ajuda a quem deseja colaborar.</p>
          <p>Nossa missão é dar visibilidade a histórias que não podem esperar e direcionar apoio para necessidades essenciais, como moradia, alimentação, saúde, higiene e cuidados contínuos.</p>
          <div class="about-institute-values">
            <span>Transparência</span><span>Acolhimento</span><span>Responsabilidade</span>
          </div>
        </div>
      </div>
    </section>

    <section class="final-cta">
      <div class="page-shell final-card">
        <img src="/assets/logo-amor-salva.png" alt="Amor Salva">
        <div><span class="eyebrow">AMOR SALVA</span><h2>Juntos podemos aliviar esse peso</h2><p>Escolha um valor e ajude Maria Sônia e Ana Júlia a seguirem com mais segurança e dignidade.</p></div>
        <button class="button button-primary" data-donate>Doar agora</button>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="page-shell footer-inner">
      <a class="footer-brand" href="#inicio">
        <img src="/assets/logo-amor-salva-icon.png" alt="Instituto Amor Salva">
        <span><strong>Instituto Amor Salva</strong><small>Solidariedade que acolhe</small></span>
      </a>
      <nav class="footer-nav" aria-label="Links do rodapé">
        <a href="#quem-somos">Quem somos</a>
        <a href="#campanha">Campanha</a>
        <a href="#transparencia">Transparência</a>
      </nav>
      <p>© 2024 Instituto Amor Salva. Todos os direitos reservados.</p>
    </div>
  </footer>

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
        <input type="text" name="website" class="hp-field" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div id="turnstileContainer" class="turnstile-container" aria-label="Verificação de segurança"></div>
        <button class="button button-primary full" id="generate" type="submit">Gerar QR Code PIX</button>
        <p class="error" id="error"></p>
      </form>
      <div id="pixStep" class="step pix">
        <h2>Escaneie para doar</h2>
        <p>Valor: <b id="pixAmount"></b></p>
        <div class="qr"><img id="qrImage" alt="QR Code PIX"></div>
        <label class="pix-copy-label" for="pixCopyCode">PIX copia e cola</label>
        <textarea id="pixCopyCode" class="pix-copy-code" readonly aria-label="Código PIX copia e cola"></textarea>
        <button class="button button-ghost full" id="copyPixButton" type="button">Copiar código PIX</button>
        <p class="waiting"><span></span>Aguardando confirmação do pagamento…</p>
        <button class="button button-ghost full" data-close>Fechar</button>
      </div>
      <div id="successStep" class="step success"><div>✓</div><h2>Doação confirmada</h2><p>Obrigado por fazer parte desta corrente de amor.</p><button class="button button-primary full" data-close>Concluir</button></div>
    </section>
  </div>`;



function renderTurnstile() {
  if (!TURNSTILE_SITE_KEY || !window.turnstile || turnstileWidgetId !== null) return;
  const container = document.querySelector('#turnstileContainer');
  if (!container) return;
  turnstileWidgetId = window.turnstile.render(container, {
    sitekey: TURNSTILE_SITE_KEY,
    theme: 'light',
    size: 'flexible'
  });
}
window.onTurnstileLoad = renderTurnstile;

const copyPixButton = document.querySelector('#copyPixButton');
copyPixButton?.addEventListener('click', async () => {
  const pixCopyCode = document.querySelector('#pixCopyCode');
  const code = pixCopyCode?.value || '';
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    copyPixButton.textContent = 'Código copiado';
  } catch {
    pixCopyCode.focus();
    pixCopyCode.select();
    document.execCommand('copy');
    copyPixButton.textContent = 'Código copiado';
  }
  window.setTimeout(() => { copyPixButton.textContent = 'Copiar código PIX'; }, 1800);
});

let selectedAmount = null;
let poll = null;
const modal = document.querySelector('#modal');
const menuToggle = document.querySelector('#menuToggle');
const siteMenu = document.querySelector('#siteMenu');
const closeSiteMenu = () => {
  siteMenu?.classList.remove('is-open');
  menuToggle?.classList.remove('is-open');
  menuToggle?.setAttribute('aria-expanded', 'false');
};
menuToggle?.addEventListener('click', () => {
  const open = !siteMenu?.classList.contains('is-open');
  siteMenu?.classList.toggle('is-open', open);
  menuToggle.classList.toggle('is-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
});
document.querySelectorAll('#siteMenu a, .footer-nav a').forEach(link => link.addEventListener('click', closeSiteMenu));

const steps = [...document.querySelectorAll('.step')];
const showStep = id => steps.forEach(s => s.classList.toggle('active', s.id === id));

function openDonation(amount) {
  modal.classList.add('open');
  window.setTimeout(renderTurnstile, 80);
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

document.querySelector('#donorForm').addEventListener('submit', async e => {
  e.preventDefault();
  const error = document.querySelector('#error');
  error.textContent = '';
  const btn = document.querySelector('#generate');
  btn.disabled = true;
  btn.textContent = 'Gerando…';
  const fd = new FormData(e.currentTarget);
  const name = String(fd.get('name') || '').trim();
  const turnstileToken = TURNSTILE_SITE_KEY && window.turnstile && turnstileWidgetId !== null ? window.turnstile.getResponse(turnstileWidgetId) : '';
  const payload = { amount: selectedAmount, name, website: String(fd.get('website') || ''), turnstileToken, showPublic: Boolean(name) && fd.get('showPublic') === 'on', ...tracking() };
  try {
    if (!API) throw new Error('O pagamento ainda não foi configurado.');
    if (TURNSTILE_SITE_KEY && !turnstileToken) throw new Error('Confirme a verificação de segurança.');
    const response = await fetch(`${API}/api/donations/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível gerar o PIX.');
    document.querySelector('#qrImage').src = data.qrImage;
    document.querySelector('#pixAmount').textContent = money.format(data.amount);
    document.querySelector('#pixCopyCode').value = data.pixCode || '';
    showStep('pixStep');
    startPolling(data.externalId);
  } catch (err) {
    error.textContent = err.message;
    if (window.turnstile && turnstileWidgetId !== null) window.turnstile.reset(turnstileWidgetId);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Gerar QR Code PIX';
  }
});

function readCookie(name) {
  const prefix = `${name}=`;
  const part = document.cookie.split(';').map(item => item.trim()).find(item => item.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : '';
}

function tracking() {
  const params = new URLSearchParams(location.search);
  const output = {};
  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid','ttclid'].forEach(key => {
    const value = params.get(key) || sessionStorage.getItem(`tracking_${key}`) || '';
    if (value) {
      output[key] = value;
      sessionStorage.setItem(`tracking_${key}`, value);
    }
  });

  const fbp = readCookie('_fbp');
  const cookieFbc = readCookie('_fbc');
  const fbclid = output.fbclid || '';
  if (fbp) output.fbp = fbp;
  if (cookieFbc) output.fbc = cookieFbc;
  else if (fbclid) output.fbc = `fb.1.${Date.now()}.${fbclid}`;
  output.event_source_url = `${location.origin}${location.pathname}`;
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
const videoAudioPrompt = document.querySelector('#videoAudioPrompt');
const soundIcon = document.querySelector('#soundIcon');
const soundLabel = document.querySelector('#soundLabel');
const videoStatus = document.querySelector('#videoStatus');
let visualProgressFrame = null;
let autoplayCountdownActive = true;
let autoplayCountdownStarted = false;

function stopVisualProgressLoop() {
  if (visualProgressFrame !== null) {
    cancelAnimationFrame(visualProgressFrame);
    visualProgressFrame = null;
  }
}

function startVisualProgressLoop() {
  stopVisualProgressLoop();
  const tick = () => {
    updateVisualVideoProgress();
    if (campaignVideo && !campaignVideo.paused && !campaignVideo.ended) {
      visualProgressFrame = requestAnimationFrame(tick);
    } else {
      visualProgressFrame = null;
    }
  };
  visualProgressFrame = requestAnimationFrame(tick);
}

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

  if (realRatio <= 0.22) {
    // Sensação de vídeo curto: a barra alcança cerca de 88% ainda no começo.
    const phase = realRatio / 0.22;
    visualRatio = 0.88 * (1 - Math.pow(1 - phase, 2.8));
  } else if (realRatio <= 0.62) {
    // Continua avançando, mas já reduz bastante a velocidade.
    const phase = (realRatio - 0.22) / 0.40;
    visualRatio = 0.88 + (0.97 - 0.88) * (1 - Math.pow(1 - phase, 1.8));
  } else {
    // Trecho final: percorre os últimos pixels devagar e só completa no fim real.
    const phase = (realRatio - 0.62) / 0.38;
    visualRatio = 0.97 + 0.029 * (1 - Math.pow(1 - phase, 2.2));
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
    if (label && !autoplayCountdownActive) label.textContent = campaignVideo.ended ? 'Assistir novamente' : (campaignVideo.paused && campaignVideo.currentTime > 0 ? 'Continuar assistindo' : 'Toque para assistir');
  }
  if (videoStatus) videoStatus.textContent = autoplayCountdownActive ? 'O vídeo começará automaticamente' : (campaignVideo.ended ? 'Vídeo concluído' : (playing ? 'Reproduzindo' : 'Vídeo pausado'));
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
  videoAudioPrompt?.classList.toggle('is-hidden', !muted || campaignVideo.paused || campaignVideo.ended);
}

if (campaignVideo) {
  campaignVideo.controls = false;
  campaignVideo.removeAttribute('controls');
  campaignVideo.autoplay = false;
  campaignVideo.muted = true;
  campaignVideo.defaultMuted = true;
  campaignVideo.volume = 1;
  campaignVideo.playsInline = true;

  const startVideoAutomatically = () => {
    if (autoplayCountdownStarted) return;
    autoplayCountdownStarted = true;
    const label = document.querySelector('#videoCountdown');
    videoPlayOverlay?.classList.remove('is-hidden');
    if (label) label.textContent = 'Começando em 2...';
    if (videoStatus) videoStatus.textContent = 'O vídeo começará automaticamente';

    window.setTimeout(() => {
      if (label) label.textContent = 'Começando em 1...';
    }, 1000);

    window.setTimeout(async () => {
      autoplayCountdownActive = false;
      try {
        // Autoplay confiável: começa sem som e pede uma interação para ativar o áudio.
        campaignVideo.muted = true;
        campaignVideo.volume = 1;
        await campaignVideo.play();
        updateSoundInterface();
      } catch {
        if (label) label.textContent = 'Toque para assistir';
        updateVideoInterface();
      }
    }, 2000);
  };

  campaignVideo.addEventListener('click', toggleVideoPlayback);
  videoPlayOverlay?.addEventListener('click', toggleVideoPlayback);
  const toggleVideoSound = () => {
    campaignVideo.muted = !campaignVideo.muted;
    if (!campaignVideo.muted) campaignVideo.volume = 1;
    updateSoundInterface();
  };
  soundToggle?.addEventListener('click', toggleVideoSound);
  videoAudioPrompt?.addEventListener('click', event => {
    event.stopPropagation();
    campaignVideo.muted = false;
    campaignVideo.volume = 1;
    updateSoundInterface();
  });
  ['loadedmetadata', 'timeupdate', 'seeking', 'seeked'].forEach(eventName => {
    campaignVideo.addEventListener(eventName, updateVisualVideoProgress);
  });
  campaignVideo.addEventListener('play', () => {
    updateVideoInterface();
    startVisualProgressLoop();
  });
  campaignVideo.addEventListener('pause', () => {
    updateVideoInterface();
    stopVisualProgressLoop();
    updateVisualVideoProgress();
  });
  campaignVideo.addEventListener('ended', () => {
    updateVideoInterface();
    stopVisualProgressLoop();
  });
  campaignVideo.addEventListener('volumechange', updateSoundInterface);
  campaignVideo.addEventListener('ended', () => {
    fakeVideoProgress.style.width = '100%';
  });
  updateVideoInterface();
  updateSoundInterface();
  startVideoAutomatically();
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
