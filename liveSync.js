// Simple live-sync client that pushes the current project views
// to the local Node.js server over a WebSocket connection.

let socket = null;
let syncInterval = null;

export function setupLiveSync({ getViewsSnapshot }) {
    // Only attempt to connect to localhost; if blocked, we just no-op.
    const protocol = 'wss://';
    const host = 'localhost:8080';
    const url = `${protocol}${host}/live`;

    try {
        socket = new WebSocket(url);

        socket.addEventListener('open', () => {
            console.log('[LiveSync] Connected to', url);
            // Start periodic sync
            if (syncInterval) clearInterval(syncInterval);
            syncInterval = setInterval(() => {
                if (socket && socket.readyState === WebSocket.OPEN) {
                    try {
                        const views = getViewsSnapshot();
                        socket.send(JSON.stringify({ type: 'syncProject', views }));
                    } catch (e) {
                        console.error('[LiveSync] Error collecting/sending views', e);
                    }
                }
            }, 2000); // every 2 seconds
        });

        socket.addEventListener('close', () => {
            console.log('[LiveSync] Disconnected from server');
            if (syncInterval) {
                clearInterval(syncInterval);
                syncInterval = null;
            }
        });

        socket.addEventListener('error', (err) => {
            console.error('[LiveSync] WebSocket error', err);
        });

        socket.addEventListener('message', (event) => {
            // Reserved for future use (e.g., server->client notifications)
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'fileUpdated') {
                    console.log('[LiveSync] File updated on server:', data.path);
                }
            } catch {
                // ignore non-JSON messages
            }
        });
    } catch (e) {
        console.error('[LiveSync] Failed to connect', e);
    }
}