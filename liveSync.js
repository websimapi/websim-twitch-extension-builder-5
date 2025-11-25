// Simple live-sync client that pushes the current project views
// to the local Node.js server over a WebSocket connection.

let socket = null;
let syncInterval = null;
let reconnectTimeout = null;

export function setupLiveSync({ getViewsSnapshot, onStatusChange }) {
    function setStatus(state) {
        if (typeof onStatusChange === 'function') {
            onStatusChange(state);
        }
    }

    function clearSync() {
        if (syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
        }
    }

    function scheduleReconnect() {
        clearSync();
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(() => {
            connect();
        }, 3000);
    }

    function connect() {
        // Only attempt to connect to localhost; if blocked, we just no-op.
        const isHttps = window.location.protocol === 'https:';
        const protocol = isHttps ? 'wss' : 'ws';
        const host = 'localhost:8080';
        const url = `${protocol}://${host}/live`;

        try {
            setStatus('connecting');
            socket = new WebSocket(url);

            socket.addEventListener('open', () => {
                console.log('[LiveSync] Connected to', url);
                setStatus('connected');

                // Send an immediate snapshot on connect
                try {
                    const views = getViewsSnapshot();
                    socket.send(JSON.stringify({ type: 'syncProject', views }));
                } catch (e) {
                    console.error('[LiveSync] Error sending initial views', e);
                }

                // Start periodic sync
                clearSync();
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
                setStatus('disconnected');
                clearSync();
                scheduleReconnect();
            });

            socket.addEventListener('error', (err) => {
                console.error('[LiveSync] WebSocket error', err);
                setStatus('error');
                try {
                    socket.close();
                } catch (_) {}
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
            setStatus('error');
            scheduleReconnect();
        }
    }

    connect();
}