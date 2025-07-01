// content.js para ContraPunto Chrome Extension

// Escucha mensajes del background para obtener info de la página
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === 'CONTRAPUNTO_GET_PAGE_INFO') {
		// Devuelve el HTML y la URL de la página actual
		sendResponse({
			html: document.documentElement.outerHTML,
			url: window.location.href,
		});
	}
});

// Inyecta el sidebar al hacer clic en el icono de la extensión
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === 'CONTRAPUNTO_TOGGLE_SIDEBAR') {
		if (document.getElementById('contrapunto-sidebar-iframe')) {
			document.getElementById('contrapunto-sidebar-iframe').remove();
			return;
		}
		const iframe = document.createElement('iframe');
		iframe.id = 'contrapunto-sidebar-iframe';
		iframe.src = chrome.runtime.getURL('sidebar.html');
		iframe.style.position = 'fixed';
		iframe.style.top = '0';
		iframe.style.right = '0';
		iframe.style.width = '400px';
		iframe.style.height = '100vh';
		iframe.style.zIndex = '999999';
		iframe.style.border = 'none';
		iframe.style.boxShadow = '0 0 16px rgba(0,0,0,0.2)';
		document.body.appendChild(iframe);
	}
});
