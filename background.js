// background.js para ContraPunto Chrome Extension

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === 'CONTRAPUNTO_GET_PAGE_INFO') {
		// Reenvía el mensaje al content script de la pestaña activa
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			if (tabs.length === 0) {
				sendResponse({ error: 'No active tab found' });
				return;
			}
			chrome.tabs.sendMessage(
				tabs[0].id,
				{ type: 'CONTRAPUNTO_GET_PAGE_INFO' },
				(response) => {
					sendResponse(response);
				}
			);
		});
		// Indica que la respuesta será asíncrona
		return true;
	}
});

// Al hacer clic en el icono, inyecta o quita el sidebar en la pestaña activa
chrome.action.onClicked.addListener((tab) => {
	chrome.tabs.sendMessage(tab.id, { type: 'CONTRAPUNTO_TOGGLE_SIDEBAR' });
});
