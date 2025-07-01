// sidebar.js

// Utilidad para obtener la URL y HTML de la página actual desde el content script
function getPageInfo() {
	console.log('ContraPunto: Requesting page info (chrome.runtime.sendMessage)'); // DEBUG
	return new Promise((resolve, reject) => {
		// Pedir al background que solicite la info al content script
		if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
			reject('chrome.runtime.sendMessage no está disponible');
			return;
		}
		chrome.runtime.sendMessage({ type: 'CONTRAPUNTO_GET_PAGE_INFO' }, (response) => {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
				return;
			}
			if (!response || !response.html || !response.url) {
				reject('Respuesta inválida del content script');
				return;
			}
			const { url } = response;
			console.log('ContraPunto: Page URL', url); // DEBUG
			resolve({ url });
		});
	});
}

async function analyzeArticle() {
	const analyzeBtn = document.getElementById('analyze-btn');
	const loading = document.getElementById('loading-indicator');
	const content = document.getElementById('sidebar-content');
	analyzeBtn.disabled = true;
	content.style.display = 'none';
	loading.style.display = 'block';

	try {
		// Obtener info de la página
		const pageInfo = await getPageInfo();
		console.log('ContraPunto: pageInfo', pageInfo); // DEBUG
		// Solo enviar la URL en el body
		const res = await fetch('http://localhost:3001/news-analysis/single', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: pageInfo.url }),
		});
		console.log('ContraPunto: API status', res.status); // DEBUG
		const data = await res.json();
		console.log('ContraPunto: API response', data); // DEBUG
		// Renderizar el resultado (aquí deberías adaptar el render según la respuesta de la API)
		renderAnalysis(data);
	} catch (e) {
		console.error('ContraPunto: error', e); // DEBUG
		content.innerHTML =
			'<div style="color:red;text-align:center;">Error al analizar el artículo.</div>';
		content.style.display = 'block';
	} finally {
		loading.style.display = 'none';
		analyzeBtn.disabled = false;
	}
}

function renderAnalysis(data) {
	const content = document.getElementById('sidebar-content');
	content.style.display = 'block';

	// Desestructuramos los datos esperados de la API
	const {
		title = '',
		snippet = '',
		url = '',
		source = '',
		publishedAt = '',
		neutralSummary = '',
		biasAnalysis = {},
		actorAnalysis = {},
		contextInfo = '',
		keywords = [],
		entities = [],
		writingStyle = '',
		factCheck = '',
		glossary = [],
		dataAnalysis = null,
		politicalBiasScore = 0,
		factualityScore = 0,
		sensationalismScore = 0,
		personEntities = [],
	} = data || {};

	// Bias label y escala
	let biasLabel = 'Desconocido';
	let biasText = '';
	let bias = 50;
	let biasConfidence = null;
	if (typeof politicalBiasScore === 'number') {
		// -1 (izquierda) a 1 (derecha)
		bias = Math.round(((politicalBiasScore + 1) / 2) * 100);
		if (politicalBiasScore < -0.33) biasLabel = 'Izquierda';
		else if (politicalBiasScore > 0.33) biasLabel = 'Derecha';
		else biasLabel = 'Centro';
		biasText = biasAnalysis.explanation || '';
		biasConfidence = biasAnalysis.confidence;
	}

	// Actor favorecido y confianza
	let favoredActor = actorAnalysis.favoredActor || '';
	let actorConfidence = actorAnalysis.confidence;

	// Data analysis
	let chartHtml = '';
	let showDataTab = false;
	if (dataAnalysis && dataAnalysis.values && dataAnalysis.values.length > 0) {
		showDataTab = true;
		// Mapeo de iconos por unidad
		const unitIcons = {
			porcentaje: `<svg width="16" height="16" fill="none" stroke="#2196F3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="margin-right:6px;"><line x1="19" y1="5" x2="5" y2="19"></line><circle cx="7.5" cy="7.5" r="2.5"></circle><circle cx="16.5" cy="16.5" r="2.5"></circle></svg>`,
			numero: `<svg width="16" height="16" fill="none" stroke="#2196F3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="margin-right:6px;"><rect x="4" y="4" width="16" height="16" rx="4"></rect><text x="12" y="16" text-anchor="middle" font-size="10" fill="#2196F3" font-family="Arial" dy="-1">#</text></svg>`,
			moneda: `<svg width="16" height="16" fill="none" stroke="#2196F3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="margin-right:6px;"><circle cx="12" cy="12" r="10"></circle><text x="12" y="16" text-anchor="middle" font-size="10" fill="#2196F3" font-family="Arial" dy="-1">$</text></svg>`,
			cantidad: `<svg width="16" height="16" fill="none" stroke="#2196F3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="margin-right:6px;"><rect x="4" y="8" width="16" height="8" rx="2"></rect><circle cx="8" cy="12" r="1.5"></circle><circle cx="16" cy="12" r="1.5"></circle></svg>`,
			nivel: `<svg width="16" height="16" fill="none" stroke="#2196F3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="margin-right:6px;"><rect x="4" y="16" width="4" height="4"></rect><rect x="10" y="12" width="4" height="8"></rect><rect x="16" y="8" width="4" height="12"></rect></svg>`,
			otro: `<svg width="16" height="16" fill="none" stroke="#2196F3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="margin-right:6px;"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle></svg>`,
		};
		// Barras solo para porcentaje
		const percentValues = dataAnalysis.values.filter((v) => v.unit === 'porcentaje');
		// Tarjetas para los demás tipos
		const numberValues = dataAnalysis.values.filter((v) => v.unit !== 'porcentaje');
		// Barras horizontales para porcentajes
		let percentBars = '';
		if (percentValues.length > 0) {
			percentBars = `<div class="percent-bars" style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 16px;">
                ${percentValues
					.map(
						(bar) => `
                        <div class="percent-bar-row" style="display: flex; flex-direction: column; align-items: flex-start; width: 100%;">
                            <div class="percent-bar-label" style="font-size: 14px; margin-bottom: 4px; color: #333; display: flex; align-items: center;">${
								unitIcons[bar.unit] || unitIcons['otro']
							}${bar.label}</div>
                            <div class="percent-bar-track" style="background: #eee; border-radius: 6px; width: 100%; height: 18px; position: relative;">
                                <div class="percent-bar-fill" style="width: ${
									bar.value
								}%; background: linear-gradient(90deg, #2196F3 60%, #42a5f5 100%); height: 100%; border-radius: 6px;"></div>
                                <span class="percent-bar-value" style="position: absolute; right: 8px; top: 0; height: 100%; display: flex; align-items: center; font-size: 13px; color: #222; font-weight: 600;">${
									bar.value
								}%</span>
                            </div>
                        </div>
                    `
					)
					.join('')}
            </div>`;
		}
		// Stat-cards para valores numéricos y otros
		let numberStats = '';
		if (numberValues.length > 0) {
			numberStats = `<div class="stat-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 12px; margin-top: 8px;">
                ${numberValues
					.map(
						(bar) => `
                        <div class="stat-card" style="background: #f5f5f5; border-radius: 8px; padding: 14px 10px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
                            <div class="stat-value" style="font-size: 20px; font-weight: 700; color: #2196F3; display: flex; align-items: center;">${
								unitIcons[bar.unit] || unitIcons['otro']
							}${bar.value}</div>
                            <div class="stat-label" style="font-size: 13px; color: #555; margin-top: 2px; text-align: center;">${
								bar.label
							}</div>
                        </div>
                    `
					)
					.join('')}
            </div>`;
		}
		chartHtml = `
            <div class="chart-container" style="max-width: 100%; box-sizing: border-box;">
                <div class="chart-title" style="font-weight: 600; font-size: 15px; margin-bottom: 12px;">${
					dataAnalysis.explanation || ''
				}</div>
                ${percentBars}
                ${numberStats}
            </div>
        `;
	}

	content.innerHTML = `
		<div class="tab-container">
			<div class="tab-header">
				<div class="tab active" data-tab="resumen">Resumen</div>
				<div class="tab" data-tab="analisis">Análisis</div>
				${showDataTab ? '<div class="tab" data-tab="datos">Datos</div>' : ''}
				<div class="tab" data-tab="contexto">Contexto</div>
			</div>
			<div id="tab-resumen" class="tab-content active">
				<div class="card">
					<div class="section-title">
						<svg xmlns="http://www.w3.org/2000/svg" class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
						Resumen IA
					</div>
					<p style="line-height: 1.5; color: #333; font-size: 14px;">${neutralSummary}</p>
					<br>
					<p style="line-height: 1.5; color: #666; font-size: 14px;">Estilo de redacción: ${
						writingStyle || 'No disponible'
					}</p>
				</div>
				<div class="card">
					<div class="section-title">
						<svg xmlns="http://www.w3.org/2000/svg" class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h6"></path><path d="M22 12h-6"></path><path d="M12 2v2"></path><path d="M12 8v2"></path><path d="M12 14v2"></path><path d="M12 20v2"></path><circle cx="12" cy="12" r="10"></circle></svg>
						Análisis de sesgo
					</div>
					<div class="bias-scale-container">
						<div class="bias-scale">
							<div class="bias-marker" style="left: ${bias}%;"></div>
						</div>
						<div class="bias-labels">
							<span class="bias-label">Izquierda</span>
							<span class="bias-label">Centro</span>
							<span class="bias-label">Derecha</span>
						</div>
					</div>
					<p style="font-size: 13px;">${biasText}</p>
					${
						typeof biasConfidence === 'number'
							? `<p style='font-size:12px;color:#888;'>Confianza del análisis: ${(
									biasConfidence * 100
							  ).toFixed(0)}%</p>`
							: ''
					}
				</div>
				<div class="card">
					<div class="section-title toggle-section" data-target="keywords-content">
						<div style="display: flex; align-items: center;">
							<svg xmlns="http://www.w3.org/2000/svg" class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
							Palabras clave
						</div>
						<svg xmlns="http://www.w3.org/2000/svg" class="toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
					</div>
					<div id="keywords-content" class="collapsible-content open">
						<div class="keywords">
							${keywords.map((k) => `<span class="keyword-tag">#${k}</span>`).join('')}
						</div>
					</div>
				</div>
			</div>
			<div id="tab-analisis" class="tab-content">
				<div class="card">
					<div class="section-title">
						<svg xmlns="http://www.w3.org/2000/svg" class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h6"></path><path d="M22 12h-6"></path><path d="M12 2v2"></path><path d="M12 8v2"></path><path d="M12 14v2"></path><path d="M12 20v2"></path><circle cx="12" cy="12" r="10"></circle></svg>
						Análisis detallado
					</div>
					<p style="font-size: 13px; margin-bottom: 12px;">${actorAnalysis.explanation || ''}</p>
					${
						favoredActor
							? `<p style='font-size:13px;color:#444;'>Actor favorecido: <b>${favoredActor}</b></p>`
							: ''
					}
					<div class="stat-grid">
						<div class="stat-card">
							<div class="stat-value" data-tooltip="Indica la inclinación política del artículo. 0% es neutral, 100% es altamente sesgado.">${Math.round(
								politicalBiasScore * 100
							)}%</div>
							<div class="stat-label" data-tooltip="Indica la inclinación política del artículo. 0% es neutral, 100% es altamente sesgado.">Sesgo político</div>
						</div>
						<div class="stat-card">
							<div class="stat-value" data-tooltip="Indica el nivel de confianza del modelo en el análisis realizado. 100% significa máxima certeza en la evaluación.">
								${typeof actorConfidence === 'number' ? Math.round(actorConfidence * 100) : 'N/A'}%
							</div>
							<div class="stat-label" data-tooltip="Indica el nivel de confianza del modelo en el análisis realizado. 100% significa máxima certeza en la evaluación.">Confianza</div>
						</div>
						<div class="stat-card">
							<div class="stat-value" data-tooltip="Evalúa el grado de exageración o dramatismo en el artículo. 0% es nada sensacionalista, 100% es muy sensacionalista.">${Math.round(
								sensationalismScore * 100
							)}%</div>
							<div class="stat-label" data-tooltip="Evalúa el grado de exageración o dramatismo en el artículo. 0% es nada sensacionalista, 100% es muy sensacionalista.">Sensacionalismo</div>
						</div>
					</div>
				</div>
				${
					entities && entities.length > 0
						? `
				<div class="card">
					<div class="section-title">
						<svg xmlns="http://www.w3.org/2000/svg" class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"></path></svg>
						Entidades relevantes
					</div>
					<div class="entities-list">
						${entities
							.map(
								(e) =>
									`<div class="entity-item"><span class="entity-value">${e}</span></div>`
							)
							.join('')}
					</div>
				</div>
				`
						: ''
				}
				<div class="card">
					<div class="section-title toggle-section" data-target="glossary-content">
						<div style="display: flex; align-items: center;">
							<svg xmlns="http://www.w3.org/2000/svg" class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
							Glosario
						</div>
						<svg xmlns="http://www.w3.org/2000/svg" class="toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
					</div>
					<div id="glossary-content" class="collapsible-content">
						<div class="glossary-list">
							${glossary
								.map(
									(item) =>
										`<div class="glossary-item"><div class="glossary-term">${item.term}</div><div class="glossary-definition">${item.definition}</div></div>`
								)
								.join('')}
						</div>
					</div>
				</div>
				<div class="card">
					<div class="section-title" style="display:flex;align-items:center;gap:6px;">
						<svg xmlns="http://www.w3.org/2000/svg" class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
						Chequeo de hechos
						<span style="display:inline-flex;align-items:center;cursor:pointer;" data-tooltip="Aquí se informa si el artículo contiene errores fácticos, datos dudosos o afirmaciones no verificadas. Si no se detectan problemas, el artículo es considerado factual.">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2196F3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x="12" y="16" x2="12" y2="12"/><line x="12" y="8" x2="12.01" y2="8"/></svg>
						</span>
					</div>
					<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
						<div style="font-size:15px;font-weight:600;color:#2196F3;" data-tooltip="Mide cuán precisos y verificables son los hechos presentados. 100% es completamente factual.">
							${Math.round(factualityScore * 100)}% factualidad
						</div>
					</div>
					<p style="font-size: 13px;">${factCheck}</p>
				</div>
			</div>
			${
				showDataTab
					? `<div id="tab-datos" class="tab-content" style="height:80vh"><div class="card" style="max-width:100%; height:100%"><div class="section-title"><svg xmlns="http://www.w3.org/2000/svg" class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg> Análisis de datos</div>${chartHtml}</div></div>`
					: ''
			}
			<div id="tab-contexto" class="tab-content">
				<div class="card">
					<div class="section-title">
						<svg xmlns="http://www.w3.org/2000/svg" class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
						Contexto adicional
					</div>
					<p>${contextInfo}</p>
				</div>
				<!-- Tarjeta de personas relevantes -->
				${
					Array.isArray(personEntities) && personEntities.length > 0
						? `
				<div class="card">
					<div class="section-title">
						<svg xmlns="http://www.w3.org/2000/svg" class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"></path></svg>
						Personas relevantes
					</div>
					<div class="entities-list">
						${personEntities
							.map(
								(p) => `
                <div class="entity-item">
                    <span class="entity-value" style="font-weight:600;">${p.nombre}</span>
                    <span class="entity-desc" style="color:#666;font-size:13px;">${p.descripcion}</span>
                </div>
            `
							)
							.join('')}
					</div>
				</div>
				`
						: ''
				}
			</div>
		</div>
	`;

	// Reaplicar listeners de tabs, collapsibles, keywords y botones de acción
	setTimeout(() => {
		document.querySelectorAll('.tab').forEach((tab) => {
			tab.addEventListener('click', function () {
				document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
				document
					.querySelectorAll('.tab-content')
					.forEach((c) => c.classList.remove('active'));
				this.classList.add('active');
				document.getElementById('tab-' + this.dataset.tab).classList.add('active');
			});
		});
		document.querySelectorAll('.toggle-section').forEach((toggle) => {
			toggle.addEventListener('click', function () {
				const targetId = this.dataset.target;
				const target = document.getElementById(targetId);
				const icon = this.querySelector('.toggle-icon');
				if (target.classList.contains('open')) {
					target.classList.remove('open');
					icon.classList.remove('open');
				} else {
					target.classList.add('open');
					icon.classList.add('open');
				}
			});
		});
		document.querySelectorAll('.keyword-tag').forEach((tag) => {
			tag.addEventListener('click', function () {
				const keyword = this.textContent.trim();
				alert(`Buscando noticias relacionadas con: ${keyword}`);
			});
		});
		document.getElementById('source-btn')?.addEventListener('click', () => {
			window.open(url, '_blank');
		});
		document.getElementById('share-btn')?.addEventListener('click', () => {
			alert('Compartiendo el análisis de esta noticia');
		});
		document.getElementById('feedback-btn')?.addEventListener('click', () => {
			alert('Enviando feedback sobre este análisis');
		});
		enableCustomTooltips();
	}, 0);
}

// Botón principal
const analyzeBtn = document.getElementById('analyze-btn');
if (analyzeBtn) {
	analyzeBtn.addEventListener('click', function () {
		console.log('ContraPunto: Analyzing article...'); // DEBUG
		analyzeArticle();
	});
}

// Simulación de configuración
const settingsBtn = document.querySelector('.settings-button');
if (settingsBtn) {
	settingsBtn.addEventListener('click', function () {
		alert('Abriendo configuración de ContraPunto');
	});
}

// Mejora de tooltips: se muestran como popover personalizados al hacer hover
function enableCustomTooltips() {
	const tooltipElements = document.querySelectorAll('[data-tooltip]');
	tooltipElements.forEach((el) => {
		let tooltipDiv;
		el.addEventListener('mouseenter', function (e) {
			tooltipDiv = document.createElement('div');
			tooltipDiv.textContent = el.getAttribute('data-tooltip');
			tooltipDiv.style.position = 'fixed';
			tooltipDiv.style.background = '#222';
			tooltipDiv.style.color = '#fff';
			tooltipDiv.style.padding = '6px 10px';
			tooltipDiv.style.borderRadius = '6px';
			tooltipDiv.style.fontSize = '13px';
			tooltipDiv.style.zIndex = 9999;
			tooltipDiv.style.pointerEvents = 'none';
			document.body.appendChild(tooltipDiv);
			const rect = el.getBoundingClientRect();
			tooltipDiv.style.top = rect.top - tooltipDiv.offsetHeight - 8 + 'px';
			tooltipDiv.style.left = rect.left + rect.width / 2 - tooltipDiv.offsetWidth / 2 + 'px';

			// Ajuste para tooltips: si el sidebar es un iframe, mover el tooltip al iframe o ajustar posición
			const sidebarIframe = document.getElementById('contrapunto-sidebar-iframe');
			if (sidebarIframe) {
				// Si estamos en el contexto del iframe, no hacer nada especial
				// Si estamos en el contexto de la página principal, mover el tooltip al iframe
				// Pero como el script corre dentro del iframe, solo aseguramos z-index alto y posición fixed
				tooltipDiv.style.zIndex = 2147483647;
			}
			// Mejorar posición: si el tooltip se sale por la derecha o izquierda, ajustarlo
			const vw = window.innerWidth;
			const rectTooltip = tooltipDiv.getBoundingClientRect();
			if (rectTooltip.left < 0) {
				tooltipDiv.style.left = '8px';
			}
			if (rectTooltip.right > vw) {
				tooltipDiv.style.left = vw - rectTooltip.width - 8 + 'px';
			}
		});
		el.addEventListener('mouseleave', function () {
			if (tooltipDiv) tooltipDiv.remove();
		});
	});
}

// Recibe mensajes del content script
window.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'CONTRAPUNTO_ANALYZE') {
		analyzeArticle();
	}
});

// Lógica para agrandar/reducir el sidebar (migrada desde sidebar.html por CSP)
document.addEventListener('DOMContentLoaded', function () {
	const resizeBtn = document.getElementById('resize-btn');
	const sidebarContainer = document.querySelector('.sidebar-container');
	let expanded = false;
	if (resizeBtn && sidebarContainer) {
		resizeBtn.addEventListener('click', function () {
			expanded = !expanded;
			if (expanded) {
				sidebarContainer.style.width = '500px';
				resizeBtn.querySelector('#resize-btn-label').textContent = 'Reducir';
			} else {
				sidebarContainer.style.width = '';
				resizeBtn.querySelector('#resize-btn-label').textContent = 'Agrandar';
			}
		});
	}
});
